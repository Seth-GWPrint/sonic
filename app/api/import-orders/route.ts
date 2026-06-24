import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

type BigCommerceOrder = {
  id: number;
  customer_id: number;
  date_created: string;
  status_id: number;
  status: string;
  subtotal_ex_tax: string;
  staff_notes: string;
  customer_message: string;
  custom_status: string;
};

type BigCommerceOrderProduct = {
  id: number;
  order_id: number;
  product_id: number;
  name: string;
  quantity: number;
  total_ex_tax: string;
  total_inc_tax: string;
  price_ex_tax: string;
  price_inc_tax: string;
  sku?: string;
};

type FlattenedOrderRow = {
  id: number;
  customer_id: number;
  date_created: string;
  status_id: number;
  status: string;
  subtotal_ex_tax: string;
  staff_notes: string;
  customer_message: string;
  custom_status: string;
  product_name: string;
  product_quantity: number;
  product_total_ex_tax: string;
  product_total_inc_tax: string;
  product_sku: string;
};

type ExistingOrderIdRow = {
  id: number;
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

async function bigCommerceFetch<T>(path: string): Promise<T> {
  const storeHash = process.env.BC_STORE_HASH;
  const accessToken = process.env.BC_ACCESS_TOKEN;

  if (!storeHash || !accessToken) {
    throw new Error(
      "Missing BigCommerce credentials. Make sure BC_STORE_HASH and BC_ACCESS_TOKEN are set."
    );
  }

  const response = await fetch(
    `https://api.bigcommerce.com/stores/${storeHash}${path}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Auth-Token": accessToken,
      },
      cache: "no-store",
    }
  );

  const rawText = await response.text();

  let data: unknown;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }

  if (!response.ok) {
    console.error("BigCommerce API error:", {
      path,
      status: response.status,
      data,
    });

    throw new Error(
      typeof data === "string"
        ? `BigCommerce API error ${response.status}: ${data}`
        : `BigCommerce API error ${response.status} while requesting ${path}`
    );
  }

  return data as T;
}

async function getProductsForOrder(
  orderId: number
): Promise<BigCommerceOrderProduct[]> {
  return bigCommerceFetch<BigCommerceOrderProduct[]>(
    `/v2/orders/${orderId}/products`
  );
}

function flattenOrderProducts(
  order: BigCommerceOrder,
  products: BigCommerceOrderProduct[]
): FlattenedOrderRow[] {
  if (!products.length) {
    return [
      {
        id: order.id,
        customer_id: order.customer_id,
        date_created: order.date_created,
        status_id: order.status_id,
        status: order.status,
        subtotal_ex_tax: order.subtotal_ex_tax,
        staff_notes: order.staff_notes,
        customer_message: order.customer_message,
        custom_status: order.custom_status,
        product_name: "",
        product_quantity: 0,
        product_total_ex_tax: "",
        product_total_inc_tax: "",
        product_sku: "",
      },
    ];
  }

  return products.map((product) => ({
    id: order.id,
    customer_id: order.customer_id,
    date_created: order.date_created,
    status_id: order.status_id,
    status: order.status,
    subtotal_ex_tax: order.subtotal_ex_tax,
    staff_notes: order.staff_notes,
    customer_message: order.customer_message,
    custom_status: order.custom_status,
    product_name: product.name,
    product_quantity: product.quantity,
    product_total_ex_tax: product.total_ex_tax,
    product_total_inc_tax: product.total_inc_tax,
    product_sku: product.sku || "",
  }));
}

function normalizeDateForMySQL(dateString: string) {
  if (!dateString) return null;

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function getExistingOrderIds(
  connection: mysql.Connection,
  orderIds: number[]
) {
  if (!orderIds.length) {
    return new Set<number>();
  }

  const [rows] = await connection.query(
    `
    SELECT DISTINCT id
    FROM bigcommerce_orders
    WHERE id IN (?)
    `,
    [orderIds]
  );

  return new Set((rows as ExistingOrderIdRow[]).map((row) => row.id));
}

async function saveRowsToDatabase(
  connection: mysql.Connection,
  rows: FlattenedOrderRow[]
) {
  if (!rows.length) {
    return {
      insertedRows: 0,
    };
  }

  const values = rows.map((row) => [
    row.id,
    row.customer_id || null,
    normalizeDateForMySQL(row.date_created),
    row.status_id || null,
    row.status || null,
    row.subtotal_ex_tax || null,
    row.staff_notes || null,
    row.customer_message || null,
    row.custom_status || null,
    row.product_name || null,
    row.product_quantity || 0,
    row.product_total_ex_tax || null,
    row.product_total_inc_tax || null,
    row.product_sku || "",
  ]);

  const [result] = await connection.query(
    `
    INSERT IGNORE INTO bigcommerce_orders (
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
    )
    VALUES ?
    `,
    [values]
  );

  return {
    insertedRows: "affectedRows" in result ? result.affectedRows : 0,
  };
}

export async function GET() {
  const connection = await getConnection();

  try {
    const orders = await bigCommerceFetch<BigCommerceOrder[]>(
      "/v2/orders?sort=date_created:desc&limit=100&page=1"
    );

    const orderIds = orders.map((order) => order.id);
    const existingOrderIds = await getExistingOrderIds(connection, orderIds);

    const newOrders = orders.filter((order) => !existingOrderIds.has(order.id));

    const rows: FlattenedOrderRow[] = [];

    for (const order of newOrders) {
      const products = await getProductsForOrder(order.id);
      const orderRows = flattenOrderProducts(order, products);

      rows.push(...orderRows);
    }

    const dbResult = await saveRowsToDatabase(connection, rows);

    return NextResponse.json({
      success: true,
      fetchedOrderCount: orders.length,
      existingOrderCount: existingOrderIds.size,
      newOrderCount: newOrders.length,
      rowCount: rows.length,
      insertedRows: dbResult.insertedRows,
      rows,
    });
  } catch (error) {
    console.error("Import orders error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error while importing orders.",
      },
      { status: 500 }
    );
  } finally {
    await connection.end();
  }
}