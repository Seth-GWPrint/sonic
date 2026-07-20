import { NextRequest, NextResponse } from "next/server";
import mysql, {
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

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

type OrderNotesRow = RowDataPacket & {
  id: number;
  staff_notes: string | null;
};

type UserRow = RowDataPacket & {
  username: string;
};

export async function PATCH(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const orderId = Number(body.orderId);
    const staffNotes =
      typeof body.staffNotes === "string" ? body.staffNotes : "";

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid order ID is required.",
        },
        { status: 400 }
      );
    }

    const authToken = request.cookies.get("sonic_auth_token")?.value?.trim();

    if (!authToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid auth token.",
        },
        { status: 401 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    await connection.beginTransaction();

    const [userRows] = await connection.execute<UserRow[]>(
      `
      SELECT username
      FROM user_info
      WHERE userID = ?
      LIMIT 1
      `,
      [authToken]
    );

    const username = userRows[0]?.username;

    if (!username) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          error: "User not found.",
        },
        { status: 401 }
      );
    }

    const [orderRows] = await connection.execute<OrderNotesRow[]>(
      `
      SELECT
        id,
        staff_notes
      FROM orders
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [orderId]
    );

    const existingOrder = orderRows[0];

    if (!existingOrder) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    const oldStaffNotes = existingOrder.staff_notes ?? "";

    if (oldStaffNotes === staffNotes) {
      await connection.rollback();

      return NextResponse.json({
        success: true,
        orderId,
        staff_notes: oldStaffNotes,
        changed: false,
        message: "Order notes were unchanged.",
      });
    }

    const [updateResult] = await connection.execute<ResultSetHeader>(
      `
      UPDATE orders
      SET staff_notes = ?
      WHERE id = ?
      `,
      [staffNotes, orderId]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error("Failed to update the order notes.");
    }

    const [auditResult] = await connection.execute<ResultSetHeader>(
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
        "order",
        orderId,
        "updated",
        "staff_notes",
        oldStaffNotes,
        staffNotes,
        JSON.stringify({
          source: "order_details_modal",
        }),
      ]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      orderId,
      staff_notes: staffNotes,
      changed: true,
      activityLogId: auditResult.insertId,
      username,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Order notes rollback failed:", rollbackError);
      }
    }

    console.error("Update order notes failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update order notes.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}