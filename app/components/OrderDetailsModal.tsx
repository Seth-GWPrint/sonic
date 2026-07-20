// src/app/sonic/components/OrderDetailsModal.tsx

"use client";

import { useEffect, useState, type ReactNode } from "react";
import DefineVendorQuote, { type VendorQuoteDetails } from "./DefineVendorQuote";
import type { Vendor, OrderProductOption, OrderOptionsProduct, OrderDetailsModalProps } from "../types/OrderTypes";

const VENDORS_API_URL = "/api/sonic/vendors";

type VendorQuote = VendorQuoteDetails;

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
    product_id?: number | string | null;
    line_item_id?: number | string | null;
    product_name?: string | null;
    product_quantity?: number | string | null;
    product_sku?: string | null;
    product_total_ex_tax?: string | number | null;
    product_total_inc_tax?: string | number | null;
    products?: {
      id: number | string;
      product_id?: number | string | null;
      line_item_id?: number | string | null;
      product_name?: string | null;
      product_quantity?: number | string | null;
      product_sku?: string | null;
      product_total_ex_tax?: string | number | null;
      product_total_inc_tax?: string | number | null;
    }[];
    staff_notes?: string | null;
    customer_message?: string | null;
    proof_approved_date?: string | number | null;
  }
>({
  selectedOrderDetails,
  onClose,
  getIsRush,
  formatCellValue,
  shippingAddress,
  onStaffNotesUpdated,
}: OrderDetailsModalProps<TOrder>) {
  const [isAddVendorQuoteOpen, setIsAddVendorQuoteOpen] = useState(false);
  const [vendorQuoteModalMode, setVendorQuoteModalMode] = useState<"vendor-list" | "new-vendor">("vendor-list");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [isSavingNewVendor, setIsSavingNewVendor] = useState(false);
  const [isCreatingQuoteFromVendor, setIsCreatingQuoteFromVendor] = useState(false);
  const [vendorListError, setVendorListError] = useState("");

  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorLocation, setNewVendorLocation] = useState("");
  const [newVendorContactName, setNewVendorContactName] = useState("");
  const [newVendorEmail, setNewVendorEmail] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorNotes, setNewVendorNotes] = useState("");

  const [vendorQuotes, setVendorQuotes] = useState<VendorQuote[]>([]);
  const [isLoadingVendorQuotes, setIsLoadingVendorQuotes] = useState(false);
  const [vendorQuoteError, setVendorQuoteError] = useState("");
  const [selectedVendorQuote, setSelectedVendorQuote] = useState<VendorQuote | null>(null);

  const [orderOptionsProducts, setOrderOptionsProducts] = useState<OrderOptionsProduct[]>([]);
  const [isLoadingOrderOptions, setIsLoadingOrderOptions] = useState(false);
  const [orderOptionsError, setOrderOptionsError] = useState("");

  const [orderNotes, setOrderNotes] = useState("");
  const [savedOrderNotes, setSavedOrderNotes] = useState("");
  const [isSavingOrderNotes, setIsSavingOrderNotes] = useState(false);
  const [orderNotesError, setOrderNotesError] = useState("");
  const [orderNotesSuccess, setOrderNotesSuccess] = useState("");

  const [orderNotesLastEditedBy, setOrderNotesLastEditedBy] = useState<string | null>(null);
  const [isLoadingOrderNotesEditor, setIsLoadingOrderNotesEditor] = useState(false);

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
          )}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || data?.success === false) {
          throw new Error(
            data?.error || data?.message || "Failed to load vendor quotes."
          );
        }

        setVendorQuotes(
          Array.isArray(data?.vendorQuotes) ? data.vendorQuotes : []
        );
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

  useEffect(() => {
    const orderId = selectedOrderDetails?.id;
 
    if (orderId === undefined || orderId === null || orderId === "") {
      setOrderNotesLastEditedBy(null);
      setIsLoadingOrderNotesEditor(false);
      return;
    }

    const controller = new AbortController();

    async function loadLastOrderNotesEditor() {
      try {
        setIsLoadingOrderNotesEditor(true);
        setOrderNotesLastEditedBy(null);

        const response = await fetch("/api/sonic/pull-audit-log", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        const data: {
          success?: boolean;
          error?: string;
          auditLog?: Array<{
            id: number;
            username: string | null;
            entity_type: string | null;
            entity_id: number | string | null;
            action: string | null;
            field_name: string | null;
            created_at: string | null;
          }>;
        } | null = await response.json().catch(() => null);

        if (!response.ok || data?.success === false) {
          throw new Error(
            data?.error || "Failed to load the order notes editor."
          );
        }

        const auditRows = Array.isArray(data?.auditLog)
          ? data.auditLog
          : [];

        const mostRecentNotesAudit = auditRows
          .filter((audit) => {
            return (
              audit.entity_type === "order" &&
              String(audit.entity_id) === String(orderId) &&
              audit.field_name === "staff_notes"
            );
          })
          .sort((firstAudit, secondAudit) => {
            const firstDate = firstAudit.created_at
              ? new Date(firstAudit.created_at).getTime()
              : 0;

            const secondDate = secondAudit.created_at
              ? new Date(secondAudit.created_at).getTime()
              : 0;

            if (secondDate !== firstDate) {
              return secondDate - firstDate;
            }

            return secondAudit.id - firstAudit.id;
          })[0];

        const username = mostRecentNotesAudit?.username?.trim();

        setOrderNotesLastEditedBy(username || null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Load order notes last editor failed:", error);
        setOrderNotesLastEditedBy(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOrderNotesEditor(false);
        }
      }
    }

    loadLastOrderNotesEditor();

    return () => {
      controller.abort();
    };
  }, [selectedOrderDetails?.id]);

  useEffect(() => {
    const staffNotes = selectedOrderDetails?.staff_notes ?? "";

    setOrderNotes(staffNotes);
    setSavedOrderNotes(staffNotes);
    setOrderNotesError("");
    setOrderNotesSuccess("");
  }, [selectedOrderDetails?.id, selectedOrderDetails?.staff_notes]);

  useEffect(() => {
    const orderId = selectedOrderDetails?.id;

    if (orderId === undefined || orderId === null || orderId === "") {
      setOrderNotesLastEditedBy(null);
      setIsLoadingOrderNotesEditor(false);
      return;
    }

    const controller = new AbortController();

    async function loadLastOrderNotesEditor() {
      try {
        setIsLoadingOrderNotesEditor(true);

        const response = await fetch(
          `/api/sonic/order-notes-last-editor?orderId=${encodeURIComponent(
            String(orderId)
          )}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || data?.success === false) {
          throw new Error(
            data?.error || "Failed to load the order notes editor."
          );
        }

        // Only set it if we actually found an editor string, otherwise fall back gracefully
        if (typeof data?.lastEditedBy === "string" && data.lastEditedBy.trim() !== "") {
          setOrderNotesLastEditedBy(data.lastEditedBy.trim());
        } else {
          setOrderNotesLastEditedBy(null);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Load order notes last editor failed:", error);
        setOrderNotesLastEditedBy(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOrderNotesEditor(false);
        }
      }
    }

    loadLastOrderNotesEditor();

    return () => {
      controller.abort();
    };
  }, [selectedOrderDetails?.id]); // Keeps reference stability checked solely against the ID primitives

  if (!selectedOrderDetails) {
    return null;
  }

  const selectedOrderProducts =
    selectedOrderDetails.products && selectedOrderDetails.products.length > 0
      ? selectedOrderDetails.products
      : [selectedOrderDetails];

  function getVendorDisplayName(vendor: Vendor) {
    return vendor.vendor_name || vendor.name || "Unnamed Vendor";
  }

  function getVendorLocation(vendor: Vendor) {
    return vendor.vendor_location || vendor.location || "";
  }

  function clearNewVendorForm() {
    setNewVendorName("");
    setNewVendorLocation("");
    setNewVendorContactName("");
    setNewVendorEmail("");
    setNewVendorPhone("");
    setNewVendorNotes("");
  }

  async function loadVendors() {
    try {
      setIsLoadingVendors(true);
      setVendorListError("");

      const response = await fetch(VENDORS_API_URL, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || "Failed to load vendors.");
      }

      const vendorRows =
        data?.vendors || data?.rows || data?.data || data?.vendorRows || [];

      setVendors(Array.isArray(vendorRows) ? vendorRows : []);
    } catch (error) {
      console.error("Load vendors failed:", error);

      setVendors([]);
      setVendorListError(
        error instanceof Error ? error.message : "Failed to load vendors."
      );
    } finally {
      setIsLoadingVendors(false);
    }
  }

  function handleOpenAddVendorQuote() {
    setVendorQuoteError("");
    setVendorListError("");
    setVendorQuoteModalMode("vendor-list");
    clearNewVendorForm();
    setIsAddVendorQuoteOpen(true);
    loadVendors();
  }

  async function handleCreateQuoteFromVendor(vendor: Vendor) {
    const orderId = selectedOrderDetails?.id;

    if (!orderId) {
      setVendorListError("No order is currently selected.");
      return;
    }

    const vendorName = getVendorDisplayName(vendor).trim();

    if (!vendorName) {
      setVendorListError("This vendor is missing a vendor name.");
      return;
    }

    try {
      setIsCreatingQuoteFromVendor(true);
      setVendorListError("");

      const response = await fetch("/api/sonic/order-vendor-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
          vendor_id: vendor.id,
          vendor_name: vendorName,
          vendor_location: getVendorLocation(vendor),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error || data?.message || "Failed to add vendor quote."
        );
      }

      const createdVendorQuote: VendorQuote =
        data?.vendorQuote ||
        data?.data || {
          id: data?.id || `${orderId}-${Date.now()}`,
          order_id: orderId,
          vendor_name: vendorName,
          vendor_location: getVendorLocation(vendor),
        };

      setVendorQuotes((currentQuotes) => [
        ...currentQuotes,
        createdVendorQuote,
      ]);

      setIsAddVendorQuoteOpen(false);
      setVendorQuoteModalMode("vendor-list");
      clearNewVendorForm();

      setSelectedVendorQuote(createdVendorQuote);
    } catch (error) {
      console.error("Create quote from vendor failed:", error);

      setVendorListError(
        error instanceof Error
          ? error.message
          : "Failed to add vendor quote."
      );
    } finally {
      setIsCreatingQuoteFromVendor(false);
    }
  }

  async function handleCreateNewVendor() {
    const trimmedVendorName = newVendorName.trim();

    if (!trimmedVendorName) {
      setVendorListError("Vendor name is required.");
      return;
    }

    try {
      setIsSavingNewVendor(true);
      setVendorListError("");

      const response = await fetch(VENDORS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendor_name: trimmedVendorName,
          name: trimmedVendorName,
          vendor_location: newVendorLocation.trim(),
          location: newVendorLocation.trim(),
          contact_name: newVendorContactName.trim(),
          contact_email: newVendorEmail.trim(),
          email: newVendorEmail.trim(),
          contact_phone: newVendorPhone.trim(),
          phone: newVendorPhone.trim(),
          notes: newVendorNotes.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || "Failed to add vendor.");
      }

      clearNewVendorForm();

      setVendorQuoteModalMode("vendor-list");

      const createdVendor: Vendor | null =
        data?.vendor || data?.data || data?.row || null;

      if (createdVendor) {
        setVendors((currentVendors) => [...currentVendors, createdVendor]);
      } else {
        await loadVendors();
      }
    } catch (error) {
      console.error("Create vendor failed:", error);

      setVendorListError(
        error instanceof Error ? error.message : "Failed to add vendor."
      );
    } finally {
      setIsSavingNewVendor(false);
    }
  }

  async function handleSaveOrderNotes() {
    const orderId = selectedOrderDetails?.id;

    if (!orderId) {
      setOrderNotesError("No order is currently selected.");
      return;
    }

    try {
      setIsSavingOrderNotes(true);
      setOrderNotesError("");
      setOrderNotesSuccess("");

      const response = await fetch("/api/sonic/update-order-notes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          staffNotes: orderNotes,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Failed to update the order notes."
        );
      }

      const updatedStaffNotes =
        typeof data?.staff_notes === "string"
          ? data.staff_notes
          : orderNotes;

      setOrderNotes(updatedStaffNotes);
      setSavedOrderNotes(updatedStaffNotes);
      setOrderNotesSuccess("Order notes saved.");

      if (data?.changed !== false && typeof data?.username === "string") {
        setOrderNotesLastEditedBy(data.username.trim() || null);
      }

      onStaffNotesUpdated?.(orderId, updatedStaffNotes);
    } catch (error) {
      console.error("Update order notes failed:", error);

      setOrderNotesError(
        error instanceof Error
          ? error.message
          : "Failed to update the order notes."
      );
    } finally {
      setIsSavingOrderNotes(false);
    }
  }

  function getMatchingOrderOptionsProduct(productRow: {
    product_id?: number | string | null;
    line_item_id?: number | string | null;
    product_name?: string | null;
    product_sku?: string | null;
  }) {
    return orderOptionsProducts.find((product) => {
      const selectedProductId = productRow.product_id;
      const selectedLineItemId = productRow.line_item_id;
      const selectedSku = productRow.product_sku;
      const selectedName = productRow.product_name;

      const productId = product.product_id ?? product.id;
      const lineItemId = product.line_item_id;
      const productSku = product.sku ?? product.product_sku;
      const productName = product.name ?? product.product_name;

      if (
        selectedLineItemId &&
        lineItemId &&
        String(selectedLineItemId) === String(lineItemId)
      ) {
        return true;
      }

      if (
        selectedProductId &&
        productId &&
        String(selectedProductId) === String(productId)
      ) {
        return true;
      }

      if (
        selectedSku &&
        productSku &&
        String(selectedSku) === String(productSku)
      ) {
        return true;
      }

      if (
        selectedName &&
        productName &&
        String(selectedName) === String(productName)
      ) {
        return true;
      }

      return false;
    });
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

            <div className="grid gap-3 xl:grid-cols-[minmax(0,60%)_minmax(420px,40%)]">
              <div className="min-w-0">
                <div className="grid gap-3">
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

                  <DetailCard title="Shipping Address">
                    {shippingAddress ? (
                      <>
                        <DetailRow
                          label="Name"
                          value={[shippingAddress.first_name, shippingAddress.last_name]
                            .filter(Boolean)
                            .join(" ")}
                        />

                        <DetailRow
                          label="Company"
                          value={shippingAddress.company}
                        />

                        <DetailRow
                          label="Address"
                          value={shippingAddress.street_1}
                        />

                        {shippingAddress.street_2 && (
                          <DetailRow
                            label="Address 2"
                            value={shippingAddress.street_2}
                          />
                        )}

                        <DetailRow
                          label="City"
                          value={shippingAddress.city}
                        />

                        <DetailRow
                          label="State"
                          value={shippingAddress.state}
                        />

                        <DetailRow
                          label="ZIP"
                          value={shippingAddress.zip}
                        />

                        <DetailRow
                          label="Country"
                          value={shippingAddress.country}
                        />

                        <DetailRow
                          label="Phone"
                          value={shippingAddress.phone}
                        />

                        <DetailRow
                          label="Email"
                          value={shippingAddress.email}
                          breakAll
                        />

                        <DetailRow
                          label="Method"
                          value={shippingAddress.shipping_method}
                        />
                      </>
                    ) : (
                      <p className="text-xs font-semibold text-zinc-500">
                        No shipping address found.
                      </p>
                    )}
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
                    <DetailRow
                      label="Proof Approved"
                      value={formatCellValue(
                        selectedOrderDetails.proof_approved_date
                      )}
                    />
                  </DetailCard>

                  {selectedOrderProducts.map((product, index) => {
                    const matchingOrderOptionsProduct =
                      getMatchingOrderOptionsProduct(product);

                    const selectedProductOptions = Array.isArray(
                      matchingOrderOptionsProduct?.options
                    )
                      ? matchingOrderOptionsProduct.options
                      : [];

                    return (
                      <DetailCard
                        key={`${product.id}-${
                          product.product_sku ?? "product"
                        }-${index}`}
                        title={
                          selectedOrderProducts.length > 1
                            ? `Product ${index + 1}`
                            : "Product"
                        }
                      >
                        <DetailRow
                          label="Product"
                          value={product.product_name}
                        />
                        <DetailRow
                          label="Quantity"
                          value={product.product_quantity}
                        />
                        <DetailRow
                          label="SKU"
                          value={product.product_sku}
                          breakAll
                        />
                        <DetailRow
                          label="Ex Tax"
                          value={formatCellValue(product.product_total_ex_tax)}
                        />
                        <DetailRow
                          label="Inc Tax"
                          value={formatCellValue(product.product_total_inc_tax)}
                        />

                        <ProductOptionsSection
                          options={selectedProductOptions}
                          isLoading={isLoadingOrderOptions}
                          error={orderOptionsError}
                        />
                      </DetailCard>
                    );
                  })}
                </div>

                {selectedOrderDetails.customer_message && (
                  <div className="mt-3">
                    <TextCard title="Customer Message">
                      {selectedOrderDetails.customer_message}
                    </TextCard>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="grid gap-3">
                  <OrderNotesEditor
                    value={orderNotes}
                    isSaving={isSavingOrderNotes}
                    isLoadingLastEditor={isLoadingOrderNotesEditor}
                    lastEditedBy={orderNotesLastEditedBy}
                    hasChanges={orderNotes !== savedOrderNotes}
                    error={orderNotesError}
                    success={orderNotesSuccess}
                    onChange={(value) => {
                      setOrderNotes(value);
                      setOrderNotesError("");
                      setOrderNotesSuccess("");
                    }}
                    onSave={handleSaveOrderNotes}
                    onCancel={() => {
                      setOrderNotes(savedOrderNotes);
                      setOrderNotesError("");
                      setOrderNotesSuccess("");
                    }}
                  />

                  <VendorQuoteManagement
                    vendorQuotes={vendorQuotes}
                    isLoading={isLoadingVendorQuotes}
                    error={vendorQuoteError}
                    onAddClick={handleOpenAddVendorQuote}
                    onVendorQuoteClick={(quote) => {
                      setSelectedVendorQuote(quote);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAddVendorQuoteOpen && (
        <VendorPickerModal
          mode={vendorQuoteModalMode}
          vendors={vendors}
          isLoadingVendors={isLoadingVendors}
          isCreatingQuoteFromVendor={isCreatingQuoteFromVendor}
          isSavingNewVendor={isSavingNewVendor}
          error={vendorListError}
          orderId={selectedOrderDetails.id}
          newVendorName={newVendorName}
          newVendorLocation={newVendorLocation}
          newVendorContactName={newVendorContactName}
          newVendorEmail={newVendorEmail}
          newVendorPhone={newVendorPhone}
          newVendorNotes={newVendorNotes}
          setNewVendorName={setNewVendorName}
          setNewVendorLocation={setNewVendorLocation}
          setNewVendorContactName={setNewVendorContactName}
          setNewVendorEmail={setNewVendorEmail}
          setNewVendorPhone={setNewVendorPhone}
          setNewVendorNotes={setNewVendorNotes}
          onClose={() => {
            if (isCreatingQuoteFromVendor || isSavingNewVendor) return;

            setIsAddVendorQuoteOpen(false);
            setVendorQuoteModalMode("vendor-list");
            setVendorListError("");
            clearNewVendorForm();
          }}
          onBackToVendorList={() => {
            setVendorQuoteModalMode("vendor-list");
            setVendorListError("");
            clearNewVendorForm();
            loadVendors();
          }}
          onAddNewVendorClick={() => {
            setVendorQuoteModalMode("new-vendor");
            setVendorListError("");
          }}
          onCreateNewVendor={handleCreateNewVendor}
          onCreateQuoteFromVendor={handleCreateQuoteFromVendor}
          getVendorDisplayName={getVendorDisplayName}
          getVendorLocation={getVendorLocation}
        />
      )}

      <DefineVendorQuote
        vendorQuote={selectedVendorQuote}
        onClose={() => setSelectedVendorQuote(null)}
        onSaved={(updatedVendorQuote) => {
          setVendorQuotes((currentQuotes) =>
            currentQuotes.map((quote) =>
              String(quote.id) === String(updatedVendorQuote.id)
                ? updatedVendorQuote
                : quote
            )
          );

          setSelectedVendorQuote(null);
        }}
      />
    </>
  );
}

function VendorPickerModal({
  mode,
  vendors,
  isLoadingVendors,
  isCreatingQuoteFromVendor,
  isSavingNewVendor,
  error,
  orderId,
  newVendorName,
  newVendorLocation,
  newVendorContactName,
  newVendorEmail,
  newVendorPhone,
  newVendorNotes,
  setNewVendorName,
  setNewVendorLocation,
  setNewVendorContactName,
  setNewVendorEmail,
  setNewVendorPhone,
  setNewVendorNotes,
  onClose,
  onBackToVendorList,
  onAddNewVendorClick,
  onCreateNewVendor,
  onCreateQuoteFromVendor,
  getVendorDisplayName,
  getVendorLocation,
}: {
  mode: "vendor-list" | "new-vendor";
  vendors: Vendor[];
  isLoadingVendors: boolean;
  isCreatingQuoteFromVendor: boolean;
  isSavingNewVendor: boolean;
  error: string;
  orderId: number | string;
  newVendorName: string;
  newVendorLocation: string;
  newVendorContactName: string;
  newVendorEmail: string;
  newVendorPhone: string;
  newVendorNotes: string;
  setNewVendorName: (value: string) => void;
  setNewVendorLocation: (value: string) => void;
  setNewVendorContactName: (value: string) => void;
  setNewVendorEmail: (value: string) => void;
  setNewVendorPhone: (value: string) => void;
  setNewVendorNotes: (value: string) => void;
  onClose: () => void;
  onBackToVendorList: () => void;
  onAddNewVendorClick: () => void;
  onCreateNewVendor: () => void;
  onCreateQuoteFromVendor: (vendor: Vendor) => void;
  getVendorDisplayName: (vendor: Vendor) => string;
  getVendorLocation: (vendor: Vendor) => string;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="break-words text-base font-bold text-zinc-900">
              {mode === "vendor-list"
                ? "Choose Vendor for Quote"
                : "Add New Vendor"}
            </h3>

            <p className="mt-1 break-words text-xs text-zinc-500">
              Order #{orderId}
            </p>
          </div>

          <button
            type="button"
            disabled={isCreatingQuoteFromVendor || isSavingNewVendor}
            onClick={onClose}
            className="cursor-pointer shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="max-h-[76vh] overflow-auto p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {mode === "vendor-list" ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-zinc-900">
                    Select a vendor
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Picking a vendor creates a quote row for this order.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onAddNewVendorClick}
                  className="cursor-pointer shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100"
                >
                  Add a new vendor
                </button>
              </div>

              <div className="grid gap-2">
                {isLoadingVendors ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
                    <p className="text-xs font-semibold text-zinc-500">
                      Loading vendors...
                    </p>
                  </div>
                ) : vendors.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center">
                    <p className="text-xs font-semibold text-zinc-500">
                      No vendors found yet.
                    </p>
                    <button
                      type="button"
                      onClick={onAddNewVendorClick}
                      className="mt-3 cursor-pointer rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-zinc-700"
                    >
                      Add your first vendor
                    </button>
                  </div>
                ) : (
                  vendors.map((vendor) => (
                    <button
                      type="button"
                      key={vendor.id}
                      disabled={isCreatingQuoteFromVendor}
                      onClick={() => onCreateQuoteFromVendor(vendor)}
                      className="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-zinc-900">
                            {getVendorDisplayName(vendor)}
                          </p>

                          {getVendorLocation(vendor) && (
                            <p className="mt-1 break-words text-xs font-semibold text-zinc-500">
                              {getVendorLocation(vendor)}
                            </p>
                          )}

                          {(vendor.contact_name ||
                            vendor.contact_email ||
                            vendor.email ||
                            vendor.contact_phone ||
                            vendor.phone) && (
                            <p className="mt-1 break-words text-xs text-zinc-500">
                              {[
                                vendor.contact_name,
                                vendor.contact_email || vendor.email,
                                vendor.contact_phone || vendor.phone,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-bold uppercase text-zinc-500">
                          Select
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-zinc-900">
                    New vendor information
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    After saving, you will be returned to the vendor list.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSavingNewVendor}
                  onClick={onBackToVendorList}
                  className="cursor-pointer shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Back to vendors
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Vendor Name">
                  <input
                    type="text"
                    value={newVendorName}
                    onChange={(event) => setNewVendorName(event.target.value)}
                    placeholder="Vendor name"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
                    autoFocus
                  />
                </Field>

                <Field label="Vendor Location">
                  <input
                    type="text"
                    value={newVendorLocation}
                    onChange={(event) =>
                      setNewVendorLocation(event.target.value)
                    }
                    placeholder="City, State, etc."
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
                  />
                </Field>

                <Field label="Contact Name">
                  <input
                    type="text"
                    value={newVendorContactName}
                    onChange={(event) =>
                      setNewVendorContactName(event.target.value)
                    }
                    placeholder="Contact person"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={newVendorEmail}
                    onChange={(event) => setNewVendorEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
                  />
                </Field>

                <Field label="Phone">
                  <input
                    type="text"
                    value={newVendorPhone}
                    onChange={(event) => setNewVendorPhone(event.target.value)}
                    placeholder="Phone number"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
                  />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Notes">
                  <textarea
                    value={newVendorNotes}
                    onChange={(event) => setNewVendorNotes(event.target.value)}
                    rows={4}
                    placeholder="Any general vendor notes"
                    className="w-full resize-y rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
                  />
                </Field>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  disabled={isSavingNewVendor}
                  onClick={onBackToVendorList}
                  className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isSavingNewVendor}
                  onClick={onCreateNewVendor}
                  className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingNewVendor ? "Saving..." : "Save Vendor"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderNotesEditor({
  value,
  isSaving,
  isLoadingLastEditor,
  lastEditedBy,
  hasChanges,
  error,
  success,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  isSaving: boolean;
  isLoadingLastEditor: boolean;
  lastEditedBy: string | null;
  hasChanges: boolean;
  error: string;
  success: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
          Order Notes
        </h3>

        <p className="mt-1 text-xs text-zinc-500">
          Internal staff notes for this order.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        placeholder="Enter internal order notes..."
        className="w-full resize-y rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500"
      />

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
          {success}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {lastEditedBy && (
            <p className="break-words text-xs font-medium text-zinc-500">
              Last Edited by:{" "}
              <span className="font-bold text-zinc-700">
                {lastEditedBy}
              </span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasChanges && (
            <button
              type="button"
              disabled={isSaving}
              onClick={onCancel}
              className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={isSaving || !hasChanges}
            onClick={onSave}
            className="cursor-pointer rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Notes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VendorQuoteManagement({
  vendorQuotes,
  isLoading,
  error,
  onAddClick,
  onVendorQuoteClick,
}: {
  vendorQuotes: VendorQuote[];
  isLoading: boolean;
  error: string;
  onAddClick: () => void;
  onVendorQuoteClick: (quote: VendorQuote) => void;
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
            <button
              type="button"
              key={quote.id}
              onClick={() => onVendorQuoteClick(quote)}
              className={`w-full cursor-pointer rounded-xl border p-3 text-left transition hover:border-zinc-400 ${
                quote.selected_vendor
                  ? "border-zinc-400 bg-green-200 hover:bg-green-300"
                  : "border-zinc-200 bg-white hover:bg-zinc-50"
              }`}
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
            </button>
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

function ProductOptionsSection({
  options,
  isLoading,
  error,
}: {
  options: OrderProductOption[];
  isLoading: boolean;
  error: string;
}) {
  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
        Loading product options...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
        {error}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
        No product options found.
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
        Product Options
      </p>

      <div className="grid gap-1.5">
        {options.map((option, index) => {
          const label =
            option.display_name ||
            option.option_name ||
            option.name ||
            `Option ${index + 1}`;

          const value =
            option.display_value ??
            option.option_value ??
            option.value ??
            "—";

          return (
            <DetailRow
              key={`${option.id || option.option_id || label}-${index}`}
              label={String(label)}
              value={String(value)}
              breakAll
            />
          );
        })}
      </div>
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