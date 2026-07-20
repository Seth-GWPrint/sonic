import { NextResponse } from "next/server";
import mysql, { RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";

type UserInfoRow = RowDataPacket & {
  id: number;
  username: string;
  password: string;
  email: string;
  userID: string;
  email_verified_at: string | Date | null;
};

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

export async function POST(request: Request) {
  let connection: mysql.Connection | null = null;

  try {
    const body = await request.json();

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          loggedIn: false,
          error: "Username and password are required.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [rows] = await connection.execute<UserInfoRow[]>(
      `
        SELECT
          id,
          username,
          password,
          email,
          userID,
          email_verified_at
        FROM user_info
        WHERE username = ?
        LIMIT 1
      `,
      [username]
    );

    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          loggedIn: false,
          error: "Invalid username or password.",
        },
        { status: 401 }
      );
    }

    /*
     * Accounts created through the new create-account route
     * have bcrypt-hashed passwords.
     */
    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          success: false,
          loggedIn: false,
          error: "Invalid username or password.",
        },
        { status: 401 }
      );
    }

    if (!user.email_verified_at) {
      return NextResponse.json(
        {
          success: false,
          loggedIn: false,
          requiresEmailConfirmation: true,
          userId: user.userID,
          email: user.email,
          error: "Please confirm your email before logging in.",
        },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      success: true,
      loggedIn: true,
      user: {
        username: user.username,
        email: user.email,
        userID: user.userID,
      },
    });

    response.cookies.set(
      "sonic_auth_token",
      String(user.userID),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }
    );

    return response;
  } catch (error) {
    console.error("Failed to log in:", error);

    return NextResponse.json(
      {
        success: false,
        loggedIn: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to log in.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}