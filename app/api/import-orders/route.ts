import { NextResponse } from "next/server";

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

export async function GET() {
  try {
    const orders = await bigCommerceFetch<BigCommerceOrder[]>(
      "/v2/orders?limit=100&page=1"
    );

    const rows: FlattenedOrderRow[] = [];

    // Important:
    // Do this sequentially at first to avoid "Too many simultaneous requests".
    // Once it works, we can upgrade this to small batches of 3-5 at a time.
    for (const order of orders) {
      const products = await getProductsForOrder(order.id);
      const orderRows = flattenOrderProducts(order, products);

      rows.push(...orderRows);
    }

    return NextResponse.json({
      orderCount: orders.length,
      rowCount: rows.length,
      rows,
    });
  } catch (error) {
    console.error("Import orders error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error while importing orders.",
      },
      { status: 500 }
    );
  }
}