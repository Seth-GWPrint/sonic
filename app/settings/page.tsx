"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type OrderStatusColor = {
  id: number;
  name: string;
  color: string;
};

const DEFAULT_STATUS_COLORS: OrderStatusColor[] = [
  { id: 0, name: "Incomplete", color: "#000000" },
  { id: 1, name: "Pending", color: "#000000" },
  { id: 2, name: "Shipped", color: "#000000" },
  { id: 3, name: "Partially Shipped", color: "#000000" },
  { id: 4, name: "Refunded", color: "#000000" },
  { id: 5, name: "Cancelled", color: "#000000" },
  { id: 6, name: "Declined", color: "#000000" },
  { id: 7, name: "Awaiting Payment", color: "#000000" },
  { id: 8, name: "Awaiting Pickup", color: "#000000" },
  { id: 9, name: "Awaiting Shipment", color: "#000000" },
  { id: 10, name: "Completed", color: "#000000" },
  { id: 11, name: "Awaiting Fulfillment", color: "#000000" },
  { id: 12, name: "Manual Verification Required", color: "#000000" },
  { id: 13, name: "Disputed", color: "#000000" },
  { id: 14, name: "Partially Refunded", color: "#000000" },
];

function isValidHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

export default function SettingsPage() {
  const [isStatusColorsOpen, setIsStatusColorsOpen] = useState(false);
  const [statusColors, setStatusColors] =
    useState<OrderStatusColor[]>(DEFAULT_STATUS_COLORS);
  const [originalStatusColors, setOriginalStatusColors] =
    useState<OrderStatusColor[]>(DEFAULT_STATUS_COLORS);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoadingStatusColors, setIsLoadingStatusColors] = useState(false);

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

  const handleOpenStatusColors = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsStatusColorsOpen(true);
    setIsLoadingStatusColors(true);

    try {
        const response = await fetch("/api/sonic/get-status-colors", {
        method: "GET",
        cache: "no-store",
        });

        const rawText = await response.text();

        let data: any;

        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new Error(rawText || "Server returned a non-JSON response.");
        }

        if (!response.ok) {
          throw new Error(data.error || "Failed to load status colors.");
        }

        const loadedStatusColors = data.rows || DEFAULT_STATUS_COLORS;

        setStatusColors(loadedStatusColors);
        setOriginalStatusColors(loadedStatusColors);
    } catch (error) {
        console.error(error);

        setErrorMessage(
        error instanceof Error
            ? error.message
            : "Something went wrong while loading status colors."
        );
    } finally {
        setIsLoadingStatusColors(false);
    }
  };

  const handleColorChange = (statusId: number, newColor: string) => {
    setStatusColors((currentStatusColors) =>
      currentStatusColors.map((status) =>
        status.id === statusId
          ? {
              ...status,
              color: newColor,
            }
          : status
      )
    );
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

  const handleSaveStatusColors = async () => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const invalidStatus = statusColors.find(
      (status) => !isValidHexColor(status.color)
    );

    if (invalidStatus) {
      setErrorMessage(
        `${invalidStatus.name} needs a valid hex color like #000000. You entered: "${invalidStatus.color}"`
      );
      setIsSaving(false);
      return;
    }

    try {
      await Promise.all(
        statusColors.map(async (status) => {
          const newColor = status.color.trim();

          const response = await fetch("/api/sonic/update-status-color", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              statusId: status.id,
              colorHex: newColor,
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
            throw new Error(
              data.error || `Failed to update ${status.name} color.`
            );
          }

          const originalStatus = originalStatusColors.find(
            (original) => original.id === status.id
          );

          const oldColor = originalStatus?.color?.trim() ?? null;

          if (oldColor !== newColor) {
            await handleSubmitAuditLog({
              entity_type: "status_color",
              entity_id: status.id,
              action: "status_color_changed",
              field_name: "color",
              old_value: oldColor,
              new_value: newColor,
              metadata: {
                status_id: status.id,
                status_name: status.name,
                old_color: oldColor,
                new_color: newColor,
                source: "settings_status_colors_modal",
              },
            });
          }
        })
      );

      setOriginalStatusColors(statusColors);
      setSuccessMessage("Status colors saved.");
      setIsStatusColorsOpen(false);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving status colors."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans text-zinc-900">
      <div className="mb-6 flex items-center justify-between">
        <Image
          src="/sonic_dev_logo.png"
          alt="Sonic Dev Logo"
          width={140}
          height={40}
          className="h-auto w-[160px]"
          priority
        />

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

      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage settings for the Sonic order dashboard.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleOpenStatusColors}
              className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Status Colors
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {successMessage}
          </div>
        )}
      </main>

      {isStatusColorsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Status Colors</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Update the hex color assigned to each order status.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsStatusColorsOpen(false)}
                className="rounded-lg px-2 py-1 text-xl font-semibold leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Close status color settings"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto px-5 py-4">
              {isLoadingStatusColors ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  Loading status colors...
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {statusColors.map((status) => (
                  <div
                    key={status.id}
                    className="grid gap-3 rounded-xl border border-zinc-200 p-3 sm:grid-cols-[1fr_160px_40px] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {status.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Status ID: {status.id}
                      </p>
                    </div>

                    <input
                      type="text"
                      value={status.color}
                      onChange={(event) =>
                        handleColorChange(status.id, event.target.value)
                      }
                      placeholder="#000000"
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                    />

                    <div
                      className="h-10 w-10 rounded-lg border border-zinc-300"
                      style={{
                        backgroundColor: isValidHexColor(status.color)
                          ? status.color
                          : "#ffffff",
                      }}
                      title={status.color}
                    />
                  </div>
                ))}
              </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsStatusColorsOpen(false)}
                disabled={isSaving || isLoadingStatusColors}
                className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveStatusColors}
                disabled={isSaving || isLoadingStatusColors}
                className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}