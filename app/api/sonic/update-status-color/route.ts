import { NextResponse } from "next/server";
import mysql, { ResultSetHeader } from "mysql2/promise";

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

function isValidHexColor(value: unknown) {
  if (typeof value !== "string") return false;

  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

export async function PATCH(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const statusId = Number(body.statusId);
    const colorHex = String(body.colorHex || "").trim();

    if (!Number.isInteger(statusId) || statusId < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid status ID." },
        { status: 400 }
      );
    }

    if (!isValidHexColor(colorHex)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid hex color. Use format like #000000. You entered ${colorHex}`,
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      UPDATE status_colors
      SET color_hex = ?
      WHERE status_id = ?
      `,
      [colorHex, statusId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No status found with status_id ${statusId}.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      statusId,
      colorHex,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Failed to update status color:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update status color.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}