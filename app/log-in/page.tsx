"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogIn() {
    const loginresponse = await fetch("/api/sonic/log-in-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    console.log("Log in clicked", {
      username,
      password,
    });

    const data = await loginresponse.json();

    console.log(data);

    if (data.success) {
      router.push("/");
    }
  }

  function handleForgotPassword() {
    // TODO: Add forgot password flow here later.
    console.log("Forgot password clicked");
  }

  function handleCreateAccount() {
    console.log("Create account clicked");
    router.push("/log-in/create-account");
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
            <h1 className="text-2xl font-bold">Log In</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Sign in to access the Sonic order dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                type="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="myusername"
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
                placeholder="Enter your password"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <button
              type="button"
              onClick={handleLogIn}
              className="cursor-pointer mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Log In
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
            >
              Forgot Password
            </button>

            <button
              type="button"
              onClick={handleCreateAccount}
              className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
            >
              Create Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}