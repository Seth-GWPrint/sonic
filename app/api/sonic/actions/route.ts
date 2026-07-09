import { NextResponse } from "next/server";
import mysql, { ResultSetHeader, RowDataPacket } from "mysql2/promise";

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

export async function GET() {
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<RowDataPacket[]>(
      `
      SELECT
        status_id AS actionId,
        status_name AS name,
        color_hex AS color
      FROM actions
      ORDER BY status_id ASC
      `
    );

    return NextResponse.json({
      success: true,
      actions: rows,
    });
  } catch (error) {
    console.error("Failed to fetch actions:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch actions.",
        actions: [],
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function POST(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const statusId = Number(body.statusId);
    const statusName = String(body.statusName || "").trim();
    const colorHex = String(body.colorHex || "#000000").trim();

    if (!Number.isInteger(statusId) || statusId < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid status ID." },
        { status: 400 }
      );
    }

    if (!statusName) {
      return NextResponse.json(
        { success: false, error: "Status name is required." },
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
      INSERT INTO actions
        (status_id, status_name, color_hex)
      VALUES
        (?, ?, ?)
      `,
      [statusId, statusName, colorHex]
    );

    return NextResponse.json({
      success: true,
      message: "Status added successfully.",
      insertedId: result.insertId,
      action: {
        actionId: statusId,
        name: statusName,
        color: colorHex,
      },
    });
  } catch (error) {
    console.error("Failed to add status:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add status.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PATCH(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const originalStatusId = Number(body.originalStatusId);
    const statusId = Number(body.statusId);
    const statusName = String(body.statusName || "").trim();
    const colorHex = String(body.colorHex || "").trim();

    if (!Number.isInteger(originalStatusId) || originalStatusId < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid original status ID." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(statusId) || statusId < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid status ID." },
        { status: 400 }
      );
    }

    if (!statusName) {
      return NextResponse.json(
        { success: false, error: "Status name is required." },
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
      UPDATE actions
      SET
        status_id = ?,
        status_name = ?,
        color_hex = ?
      WHERE status_id = ?
      `,
      [statusId, statusName, colorHex, originalStatusId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No status found with status_id ${originalStatusId}.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Status updated successfully.",
      originalStatusId,
      action: {
        actionId: statusId,
        name: statusName,
        color: colorHex,
      },
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Failed to update status:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update status.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function DELETE(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const statusId = Number(body.statusId);

    if (!Number.isInteger(statusId) || statusId < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid status ID." },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      DELETE FROM actions
      WHERE status_id = ?
      `,
      [statusId]
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
      message: "Status deleted successfully.",
      statusId,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Failed to delete status:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete status.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}