import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

type OrderSpreadsheetRow = {
  id: number;
  customer_id: number | null;
  date_created: string | null;
  status_id: number | null;
  status: string | null;
  subtotal_ex_tax: string | null;
  staff_notes: string | null;
  customer_message: string | null;
  custom_status: string | null;
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
  const port = Number(process.env.DB_PORT || 3306);

  if (!host || !user || !password || !database) {
    throw new Error(
      "Missing database credentials. Check DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME."
    );
  }

  return {
    host,
    user,
    password,
    database,
    port,
  };
}

async function getConnection() {
  return mysql.createConnection(getDbConfig());
}

export async function GET() {
  const connection = await getConnection();

  try {
    const [rows] = await connection.query(
      `
      SELECT
        id,
        customer_id,
        date_created,
        status_id,
        status,
        subtotal_ex_tax,
        staff_notes,
        customer_message,
        custom_status,
        product_name,
        product_quantity,
        product_total_ex_tax,
        product_total_inc_tax,
        product_sku
      FROM bigcommerce_orders
      ORDER BY date_created DESC, id DESC
      LIMIT 100
      `
    );

    return NextResponse.json({
      success: true,
      rows: rows as OrderSpreadsheetRow[],
    });
  } catch (error) {
    console.error("Load orders from database error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error while loading orders from database.",
      },
      { status: 500 }
    );
  } finally {
    await connection.end();
  }
}