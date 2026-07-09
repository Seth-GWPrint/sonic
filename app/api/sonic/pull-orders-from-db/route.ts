import { NextResponse } from "next/server";
import mysql, { RowDataPacket } from "mysql2/promise";

type OrderSpreadsheetRow = RowDataPacket & {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  date_created: string | null;
  status_id: number | null;
  status: string | null;
  subtotal_ex_tax: string | null;
  staff_notes: string | null;
  customer_message: string | null;
  custom_status: string | null;
  is_rush: number;
  proof_approved_date: string | null;
  location: string | null;
  product_name: string | null;
  product_quantity: number | null;
  product_total_ex_tax: string | null;
  product_total_inc_tax: string | null;
  product_sku: string | null;
};

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

export async function GET() {
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<OrderSpreadsheetRow[]>(
      `
      SELECT
        o.id,
        o.customer_id,

        CONCAT_WS(' ', c.first_name, c.last_name) AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.company AS customer_company,

        o.date_created,
        o.status_id,
        o.status,
        o.subtotal_ex_tax,
        o.staff_notes,
        o.customer_message,
        o.custom_status,
        o.is_rush,
        o.proof_approved_date,

        selected_vendor_details.location AS location,

        p.product_name,
        p.product_quantity,
        p.product_total_ex_tax,
        p.product_total_inc_tax,
        p.product_sku

      FROM orders o

      LEFT JOIN customers c
        ON c.id = o.customer_id

      LEFT JOIN products p
        ON p.order_id = o.id

      LEFT JOIN (
        SELECT
          order_id,
          MIN(vendor_name) AS location
        FROM quotes
        WHERE selected_vendor = 1
        GROUP BY order_id
      ) selected_vendor_details
        ON selected_vendor_details.order_id = o.id

      ORDER BY o.id DESC, p.id ASC

      LIMIT 100
      `
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error("Failed to pull orders from database:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to pull orders from database.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}