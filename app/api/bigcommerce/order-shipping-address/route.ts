import { NextRequest, NextResponse } from "next/server";

type BigCommerceShippingAddress = {
  id: number;
  order_id: number;
  first_name: string;
  last_name: string;
  company: string;
  street_1: string;
  street_2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  country_iso2: string;
  phone: string;
  email: string;
  shipping_method: string;
  base_cost: string;
  cost_ex_tax: string;
  cost_inc_tax: string;
  cost_tax: string;
  cost_tax_class_id: number;
  handling_cost_ex_tax: string;
  handling_cost_inc_tax: string;
  handling_cost_tax: string;
  handling_cost_tax_class_id: number;
};

function getBigCommerceConfig() {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;

  if (!storeHash || !accessToken) {
    throw new Error(
      "Missing BIGCOMMERCE_STORE_HASH or BIGCOMMERCE_ACCESS_TOKEN."
    );
  }

  return {
    storeHash,
    accessToken,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Supports several possible query parameter names.
    const orderIdParam =
      searchParams.get("orderId") ||
      searchParams.get("order_id") ||
      searchParams.get("orderNumber") ||
      searchParams.get("orderNum");

    const orderId = Number(orderIdParam);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid order ID is required.",
          example:
            "/api/bigcommerce/order-shipping-address?orderId=428371",
        },
        { status: 400 }
      );
    }

    const { storeHash, accessToken } = getBigCommerceConfig();

    const response = await fetch(
      `https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}/shipping_addresses`,
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

    const responseBody = await response.text();

    let data: unknown = null;

    if (responseBody) {
      try {
        data = JSON.parse(responseBody);
      } catch {
        data = responseBody;
      }
    }

    if (!response.ok) {
      console.error("BigCommerce shipping address error:", {
        orderId,
        status: response.status,
        data,
      });

      return NextResponse.json(
        {
          success: false,
          error: "BigCommerce could not retrieve the shipping address.",
          status: response.status,
          details: data,
        },
        { status: response.status }
      );
    }

    const shippingAddresses = Array.isArray(data)
      ? (data as BigCommerceShippingAddress[])
      : [];

    if (shippingAddresses.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No shipping address was found for this order.",
          orderId,
          shippingAddresses: [],
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      shippingAddress: shippingAddresses[0],
      shippingAddresses,
    });
  } catch (error) {
    console.error("Order shipping address route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred.",
      },
      { status: 500 }
    );
  }
}