import { NextRequest, NextResponse } from "next/server";
import mysql, {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

const CODE_EXPIRATION_MINUTES = 15;

type ExistingUserRow = RowDataPacket & {
  id: number;
  userID: string | null;
  username: string;
  email: string;
};

type ConfirmationCodeRow = RowDataPacket & {
  id: number;
  user_id: string;
  email: string;
  code_hash: string;
  attempt_count: number;
  max_attempts: number;
  is_expired: number;
};

const PASSWORD_RESET_EXPIRATION_MINUTES = 15;

function getPasswordResetSecret() {
  const secret = process.env.PASSWORD_RESET_SECRET;

  if (!secret) {
    throw new Error(
      "Missing PASSWORD_RESET_SECRET environment variable."
    );
  }

  return secret;
}

function createPasswordResetToken(
  userId: string,
  email: string
) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      email,
      purpose: "reset_password",
      expiresAt:
        Date.now() +
        PASSWORD_RESET_EXPIRATION_MINUTES * 60 * 1000,
    })
  ).toString("base64url");

  const signature = createHmac(
    "sha256",
    getPasswordResetSecret()
  )
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

async function sendPasswordResetEmail(
  email: string,
  code: string
) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || "465");
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (
    !smtpHost ||
    !smtpUser ||
    !smtpPassword ||
    !smtpFrom ||
    !Number.isInteger(smtpPort)
  ) {
    throw new Error("Missing SMTP environment variables.");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Reset your Sonic password",
    text: [
      "Your Sonic password reset code is:",
      "",
      code,
      "",
      `This code expires in ${PASSWORD_RESET_EXPIRATION_MINUTES} minutes.`,
      "",
      "If you did not request a password reset, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #18181b;">
        <h2>Reset your Sonic password</h2>

        <p>Your six-digit password reset code is:</p>

        <div
          style="
            display: inline-block;
            margin: 12px 0;
            padding: 14px 22px;
            border-radius: 10px;
            background: #f4f4f5;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 8px;
          "
        >
          ${code}
        </div>

        <p>
          This code expires in
          ${PASSWORD_RESET_EXPIRATION_MINUTES} minutes.
        </p>

        <p style="color: #71717a; font-size: 13px;">
          If you did not request a password reset, you can ignore this email.
        </p>
      </div>
    `,
  });
}

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

function getConfirmationSecret() {
  const secret = process.env.EMAIL_CONFIRMATION_SECRET;

  if (!secret) {
    throw new Error(
      "Missing EMAIL_CONFIRMATION_SECRET environment variable."
    );
  }

  return secret;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateConfirmationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashConfirmationCode(code: string) {
  return createHmac("sha256", getConfirmationSecret())
    .update(code)
    .digest("hex");
}

function confirmationCodesMatch(
  submittedCode: string,
  storedCodeHash: string
) {
  const submittedHash = Buffer.from(
    hashConfirmationCode(submittedCode),
    "hex"
  );

  const storedHash = Buffer.from(storedCodeHash, "hex");

  return (
    submittedHash.length === storedHash.length &&
    timingSafeEqual(submittedHash, storedHash)
  );
}

async function sendConfirmationEmail(email: string, code: string) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || "465");
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (
    !smtpHost ||
    !smtpUser ||
    !smtpPassword ||
    !smtpFrom ||
    !Number.isInteger(smtpPort)
  ) {
    throw new Error("Missing SMTP environment variables.");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Confirm your Sonic account",
    text: [
      "Your Sonic confirmation code is:",
      "",
      code,
      "",
      `This code expires in ${CODE_EXPIRATION_MINUTES} minutes.`,
      "",
      "If you did not create this account, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #18181b;">
        <h2>Confirm your Sonic account</h2>

        <p>Your six-digit confirmation code is:</p>

        <div
          style="
            display: inline-block;
            margin: 12px 0;
            padding: 14px 22px;
            border-radius: 10px;
            background: #f4f4f5;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 8px;
          "
        >
          ${code}
        </div>

        <p>
          This code expires in
          ${CODE_EXPIRATION_MINUTES} minutes.
        </p>

        <p style="color: #71717a; font-size: 13px;">
          If you did not create this account, you can ignore this email.
        </p>
      </div>
    `,
  });
}

