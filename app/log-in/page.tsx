"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  success: boolean;
  loggedIn: boolean;
  error?: string;
  requiresEmailConfirmation?: boolean;
  userId?: string;
  email?: string;
};

export default function LogInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const router = useRouter();

  const trimmedUsername = username.trim();

  const canLogIn =
    trimmedUsername.length > 0 &&
    password.length > 0 &&
    !isSubmitting;

  async function handleLogIn() {
    if (!canLogIn) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/sonic/log-in-check",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: trimmedUsername,
            password,
          }),
        }
      );

      const data = (await response.json()) as LoginResponse;

      /*
       * The username and password were correct, but the account
       * has not yet confirmed its email address.
       */
      if (data.requiresEmailConfirmation) {
        if (!data.userId || !data.email) {
          throw new Error(
            "The server did not return the required confirmation information."
          );
        }

        sessionStorage.setItem(
          "pending-confirmation-user-id",
          data.userId
        );

        sessionStorage.setItem(
          "pending-confirmation-email",
          data.email
        );

        router.push("/log-in/confirm-email");
        return;
      }

      /*
       * Normal login error, such as an invalid username or password.
       */
      if (
        !response.ok ||
        !data.success ||
        !data.loggedIn
      ) {
        throw new Error(
          data.error || "Invalid username or password."
        );
      }

      /*
       * The API has set the sonic_auth_token cookie.
       */
      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to log in."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleForgotPassword() {
    router.push("/log-in/forgot-password");
  }

  function handleCreateAccount() {
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
            <h1 className="text-2xl font-bold">
              Log In
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Sign in to access the Sonic order dashboard.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogIn();
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                Username
              </label>

              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="myusername"
                autoComplete="username"
                required
                disabled={isSubmitting}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={!canLogIn}
              className="mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              {isSubmitting ? "Logging In..." : "Log In"}
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isSubmitting}
              className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60"
            >
              Forgot Password
            </button>

            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={isSubmitting}
              className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60"
            >
              Create Account
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}