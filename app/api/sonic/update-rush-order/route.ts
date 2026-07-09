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

  return { host, user, password, database };
}

export async function PATCH(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const orderId = Number(body.orderId);
    const isRush = Boolean(body.isRush);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid orderId.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      UPDATE orders
      SET is_rush = ?
      WHERE id = ?
      `,
      [isRush ? 1 : 0, orderId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      isRush,
    });
  } catch (error) {
    console.error("Failed to update rush order:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update rush order.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}