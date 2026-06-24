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

export async function PATCH(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const orderId = Number(body.orderId);
    const statusId = Number(body.statusId);
    const status = String(body.status || "").trim();

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid order ID." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(statusId) || statusId < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid status ID." },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: "Invalid status name." },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      UPDATE bigcommerce_orders
      SET
        status_id = ?,
        status = ?
      WHERE id = ?
      `,
      [statusId, status, orderId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No order found with ID ${orderId}.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      statusId,
      status,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Failed to update order status:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update order status.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}