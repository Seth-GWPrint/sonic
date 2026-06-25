import { NextResponse } from "next/server";
import mysql, { RowDataPacket } from "mysql2/promise";

type UserRow = RowDataPacket & {
  userID: string;
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

export async function POST(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();
    const authToken = String(body.authToken || "").trim();

    if (!authToken) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Missing auth token.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<UserRow[]>(
      `
      SELECT userID
      FROM user_info
      WHERE userID = ?
      LIMIT 1
      `,
      [authToken]
    );

    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Invalid auth token.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      userID: user.userID,
    });
  } catch (error) {
    console.error("Failed to validate auth token:", error);

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to validate auth token.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}