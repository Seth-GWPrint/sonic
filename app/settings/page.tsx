"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import VendorsSettings from "../components/VendorSettings";
import StagesManager from "../components/StageSettings";
import ActionSettings from "../components/ActionSettings";
import AuditLog from "../components/AuditLog";
import PricingSettings from "../components/PricingSettings";

export default function SettingsPage() {

  const handleLogOut = async () => {
    try {
      await fetch("/api/sonic/log-out", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.href = "/log-in";
    }
  };

  const handleSubmitAuditLog = async ({
    entity_type,
    entity_id,
    action,
    field_name = null,
    old_value = null,
    new_value = null,
    metadata = null,
  }: {
    entity_type: string;
    entity_id: number;
    action: string;
    field_name?: string | null;
    old_value?: string | number | boolean | null;
    new_value?: string | number | boolean | null;
    metadata?: unknown;
  }) => {
    const response = await fetch("/api/sonic/update-audit-log", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_type,
        entity_id,
        action,
        field_name,
        old_value,
        new_value,
        metadata,
      }),
    });

    const rawText = await response.text();

    let data: any;

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(rawText || "Server returned a non-JSON response.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Failed to submit audit log.");
    }

    return data;
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans text-zinc-900">
      <div className="mb-6 flex items-center justify-between">
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLogOut}
            className="cursor-pointer rounded-xl border border-zinc-300 bg-[#AA0000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#CC0000]"
          >
            Log Out
          </button>

          <Link
            href="/"
            className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            Return
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1800px]">
        {/* Page Description Box */}
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold">Settings</h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage dashboard configuration, order statuses, and other Sonic order
            dashboard settings.
          </p>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <ActionSettings />
          <StagesManager />
          <VendorsSettings />
          <AuditLog />
          <PricingSettings />
        </div>
      </main>
    </div>
  );
}