/**
 * POST
 *
 * Create a new account and its first confirmation code:
 * {
 *   username: string;
 *   email: string;
 *   password: string;
 * }
 *
 * Resend/create another code for an existing account:
 * {
 *   userId: string;
 *   email: string;
 * }
 */
export async function POST(request: NextRequest) {
  let connection: mysql.Connection | null = null;
  let transactionStarted = false;

  let userId = "";
  let confirmationCodeId: number | null = null;
  let createdNewUser = false;

  try {
    const body = await request.json();

    const action =
      typeof body.action === "string"
        ? body.action.trim()
        : "";

    if (action === "request_password_reset") {
      const email =
        typeof body.email === "string"
          ? body.email.trim().toLowerCase()
          : "";

      if (!email || !isValidEmail(email)) {
        return NextResponse.json(
          {
            success: false,
            error: "Enter a valid email address.",
          },
          { status: 400 }
        );
      }

      connection = await mysql.createConnection(getDbConfig());

      const [users] =
        await connection.execute<ExistingUserRow[]>(
          `
            SELECT
              id,
              userID,
              username,
              email
            FROM user_info
            WHERE email = ?
            LIMIT 1
          `,
          [email]
        );

      /*
      * Do not reveal whether the email exists.
      */
      if (users.length === 0 || !users[0].userID) {
        return NextResponse.json({
          success: true,
          message:
            "If that email exists, a reset code has been sent.",
        });
      }

      const user = users[0];

      await connection.beginTransaction();
      transactionStarted = true;

      await connection.execute<ResultSetHeader>(
        `
          UPDATE email_confirmation_codes
          SET invalidated_at = NOW()
          WHERE user_id = ?
            AND purpose = 'reset_password'
            AND verified_at IS NULL
            AND invalidated_at IS NULL
        `,
        [user.userID]
      );

      const resetCode = generateConfirmationCode();
      const resetCodeHash = hashConfirmationCode(resetCode);

      const [insertResult] =
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO email_confirmation_codes (
              user_id,
              email,
              code_hash,
              purpose,
              attempt_count,
              max_attempts,
              expires_at
            )
            VALUES (
              ?,
              ?,
              ?,
              'reset_password',
              0,
              5,
              DATE_ADD(
                NOW(),
                INTERVAL ${PASSWORD_RESET_EXPIRATION_MINUTES} MINUTE
              )
            )
          `,
          [user.userID, email, resetCodeHash]
        );

      await connection.commit();
      transactionStarted = false;

      try {
        await sendPasswordResetEmail(email, resetCode);
      } catch (emailError) {
        console.error(
          "Failed to send password reset email:",
          emailError
        );

        await connection.execute<ResultSetHeader>(
          `
            UPDATE email_confirmation_codes
            SET invalidated_at = NOW()
            WHERE id = ?
          `,
          [insertResult.insertId]
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "The password reset email could not be sent.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "If that email exists, a reset code has been sent.",
        expiresInMinutes:
          PASSWORD_RESET_EXPIRATION_MINUTES,
      });
    }

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const requestedUserId =
      typeof body.userId === "string"
        ? body.userId.trim()
        : "";

    const isCreatingAccount =
      username.length > 0 && password.length > 0;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid email address.",
        },
        { status: 400 }
      );
    }

    if (!isCreatingAccount && !requestedUserId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Username and password are required when creating an account.",
        },
        { status: 400 }
      );
    }

    if (isCreatingAccount && password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    await connection.beginTransaction();
    transactionStarted = true;

    if (isCreatingAccount) {
      const [existingUsers] =
        await connection.execute<ExistingUserRow[]>(
          `
            SELECT
              id,
              userID,
              username,
              email
            FROM user_info
            WHERE username = ?
               OR email = ?
            LIMIT 1
            FOR UPDATE
          `,
          [username, email]
        );

      if (existingUsers.length > 0) {
        await connection.rollback();
        transactionStarted = false;

        const existingUser = existingUsers[0];

        const error =
          existingUser.email.toLowerCase() === email
            ? "An account already exists with that email address."
            : "That username is already in use.";

        return NextResponse.json(
          {
            success: false,
            error,
          },
          { status: 409 }
        );
      }

      userId = randomUUID();

      const passwordHash = await bcrypt.hash(password, 12);

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO user_info (
            username,
            password,
            email,
            userID
          )
          VALUES (?, ?, ?, ?)
        `,
        [username, passwordHash, email, userId]
      );

      createdNewUser = true;
    } else {
      userId = requestedUserId;

      const [users] =
        await connection.execute<ExistingUserRow[]>(
          `
            SELECT
              id,
              userID,
              username,
              email
            FROM user_info
            WHERE userID = ?
              AND email = ?
            LIMIT 1
            FOR UPDATE
          `,
          [userId, email]
        );

      if (users.length === 0) {
        await connection.rollback();
        transactionStarted = false;

        return NextResponse.json(
          {
            success: false,
            error: "The account could not be found.",
          },
          { status: 404 }
        );
      }
    }

    /*
     * Invalidate any previous unused confirmation codes.
     */
    await connection.execute<ResultSetHeader>(
      `
        UPDATE email_confirmation_codes
        SET invalidated_at = NOW()
        WHERE user_id = ?
          AND purpose = 'confirm_email'
          AND verified_at IS NULL
          AND invalidated_at IS NULL
      `,
      [userId]
    );

    const confirmationCode = generateConfirmationCode();
    const confirmationCodeHash =
      hashConfirmationCode(confirmationCode);

    const [insertResult] =
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO email_confirmation_codes (
            user_id,
            email,
            code_hash,
            purpose,
            attempt_count,
            max_attempts,
            expires_at
          )
          VALUES (
            ?,
            ?,
            ?,
            'confirm_email',
            0,
            5,
            DATE_ADD(NOW(), INTERVAL ${CODE_EXPIRATION_MINUTES} MINUTE)
          )
        `,
        [userId, email, confirmationCodeHash]
      );

    confirmationCodeId = insertResult.insertId;

    await connection.commit();
    transactionStarted = false;

    try {
      await sendConfirmationEmail(email, confirmationCode);
    } catch (emailError) {
      console.error(
        "Failed to send confirmation email:",
        emailError
      );

      /*
       * Remove a newly-created account if its first confirmation
       * email could not be sent. The foreign key will also delete
       * its confirmation code.
       */
      if (createdNewUser) {
        await connection.execute<ResultSetHeader>(
          `
            DELETE FROM user_info
            WHERE userID = ?
          `,
          [userId]
        );
      } else if (confirmationCodeId) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE email_confirmation_codes
            SET invalidated_at = NOW()
            WHERE id = ?
          `,
          [confirmationCodeId]
        );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "The account could not be created because the confirmation email failed to send.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: createdNewUser
          ? "Account created and confirmation code sent."
          : "A new confirmation code was sent.",
        userId,
        email,
        expiresInMinutes: CODE_EXPIRATION_MINUTES,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Email confirmation code POST error:",
      error
    );

    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Failed to roll back transaction:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while creating the account.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * PATCH
 *
 * Verify a code:
 * {
 *   action: "verify";
 *   userId: string;
 *   code: string;
 * }
 *
 * Invalidate active codes:
 * {
 *   action: "invalidate";
 *   userId: string;
 * }
 */
