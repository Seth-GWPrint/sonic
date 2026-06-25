import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

type AuditLogRequestBody = {
  entity_type?: string;
  entity_id?: number;
  action?: string;
  field_name?: string | null;
  old_value?: string | number | boolean | null;
  new_value?: string | number | boolean | null;
  metadata?: unknown;
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

function stringifyValue(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

export async function POST(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const body = (await request.json()) as AuditLogRequestBody;

    const {
      entity_type,
      entity_id,
      action,
      field_name = null,
      old_value = null,
      new_value = null,
      metadata = null,
    } = body;

    if (!entity_type) {
      return NextResponse.json(
        { success: false, error: "Missing entity_type." },
        { status: 400 }
      );
    }

    if (entity_id === undefined || entity_id === null) {
      return NextResponse.json(
        { success: false, error: "Missing entity_id." },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Missing action." },
        { status: 400 }
      );
    }

    const authToken = request.cookies.get("sonic_auth_token")?.value;

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: "Missing auth token." },
        { status: 401 }
      );
    }

    const userId = authToken.trim();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Invalid auth token." },
        { status: 401 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [userRows] = await connection.execute<mysql.RowDataPacket[]>(
      `
      SELECT username
      FROM user_info
      WHERE userID = ?
      LIMIT 1
      `,
      [userId]
    );

    const username = userRows[0]?.username;

    if (!username) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 401 }
      );
    }

    const [result] = await connection.execute<mysql.ResultSetHeader>(
      `
      INSERT INTO audit_log (
        username,
        entity_type,
        entity_id,
        action,
        field_name,
        old_value,
        new_value,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        username,
        entity_type,
        entity_id,
        action,
        field_name,
        stringifyValue(old_value),
        stringifyValue(new_value),
        metadata === null || metadata === undefined
          ? null
          : JSON.stringify(metadata),
      ]
    );

    return NextResponse.json({
      success: true,
      activityLogId: result.insertId,
      username,
    });
  } catch (error) {
    console.error("Audit log insert failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown audit log insert error.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}