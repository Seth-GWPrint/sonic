import { NextRequest, NextResponse } from "next/server";
import mysql, { type RowDataPacket } from "mysql2/promise";

type AuditLogRow = RowDataPacket & {
  id: number;
  username: string;
  entity_type: string;
  entity_id: number;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: string | null;
  timestamp: string;
};

function getDbConfig() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !password || !database) {
    throw new Error("Missing database environment variables.");
  }

  return {
    host,
    user,
    password,
    database,
  };
}

function getPositiveInteger(
  value: string | null,
  fallback: number,
  maximum?: number
) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  if (maximum !== undefined) {
    return Math.min(parsedValue, maximum);
  }

  return parsedValue;
}

function parseMetadata(metadata: string | null) {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.parse(metadata);
  } catch {
    return metadata;
  }
}

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const { searchParams } = new URL(request.url);

    // "name" is accepted as an alias for "username".
    const username =
      searchParams.get("username")?.trim() ||
      searchParams.get("name")?.trim() ||
      "";

    const entityType =
      searchParams.get("entity_type")?.trim() ||
      searchParams.get("type")?.trim() ||
      "";

    const action = searchParams.get("action")?.trim() || "";

    const fieldName =
      searchParams.get("field_name")?.trim() ||
      searchParams.get("field")?.trim() ||
      "";

    const entityIdParam = searchParams.get("entity_id");
    const entityId = entityIdParam ? Number(entityIdParam) : null;

    const limit = getPositiveInteger(
      searchParams.get("limit"),
      100,
      500
    );

    const page = getPositiveInteger(searchParams.get("page"), 1);
    const offset = (page - 1) * limit;

    if (
      entityIdParam &&
      (!Number.isInteger(entityId) || Number(entityId) <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "entity_id must be a positive integer.",
        },
        { status: 400 }
      );
    }

    const conditions: string[] = [];
    const values: Array<string | number> = [];

    if (username) {
      conditions.push("username LIKE ?");
      values.push(`%${username}%`);
    }

    if (entityType) {
      conditions.push("entity_type = ?");
      values.push(entityType);
    }

    if (action) {
      conditions.push("action = ?");
      values.push(action);
    }

    if (fieldName) {
      conditions.push("field_name = ?");
      values.push(fieldName);
    }

    if (entityId !== null) {
      conditions.push("entity_id = ?");
      values.push(entityId);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    connection = await mysql.createConnection(getDbConfig());

    const [countRows] = await connection.execute<RowDataPacket[]>(
      `
      SELECT COUNT(*) AS total
      FROM audit_log
      ${whereClause}
      `,
      values
    );

    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await connection.execute<AuditLogRow[]>(
      `
      SELECT
        id,
        username,
        entity_type,
        entity_id,
        action,
        field_name,
        old_value,
        new_value,
        metadata,
        created_at
      FROM audit_log
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
      OFFSET ${offset}
      `,
      values
    );

    const auditLog = rows.map((row) => ({
      ...row,
      metadata: parseMetadata(row.metadata),
    }));

    return NextResponse.json({
      success: true,
      auditLog,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        username: username || null,
        entity_type: entityType || null,
        entity_id: entityId,
        action: action || null,
        field_name: fieldName || null,
      },
    });
  } catch (error) {
    console.error("Pull audit log failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to pull audit log.",
        auditLog: [],
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}