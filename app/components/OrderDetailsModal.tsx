// src/app/sonic/components/OrderDetailsModal.tsx

"use client";

import { useEffect, useState, type ReactNode } from "react";

type VendorQuote = {
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
};

type OrderDetailsModalProps<TOrder> = {
  selectedOrderDetails: TOrder | null;
  onClose: () => void;
  getIsRush: (order: TOrder) => boolean;
  formatCellValue: (value: unknown) => string;
};

export default function OrderDetailsModal<
  TOrder extends {
    id: number | string;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    customer_company?: string | null;
    date_created?: string | null;
    status_id?: number | string | null;
    status?: string | null;
    subtotal_ex_tax?: string | number | null;
    custom_status?: string | null;
    product_name?: string | null;
    product_quantity?: number | string | null;
    product_sku?: string | null;
    product_total_ex_tax?: string | number | null;
    product_total_inc_tax?: string | number | null;
    staff_notes?: string | null;
    customer_message?: string | null;
  }
>({
  selectedOrderDetails,
  onClose,
  getIsRush,
  formatCellValue,
}: OrderDetailsModalProps<TOrder>) {
  const [isAddVendorQuoteOpen, setIsAddVendorQuoteOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [vendorQuotes, setVendorQuotes] = useState<VendorQuote[]>([]);
  const [isLoadingVendorQuotes, setIsLoadingVendorQuotes] = useState(false);
  const [isSavingVendorQuote, setIsSavingVendorQuote] = useState(false);
  const [vendorQuoteError, setVendorQuoteError] = useState("");

  useEffect(() => {
    const orderId = selectedOrderDetails?.id;

    if (!orderId) {
      setVendorQuotes([]);
      return;
    }

    async function loadVendorQuotes() {
      try {
        setIsLoadingVendorQuotes(true);
        setVendorQuoteError("");

        const response = await fetch(
          `/api/sonic/order-vendor-details?order_id=${encodeURIComponent(
            String(orderId)
          )}`
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || data?.success === false) {
          throw new Error(
            data?.error || data?.message || "Failed to load vendor quotes."
          );
        }

        setVendorQuotes(data?.data ? [data.data] : []);
      } catch (error) {
        console.error("Load vendor quotes failed:", error);

        setVendorQuotes([]);
        setVendorQuoteError(
          error instanceof Error
            ? error.message
            : "Failed to load vendor quotes."
        );
      } finally {
        setIsLoadingVendorQuotes(false);
      }
    }

    loadVendorQuotes();
  }, [selectedOrderDetails?.id]);

  if (!selectedOrderDetails) {
    return null;
  }

  async function handleAddVendorQuote() {
    if (!selectedOrderDetails) {
      return;
    }

    const trimmedVendorName = vendorName.trim();

    if (!trimmedVendorName) {
      setVendorQuoteError("Vendor name is required.");
      return;
    }

    try {
      setIsSavingVendorQuote(true);
      setVendorQuoteError("");

      const response = await fetch("/api/sonic/order-vendor-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: selectedOrderDetails.id,
          vendor_name: trimmedVendorName,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error || data?.message || "Failed to add vendor quote."
        );
      }

      const createdVendorQuote: VendorQuote = data?.vendorQuote || {
        id: data?.id || `${selectedOrderDetails.id}-${Date.now()}`,
        order_id: selectedOrderDetails.id,
        vendor_name: trimmedVendorName,
      };

      setVendorQuotes((currentQuotes) => [
        ...currentQuotes,
        createdVendorQuote,
      ]);

      setVendorName("");
      setIsAddVendorQuoteOpen(false);
    } catch (error) {
      console.error("Add vendor quote failed:", error);

      setVendorQuoteError(
        error instanceof Error
          ? error.message
          : "Failed to add vendor quote."
      );
    } finally {
      setIsSavingVendorQuote(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-3">
            <div className="min-w-0">
              <h2 className="break-words text-lg font-bold text-zinc-900">
                Order #{selectedOrderDetails.id}
              </h2>

              <p className="mt-0.5 break-words text-sm text-zinc-500">
                {selectedOrderDetails.customer_name || "Unknown Customer"} •{" "}
                {selectedOrderDetails.status || "Unknown Status"}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200"
            >
              Close
            </button>
          </div>

          <div className="max-h-[80vh] overflow-auto p-4">
            <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <span
                className={`inline-flex min-w-0 max-w-full items-center gap-2 break-words rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  getIsRush(selectedOrderDetails)
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-zinc-300 bg-white text-zinc-500"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    getIsRush(selectedOrderDetails)
                      ? "bg-red-600"
                      : "bg-zinc-300"
                  }`}
                />
                {getIsRush(selectedOrderDetails) ? "Rush" : "Normal"}
              </span>

              <span className="min-w-0 max-w-full break-words rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                Status: {selectedOrderDetails.status || "Unknown"}
              </span>

              <span className="min-w-0 max-w-full break-words rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                Customer: {selectedOrderDetails.customer_name || "Unknown"}
              </span>

              <span className="min-w-0 max-w-full break-words rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                Order ID: {selectedOrderDetails.id}
              </span>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0">
                <div className="grid gap-3 lg:grid-cols-3">
                  <DetailCard title="Customer">
                    <DetailRow
                      label="Name"
                      value={selectedOrderDetails.customer_name}
                    />
                    <DetailRow
                      label="Email"
                      value={selectedOrderDetails.customer_email}
                      breakAll
                    />
                    <DetailRow
                      label="Phone"
                      value={selectedOrderDetails.customer_phone}
                    />
                    <DetailRow
                      label="Company"
                      value={selectedOrderDetails.customer_company}
                    />
                  </DetailCard>

                  <DetailCard title="Order">
                    <DetailRow
                      label="Date"
                      value={formatCellValue(selectedOrderDetails.date_created)}
                    />
                    <DetailRow
                      label="Status ID"
                      value={selectedOrderDetails.status_id}
                    />
                    <DetailRow
                      label="Status"
                      value={selectedOrderDetails.status}
                    />
                    <DetailRow
                      label="Subtotal"
                      value={formatCellValue(
                        selectedOrderDetails.subtotal_ex_tax
                      )}
                    />
                    <DetailRow
                      label="Custom Status"
                      value={selectedOrderDetails.custom_status}
                    />
                  </DetailCard>

                  <DetailCard title="Product">
                    <DetailRow
                      label="Product"
                      value={selectedOrderDetails.product_name}
                    />
                    <DetailRow
                      label="Quantity"
                      value={selectedOrderDetails.product_quantity}
                    />
                    <DetailRow
                      label="SKU"
                      value={selectedOrderDetails.product_sku}
                      breakAll
                    />
                    <DetailRow
                      label="Ex Tax"
                      value={formatCellValue(
                        selectedOrderDetails.product_total_ex_tax
                      )}
                    />
                    <DetailRow
                      label="Inc Tax"
                      value={formatCellValue(
                        selectedOrderDetails.product_total_inc_tax
                      )}
                    />
                  </DetailCard>
                </div>

                {(selectedOrderDetails.staff_notes ||
                  selectedOrderDetails.customer_message) && (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {selectedOrderDetails.staff_notes && (
                      <TextCard title="Staff Notes">
                        {selectedOrderDetails.staff_notes}
                      </TextCard>
                    )}

                    {selectedOrderDetails.customer_message && (
                      <TextCard title="Customer Message">
                        {selectedOrderDetails.customer_message}
                      </TextCard>
                    )}
                  </div>
                )}
              </div>

              <VendorQuoteManagement
                vendorQuotes={vendorQuotes}
                isLoading={isLoadingVendorQuotes}
                error={vendorQuoteError}
                onAddClick={() => {
                  setVendorQuoteError("");
                  setVendorName("");
                  setIsAddVendorQuoteOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {isAddVendorQuoteOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Add Vendor Quote
                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  This will create a vendor quote row for order #
                  {selectedOrderDetails.id}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isSavingVendorQuote) return;

                  setIsAddVendorQuoteOpen(false);
                  setVendorName("");
                  setVendorQuoteError("");
                }}
                className="cursor-pointer rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              <label className="block text-xs font-bold uppercase tracking-wide text-zinc-500">
                Vendor Name
              </label>

              <input
                type="text"
                value={vendorName}
                onChange={(event) => {
                  setVendorName(event.target.value);
                  setVendorQuoteError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleAddVendorQuote();
                  }
                }}
                placeholder="Enter vendor name"
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
                autoFocus
              />

              {vendorQuoteError && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  {vendorQuoteError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingVendorQuote}
                  onClick={() => {
                    setIsAddVendorQuoteOpen(false);
                    setVendorName("");
                    setVendorQuoteError("");
                  }}
                  className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isSavingVendorQuote}
                  onClick={handleAddVendorQuote}
                  className="cursor-pointer rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingVendorQuote ? "Adding..." : "Add Vendor Quote"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VendorQuoteManagement({
  vendorQuotes,
  isLoading,
  error,
  onAddClick,
}: {
  vendorQuotes: VendorQuote[];
  isLoading: boolean;
  error: string;
  onAddClick: () => void;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            Vendor Quote Management
          </h3>

          <p className="mt-1 text-xs text-zinc-500">
            Add vendors for this order and view saved vendor quote rows.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddClick}
          className="cursor-pointer shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-700"
        >
          Add a new vendor quote
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-2">
        {isLoading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-zinc-500">
              Loading vendor quotes...
            </p>
          </div>
        ) : vendorQuotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-zinc-500">
              No vendor quotes added yet.
            </p>
          </div>
        ) : (
          vendorQuotes.map((quote) => (
            <div
              key={quote.id}
              className="rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-zinc-900">
                    {quote.vendor_name}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Quote ID: {quote.id}
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-bold uppercase text-zinc-500">
                  Vendor
                </span>
              </div>

              {(quote.sku ||
                quote.description ||
                quote.print_details ||
                quote.prod_day ||
                quote.shipping_day ||
                quote.price ||
                quote.vendor_location) && (
                <div className="mt-3 grid gap-1.5 border-t border-zinc-100 pt-2 text-xs">
                  <MiniDetail label="SKU" value={quote.sku} />
                  <MiniDetail label="Description" value={quote.description} />
                  <MiniDetail label="Print" value={quote.print_details} />
                  <MiniDetail label="Prod Day" value={quote.prod_day} />
                  <MiniDetail label="Shipping" value={quote.shipping_day} />
                  <MiniDetail label="Price" value={quote.price} />
                  <MiniDetail label="Location" value={quote.vendor_location} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MiniDetail({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
      <span className="text-zinc-400">{label}</span>
      <span className="break-words font-semibold text-zinc-800">{value}</span>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>

      <div className="grid gap-1.5 text-xs">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: ReactNode;
  breakAll?: boolean;
}) {
  return (
    <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
      <span className="text-zinc-400">{label}</span>
      <span
        className={`font-semibold text-zinc-800 ${
          breakAll ? "break-all" : "break-words"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function TextCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
        {title}
      </p>

      <p className="max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs font-medium text-zinc-800">
        {children}
      </p>
    </div>
  );
}