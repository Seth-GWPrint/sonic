"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateAccountPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  function handleCreateAccount() {
    router.push("/log-in/confirm-email");
    console.log("Create account clicked", {
      username,
      email,
      password,
      confirmPassword,
    });
  }

  function handleBackToLogIn() {
    router.push("/log-in");
    console.log("Back to log in clicked");
  }

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
            <h1 className="text-2xl font-bold">Create Account</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Create a Sonic dashboard account.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Ex. user123"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a password"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your password"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <button
              type="button"
              onClick={handleCreateAccount}
              className="cursor-pointer mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Create Account
            </button>

            <Link
              href="/log-in"
              onClick={handleBackToLogIn}
              className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
            >
              Back to Log In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}