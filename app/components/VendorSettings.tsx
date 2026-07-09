"use client";

import { useState } from "react";

type Vendor = {
  id: number | string;
  vendor_name: string;
  vendor_location?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  notes?: string | null;
  default_prod_day?: string | null;
  default_shipping_day?: string | null;
  is_active?: boolean | number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EditableVendor = Vendor & {
  originalId: number | string;
  isNew?: boolean;
};

const EMPTY_VENDOR: Omit<EditableVendor, "id" | "originalId"> = {
  vendor_name: "",
  vendor_location: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  website: "",
  notes: "",
  default_prod_day: "",
  default_shipping_day: "",
  is_active: 1,
  isNew: true,
};

function normalizeValue(value: unknown) {
  const cleanValue = String(value ?? "").trim();
  return cleanValue || null;
}

export default function VendorsSettings() {
  const [isVendorsOpen, setIsVendorsOpen] = useState(false);
  const [vendors, setVendors] = useState<EditableVendor[]>([]);
  const [deletedVendors, setDeletedVendors] = useState<EditableVendor[]>([]);

  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [isSavingVendors, setIsSavingVendors] = useState(false);
  const [vendorErrorMessage, setVendorErrorMessage] = useState("");
  const [vendorSuccessMessage, setVendorSuccessMessage] = useState("");

  async function handleOpenVendors() {
    setIsVendorsOpen(true);
    setVendorErrorMessage("");
    setVendorSuccessMessage("");
    setDeletedVendors([]);
    setIsLoadingVendors(true);

    try {
      const response = await fetch("/api/sonic/vendors", {
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

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load vendors.");
      }

      const loadedVendors: EditableVendor[] = Array.isArray(data.vendors)
        ? data.vendors.map((vendor: Vendor) => ({
            ...vendor,
            originalId: vendor.id,
            isNew: false,
          }))
        : [];

      setVendors(loadedVendors);
    } catch (error) {
      console.error("Load vendors failed:", error);

      setVendorErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading vendors."
      );
    } finally {
      setIsLoadingVendors(false);
    }
  }

  function handleAddNewVendor() {
    const temporaryId = Date.now() * -1;

    setVendors((currentVendors) => [
      ...currentVendors,
      {
        id: temporaryId,
        originalId: temporaryId,
        ...EMPTY_VENDOR,
      },
    ]);
  }

  function handleDeleteVendor(vendorToDelete: EditableVendor) {
    setVendors((currentVendors) =>
      currentVendors.filter(
        (vendor) => String(vendor.originalId) !== String(vendorToDelete.originalId)
      )
    );

    if (!vendorToDelete.isNew) {
      setDeletedVendors((currentDeletedVendors) => [
        ...currentDeletedVendors,
        vendorToDelete,
      ]);
    }
  }

  function handleVendorChange(
    originalId: number | string,
    field: keyof EditableVendor,
    value: string
  ) {
    setVendors((currentVendors) =>
      currentVendors.map((vendor) =>
        String(vendor.originalId) === String(originalId)
          ? {
              ...vendor,
              [field]: value,
            }
          : vendor
      )
    );
  }

  async function handleSaveVendors() {
    setIsSavingVendors(true);
    setVendorErrorMessage("");
    setVendorSuccessMessage("");

    const invalidVendor = vendors.find(
      (vendor) => !String(vendor.vendor_name || "").trim()
    );

    if (invalidVendor) {
      setVendorErrorMessage("Each vendor needs a vendor name.");
      setIsSavingVendors(false);
      return;
    }

    try {
      await Promise.all(
        deletedVendors.map(async (vendor) => {
          const response = await fetch("/api/sonic/vendors", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: vendor.originalId,
            }),
          });

          const rawText = await response.text();

          let data: any;

          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            throw new Error(rawText || "Server returned a non-JSON response.");
          }

          if (!response.ok || !data.success) {
            throw new Error(
              data.error || `Failed to delete ${vendor.vendor_name}.`
            );
          }
        })
      );

      const savedVendors = await Promise.all(
        vendors.map(async (vendor) => {
          const payload = {
            id: vendor.originalId,
            vendor_name: String(vendor.vendor_name || "").trim(),
            vendor_location: normalizeValue(vendor.vendor_location),
            contact_name: normalizeValue(vendor.contact_name),
            contact_email: normalizeValue(vendor.contact_email),
            contact_phone: normalizeValue(vendor.contact_phone),
            website: normalizeValue(vendor.website),
            notes: normalizeValue(vendor.notes),
            default_prod_day: normalizeValue(vendor.default_prod_day),
            default_shipping_day: normalizeValue(vendor.default_shipping_day),
          };

          const response = await fetch("/api/sonic/vendors", {
            method: vendor.isNew ? "POST" : "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const rawText = await response.text();

          let data: any;

          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            throw new Error(rawText || "Server returned a non-JSON response.");
          }

          if (!response.ok || !data.success) {
            throw new Error(
              data.error ||
                `Failed to ${vendor.isNew ? "create" : "update"} ${
                  vendor.vendor_name
                }.`
            );
          }

          return data.vendor;
        })
      );

      const normalizedSavedVendors: EditableVendor[] = savedVendors
        .filter(Boolean)
        .map((vendor: Vendor) => ({
          ...vendor,
          originalId: vendor.id,
          isNew: false,
        }))
        .sort((a, b) =>
          String(a.vendor_name || "").localeCompare(String(b.vendor_name || ""))
        );

      setVendors(normalizedSavedVendors);
      setDeletedVendors([]);
      setVendorSuccessMessage("Vendors saved.");
      setIsVendorsOpen(false);
    } catch (error) {
      console.error("Save vendors failed:", error);

      setVendorErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving vendors."
      );
    } finally {
      setIsSavingVendors(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Vendors</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Add, remove, and edit saved vendor information for vendor quotes.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleOpenVendors}
            className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            Change Vendors
          </button>
        </div>
      </div>

      {vendorErrorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {vendorErrorMessage}
        </div>
      )}

      {vendorSuccessMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {vendorSuccessMessage}
        </div>
      )}

      {isVendorsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Change Vendors</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add, delete, and edit vendor information.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsVendorsOpen(false)}
                disabled={isSavingVendors}
                className="rounded-lg px-2 py-1 text-xl font-semibold leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close vendor settings"
              >
                ×
              </button>
            </div>

            <div className="border-b border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={handleAddNewVendor}
                disabled={isSavingVendors || isLoadingVendors}
                className="cursor-pointer rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add New Vendor
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto px-5 py-4">
              {isLoadingVendors ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  Loading vendors...
                </div>
              ) : vendors.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm font-semibold text-zinc-500">
                  No vendors found yet. Click “Add New Vendor” to create one.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {vendors.map((vendor) => (
                    <div
                      key={vendor.originalId}
                      className="rounded-xl border border-zinc-200 p-4"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-zinc-900">
                            {vendor.vendor_name || "New Vendor"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {vendor.isNew
                              ? "Unsaved vendor"
                              : `Vendor ID: ${vendor.id}`}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteVendor(vendor)}
                          disabled={isSavingVendors}
                          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-red-700 text-lg font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Delete vendor ${vendor.vendor_name}`}
                        >
                          ×
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <VendorField label="Vendor Name">
                          <input
                            type="text"
                            value={vendor.vendor_name || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "vendor_name",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>

                        <VendorField label="Vendor Location">
                          <input
                            type="text"
                            value={vendor.vendor_location || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "vendor_location",
                                event.target.value
                              )
                            }
                            placeholder="City, State, etc."
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>

                        <VendorField label="Contact Name">
                          <input
                            type="text"
                            value={vendor.contact_name || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "contact_name",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>

                        <VendorField label="Contact Email">
                          <input
                            type="email"
                            value={vendor.contact_email || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "contact_email",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>

                        <VendorField label="Contact Phone">
                          <input
                            type="text"
                            value={vendor.contact_phone || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "contact_phone",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>

                        <VendorField label="Website">
                          <input
                            type="text"
                            value={vendor.website || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "website",
                                event.target.value
                              )
                            }
                            placeholder="https://example.com"
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>

                        <VendorField label="Default Production Day">
                          <input
                            type="text"
                            value={vendor.default_prod_day || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "default_prod_day",
                                event.target.value
                              )
                            }
                            placeholder="Example: 5 business days"
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>

                        <VendorField label="Default Shipping Day">
                          <input
                            type="text"
                            value={vendor.default_shipping_day || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "default_shipping_day",
                                event.target.value
                              )
                            }
                            placeholder="Example: 2 business days"
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>
                      </div>

                      <div className="mt-4">
                        <VendorField label="Notes">
                          <textarea
                            value={vendor.notes || ""}
                            onChange={(event) =>
                              handleVendorChange(
                                vendor.originalId,
                                "notes",
                                event.target.value
                              )
                            }
                            rows={3}
                            className="w-full resize-y rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </VendorField>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsVendorsOpen(false)}
                disabled={isSavingVendors || isLoadingVendors}
                className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveVendors}
                disabled={isSavingVendors || isLoadingVendors}
                className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingVendors ? "Saving..." : "Save Vendors"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VendorField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-500">
        {label}
      </span>

      {children}
    </label>
  );
}