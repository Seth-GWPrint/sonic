"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ResetPasswordResponse = {
  success: boolean;
  error?: string;
  message?: string;
};

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const router = useRouter();

  const isPasswordLongEnough =
    password.length >= 8;

  const doPasswordsMatch =
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const canResetPassword =
    isPasswordLongEnough &&
    doPasswordsMatch &&
    !isSubmitting;

  async function handleResetPassword() {
    if (!canResetPassword) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/sonic/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            password,
            confirmPassword,
          }),
        }
      );

      const data =
        (await response.json()) as ResetPasswordResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Your password could not be reset."
        );
      }

      sessionStorage.removeItem(
        "pending-password-reset-email"
      );

      router.replace("/log-in");
    } catch (error) {
      console.error(
        "Reset password page error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your password could not be reset."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
              Reset Password
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Enter a new password for your Sonic
              account.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleResetPassword();
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                New Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="Enter your new password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={isSubmitting}
                aria-invalid={
                  password.length > 0 &&
                  !isPasswordLongEnough
                }
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100 ${
                  password.length > 0 &&
                  !isPasswordLongEnough
                    ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                    : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-200"
                }`}
              />

              {password.length > 0 &&
                !isPasswordLongEnough && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    Password must be at least 8
                    characters.
                  </p>
                )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                Confirm New Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(
                    event.target.value
                  );
                  setErrorMessage("");
                }}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                aria-invalid={
                  confirmPassword.length > 0 &&
                  !doPasswordsMatch
                }
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100 ${
                  confirmPassword.length > 0 &&
                  !doPasswordsMatch
                    ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                    : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-200"
                }`}
              />

              {confirmPassword.length > 0 &&
                !doPasswordsMatch && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    Passwords do not match.
                  </p>
                )}
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={!canResetPassword}
              className="mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              {isSubmitting
                ? "Updating Password..."
                : "Reset Password"}
            </button>

            <Link
              href="/log-in"
              aria-disabled={isSubmitting}
              onClick={(event) => {
                if (isSubmitting) {
                  event.preventDefault();
                }
              }}
              className={`rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-700 transition ${
                isSubmitting
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