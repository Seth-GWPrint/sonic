import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { gwPricingPool } from "@/app/lib/gwBuilderPricingDB";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RULE_TYPES = [
  "base_price",
  "quantity_discount",
  "option_modifier",
] as const;

const PRICE_OPERATIONS = [
  "set_unit_price",
  "multiply_unit_price",
] as const;

type RuleType = (typeof RULE_TYPES)[number];
type PriceOperation = (typeof PRICE_OPERATIONS)[number];

type PricingRuleData = {
  rule_code: string;
  rule_name: string;
  rule_type: RuleType;
  envelope_type: string | null;
  envelope_size: string | null;
  option_name: string | null;
  option_value: string | null;
  minimum_quantity: number | null;
  maximum_quantity: number | null;
  price_operation: PriceOperation;
  price_value: number;
  priority: number;
  is_active: number;
  effective_from: string | null;
  effective_until: string | null;
};

type PricingRuleRow = RowDataPacket &
  PricingRuleData & {
    id: number;
    created_at: string;
    updated_at: string;
  };

type MysqlError = Error & {
  code?: string;
  errno?: number;
  sqlMessage?: string;
};

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const PRICING_RULE_SELECT = `
  SELECT
    id,
    rule_code,
    rule_name,
    rule_type,
    envelope_type,
    envelope_size,
    option_name,
    option_value,
    minimum_quantity,
    maximum_quantity,
    price_operation,
    price_value,
    priority,
    is_active,
    DATE_FORMAT(
      effective_from,
      '%Y-%m-%d %H:%i:%s'
    ) AS effective_from,
    DATE_FORMAT(
      effective_until,
      '%Y-%m-%d %H:%i:%s'
    ) AS effective_until,
    DATE_FORMAT(
      created_at,
      '%Y-%m-%d %H:%i:%s'
    ) AS created_at,
    DATE_FORMAT(
      updated_at,
      '%Y-%m-%d %H:%i:%s'
    ) AS updated_at
  FROM envelope_pricing_rules
`;

function hasOwn(
  object: Record<string, unknown>,
  property: string
): boolean {
  return Object.prototype.hasOwnProperty.call(object, property);
}

async function readJsonObject(
  request: NextRequest
): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must contain valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}

function parseRequiredString(
  value: unknown,
  fieldName: string
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  return value.trim();
}

function parseNullableString(
  value: unknown,
  fieldName: string
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const trimmedValue = value.trim();

  return trimmedValue || null;
}

function parseEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  if (
    typeof value !== "string" ||
    !allowedValues.includes(value as T)
  ) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}.`
    );
  }

  return value as T;
}

function parsePositiveNumber(
  value: unknown,
  fieldName: string
): number {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError(`${fieldName} is required.`);
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new ValidationError(
      `${fieldName} must be a number greater than zero.`
    );
  }

  return numberValue;
}

function parseInteger(
  value: unknown,
  fieldName: string,
  minimum = 0
): number {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError(`${fieldName} is required.`);
  }

  const numberValue = Number(value);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < minimum
  ) {
    throw new ValidationError(
      `${fieldName} must be an integer greater than or equal to ${minimum}.`
    );
  }

  return numberValue;
}

function parseNullableInteger(
  value: unknown,
  fieldName: string
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return parseInteger(value, fieldName, 0);
}

function parseActiveValue(value: unknown): number {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return 1;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return 0;
  }

  throw new ValidationError(
    "is_active must be true, false, 1, or 0."
  );
}

function parseNullableDateTime(
  value: unknown,
  fieldName: string
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(
      `${fieldName} must be a valid date string or null.`
    );
  }

  const trimmedValue = value.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return `${trimmedValue} 00:00:00`;
  }

  // YYYY-MM-DD HH:mm, YYYY-MM-DDTHH:mm,
  // or versions that include seconds.
  const localDateMatch = trimmedValue.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (localDateMatch) {
    const [, date, hour, minute, second = "00"] =
      localDateMatch;

    return `${date} ${hour}:${minute}:${second}`;
  }

  // Supports full ISO date strings.
  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new ValidationError(
      `${fieldName} must be a valid date string or null.`
    );
  }

  return parsedDate
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function validateCompleteRule(rule: PricingRuleData): void {
  if (
    rule.minimum_quantity !== null &&
    rule.maximum_quantity !== null &&
    rule.maximum_quantity < rule.minimum_quantity
  ) {
    throw new ValidationError(
      "maximum_quantity cannot be less than minimum_quantity."
    );
  }

  if (rule.rule_type === "base_price") {
    if (rule.price_operation !== "set_unit_price") {
      throw new ValidationError(
        "Base-price rules must use set_unit_price."
      );
    }
  }

  if (rule.rule_type === "quantity_discount") {
    if (!rule.envelope_size) {
      throw new ValidationError(
        "Quantity-discount rules require envelope_size."
      );
    }

    if (rule.minimum_quantity === null) {
      throw new ValidationError(
        "Quantity-discount rules require minimum_quantity."
      );
    }

    if (rule.price_operation !== "multiply_unit_price") {
      throw new ValidationError(
        "Quantity-discount rules must use multiply_unit_price."
      );
    }
  }

  if (rule.rule_type === "option_modifier") {
    if (!rule.option_name || !rule.option_value) {
      throw new ValidationError(
        "Option-modifier rules require option_name and option_value."
      );
    }

    if (rule.price_operation !== "multiply_unit_price") {
      throw new ValidationError(
        "Option-modifier rules must use multiply_unit_price."
      );
    }
  }

  if (
    rule.effective_from &&
    rule.effective_until &&
    rule.effective_until <= rule.effective_from
  ) {
    throw new ValidationError(
      "effective_until must be later than effective_from."
    );
  }

  /*
   * BASE_DEFAULT is required as the fallback price.
   * Prevent it from being converted into a different kind of rule.
   */
  if (rule.rule_code === "BASE_DEFAULT") {
    if (
      rule.rule_type !== "base_price" ||
      rule.price_operation !== "set_unit_price" ||
      rule.envelope_type !== null ||
      rule.envelope_size !== null ||
      rule.is_active !== 1
    ) {
      throw new ValidationError(
        "BASE_DEFAULT must remain an active, unrestricted base-price rule."
      );
    }
  }
}

function normalizeCreateBody(
  body: Record<string, unknown>
): PricingRuleData {
  const ruleType = parseEnum(
    body.rule_type,
    "rule_type",
    RULE_TYPES
  );

  const defaultOperation: PriceOperation =
    ruleType === "base_price"
      ? "set_unit_price"
      : "multiply_unit_price";

  const rule: PricingRuleData = {
    rule_code: parseRequiredString(
      body.rule_code,
      "rule_code"
    ),
    rule_name: parseRequiredString(
      body.rule_name,
      "rule_name"
    ),
    rule_type: ruleType,
    envelope_type: parseNullableString(
      body.envelope_type,
      "envelope_type"
    ),
    envelope_size: parseNullableString(
      body.envelope_size,
      "envelope_size"
    ),
    option_name: parseNullableString(
      body.option_name,
      "option_name"
    ),
    option_value: parseNullableString(
      body.option_value,
      "option_value"
    ),
    minimum_quantity: parseNullableInteger(
      body.minimum_quantity,
      "minimum_quantity"
    ),
    maximum_quantity: parseNullableInteger(
      body.maximum_quantity,
      "maximum_quantity"
    ),
    price_operation:
      body.price_operation === undefined
        ? defaultOperation
        : parseEnum(
            body.price_operation,
            "price_operation",
            PRICE_OPERATIONS
          ),
    price_value: parsePositiveNumber(
      body.price_value,
      "price_value"
    ),
    priority:
      body.priority === undefined
        ? 100
        : parseInteger(body.priority, "priority", 0),
    is_active:
      body.is_active === undefined
        ? 1
        : parseActiveValue(body.is_active),
    effective_from: parseNullableDateTime(
      body.effective_from,
      "effective_from"
    ),
    effective_until: parseNullableDateTime(
      body.effective_until,
      "effective_until"
    ),
  };

  validateCompleteRule(rule);

  return rule;
}

function normalizePatchBody(
  body: Record<string, unknown>
): Partial<PricingRuleData> {
  const patch: Partial<PricingRuleData> = {};

  if (hasOwn(body, "rule_code")) {
    patch.rule_code = parseRequiredString(
      body.rule_code,
      "rule_code"
    );
  }

  if (hasOwn(body, "rule_name")) {
    patch.rule_name = parseRequiredString(
      body.rule_name,
      "rule_name"
    );
  }

  if (hasOwn(body, "rule_type")) {
    patch.rule_type = parseEnum(
      body.rule_type,
      "rule_type",
      RULE_TYPES
    );
  }

  if (hasOwn(body, "envelope_type")) {
    patch.envelope_type = parseNullableString(
      body.envelope_type,
      "envelope_type"
    );
  }

  if (hasOwn(body, "envelope_size")) {
    patch.envelope_size = parseNullableString(
      body.envelope_size,
      "envelope_size"
    );
  }

  if (hasOwn(body, "option_name")) {
    patch.option_name = parseNullableString(
      body.option_name,
      "option_name"
    );
  }

  if (hasOwn(body, "option_value")) {
    patch.option_value = parseNullableString(
      body.option_value,
      "option_value"
    );
  }

  if (hasOwn(body, "minimum_quantity")) {
    patch.minimum_quantity = parseNullableInteger(
      body.minimum_quantity,
      "minimum_quantity"
    );
  }

  if (hasOwn(body, "maximum_quantity")) {
    patch.maximum_quantity = parseNullableInteger(
      body.maximum_quantity,
      "maximum_quantity"
    );
  }

  if (hasOwn(body, "price_operation")) {
    patch.price_operation = parseEnum(
      body.price_operation,
      "price_operation",
      PRICE_OPERATIONS
    );
  }

  if (hasOwn(body, "price_value")) {
    patch.price_value = parsePositiveNumber(
      body.price_value,
      "price_value"
    );
  }

  if (hasOwn(body, "priority")) {
    patch.priority = parseInteger(
      body.priority,
      "priority",
      0
    );
  }

  if (hasOwn(body, "is_active")) {
    patch.is_active = parseActiveValue(body.is_active);
  }

  if (hasOwn(body, "effective_from")) {
    patch.effective_from = parseNullableDateTime(
      body.effective_from,
      "effective_from"
    );
  }

  if (hasOwn(body, "effective_until")) {
    patch.effective_until = parseNullableDateTime(
      body.effective_until,
      "effective_until"
    );
  }

  return patch;
}

async function getPricingRuleById(
  id: number
): Promise<PricingRuleRow | null> {
  const [rows] = await gwPricingPool.execute<PricingRuleRow[]>(
    `
      ${PRICING_RULE_SELECT}
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

