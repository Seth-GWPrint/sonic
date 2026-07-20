import { NextRequest, NextResponse } from "next/server";
import mysql, { type RowDataPacket } from "mysql2/promise";

type LastEditorRow = RowDataPacket & {
  username: string;
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

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = Number(searchParams.get("orderId"));

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid orderId is required.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<LastEditorRow[]>(
      `
      SELECT
        username,
        timestamp
      FROM audit_log
      WHERE entity_id = ?
        AND entity_type = 'order'
        AND field_name = 'staff_notes'
      ORDER BY timestamp DESC, id DESC
      LIMIT 1
      `,
      [orderId]
    );

    const latestEntry = rows[0] ?? null;

    return NextResponse.json({
      success: true,
      lastEditedBy: latestEntry?.username ?? null,
      username: latestEntry?.username ?? null, // Added as a structural fallback mirror matching your update payload
      lastEditedAt: latestEntry?.timestamp ?? null,
    });
  } catch (error) {
    console.error("Load order notes last editor failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load the order notes editor.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}