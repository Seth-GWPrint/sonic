import { NextRequest, NextResponse } from "next/server";

type BigCommerceProductOption = {
  id?: number;
  option_id?: number;
  order_product_id?: number;
  product_option_id?: number;
  display_name?: string;
  display_value?: string;
  value?: string;
  type?: string;
  name?: string;
};

type BigCommerceOrderProduct = {
  id: number;
  order_id: number;
  product_id: number;
  name: string;
  sku?: string;
  quantity: number;
  product_options?: BigCommerceProductOption[];
  configurable_fields?: BigCommerceProductOption[];
};

function getBigCommerceConfig() {
  const storeHash =
    process.env.BIGCOMMERCE_STORE_HASH || process.env.BC_STORE_HASH;

  const accessToken =
    process.env.BIGCOMMERCE_ACCESS_TOKEN || process.env.BC_ACCESS_TOKEN;

  if (!storeHash || !accessToken) {
    throw new Error("Missing BigCommerce environment variables.");
  }

  return {
    storeHash,
    accessToken,
  };
}

function normalizeOption(option: BigCommerceProductOption) {
  return {
    id: option.id ?? null,
    option_id: option.option_id ?? option.product_option_id ?? null,
    name: option.display_name ?? option.name ?? "",
    value: option.display_value ?? option.value ?? "",
    type: option.type ?? "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const orderIdParam =
      searchParams.get("orderId") || searchParams.get("order_id");

    const orderId = orderIdParam ? Number(orderIdParam) : null;

    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid orderId.",
          products: [],
          options: [],
        },
        { status: 400 }
      );
    }

    const { storeHash, accessToken } = getBigCommerceConfig();

    const response = await fetch(
      `https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}/products`,
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

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.title ||
            data?.message ||
            data?.error ||
            "Failed to fetch order products from BigCommerce.",
          status: response.status,
          products: [],
          options: [],
        },
        { status: response.status }
      );
    }

    const products = Array.isArray(data)
      ? (data as BigCommerceOrderProduct[])
      : [];

    const formattedProducts = products.map((product) => {
      const productOptions = Array.isArray(product.product_options)
        ? product.product_options
        : [];

      const configurableFields = Array.isArray(product.configurable_fields)
        ? product.configurable_fields
        : [];

      const allOptions = [...productOptions, ...configurableFields].map(
        normalizeOption
      );

      return {
        order_product_id: product.id,
        order_id: product.order_id,
        product_id: product.product_id,
        product_name: product.name,
        product_sku: product.sku ?? "",
        product_quantity: product.quantity,
        options: allOptions,
      };
    });

    const options = formattedProducts.flatMap((product) =>
      product.options.map((option) => ({
        order_product_id: product.order_product_id,
        product_id: product.product_id,
        product_name: product.product_name,
        product_sku: product.product_sku,
        ...option,
      }))
    );

    return NextResponse.json({
      success: true,
      order_id: orderId,
      products: formattedProducts,
      options,
    });
  } catch (error) {
    console.error("Failed to get order options:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        products: [],
        options: [],
      },
      { status: 500 }
    );
  }
}