function handleRouteError(
  error: unknown,
  operation: string
): NextResponse {
  console.error(
    `Envelope pricing ${operation} failed:`,
    error
  );

  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }

  const mysqlError = error as MysqlError;

  if (mysqlError.code === "ER_DUP_ENTRY") {
    return NextResponse.json(
      {
        success: false,
        error:
          "A pricing rule with that rule_code already exists.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: `Failed to ${operation} envelope pricing rule.`,
    },
    { status: 500 }
  );
}

/**
 * GET /api/sonic/envelope-pricing
 *
 * Optional query parameters:
 * activeOnly=true
 * ruleType=base_price
 */
export async function GET(request: NextRequest) {
  try {
    const activeOnly =
      request.nextUrl.searchParams.get("activeOnly") ===
      "true";

    const ruleTypeValue =
      request.nextUrl.searchParams.get("ruleType");

    const conditions: string[] = [];
    const parameters: Array<string | number> = [];

    if (activeOnly) {
      conditions.push("is_active = 1");
    }

    if (ruleTypeValue) {
      const ruleType = parseEnum(
        ruleTypeValue,
        "ruleType",
        RULE_TYPES
      );

      conditions.push("rule_type = ?");
      parameters.push(ruleType);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [rows] =
      await gwPricingPool.execute<PricingRuleRow[]>(
        `
          ${PRICING_RULE_SELECT}
          ${whereClause}
          ORDER BY
            CASE rule_type
              WHEN 'base_price' THEN 1
              WHEN 'quantity_discount' THEN 2
              WHEN 'option_modifier' THEN 3
              ELSE 4
            END,
            priority ASC,
            envelope_size ASC,
            minimum_quantity ASC,
            id ASC
        `,
        parameters
      );

    return NextResponse.json({
      success: true,
      pricingRules: rows,
    });
  } catch (error) {
    return handleRouteError(error, "load");
  }
}

/**
 * POST /api/sonic/envelope-pricing
 *
 * Creates a new pricing rule.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    const rule = normalizeCreateBody(body);

    const [result] =
      await gwPricingPool.execute<ResultSetHeader>(
        `
          INSERT INTO envelope_pricing_rules (
            rule_code,
            rule_name,
            rule_type,
            envelope_type,
            envelope_size,
            option_name,
            option_value,
            minimum_quantity,
            maximum_quantity,
            price_operation,
            price_value,
            priority,
            is_active,
            effective_from,
            effective_until
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          rule.rule_code,
          rule.rule_name,
          rule.rule_type,
          rule.envelope_type,
          rule.envelope_size,
          rule.option_name,
          rule.option_value,
          rule.minimum_quantity,
          rule.maximum_quantity,
          rule.price_operation,
          rule.price_value,
          rule.priority,
          rule.is_active,
          rule.effective_from,
          rule.effective_until,
        ]
      );

    const createdRule = await getPricingRuleById(
      result.insertId
    );

    return NextResponse.json(
      {
        success: true,
        message: "Envelope pricing rule created.",
        pricingRule: createdRule,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, "create");
  }
}

/**
 * PATCH /api/sonic/envelope-pricing
 *
 * Body must include:
 * {
 *   "id": 1,
 *   "price_value": 1.05
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    const id = parseInteger(body.id, "id", 1);

    const existingRule = await getPricingRuleById(id);

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: "Envelope pricing rule not found.",
        },
        { status: 404 }
      );
    }

    const patch = normalizePatchBody(body);
    const patchEntries = Object.entries(patch) as Array<
      [
        keyof PricingRuleData,
        PricingRuleData[keyof PricingRuleData]
      ]
    >;

    if (patchEntries.length === 0) {
      throw new ValidationError(
        "No pricing-rule fields were provided to update."
      );
    }

    const candidateRule: PricingRuleData = {
      ...existingRule,
      ...patch,
    };

    validateCompleteRule(candidateRule);

    const columnNames: Record<
      keyof PricingRuleData,
      string
    > = {
      rule_code: "rule_code",
      rule_name: "rule_name",
      rule_type: "rule_type",
      envelope_type: "envelope_type",
      envelope_size: "envelope_size",
      option_name: "option_name",
      option_value: "option_value",
      minimum_quantity: "minimum_quantity",
      maximum_quantity: "maximum_quantity",
      price_operation: "price_operation",
      price_value: "price_value",
      priority: "priority",
      is_active: "is_active",
      effective_from: "effective_from",
      effective_until: "effective_until",
    };

    const setClause = patchEntries
      .map(([field]) => `${columnNames[field]} = ?`)
      .join(", ");

    const parameters: Array<string | number | null> =
      patchEntries.map(([, value]) => value);

    const [result] =
      await gwPricingPool.execute<ResultSetHeader>(
        `
          UPDATE envelope_pricing_rules
          SET ${setClause}
          WHERE id = ?
        `,
        [...parameters, id]
      );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Envelope pricing rule was not updated.",
        },
        { status: 404 }
      );
    }

    const updatedRule = await getPricingRuleById(id);

    return NextResponse.json({
      success: true,
      message: "Envelope pricing rule updated.",
      pricingRule: updatedRule,
    });
  } catch (error) {
    return handleRouteError(error, "update");
  }
}

/**
 * DELETE /api/sonic/envelope-pricing?id=12
 */
export async function DELETE(request: NextRequest) {
  try {
    const id = parseInteger(
      request.nextUrl.searchParams.get("id"),
      "id",
      1
    );

    const existingRule = await getPricingRuleById(id);

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: "Envelope pricing rule not found.",
        },
        { status: 404 }
      );
    }

    if (existingRule.rule_code === "BASE_DEFAULT") {
      throw new ValidationError(
        "BASE_DEFAULT cannot be deleted because it is the fallback envelope price."
      );
    }

    const [result] =
      await gwPricingPool.execute<ResultSetHeader>(
        `
          DELETE FROM envelope_pricing_rules
          WHERE id = ?
        `,
        [id]
      );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Envelope pricing rule was not deleted.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Envelope pricing rule deleted.",
      deletedPricingRule: existingRule,
    });
  } catch (error) {
    return handleRouteError(error, "delete");
  }
}