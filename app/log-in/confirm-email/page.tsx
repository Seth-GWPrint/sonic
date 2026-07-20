"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const RESEND_COOLDOWN_SECONDS = 30;

type ConfirmationApiResponse = {
  success: boolean;
  error?: string;
  message?: string;
  verified?: boolean;
  userId?: string;
  email?: string;
  attemptsRemaining?: number;
  expiresInMinutes?: number;
};

export default function ConfirmEmailCodePage() {
  const [code, setCode] = useState("");

  const [pendingUserId, setPendingUserId] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const [resendSecondsLeft, setResendSecondsLeft] = useState(
    RESEND_COOLDOWN_SECONDS
  );

  const [isPageReady, setIsPageReady] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const router = useRouter();

  const hasPendingAccount =
    pendingUserId.length > 0 && pendingEmail.length > 0;

  const canConfirmCode =
    code.length === 6 &&
    hasPendingAccount &&
    !isConfirming &&
    !isResending;

  const isResendDisabled =
    resendSecondsLeft > 0 ||
    !hasPendingAccount ||
    isConfirming ||
    isResending;

  function startResendCooldown() {
    setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  function clearPendingConfirmation() {
    sessionStorage.removeItem("pending-confirmation-user-id");
    sessionStorage.removeItem("pending-confirmation-email");
    sessionStorage.removeItem(
      "pending-confirmation-expires-in-minutes"
    );
  }

  function handleCodeChange(value: string) {
    const numbersOnly = value.replace(/\D/g, "").slice(0, 6);

    setCode(numbersOnly);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleConfirmCode() {
    if (!canConfirmCode) {
      return;
    }

    setIsConfirming(true);
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
            action: "verify",
            userId: pendingUserId,
            code,
          }),
        }
      );

      const data =
        (await response.json()) as ConfirmationApiResponse;

      if (!response.ok || !data.success || !data.verified) {
        throw new Error(
          data.error || "The confirmation code could not be verified."
        );
      }

      clearPendingConfirmation();

      setSuccessMessage(
        data.message || "Your email has been confirmed."
      );

      router.replace("/log-in");
    } catch (error) {
      console.error("Confirm email error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The confirmation code could not be verified."
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleResendCode() {
    if (isResendDisabled) {
      return;
    }

    setIsResending(true);
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
            userId: pendingUserId,
            email: pendingEmail,
          }),
        }
      );

      const data =
        (await response.json()) as ConfirmationApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "A new confirmation code could not be sent."
        );
      }

      setCode("");

      setSuccessMessage(
        data.message || "A new confirmation code was sent."
      );

      startResendCooldown();
    } catch (error) {
      console.error("Resend confirmation code error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A new confirmation code could not be sent."
      );
    } finally {
      setIsResending(false);
    }
  }

  useEffect(() => {
    const storedUserId = sessionStorage.getItem(
      "pending-confirmation-user-id"
    );

    const storedEmail = sessionStorage.getItem(
      "pending-confirmation-email"
    );

    if (storedUserId && storedEmail) {
      setPendingUserId(storedUserId);
      setPendingEmail(storedEmail);
    } else {
      setErrorMessage(
        "No pending email confirmation was found. Create an account or request a new confirmation code."
      );
    }

    setIsPageReady(true);
  }, []);

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
              Confirm Email
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Enter the 6-digit code we sent to your email.
            </p>

            {pendingEmail && (
              <p className="mt-1 break-all text-sm font-medium text-zinc-700">
                {pendingEmail}
              </p>
            )}
          </div>

          {!isPageReady ? (
            <p className="text-center text-sm text-zinc-500">
              Loading confirmation information...
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleConfirmCode();
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <label
                  htmlFor="confirmationCode"
                  className="mb-1 block text-sm font-medium text-zinc-700"
                >
                  Confirmation Code
                </label>

                <input
                  id="confirmationCode"
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
                  disabled={
                    !hasPendingAccount ||
                    isConfirming ||
                    isResending
                  }
                  aria-invalid={
                    code.length > 0 && code.length !== 6
                  }
                  className={`w-full rounded-xl border px-3 py-3 text-center text-2xl font-bold tracking-[0.35em] outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100 ${
                    code.length > 0 && code.length !== 6
                      ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                      : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-200"
                  }`}
                />

                <p className="mt-2 text-xs text-zinc-400">
                  Code must be 6 digits.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                >
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
                >
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={!canConfirmCode}
                className="mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
              >
                {isConfirming
                  ? "Confirming..."
                  : "Confirm Email"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleResendCode();
                }}
                disabled={isResendDisabled}
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                {isResending
                  ? "Sending..."
                  : resendSecondsLeft > 0
                    ? `Resend Code (${resendSecondsLeft}s)`
                    : "Resend Code"}
              </button>

              <Link
                href="/log-in/create-account"
                aria-disabled={isConfirming || isResending}
                onClick={(event) => {
                  if (isConfirming || isResending) {
                    event.preventDefault();
                  }
                }}
                className={`rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-700 transition ${
                  isConfirming || isResending
                    ? "pointer-events-none cursor-not-allowed bg-zinc-100 opacity-60"
                    : "cursor-pointer hover:bg-zinc-100"
                }`}
              >
                Back to Create Account
              </Link>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}