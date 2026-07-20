"use client";

import { useState } from "react";

const PRICING_API_URL = "/api/gwbuilder/envelope-pricing";

type RuleType =
  | "base_price"
  | "quantity_discount"
  | "option_modifier";

type PriceOperation =
  | "set_unit_price"
  | "multiply_unit_price";

type ApiPricingRule = {
  id: number;
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
  price_value: number | string;
  priority: number | string;
  is_active: number | boolean;
  effective_from: string | null;
  effective_until: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EditablePricingRule = {
  clientKey: string;
  originalId: number | null;
  id: number | null;

  rule_code: string;
  rule_name: string;
  rule_type: RuleType;

  envelope_type: string;
  envelope_size: string;

  option_name: string;
  option_value: string;

  minimum_quantity: string;
  maximum_quantity: string;

  price_operation: PriceOperation;
  price_value: string;
  priority: string;
  is_active: boolean;

  effective_from: string;
  effective_until: string;

  created_at: string | null;
  updated_at: string | null;
};

type PricingRulePayload = {
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
  is_active: boolean;
  effective_from: string | null;
  effective_until: string | null;
};

function formatDateForInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(" ", "T").slice(0, 16);
}

function formatUpdatedDate(value: string | null) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value.replace(" ", "T"));

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

function createClientKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function convertApiRuleToEditable(
  rule: ApiPricingRule
): EditablePricingRule {
  const id = Number(rule.id);

  return {
    clientKey: `existing-${id}`,
    originalId: id,
    id,

    rule_code: rule.rule_code ?? "",
    rule_name: rule.rule_name ?? "",
    rule_type: rule.rule_type,

    envelope_type: rule.envelope_type ?? "",
    envelope_size: rule.envelope_size ?? "",

    option_name: rule.option_name ?? "",
    option_value: rule.option_value ?? "",

    minimum_quantity:
      rule.minimum_quantity === null ||
      rule.minimum_quantity === undefined
        ? ""
        : String(rule.minimum_quantity),

    maximum_quantity:
      rule.maximum_quantity === null ||
      rule.maximum_quantity === undefined
        ? ""
        : String(rule.maximum_quantity),

    price_operation: rule.price_operation,
    price_value: String(rule.price_value ?? ""),
    priority: String(rule.priority ?? 100),

    is_active:
      rule.is_active === true ||
      Number(rule.is_active) === 1,

    effective_from: formatDateForInput(
      rule.effective_from
    ),
    effective_until: formatDateForInput(
      rule.effective_until
    ),

    created_at: rule.created_at ?? null,
    updated_at: rule.updated_at ?? null,
  };
}

function getRulePayload(
  rule: EditablePricingRule
): PricingRulePayload {
  return {
    rule_code: rule.rule_code.trim(),
    rule_name: rule.rule_name.trim(),
    rule_type: rule.rule_type,

    envelope_type: rule.envelope_type.trim() || null,
    envelope_size: rule.envelope_size.trim() || null,

    option_name: rule.option_name.trim() || null,
    option_value: rule.option_value.trim() || null,

    minimum_quantity:
      rule.minimum_quantity.trim() === ""
        ? null
        : Number(rule.minimum_quantity),

    maximum_quantity:
      rule.maximum_quantity.trim() === ""
        ? null
        : Number(rule.maximum_quantity),

    price_operation: rule.price_operation,
    price_value: Number(rule.price_value),
    priority: Number(rule.priority),
    is_active: rule.is_active,

    effective_from: rule.effective_from || null,
    effective_until: rule.effective_until || null,
  };
}

function rulesAreEqual(
  currentRule: EditablePricingRule,
  originalRule: EditablePricingRule
) {
  return (
    JSON.stringify(getRulePayload(currentRule)) ===
    JSON.stringify(getRulePayload(originalRule))
  );
}

async function readApiResponse(response: Response) {
  const rawText = await response.text();

  let data: any;

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(
      rawText || "Server returned a non-JSON response."
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || "The pricing request failed."
    );
  }

  return data;
}

