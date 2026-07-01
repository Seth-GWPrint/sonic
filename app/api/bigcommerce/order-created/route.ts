import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

type BigCommerceWebhookPayload = {
  scope: string;
  store_id: string;
  data: {
    type: string;
    id: number;
  };
  hash: string;
  created_at?: number;
  producer?: string;
};

function getDbConfig() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  console.log("BIGCOMMERCE WEBHOOK HIT");
  console.log("Time:", new Date().toISOString());

  if (!host || !user || !password || !database) {
    throw new Error("Missing database environment variables.");
  }

  return { host, user, password, database };
}

async function bigCommerceFetch<T>(path: string): Promise<T> {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;

  if (!storeHash || !accessToken) {
    throw new Error("Missing BigCommerce environment variables.");
  }

  const res = await fetch(
    `https://api.bigcommerce.com/stores/${storeHash}${path}`,
    {
      method: "GET",
      headers: {
        "X-Auth-Token": accessToken,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BigCommerce API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "BigCommerce order-created webhook route exists.",
  });
}

export async function POST(req: NextRequest) {
  let orderId: number | null = null;

  try {
    const expectedSecret = process.env.BIGCOMMERCE_WEBHOOK_SECRET;
    const receivedSecret = req.headers.get("x-webhook-secret");

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized webhook request.",
        },
        { status: 401 }
      );
    }

    const payload = (await req.json()) as BigCommerceWebhookPayload;

    if (payload.scope !== "store/order/created") {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: `Ignored scope: ${payload.scope}`,
      });
    }

    orderId = payload.data?.id ?? null;

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: "Missing order ID in webhook payload.",
      });
    }

    const order: any = await bigCommerceFetch(`/v2/orders/${orderId}`);

    const products: any[] = await bigCommerceFetch(
      `/v2/orders/${orderId}/products`
    );

    let customer: any = null;

    if (order.customer_id && Number(order.customer_id) > 0) {
      try {
        customer = await bigCommerceFetch(`/v2/customers/${order.customer_id}`);
      } catch (error) {
        console.warn(
          `Could not fetch customer ${order.customer_id}. Falling back to order billing address.`,
          error
        );
      }
    }

    const billingAddress = order.billing_address ?? {};

    const connection = await mysql.createConnection(getDbConfig());

    try {
      await connection.beginTransaction();

      await connection.execute(
        `
        INSERT INTO bigcommerce_orders (
          id,
          customer_id,
          date_created,
          status_id,
          status,
          subtotal_ex_tax,
          staff_notes,
          customer_message,
          custom_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          customer_id = VALUES(customer_id),
          date_created = VALUES(date_created),
          status_id = VALUES(status_id),
          status = VALUES(status),
          subtotal_ex_tax = VALUES(subtotal_ex_tax),
          staff_notes = VALUES(staff_notes),
          customer_message = VALUES(customer_message),
          custom_status = VALUES(custom_status)
        `,
        [
          order.id,
          order.customer_id ?? null,
          order.date_created ?? null,
          order.status_id ?? null,
          order.status ?? null,
          order.subtotal_ex_tax ?? null,
          order.staff_notes ?? null,
          order.customer_message ?? null,
          order.custom_status ?? null,
        ]
      );

      if (order.customer_id && Number(order.customer_id) > 0) {
        await connection.execute(
          `
          INSERT INTO bigcommerce_customers (
            id,
            email,
            first_name,
            last_name,
            company,
            phone,
            date_created,
            date_modified
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            company = VALUES(company),
            phone = VALUES(phone),
            date_created = VALUES(date_created),
            date_modified = VALUES(date_modified)
          `,
          [
            order.customer_id,
            customer?.email ?? billingAddress.email ?? null,
            customer?.first_name ?? billingAddress.first_name ?? null,
            customer?.last_name ?? billingAddress.last_name ?? null,
            customer?.company ?? billingAddress.company ?? null,
            customer?.phone ?? billingAddress.phone ?? null,
            customer?.date_created ?? null,
            customer?.date_modified ?? null,
          ]
        );
      }

      for (const product of products) {
        await connection.execute(
          `
          INSERT INTO bigcommerce_products (
            order_id,
            line_item_id,
            product_id,
            product_name,
            product_quantity,
            product_total_ex_tax,
            product_total_inc_tax,
            product_sku
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            product_id = VALUES(product_id),
            product_name = VALUES(product_name),
            product_quantity = VALUES(product_quantity),
            product_total_ex_tax = VALUES(product_total_ex_tax),
            product_total_inc_tax = VALUES(product_total_inc_tax),
            product_sku = VALUES(product_sku)
          `,
          [
            order.id,
            product.id ?? null,
            product.product_id ?? null,
            product.name ?? null,
            product.quantity ?? null,
            product.total_ex_tax ?? null,
            product.total_inc_tax ?? null,
            product.sku ?? null,
          ]
        );
      }

      await connection.commit();

      return NextResponse.json({
        success: true,
        imported: true,
        orderId,
        customerImported: Boolean(order.customer_id && Number(order.customer_id) > 0),
        productCount: products.length,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error("BigCommerce order import failed:", error);

    return NextResponse.json(
      {
        success: false,
        imported: false,
        orderId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}