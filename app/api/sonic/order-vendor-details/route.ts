import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

type OrderVendorDetailsRow = {
  id: number;
  order_id: number;
  sku: string | null;
  description: string | null;
  print_details: string | null;
  vendor_name: string | null;
  prod_day: string | null;
  shipping_day: string | null;
  price: string | number | null;
  vendor_location: string | null;
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

function formatRow(row: OrderVendorDetailsRow) {
  return {
    id: row.id,
    order_id: row.order_id,
    sku: row.sku ?? "",
    description: row.description ?? "",
    print_details: row.print_details ?? "",
    vendor_name: row.vendor_name ?? "",
    prod_day: row.prod_day ?? "",
    shipping_day: row.shipping_day ?? "",
    price: row.price ?? "",
    vendor_location: row.vendor_location ?? "",
  };
}

function blankVendorDetails(orderId: number | null = null) {
  return {
    order_id: orderId,
    vendor_name: "",
    vendor_location: "",
  };
}

// GET /api/sonic/order-vendor-details?orderId=428371
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const orderIdParam =
    searchParams.get("orderId") || searchParams.get("order_id");

  const orderId = orderIdParam ? Number(orderIdParam) : null;

  if (!orderId || Number.isNaN(orderId)) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing or invalid orderId.",
        vendorQuotes: [],
      },
      { status: 400 }
    );
  }

  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      `
      SELECT
        id,
        order_id,
        sku,
        description,
        print_details,
        vendor_name,
        prod_day,
        shipping_day,
        price,
        vendor_location
      FROM order_vendor_details
      WHERE order_id = ?
      ORDER BY id ASC
      `,
      [orderId]
    );

    return NextResponse.json({
      success: true,
      exists: rows.length > 0,
      vendorQuotes: rows.map((row) =>
        formatRow(row as OrderVendorDetailsRow)
      ),
    });
  } catch (error) {
    console.error("Failed to load order vendor details:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        vendorQuotes: [],
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// POST /api/sonic/order-vendor-details
// body: { orderId, vendorName, vendorLocation }
export async function POST(req: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await req.json();

    const orderId = Number(body.orderId ?? body.order_id);
    const sku = body.sku ?? "";
    const description = body.description ?? "";
    const printDetails = body.printDetails ?? body.print_details ?? "";
    const vendorName = body.vendorName ?? body.vendor_name ?? "";
    const prodDay = body.prodDay ?? "";
    const shippingDay = body.shippingDay ?? "";
    const price = body.price === "" || body.price == null ? null : Number(body.price);
    const vendorLocation = body.vendorLocation ?? "";

    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid orderId.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<mysql.ResultSetHeader>(
      `
      INSERT INTO order_vendor_details (
        order_id,
        sku,
        description,
        print_details,
        vendor_name,
        prod_day,
        shipping_day,
        price,
        vendor_location
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        orderId,
        sku,
        description,
        printDetails,
        vendorName,
        prodDay,
        shippingDay,
        price,
        vendorLocation,
      ]
    );

    const vendorQuote = {
      id: result.insertId,
      order_id: orderId,
      sku,
      description,
      print_details: printDetails,
      vendor_name: vendorName,
      prod_day: prodDay,
      shipping_day: shippingDay,
      price: price ?? "",
      vendor_location: vendorLocation,
    };

    return NextResponse.json({
      success: true,
      created: true,
      id: result.insertId,
      data: vendorQuote,
      vendorQuote,
    });
  } catch (error) {
    console.error("Failed to create order vendor details:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PATCH(req: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await req.json();

    const id = body.id ? Number(body.id) : null;
    const orderId = Number(body.orderId);

    const sku = body.sku ?? "";
    const description = body.description ?? "";
    const printDetails = body.printDetails ?? "";
    const vendorName = body.vendorName ?? "";
    const vendorLocation = body.vendorLocation ?? "";

    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid orderId.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    // If an id is provided, update that specific vendor quote row.
    if (id && !Number.isNaN(id)) {
      const [result] = await connection.execute<mysql.ResultSetHeader>(
        `
        UPDATE order_vendor_details
        SET
          order_id = ?,
          sku = ?,
          description = ?,
          print_details = ?,
          vendor_name = ?,
          vendor_location = ?
        WHERE id = ?
        `,
        [
          orderId,
          sku,
          description,
          printDetails,
          vendorName,
          vendorLocation,
          id,
        ]
      );

      // If id was provided but no row matched, create a new one instead.
      if (result.affectedRows === 0) {
        const [insertResult] = await connection.execute<mysql.ResultSetHeader>(
          `
          INSERT INTO order_vendor_details (
            order_id,
            sku,
            description,
            print_details,
            vendor_name,
            vendor_location
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            orderId,
            sku,
            description,
            printDetails,
            vendorName,
            vendorLocation,
          ]
        );

        return NextResponse.json({
          success: true,
          created: true,
          updated: false,
          id: insertResult.insertId,
          data: {
            id: insertResult.insertId,
            order_id: orderId,
            sku,
            description,
            print_details: printDetails,
            vendor_name: vendorName,
            vendor_location: vendorLocation,
          },
        });
      }

      return NextResponse.json({
        success: true,
        created: false,
        updated: true,
        id,
        data: {
          id,
          order_id: orderId,
          sku,
          description,
          print_details: printDetails,
          vendor_name: vendorName,
          vendor_location: vendorLocation,
        },
      });
    }

    // If no id is provided, create a new vendor quote row.
    const [insertResult] = await connection.execute<mysql.ResultSetHeader>(
      `
      INSERT INTO order_vendor_details (
        order_id,
        sku,
        description,
        print_details,
        vendor_name,
        vendor_location
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        orderId,
        sku,
        description,
        printDetails,
        vendorName,
        vendorLocation,
      ]
    );

    return NextResponse.json({
      success: true,
      created: true,
      updated: false,
      id: insertResult.insertId,
      data: {
        id: insertResult.insertId,
        order_id: orderId,
        sku,
        description,
        print_details: printDetails,
        vendor_name: vendorName,
        vendor_location: vendorLocation,
      },
    });
  } catch (error) {
    console.error("Failed to upsert order vendor details:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}