"use client";

import { useEffect, useState } from "react";

export type VendorQuoteDetails = {
  id: number | string;
  order_id: number | string;
  sku?: string | null;
  description?: string | null;
  print_details?: string | null;
  vendor_name: string;
  prod_day?: string | null;
  shipping_day?: string | null;
  price?: string | number | null;
  vendor_location?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  selected_vendor?: boolean | number | null;
};

type DefineVendorQuoteProps = {
  vendorQuote: VendorQuoteDetails | null;
  onClose: () => void;
  onSaved: (updatedVendorQuote: VendorQuoteDetails) => void;
};

export default function DefineVendorQuote({
  vendorQuote,
  onClose,
  onSaved,
}: DefineVendorQuoteProps) {
  const [vendorName, setVendorName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [printDetails, setPrintDetails] = useState("");
  const [prodDay, setProdDay] = useState("");
  const [shippingDay, setShippingDay] = useState("");
  const [price, setPrice] = useState("");
  const [vendorLocation, setVendorLocation] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!vendorQuote) return;

    setVendorName(vendorQuote.vendor_name || "");
    setSku(vendorQuote.sku || "");
    setDescription(vendorQuote.description || "");
    setPrintDetails(vendorQuote.print_details || "");
    setProdDay(vendorQuote.prod_day || "");
    setShippingDay(vendorQuote.shipping_day || "");
    setPrice(
      vendorQuote.price === null || vendorQuote.price === undefined
        ? ""
        : String(vendorQuote.price)
    );
    setVendorLocation(vendorQuote.vendor_location || "");
    setError("");
  }, [vendorQuote]);

  if (!vendorQuote) {
    return null;
  }

  const isSelectedVendor = Boolean(vendorQuote.selected_vendor);

  async function handleSave() {
    if (!vendorQuote) return;

    const trimmedVendorName = vendorName.trim();

    if (!trimmedVendorName) {
      setError("Vendor name is required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");

      const response = await fetch("/api/sonic/order-vendor-details", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: vendorQuote.id,
          orderId: vendorQuote.order_id,
          sku,
          description,
          printDetails,
          vendorName: trimmedVendorName,
          prodDay,
          shippingDay,
          price,
          vendorLocation,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error || data?.message || "Failed to save vendor quote."
        );
      }

      const updatedVendorQuote: VendorQuoteDetails = data?.vendorQuote ||
        data?.data || {
          ...vendorQuote,
          sku,
          description,
          print_details: printDetails,
          vendor_name: trimmedVendorName,
          prod_day: prodDay,
          shipping_day: shippingDay,
          price,
          vendor_location: vendorLocation,
        };

      onSaved(updatedVendorQuote);
      onClose();
    } catch (error) {
      console.error("Save vendor quote failed:", error);

      setError(
        error instanceof Error ? error.message : "Failed to save vendor quote."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleVendorForProduction() {
    if (!vendorQuote) return;

    const trimmedVendorName = vendorName.trim();

    if (!trimmedVendorName) {
        setError("Vendor name is required before selecting this vendor.");
        return;
    }

    const nextSelectedVendorValue = !Boolean(vendorQuote.selected_vendor);

    try {
        setIsSaving(true);
        setError("");

        const response = await fetch("/api/sonic/order-vendor-details", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id: vendorQuote.id,
            orderId: vendorQuote.order_id,
            sku,
            description,
            printDetails,
            vendorName: trimmedVendorName,
            prodDay,
            shippingDay,
            price,
            vendorLocation,
            selectedVendor: nextSelectedVendorValue,
        }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || data?.success === false) {
        throw new Error(
            data?.error ||
            data?.message ||
            "Failed to update vendor production selection."
        );
        }

        const updatedVendorQuote: VendorQuoteDetails = data?.vendorQuote ||
        data?.data || {
            ...vendorQuote,
            sku,
            description,
            print_details: printDetails,
            vendor_name: trimmedVendorName,
            prod_day: prodDay,
            shipping_day: shippingDay,
            price,
            vendor_location: vendorLocation,
            selected_vendor: nextSelectedVendorValue,
        };

        onSaved({
        ...updatedVendorQuote,
        selected_vendor: nextSelectedVendorValue,
        });

        onClose();
    } catch (error) {
        console.error("Toggle vendor production selection failed:", error);

        setError(
        error instanceof Error
            ? error.message
            : "Failed to update vendor production selection."
        );
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="break-words text-lg font-bold text-zinc-900">
              Define Vendor Quote
            </h3>

            <p className="mt-1 break-words text-xs text-zinc-500">
              Order #{vendorQuote.order_id} • Quote ID #{vendorQuote.id}
            </p>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="cursor-pointer shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="max-h-[78vh] overflow-auto p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Vendor Name">
              <input
                type="text"
                value={vendorName}
                onChange={(event) => setVendorName(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </Field>

            <Field label="Vendor Location">
              <input
                type="text"
                value={vendorLocation}
                onChange={(event) => setVendorLocation(event.target.value)}
                placeholder="City, State, etc."
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </Field>

            <Field label="SKU">
              <input
                type="text"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </Field>

            <Field label="Price">
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </Field>

            <Field label="Production Day">
              <input
                type="text"
                value={prodDay}
                onChange={(event) => setProdDay(event.target.value)}
                placeholder="Example: 5 business days"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </Field>

            <Field label="Shipping Day">
              <input
                type="text"
                value={shippingDay}
                onChange={(event) => setShippingDay(event.target.value)}
                placeholder="Example: 2 business days"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4">
            <Field label="Description">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full resize-y rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </Field>

            <Field label="Print Details">
              <textarea
                value={printDetails}
                onChange={(event) => setPrintDetails(event.target.value)}
                rows={4}
                className="w-full resize-y rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4">
            <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                Cancel
            </button>

            <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isSaving ? "Saving..." : "Save Vendor Quote"}
            </button>

            <button
                type="button"
                disabled={isSaving}
                onClick={handleToggleVendorForProduction}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelectedVendor
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
                >
                {isSaving
                    ? isSelectedVendor
                    ? "Unselecting..."
                    : "Selecting..."
                    : isSelectedVendor
                    ? "Unselect Vendor for Production"
                    : "Select Vendor for Production"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </span>

      {children}
    </label>
  );
}