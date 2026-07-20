import { NextRequest, NextResponse } from "next/server";
import mysql, {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import bcrypt from "bcryptjs";
import {
  createHmac,
  timingSafeEqual,
} from "crypto";

type PasswordResetTokenPayload = {
  userId: string;
  email: string;
  purpose: "reset_password";
  expiresAt: number;
};

type UserRow = RowDataPacket & {
  id: number;
  userID: string;
  email: string;
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

function getPasswordResetSecret() {
  const secret = process.env.PASSWORD_RESET_SECRET;

  if (!secret) {
    throw new Error(
      "Missing PASSWORD_RESET_SECRET environment variable."
    );
  }

  return secret;
}

function verifyPasswordResetToken(
  token: string
): PasswordResetTokenPayload | null {
  try {
    const tokenParts = token.split(".");

    if (tokenParts.length !== 2) {
      return null;
    }

    const [payload, suppliedSignature] = tokenParts;

    const expectedSignature = createHmac(
      "sha256",
      getPasswordResetSecret()
    )
      .update(payload)
      .digest("base64url");

    const suppliedSignatureBuffer = Buffer.from(
      suppliedSignature,
      "utf8"
    );

    const expectedSignatureBuffer = Buffer.from(
      expectedSignature,
      "utf8"
    );

    if (
      suppliedSignatureBuffer.length !==
      expectedSignatureBuffer.length
    ) {
      return null;
    }

    const signatureMatches = timingSafeEqual(
      suppliedSignatureBuffer,
      expectedSignatureBuffer
    );

    if (!signatureMatches) {
      return null;
    }

    const decodedPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as PasswordResetTokenPayload;

    if (
      !decodedPayload.userId ||
      !decodedPayload.email ||
      decodedPayload.purpose !== "reset_password" ||
      typeof decodedPayload.expiresAt !== "number"
    ) {
      return null;
    }

    if (decodedPayload.expiresAt <= Date.now()) {
      return null;
    }

    return decodedPayload;
  } catch (error) {
    console.error(
      "Failed to verify password reset token:",
      error
    );

    return null;
  }
}

function createExpiredResetCookieResponse(
  body: Record<string, unknown>,
  status: number
) {
  const response = NextResponse.json(body, {
    status,
  });

  response.cookies.set(
    "sonic_password_reset_token",
    "",
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    }
  );

  return response;
}

export async function POST(request: NextRequest) {
  let connection: mysql.Connection | null = null;
  let transactionStarted = false;

  try {
    const resetToken = request.cookies.get(
      "sonic_password_reset_token"
    )?.value;

    if (!resetToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your password reset session is missing or has expired. Request a new reset code.",
        },
        { status: 401 }
      );
    }

    const tokenPayload =
      verifyPasswordResetToken(resetToken);

    if (!tokenPayload) {
      return createExpiredResetCookieResponse(
        {
          success: false,
          error:
            "Your password reset session is invalid or has expired. Request a new reset code.",
        },
        401
      );
    }

    const body = await request.json();

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const confirmPassword =
      typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Passwords do not match.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(
      getDbConfig()
    );

    await connection.beginTransaction();
    transactionStarted = true;

    const [users] =
      await connection.execute<UserRow[]>(
        `
          SELECT
            id,
            userID,
            email
          FROM user_info
          WHERE userID = ?
            AND email = ?
          LIMIT 1
          FOR UPDATE
        `,
        [
          tokenPayload.userId,
          tokenPayload.email,
        ]
      );

    if (users.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return createExpiredResetCookieResponse(
        {
          success: false,
          error:
            "The account associated with this password reset could not be found.",
        },
        404
      );
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const [updateResult] =
      await connection.execute<ResultSetHeader>(
        `
          UPDATE user_info
          SET password = ?
          WHERE userID = ?
            AND email = ?
        `,
        [
          passwordHash,
          tokenPayload.userId,
          tokenPayload.email,
        ]
      );

    if (updateResult.affectedRows !== 1) {
      throw new Error(
        "The password could not be updated."
      );
    }

    /*
     * Invalidate all password-reset codes for this user
     * after the password has successfully changed.
     */
    await connection.execute<ResultSetHeader>(
      `
        UPDATE email_confirmation_codes
        SET invalidated_at = COALESCE(
          invalidated_at,
          NOW()
        )
        WHERE user_id = ?
          AND purpose = 'reset_password'
      `,
      [tokenPayload.userId]
    );

    await connection.commit();
    transactionStarted = false;

    const response = NextResponse.json({
      success: true,
      message:
        "Your password has been updated successfully.",
    });

    /*
     * The reset token can only be used once.
     */
    response.cookies.set(
      "sonic_password_reset_token",
      "",
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  } catch (error) {
    console.error("Reset password error:", error);

    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Failed to roll back password reset:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while resetting the password.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}