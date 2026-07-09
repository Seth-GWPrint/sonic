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

  return {
    host,
    user,
    password,
    database,
  };
}

function cleanString(value: unknown) {
  const cleanedValue = String(value ?? "").trim();
  return cleanedValue || null;
}

async function getVendorById(
  connection: mysql.Connection,
  vendorId: number
) {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    `
    SELECT
      id,
      vendor_name,
      vendor_location,
      contact_name,
      contact_email,
      contact_phone,
      website,
      notes,
      default_prod_day,
      default_shipping_day,
      is_active,
      created_at,
      updated_at
    FROM vendors
    WHERE id = ?
    LIMIT 1
    `,
    [vendorId]
  );

  return rows[0] || null;
}

export async function GET() {
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      `
      SELECT
        id,
        vendor_name,
        vendor_location,
        contact_name,
        contact_email,
        contact_phone,
        website,
        notes,
        default_prod_day,
        default_shipping_day,
        is_active,
        created_at,
        updated_at
      FROM vendors
      WHERE is_active = 1
      ORDER BY vendor_name ASC
      `
    );

    return NextResponse.json({
      success: true,
      vendors: rows,
    });
  } catch (error) {
    console.error("Load vendors failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load vendors.",
        vendors: [],
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function POST(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const vendorName = String(body.vendor_name || "").trim();
    const vendorLocation = cleanString(body.vendor_location);
    const contactName = cleanString(body.contact_name);
    const contactEmail = cleanString(body.contact_email);
    const contactPhone = cleanString(body.contact_phone);
    const website = cleanString(body.website);
    const notes = cleanString(body.notes);
    const defaultProdDay = cleanString(body.default_prod_day);
    const defaultShippingDay = cleanString(body.default_shipping_day);

    if (!vendorName) {
      return NextResponse.json(
        {
          success: false,
          error: "Vendor name is required.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      INSERT INTO vendors (
        vendor_name,
        vendor_location,
        contact_name,
        contact_email,
        contact_phone,
        website,
        notes,
        default_prod_day,
        default_shipping_day,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        vendorName,
        vendorLocation,
        contactName,
        contactEmail,
        contactPhone,
        website,
        notes,
        defaultProdDay,
        defaultShippingDay,
      ]
    );

    const vendor = await getVendorById(connection, result.insertId);

    return NextResponse.json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("Create vendor failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create vendor.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PATCH(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const vendorId = Number(body.id);
    const vendorName = String(body.vendor_name || "").trim();
    const vendorLocation = cleanString(body.vendor_location);
    const contactName = cleanString(body.contact_name);
    const contactEmail = cleanString(body.contact_email);
    const contactPhone = cleanString(body.contact_phone);
    const website = cleanString(body.website);
    const notes = cleanString(body.notes);
    const defaultProdDay = cleanString(body.default_prod_day);
    const defaultShippingDay = cleanString(body.default_shipping_day);

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid vendor ID.",
        },
        { status: 400 }
      );
    }

    if (!vendorName) {
      return NextResponse.json(
        {
          success: false,
          error: "Vendor name is required.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] = await connection.execute<ResultSetHeader>(
      `
      UPDATE vendors
      SET
        vendor_name = ?,
        vendor_location = ?,
        contact_name = ?,
        contact_email = ?,
        contact_phone = ?,
        website = ?,
        notes = ?,
        default_prod_day = ?,
        default_shipping_day = ?,
        is_active = 1
      WHERE id = ?
      LIMIT 1
      `,
      [
        vendorName,
        vendorLocation,
        contactName,
        contactEmail,
        contactPhone,
        website,
        notes,
        defaultProdDay,
        defaultShippingDay,
        vendorId,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Vendor not found.",
        },
        { status: 404 }
      );
    }

    const vendor = await getVendorById(connection, vendorId);

    return NextResponse.json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("Update vendor failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update vendor.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function DELETE(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const vendorId = Number(body.id || body.vendor_id || body.vendorId);

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid vendor ID.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const vendor = await getVendorById(connection, vendorId);

    if (!vendor) {
      return NextResponse.json(
        {
          success: false,
          error: "Vendor not found.",
        },
        { status: 404 }
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
      UPDATE vendors
      SET is_active = 0
      WHERE id = ?
      LIMIT 1
      `,
      [vendorId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Vendor not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedVendorId: vendorId,
      vendor,
    });
  } catch (error) {
    console.error("Delete vendor failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete vendor.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}