export async function PATCH(request: NextRequest) {
  let connection: mysql.Connection | null = null;
  let transactionStarted = false;

  try {
    const body = await request.json();

    const action =
      typeof body.action === "string"
        ? body.action.trim()
        : "";

    connection = await mysql.createConnection(getDbConfig());

    if (action === "verify_password_reset") {
      const email =
        typeof body.email === "string"
          ? body.email.trim().toLowerCase()
          : "";

      const code =
        typeof body.code === "string"
          ? body.code.trim()
          : "";

      if (!email || !isValidEmail(email)) {
        return NextResponse.json(
          {
            success: false,
            error: "Enter a valid email address.",
          },
          { status: 400 }
        );
      }

      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          {
            success: false,
            error: "Enter a valid six-digit reset code.",
          },
          { status: 400 }
        );
      }

      connection = await mysql.createConnection(getDbConfig());

      await connection.beginTransaction();
      transactionStarted = true;

      const [rows] =
        await connection.execute<ConfirmationCodeRow[]>(
          `
            SELECT
              id,
              user_id,
              email,
              code_hash,
              attempt_count,
              max_attempts,
              CASE
                WHEN expires_at <= NOW() THEN 1
                ELSE 0
              END AS is_expired
            FROM email_confirmation_codes
            WHERE email = ?
              AND purpose = 'reset_password'
              AND verified_at IS NULL
              AND invalidated_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
          `,
          [email]
        );

      if (rows.length === 0) {
        await connection.rollback();
        transactionStarted = false;

        return NextResponse.json(
          {
            success: false,
            error:
              "No active password reset code was found. Request a new code.",
          },
          { status: 404 }
        );
      }

      const resetRow = rows[0];

      if (resetRow.is_expired === 1) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE email_confirmation_codes
            SET invalidated_at = NOW()
            WHERE id = ?
          `,
          [resetRow.id]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json(
          {
            success: false,
            error:
              "This reset code has expired. Request a new code.",
          },
          { status: 410 }
        );
      }

      if (
        resetRow.attempt_count >= resetRow.max_attempts
      ) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE email_confirmation_codes
            SET invalidated_at = NOW()
            WHERE id = ?
          `,
          [resetRow.id]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json(
          {
            success: false,
            error:
              "Too many incorrect attempts. Request a new code.",
          },
          { status: 429 }
        );
      }

      const isMatch = confirmationCodesMatch(
        code,
        resetRow.code_hash
      );

      if (!isMatch) {
        await connection.execute<ResultSetHeader>(
          `
            UPDATE email_confirmation_codes
            SET
              attempt_count = attempt_count + 1,
              invalidated_at = CASE
                WHEN attempt_count + 1 >= max_attempts
                  THEN NOW()
                ELSE invalidated_at
              END
            WHERE id = ?
          `,
          [resetRow.id]
        );

        await connection.commit();
        transactionStarted = false;

        const attemptsRemaining = Math.max(
          0,
          resetRow.max_attempts -
            resetRow.attempt_count -
            1
        );

        return NextResponse.json(
          {
            success: false,
            error:
              attemptsRemaining > 0
                ? `Incorrect code. ${attemptsRemaining} attempt${
                    attemptsRemaining === 1 ? "" : "s"
                  } remaining.`
                : "Too many incorrect attempts. Request a new code.",
            attemptsRemaining,
          },
          { status: 400 }
        );
      }

      await connection.execute<ResultSetHeader>(
        `
          UPDATE email_confirmation_codes
          SET verified_at = NOW()
          WHERE id = ?
        `,
        [resetRow.id]
      );

      await connection.commit();
      transactionStarted = false;

      const passwordResetToken =
        createPasswordResetToken(
          resetRow.user_id,
          resetRow.email
        );

      const response = NextResponse.json({
        success: true,
        verified: true,
        message:
          "Reset code verified successfully.",
      });

      response.cookies.set(
        "sonic_password_reset_token",
        passwordResetToken,
        {
          httpOnly: true,
          sameSite: "lax",
          secure:
            process.env.NODE_ENV === "production",
          path: "/",
          maxAge:
            PASSWORD_RESET_EXPIRATION_MINUTES * 60,
        }
      );

      return response;
    }

    const userId =
      typeof body.userId === "string"
        ? body.userId.trim()
        : "";

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "A user ID is required.",
        },
        { status: 400 }
      );
    }

    if (action === "invalidate") {
      const [result] =
        await connection.execute<ResultSetHeader>(
          `
            UPDATE email_confirmation_codes
            SET invalidated_at = NOW()
            WHERE user_id = ?
              AND purpose = 'confirm_email'
              AND verified_at IS NULL
              AND invalidated_at IS NULL
          `,
          [userId]
        );

      return NextResponse.json({
        success: true,
        invalidatedCount: result.affectedRows,
      });
    }

    if (action !== "verify") {
      return NextResponse.json(
        {
          success: false,
          error:
            'Action must be either "verify" or "invalidate".',
        },
        { status: 400 }
      );
    }

    const code =
      typeof body.code === "string"
        ? body.code.trim()
        : "";

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid six-digit confirmation code.",
        },
        { status: 400 }
      );
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] =
      await connection.execute<ConfirmationCodeRow[]>(
        `
          SELECT
            id,
            user_id,
            email,
            code_hash,
            attempt_count,
            max_attempts,
            CASE
              WHEN expires_at <= NOW() THEN 1
              ELSE 0
            END AS is_expired
          FROM email_confirmation_codes
          WHERE user_id = ?
            AND purpose = 'confirm_email'
            AND verified_at IS NULL
            AND invalidated_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [userId]
      );

    if (rows.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        {
          success: false,
          error:
            "No active confirmation code was found. Request a new code.",
        },
        { status: 404 }
      );
    }

    const confirmationRow = rows[0];

    if (confirmationRow.is_expired === 1) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE email_confirmation_codes
          SET invalidated_at = NOW()
          WHERE id = ?
        `,
        [confirmationRow.id]
      );

      await connection.commit();
      transactionStarted = false;

      return NextResponse.json(
        {
          success: false,
          error:
            "This confirmation code has expired. Request a new code.",
        },
        { status: 410 }
      );
    }

    if (
      confirmationRow.attempt_count >=
      confirmationRow.max_attempts
    ) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE email_confirmation_codes
          SET verified_at = NOW()
          WHERE id = ?
        `,
        [confirmationRow.id]
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE user_info
          SET email_verified_at = NOW()
          WHERE userID = ?
            AND email = ?
        `,
        [
          confirmationRow.user_id,
          confirmationRow.email,
        ]
      );

      await connection.commit();
      transactionStarted = false;

      return NextResponse.json(
        {
          success: false,
          error:
            "Too many incorrect attempts. Request a new code.",
        },
        { status: 429 }
      );
    }

    const isMatch = confirmationCodesMatch(
      code,
      confirmationRow.code_hash
    );

    if (!isMatch) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE email_confirmation_codes
          SET
            attempt_count = attempt_count + 1,
            invalidated_at = CASE
              WHEN attempt_count + 1 >= max_attempts
                THEN NOW()
              ELSE invalidated_at
            END
          WHERE id = ?
        `,
        [confirmationRow.id]
      );

      await connection.commit();
      transactionStarted = false;

      const attemptsRemaining = Math.max(
        0,
        confirmationRow.max_attempts -
          confirmationRow.attempt_count -
          1
      );

      return NextResponse.json(
        {
          success: false,
          error:
            attemptsRemaining > 0
              ? `Incorrect code. ${attemptsRemaining} attempt${
                  attemptsRemaining === 1 ? "" : "s"
                } remaining.`
              : "Too many incorrect attempts. Request a new code.",
          attemptsRemaining,
        },
        { status: 400 }
      );
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE email_confirmation_codes
        SET verified_at = NOW()
        WHERE id = ?
      `,
      [confirmationRow.id]
    );

    const [userUpdateResult] =
      await connection.execute<ResultSetHeader>(
        `
          UPDATE user_info
          SET email_verified_at = NOW()
          WHERE userID = ?
      `,
      [confirmationRow.user_id]
    );

    if (userUpdateResult.affectedRows !== 1) {
      throw new Error(
        "The user account could not be marked as email verified."
      );
    }

    await connection.commit();
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      verified: true,
      userId: confirmationRow.user_id,
      email: confirmationRow.email,
      message: "Email address confirmed successfully.",
    });

  } catch (error) {
    console.error(
      "Email confirmation code PATCH error:",
      error
    );

    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Failed to roll back transaction:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while checking the confirmation code.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * DELETE /api/sonic/email-confirmation-codes?id=123
 */
export async function DELETE(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const codeId = Number(searchParams.get("id"));

    if (!Number.isInteger(codeId) || codeId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid confirmation code record ID is required.",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(getDbConfig());

    const [result] =
      await connection.execute<ResultSetHeader>(
        `
          DELETE FROM email_confirmation_codes
          WHERE id = ?
        `,
        [codeId]
      );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Confirmation code record not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Confirmation code record deleted.",
    });
  } catch (error) {
    console.error(
      "Email confirmation code DELETE error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while deleting the confirmation code.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}