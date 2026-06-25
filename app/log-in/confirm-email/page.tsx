"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const RESEND_COOLDOWN_SECONDS = 30;

export default function ConfirmEmailCodePage() {
  const [code, setCode] = useState("");
  const [resendSecondsLeft, setResendSecondsLeft] = useState(
    RESEND_COOLDOWN_SECONDS
  );
  const router = useRouter();

  function startResendCooldown() {
    setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  function handleConfirmCode() {
    router.push("/log-in");
    console.log("Confirm code clicked", {
      code,
    });
  }

  function handleResendCode() {
    // TODO: Add resend email code API route call here later.
    console.log("Resend code clicked");

    startResendCooldown();
  }

  function handleBackToCreateAccount() {
    router.push("/log-in/create-account");
    console.log("Back to create account clicked");
  }

  function handleCodeChange(value: string) {
    const numbersOnly = value.replace(/\D/g, "").slice(0, 6);
    setCode(numbersOnly);
  }

  useEffect(() => {
    if (resendSecondsLeft <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSecondsLeft]);

  const isResendDisabled = resendSecondsLeft > 0;

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 font-sans text-zinc-900">
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-8 flex justify-center">
            <Image
              src="/sonic_dev_logo.png"
              alt="Sonic Dev Logo"
              width={160}
              height={45}
              className="h-auto w-[170px]"
              priority
            />
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">Confirm Email</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Enter the 6-digit code we sent to your email.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Confirmation Code
              </label>

              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(event) => handleCodeChange(event.target.value)}
                placeholder="000000"
                maxLength={6}
                className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-center text-2xl font-bold tracking-[0.35em] outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />

              <p className="mt-2 text-xs text-zinc-400">
                Code must be 6 digits.
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfirmCode}
              disabled={code.length !== 6}
              className="cursor-pointer mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm Email
            </button>

            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResendDisabled}
              className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResendDisabled
                ? `Resend Code (${resendSecondsLeft}s)`
                : "Resend Code"}
            </button>

            <Link
              href="/create-account"
              onClick={handleBackToCreateAccount}
              className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Back to Create Account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}