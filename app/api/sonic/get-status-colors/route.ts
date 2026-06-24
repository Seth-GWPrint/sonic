import { NextResponse } from "next/server";
import mysql, { RowDataPacket } from "mysql2/promise";

type StatusColorRow = RowDataPacket & {
  status_id: number;
  status: string;
  color_hex: string;
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

export async function GET() {
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<StatusColorRow[]>(
      `
      SELECT
        status_id,
        color_hex
      FROM status_colors
      ORDER BY status_id ASC
      `
    );

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        id: row.status_id,
        name: row.status,
        color: row.color_hex,
      })),
    });
  } catch (error) {
    console.error("Failed to load status colors:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load status colors.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}