async function fetchPricingRules() {
  const response = await fetch(PRICING_API_URL, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  const data = await readApiResponse(response);

  if (!Array.isArray(data.pricingRules)) {
    return [];
  }

  return data.pricingRules.map(
    (rule: ApiPricingRule) =>
      convertApiRuleToEditable(rule)
  );
}

function validatePricingRules(
  rules: EditablePricingRule[]
): string | null {
  const invalidCodeRule = rules.find(
    (rule) => !rule.rule_code.trim()
  );

  if (invalidCodeRule) {
    return "Every pricing rule needs a rule code.";
  }

  const duplicateCodeRule = rules.find(
    (rule, index) =>
      rules.findIndex(
        (otherRule) =>
          otherRule.rule_code.trim().toLowerCase() ===
          rule.rule_code.trim().toLowerCase()
      ) !== index
  );

  if (duplicateCodeRule) {
    return `Rule code "${duplicateCodeRule.rule_code}" is being used more than once.`;
  }

  const invalidNameRule = rules.find(
    (rule) => !rule.rule_name.trim()
  );

  if (invalidNameRule) {
    return "Every pricing rule needs a rule name.";
  }

  const invalidPriceRule = rules.find((rule) => {
    const priceValue = Number(rule.price_value);

    return (
      rule.price_value.trim() === "" ||
      !Number.isFinite(priceValue) ||
      priceValue <= 0
    );
  });

  if (invalidPriceRule) {
    return `${invalidPriceRule.rule_name} needs a price value greater than zero.`;
  }

  const invalidPriorityRule = rules.find((rule) => {
    const priority = Number(rule.priority);

    return (
      rule.priority.trim() === "" ||
      !Number.isInteger(priority) ||
      priority < 0
    );
  });

  if (invalidPriorityRule) {
    return `${invalidPriorityRule.rule_name} needs a priority of zero or greater.`;
  }

  for (const rule of rules) {
    const minimumQuantity =
      rule.minimum_quantity.trim() === ""
        ? null
        : Number(rule.minimum_quantity);

    const maximumQuantity =
      rule.maximum_quantity.trim() === ""
        ? null
        : Number(rule.maximum_quantity);

    if (
      minimumQuantity !== null &&
      (!Number.isInteger(minimumQuantity) ||
        minimumQuantity < 0)
    ) {
      return `${rule.rule_name} has an invalid minimum quantity.`;
    }

    if (
      maximumQuantity !== null &&
      (!Number.isInteger(maximumQuantity) ||
        maximumQuantity < 0)
    ) {
      return `${rule.rule_name} has an invalid maximum quantity.`;
    }

    if (
      minimumQuantity !== null &&
      maximumQuantity !== null &&
      maximumQuantity < minimumQuantity
    ) {
      return `${rule.rule_name} cannot have a maximum quantity below its minimum quantity.`;
    }

    if (rule.rule_type === "base_price") {
      if (
        rule.price_operation !== "set_unit_price"
      ) {
        return `${rule.rule_name} must use "Set Unit Price" because it is a base-price rule.`;
      }
    }

    if (
      rule.rule_type === "quantity_discount"
    ) {
      if (!rule.envelope_size.trim()) {
        return `${rule.rule_name} needs an envelope size.`;
      }

      if (minimumQuantity === null) {
        return `${rule.rule_name} needs a minimum quantity.`;
      }

      if (
        rule.price_operation !==
        "multiply_unit_price"
      ) {
        return `${rule.rule_name} must use "Multiply Unit Price" because it is a quantity-discount rule.`;
      }
    }

    if (rule.rule_type === "option_modifier") {
      if (!rule.option_name.trim()) {
        return `${rule.rule_name} needs an option name.`;
      }

      if (!rule.option_value.trim()) {
        return `${rule.rule_name} needs an option value.`;
      }

      if (
        rule.price_operation !==
        "multiply_unit_price"
      ) {
        return `${rule.rule_name} must use "Multiply Unit Price" because it is an option-modifier rule.`;
      }
    }

    if (
      rule.effective_from &&
      rule.effective_until &&
      new Date(rule.effective_until).getTime() <=
        new Date(rule.effective_from).getTime()
    ) {
      return `${rule.rule_name} must have an ending date later than its starting date.`;
    }
  }

  const defaultRule = rules.find(
    (rule) => rule.rule_code === "BASE_DEFAULT"
  );

  if (!defaultRule) {
    return "BASE_DEFAULT is required and cannot be removed.";
  }

  if (
    defaultRule.rule_type !== "base_price" ||
    defaultRule.price_operation !==
      "set_unit_price" ||
    defaultRule.envelope_type.trim() ||
    defaultRule.envelope_size.trim() ||
    !defaultRule.is_active
  ) {
    return "BASE_DEFAULT must remain an active, unrestricted base-price rule.";
  }

  return null;
}

export default function PricingSettings() {
  const [isPricingOpen, setIsPricingOpen] =
    useState(false);

  const [pricingRules, setPricingRules] = useState<
    EditablePricingRule[]
  >([]);

  const [originalPricingRules, setOriginalPricingRules] =
    useState<EditablePricingRule[]>([]);

  const [deletedRuleIds, setDeletedRuleIds] =
    useState<number[]>([]);

  const [isLoadingPricing, setIsLoadingPricing] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const handleOpenPricing = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setDeletedRuleIds([]);
    setIsPricingOpen(true);
    setIsLoadingPricing(true);

    try {
      const loadedRules = await fetchPricingRules();

      setPricingRules(loadedRules);
      setOriginalPricingRules(loadedRules);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading pricing rules."
      );
    } finally {
      setIsLoadingPricing(false);
    }
  };

  const updateRule = (
    clientKey: string,
    updates: Partial<EditablePricingRule>
  ) => {
    setPricingRules((currentRules) =>
      currentRules.map((rule) =>
        rule.clientKey === clientKey
          ? {
              ...rule,
              ...updates,
            }
          : rule
      )
    );
  };

  const handleRuleTypeChange = (
    clientKey: string,
    ruleType: RuleType
  ) => {
    setPricingRules((currentRules) =>
      currentRules.map((rule) => {
        if (rule.clientKey !== clientKey) {
          return rule;
        }

        if (ruleType === "base_price") {
          return {
            ...rule,
            rule_type: ruleType,
            price_operation: "set_unit_price",
            minimum_quantity: "",
            maximum_quantity: "",
            option_name: "",
            option_value: "",
          };
        }

        if (ruleType === "quantity_discount") {
          return {
            ...rule,
            rule_type: ruleType,
            price_operation: "multiply_unit_price",
            option_name: "",
            option_value: "",
          };
        }

        return {
          ...rule,
          rule_type: ruleType,
          price_operation: "multiply_unit_price",
          minimum_quantity: "",
          maximum_quantity: "",
        };
      })
    );
  };

  const handleAddPricingRule = () => {
    let ruleNumber = 1;

    while (
      pricingRules.some(
        (rule) =>
          rule.rule_code.trim().toLowerCase() ===
          `new_rule_${ruleNumber}`.toLowerCase()
      )
    ) {
      ruleNumber += 1;
    }

    const newRule: EditablePricingRule = {
      clientKey: createClientKey("new"),
      originalId: null,
      id: null,

      rule_code: `NEW_RULE_${ruleNumber}`,
      rule_name: "New Pricing Rule",
      rule_type: "base_price",

      envelope_type: "",
      envelope_size: "",

      option_name: "",
      option_value: "",

      minimum_quantity: "",
      maximum_quantity: "",

      price_operation: "set_unit_price",
      price_value: "1.0000",
      priority: "100",
      is_active: true,

      effective_from: "",
      effective_until: "",

      created_at: null,
      updated_at: null,
    };

    setPricingRules((currentRules) => [
      ...currentRules,
      newRule,
    ]);
  };

  const isProtectedDefaultRule = (
    rule: EditablePricingRule
  ) => {
    if (rule.rule_code === "BASE_DEFAULT") {
      return true;
    }

    if (rule.originalId === null) {
      return false;
    }

    return originalPricingRules.some(
      (originalRule) =>
        originalRule.originalId === rule.originalId &&
        originalRule.rule_code === "BASE_DEFAULT"
    );
  };

  const handleDeletePricingRule = (
    ruleToDelete: EditablePricingRule
  ) => {
    if (isProtectedDefaultRule(ruleToDelete)) {
      setErrorMessage(
        "BASE_DEFAULT cannot be deleted because it is the fallback envelope price."
      );

      return;
    }

    setPricingRules((currentRules) =>
      currentRules.filter(
        (rule) =>
          rule.clientKey !== ruleToDelete.clientKey
      )
    );

    if (ruleToDelete.originalId !== null) {
      setDeletedRuleIds((currentDeletedIds) => [
        ...currentDeletedIds,
        ruleToDelete.originalId as number,
      ]);
    }
  };

  const handleSavePricing = async () => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const validationError =
      validatePricingRules(pricingRules);

    if (validationError) {
      setErrorMessage(validationError);
      setIsSaving(false);
      return;
    }

    try {
      /*
       * Delete first so a deleted rule code can be reused
       * by a newly created rule in the same save.
       */
      await Promise.all(
        deletedRuleIds.map(async (ruleId) => {
          const response = await fetch(
            `${PRICING_API_URL}?id=${encodeURIComponent(
              ruleId
            )}`,
            {
              method: "DELETE",
              credentials: "include",
            }
          );

          await readApiResponse(response);
        })
      );

      const rulesToSave = pricingRules.filter(
        (rule) => {
          if (rule.originalId === null) {
            return true;
          }

          const originalRule =
            originalPricingRules.find(
              (candidate) =>
                candidate.originalId ===
                rule.originalId
            );

          if (!originalRule) {
            return true;
          }

          return !rulesAreEqual(rule, originalRule);
        }
      );

      await Promise.all(
        rulesToSave.map(async (rule) => {
          const isNewRule =
            rule.originalId === null;

          const payload = getRulePayload(rule);

          const response = await fetch(
            PRICING_API_URL,
            {
              method: isNewRule ? "POST" : "PATCH",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(
                isNewRule
                  ? payload
                  : {
                      id: rule.originalId,
                      ...payload,
                    }
              ),
            }
          );

          await readApiResponse(response);
        })
      );

      const refreshedRules =
        await fetchPricingRules();

      setPricingRules(refreshedRules);
      setOriginalPricingRules(refreshedRules);
      setDeletedRuleIds([]);

      setSuccessMessage(
        "Envelope pricing rules saved."
      );

      setIsPricingOpen(false);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving pricing rules."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">
          Envelope Pricing
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Manage GWBuilder base prices, quantity
          discounts, and printing-option upcharges.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleOpenPricing}
            className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            Change Envelope Pricing
          </button>
        </div>
      </div>

      {errorMessage && !isPricingOpen && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMessage}
        </div>
      )}

      {isPricingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative flex max-h-[94vh] w-full max-w-7xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Change Envelope Pricing
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Add, edit, disable, or remove pricing
                  rules used by GWBuilder.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsPricingOpen(false)
                }
                disabled={isSaving}
                className="rounded-lg px-2 py-1 text-xl font-semibold leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close pricing settings"
              >
                ×
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={handleAddPricingRule}
                disabled={
                  isLoadingPricing || isSaving
                }
                className="cursor-pointer rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add New Pricing Rule
              </button>

              {!isLoadingPricing && (
                <span className="text-sm text-zinc-500">
                  {pricingRules.length} pricing{" "}
                  {pricingRules.length === 1
                    ? "rule"
                    : "rules"}
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="flex-1 overflow-auto px-5 py-4">
              {isLoadingPricing ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  Loading pricing rules...
                </div>
              ) : pricingRules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500">
                  No pricing rules were found.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {pricingRules.map((rule) => {
                    const isDefaultRule =
                      isProtectedDefaultRule(rule);

                    return (
                      <div
                        key={rule.clientKey}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                      >
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-zinc-900">
                                {rule.rule_name ||
                                  "Unnamed Pricing Rule"}
                              </h3>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  rule.is_active
                                    ? "bg-green-100 text-green-700"
                                    : "bg-zinc-200 text-zinc-600"
                                }`}
                              >
                                {rule.is_active
                                  ? "Active"
                                  : "Disabled"}
                              </span>

                              {rule.originalId ===
                                null && (
                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                  New
                                </span>
                              )}

                              {isDefaultRule && (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  Required Default
                                </span>
                              )}
                            </div>

                            {rule.updated_at && (
                              <p className="mt-1 text-xs text-zinc-500">
                                Last updated:{" "}
                                {formatUpdatedDate(
                                  rule.updated_at
                                )}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeletePricingRule(
                                rule
                              )
                            }
                            disabled={
                              isDefaultRule ||
                              isSaving
                            }
                            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-red-700 text-lg font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                            aria-label={`Delete pricing rule ${rule.rule_name}`}
                            title={
                              isDefaultRule
                                ? "BASE_DEFAULT cannot be deleted."
                                : "Delete pricing rule"
                            }
                          >
                            ×
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Rule Code
                            </label>

                            <input
                              type="text"
                              value={rule.rule_code}
                              disabled={isDefaultRule}
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    rule_code:
                                      event.target
                                        .value,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Rule Name
                            </label>

                            <input
                              type="text"
                              value={rule.rule_name}
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    rule_name:
                                      event.target
                                        .value,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Rule Type
                            </label>

                            <select
                              value={rule.rule_type}
                              disabled={isDefaultRule}
                              onChange={(event) =>
                                handleRuleTypeChange(
                                  rule.clientKey,
                                  event.target
                                    .value as RuleType
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                            >
                              <option value="base_price">
                                Base Price
                              </option>

                              <option value="quantity_discount">
                                Quantity Discount
                              </option>

                              <option value="option_modifier">
                                Option Modifier
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Status
                            </label>

                            <label className="flex h-[38px] cursor-pointer items-center gap-3 rounded-xl border border-zinc-300 bg-white px-3">
                              <input
                                type="checkbox"
                                checked={rule.is_active}
                                disabled={isDefaultRule}
                                onChange={(event) =>
                                  updateRule(
                                    rule.clientKey,
                                    {
                                      is_active:
                                        event.target
                                          .checked,
                                    }
                                  )
                                }
                                className="h-4 w-4"
                              />

                              <span className="text-sm">
                                {rule.is_active
                                  ? "Active"
                                  : "Disabled"}
                              </span>
                            </label>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Price Operation
                            </label>

                            <select
                              value={
                                rule.price_operation
                              }
                              disabled={
                                isDefaultRule ||
                                rule.rule_type !==
                                  "base_price"
                              }
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    price_operation:
                                      event.target
                                        .value as PriceOperation,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                            >
                              <option value="set_unit_price">
                                Set Unit Price
                              </option>

                              <option value="multiply_unit_price">
                                Multiply Unit Price
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Price Value
                            </label>

                            <input
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={rule.price_value}
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    price_value:
                                      event.target
                                        .value,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Priority
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={rule.priority}
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    priority:
                                      event.target
                                        .value,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Envelope Type
                            </label>

                            <input
                              type="text"
                              value={rule.envelope_type}
                              disabled={isDefaultRule}
                              placeholder="Any envelope type"
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    envelope_type:
                                      event.target
                                        .value,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Envelope Size
                            </label>

                            <input
                              type="text"
                              value={rule.envelope_size}
                              disabled={isDefaultRule}
                              placeholder="Any size"
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    envelope_size:
                                      event.target
                                        .value,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                            />
                          </div>
                        </div>

                        {rule.rule_type ===
                          "quantity_discount" && (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                                Minimum Quantity
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  rule.minimum_quantity
                                }
                                onChange={(event) =>
                                  updateRule(
                                    rule.clientKey,
                                    {
                                      minimum_quantity:
                                        event.target
                                          .value,
                                    }
                                  )
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                                Maximum Quantity
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  rule.maximum_quantity
                                }
                                placeholder="No maximum"
                                onChange={(event) =>
                                  updateRule(
                                    rule.clientKey,
                                    {
                                      maximum_quantity:
                                        event.target
                                          .value,
                                    }
                                  )
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                              />
                            </div>
                          </div>
                        )}

                        {rule.rule_type ===
                          "option_modifier" && (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                                Option Name
                              </label>

                              <input
                                type="text"
                                value={rule.option_name}
                                placeholder="inkColors"
                                onChange={(event) =>
                                  updateRule(
                                    rule.clientKey,
                                    {
                                      option_name:
                                        event.target
                                          .value,
                                    }
                                  )
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                                Option Value
                              </label>

                              <input
                                type="text"
                                value={rule.option_value}
                                placeholder="2-color"
                                onChange={(event) =>
                                  updateRule(
                                    rule.clientKey,
                                    {
                                      option_value:
                                        event.target
                                          .value,
                                    }
                                  )
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Effective From
                            </label>

                            <input
                              type="datetime-local"
                              value={rule.effective_from}
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    effective_from:
                                      event.target
                                        .value,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">
                              Effective Until
                            </label>

                            <input
                              type="datetime-local"
                              value={
                                rule.effective_until
                              }
                              onChange={(event) =>
                                updateRule(
                                  rule.clientKey,
                                  {
                                    effective_until:
                                      event.target
                                        .value,
                                  }
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() =>
                  setIsPricingOpen(false)
                }
                disabled={
                  isSaving || isLoadingPricing
                }
                className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSavePricing}
                disabled={
                  isSaving || isLoadingPricing
                }
                className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Saving..."
                  : "Save Pricing"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}