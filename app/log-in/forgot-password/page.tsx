"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const RESEND_COOLDOWN_SECONDS = 30;

type PasswordResetApiResponse = {
  success: boolean;
  error?: string;
  message?: string;
  verified?: boolean;
  attemptsRemaining?: number;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const [hasRequestedCode, setHasRequestedCode] =
    useState(false);

  const [resendSecondsLeft, setResendSecondsLeft] =
    useState(0);

  const [isRequestingCode, setIsRequestingCode] =
    useState(false);

  const [isVerifyingCode, setIsVerifyingCode] =
    useState(false);

  const [isResendingCode, setIsResendingCode] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const router = useRouter();

  const trimmedEmail = email.trim().toLowerCase();

  const isEmailValid =
    trimmedEmail.length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  const isBusy =
    isRequestingCode ||
    isVerifyingCode ||
    isResendingCode;

  const canRequestCode =
    isEmailValid &&
    !hasRequestedCode &&
    !isBusy;

  const canConfirmCode =
    hasRequestedCode &&
    code.length === 6 &&
    !isBusy;

  const isResendDisabled =
    resendSecondsLeft > 0 ||
    !hasRequestedCode ||
    !isEmailValid ||
    isBusy;

  function startResendCooldown() {
    setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  function handleCodeChange(value: string) {
    const numbersOnly = value
      .replace(/\D/g, "")
      .slice(0, 6);

    setCode(numbersOnly);
    setErrorMessage("");
  }

  async function requestPasswordResetCode(
    isResend = false
  ) {
    if (!isEmailValid || isBusy) {
      return;
    }

    if (isResend) {
      setIsResendingCode(true);
    } else {
      setIsRequestingCode(true);
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        "/api/sonic/email-confirmation-codes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "request_password_reset",
            email: trimmedEmail,
          }),
        }
      );

      const data =
        (await response.json()) as PasswordResetApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "The password reset code could not be sent."
        );
      }

      setHasRequestedCode(true);
      setCode("");

      setSuccessMessage(
        data.message ||
          "If that email exists, a reset code has been sent."
      );

      startResendCooldown();
    } catch (error) {
      console.error(
        "Password reset code request error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The password reset code could not be sent."
      );
    } finally {
      setIsRequestingCode(false);
      setIsResendingCode(false);
    }
  }

  async function handleConfirmCode() {
    if (!canConfirmCode) {
      return;
    }

    setIsVerifyingCode(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        "/api/sonic/email-confirmation-codes",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "verify_password_reset",
            email: trimmedEmail,
            code,
          }),
        }
      );

      const data =
        (await response.json()) as PasswordResetApiResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.verified
      ) {
        throw new Error(
          data.error ||
            "The password reset code could not be verified."
        );
      }

      /*
       * The verification API should set a temporary,
       * HTTP-only password reset cookie before returning.
       */
      sessionStorage.setItem(
        "pending-password-reset-email",
        trimmedEmail
      );

      router.push("/log-in/reset-password");
    } catch (error) {
      console.error(
        "Password reset verification error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The password reset code could not be verified."
      );
    } finally {
      setIsVerifyingCode(false);
    }
  }

  function handleUseDifferentEmail() {
    setHasRequestedCode(false);
    setCode("");
    setResendSecondsLeft(0);
    setErrorMessage("");
    setSuccessMessage("");
  }

  useEffect(() => {
    if (resendSecondsLeft <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendSecondsLeft((current) =>
        Math.max(current - 1, 0)
      );
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resendSecondsLeft]);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 font-sans text-zinc-900">
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-8 flex justify-center">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="cursor-pointer transition-transform duration-150 hover:scale-95"
              aria-label="Return to dashboard"
            >
              <Image
                src="/sonic_dev_logo.png"
                alt="Sonic Dev Logo"
                width={140}
                height={40}
                className="h-auto w-[160px]"
                priority
              />
            </button>
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">
              Forgot Password
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Enter your email and we’ll send you a
              6-digit reset code.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();

              if (hasRequestedCode) {
                void handleConfirmCode();
              } else {
                void requestPasswordResetCode();
              }
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={hasRequestedCode || isBusy}
                aria-invalid={
                  email.length > 0 && !isEmailValid
                }
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 ${
                  email.length > 0 && !isEmailValid
                    ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                    : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-200"
                }`}
              />

              {email.length > 0 && !isEmailValid && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  Enter a valid email address.
                </p>
              )}
            </div>

            {!hasRequestedCode && (
              <button
                type="submit"
                disabled={!canRequestCode}
                className="mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
              >
                {isRequestingCode
                  ? "Sending Code..."
                  : "Send Reset Code"}
              </button>
            )}

            {hasRequestedCode && (
              <>
                <div>
                  <label
                    htmlFor="resetCode"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Reset Code
                  </label>

                  <input
                    id="resetCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) =>
                      handleCodeChange(event.target.value)
                    }
                    placeholder="000000"
                    maxLength={6}
                    disabled={isBusy}
                    aria-invalid={
                      code.length > 0 &&
                      code.length !== 6
                    }
                    className={`w-full rounded-xl border px-3 py-3 text-center text-2xl font-bold tracking-[0.35em] outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100 ${
                      code.length > 0 &&
                      code.length !== 6
                        ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                        : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-200"
                    }`}
                  />

                  <p className="mt-2 text-xs text-zinc-400">
                    Code must be 6 digits.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!canConfirmCode}
                  className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
                >
                  {isVerifyingCode
                    ? "Confirming..."
                    : "Confirm Code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void requestPasswordResetCode(true);
                  }}
                  disabled={isResendDisabled}
                  className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  {isResendingCode
                    ? "Sending..."
                    : resendSecondsLeft > 0
                      ? `Resend Code (${resendSecondsLeft}s)`
                      : "Resend Code"}
                </button>

                <button
                  type="button"
                  onClick={handleUseDifferentEmail}
                  disabled={isBusy}
                  className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use a Different Email
                </button>
              </>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
              >
                {successMessage}
              </div>
            )}

            <Link
              href="/log-in"
              aria-disabled={isBusy}
              onClick={(event) => {
                if (isBusy) {
                  event.preventDefault();
                }
              }}
              className={`rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-700 transition ${
                isBusy
                  ? "pointer-events-none cursor-not-allowed bg-zinc-100 opacity-60"
                  : "hover:bg-zinc-100"
              }`}
            >
              Back to Log In
            </Link>
          </form>
        </div>
      </main>
    </div>
  );
}