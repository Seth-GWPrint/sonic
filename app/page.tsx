"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OrderSpreadsheetRow = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  date_created: string | null;
  status_id: number | null;
  status: string | null;
  subtotal_ex_tax: string | null;
  staff_notes: string | null;
  customer_message: string | null;
  custom_status: string | null;
  product_name: string | null;
  product_quantity: number | null;
  product_total_ex_tax: string | null;
  product_total_inc_tax: string | null;
  product_sku: string | null;
  is_rush?: boolean | number | null;
};

const TABLE_BORDER_COLOR_CLASS = "border-zinc-800";
const TABLE_CELL_BORDER_CLASS = `border ${TABLE_BORDER_COLOR_CLASS}`;

const columns: {
  key: keyof OrderSpreadsheetRow;
  label: string;
}[] = [
  { key: "id", label: "Order ID" },
  { key: "customer_id", label: "Customer ID" },
  { key: "customer_name", label: "Customer Name" },
  { key: "customer_email", label: "Customer Email" },
  { key: "customer_phone", label: "Customer Phone" },
  { key: "customer_company", label: "Company" },
  { key: "date_created", label: "Date Created" },
  { key: "status_id", label: "Status ID" },
  { key: "status", label: "Status" },
  { key: "subtotal_ex_tax", label: "Subtotal Ex Tax" },
  { key: "staff_notes", label: "Staff Notes" },
  { key: "customer_message", label: "Customer Message" },
  { key: "custom_status", label: "Custom Status" },
  { key: "product_name", label: "Product Ordered" },
  { key: "product_quantity", label: "Product Quantity" },
  { key: "product_total_ex_tax", label: "Product Total Ex Tax" },
  { key: "product_total_inc_tax", label: "Product Total Inc Tax" },
  { key: "product_sku", label: "Product SKU" },
];

const hiddenColumnKeys: (keyof OrderSpreadsheetRow)[] = [
  "date_created",
  "status_id",
  "subtotal_ex_tax",
  "product_total_ex_tax",
  "product_total_inc_tax",
  "custom_status",
];

const visibleColumns = columns.filter(
  (column) => !hiddenColumnKeys.includes(column.key)
);

const visibleColumnsAfterOrderId = visibleColumns.filter(
  (column) => column.key !== "id"
);

type OrderStatusOption = {
  id: number;
  name: string;
};

type StatusColorRow = {
  id: number;
  name: string;
  color: string;
};

const ORDER_STATUS_OPTIONS: OrderStatusOption[] = [
  { id: 0, name: "Incomplete" },
  { id: 1, name: "Pending" },
  { id: 2, name: "Shipped" },
  { id: 3, name: "Partially Shipped" },
  { id: 4, name: "Refunded" },
  { id: 5, name: "Cancelled" },
  { id: 6, name: "Declined" },
  { id: 7, name: "Awaiting Payment" },
  { id: 8, name: "Awaiting Pickup" },
  { id: 9, name: "Awaiting Shipment" },
  { id: 10, name: "Completed" },
  { id: 11, name: "Awaiting Fulfillment" },
  { id: 12, name: "Manual Verification Required" },
  { id: 13, name: "Disputed" },
  { id: 14, name: "Partially Refunded" },
];

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function getRowName(row: OrderSpreadsheetRow) {
  return row.customer_name || "";
}

function getIsRush(row: OrderSpreadsheetRow) {
  return row.is_rush === true || row.is_rush === 1;
}

export default function Home() {
  const [rows, setRows] = useState<OrderSpreadsheetRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [savingOrderIds, setSavingOrderIds] = useState<number[]>([]);
  const [savingRushOrderIds, setSavingRushOrderIds] = useState<number[]>([]);
  const [statusUpdateMessage, setStatusUpdateMessage] = useState("");
  const [statusColorMap, setStatusColorMap] = useState<Record<number, string>>(
    {}
  );

  const [selectedOrderDetails, setSelectedOrderDetails] =
    useState<OrderSpreadsheetRow | null>(null);

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
    try {
      const response = await fetch("/api/sonic/update-audit-log", {
        method: "POST",
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
    } catch (error) {
      console.error("Failed to submit audit log:", error);
    }
  };

  const handleLoadStatusColors = async () => {
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

      const colorRows: StatusColorRow[] = data.rows || [];

      const nextStatusColorMap = colorRows.reduce<Record<number, string>>(
        (acc, status) => {
          acc[status.id] = status.color;
          return acc;
        },
        {}
      );

      setStatusColorMap(nextStatusColorMap);
    } catch (error) {
      console.error("Failed to load status colors:", error);
    }
  };

  const handleLoadOrders = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/sonic/pull-orders-from-db", {
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
        throw new Error(data.error || "Failed to load orders from database.");
      }

      setRows(data.rows || []);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading orders from the database."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: number,
    newStatusId: number
  ) => {
    const selectedStatus = ORDER_STATUS_OPTIONS.find(
      (status) => status.id === newStatusId
    );

    if (!selectedStatus) {
      setStatusUpdateMessage("Invalid order status selected.");
      return;
    }

    const existingOrder = rows.find((row) => row.id === orderId);

    setSavingOrderIds((current) => [...current, orderId]);
    setStatusUpdateMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/sonic/update-order-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          statusId: selectedStatus.id,
          status: selectedStatus.name,
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
        throw new Error(data.error || "Failed to update order status.");
      }

      await handleSubmitAuditLog({
        entity_type: "order",
        entity_id: orderId,

        action: "order_status_changed",

        field_name: "status",
        old_value: existingOrder?.status ?? null,
        new_value: selectedStatus.name,

        metadata: {
          order_id: orderId,

          old_status_id: existingOrder?.status_id ?? null,
          old_status: existingOrder?.status ?? null,

          new_status_id: selectedStatus.id,
          new_status: selectedStatus.name,

          customer_id: existingOrder?.customer_id ?? null,
          customer_name: existingOrder?.customer_name ?? null,
          customer_email: existingOrder?.customer_email ?? null,
          customer_phone: existingOrder?.customer_phone ?? null,
          customer_company: existingOrder?.customer_company ?? null,

          product_name: existingOrder?.product_name ?? null,
          product_quantity: existingOrder?.product_quantity ?? null,
          product_sku: existingOrder?.product_sku ?? null,

          source: "orders_table_status_dropdown",
        },
      });

      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === orderId
            ? {
                ...row,
                status_id: selectedStatus.id,
                status: selectedStatus.name,
              }
            : row
        )
      );

      setStatusUpdateMessage(`Order ${orderId} status updated.`);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the order status."
      );
    } finally {
      setSavingOrderIds((current) => current.filter((id) => id !== orderId));
    }
  };

  const handleToggleRushOrder = async (orderId: number, nextIsRush: boolean) => {
    setSavingRushOrderIds((current) => [...current, orderId]);
    setStatusUpdateMessage("");
    setErrorMessage("");

    const previousRows = rows;
    const existingOrder = rows.find((row) => row.id === orderId);
    const previousIsRush = existingOrder ? getIsRush(existingOrder) : null;

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === orderId
          ? {
              ...row,
              is_rush: nextIsRush,
            }
          : row
      )
    );

    try {
      const response = await fetch("/api/sonic/update-rush-order", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          isRush: nextIsRush,
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
        throw new Error(data.error || "Failed to update rush order.");
      }

      await handleSubmitAuditLog({
        entity_type: "order",
        entity_id: orderId,

        action: "rush_toggled",

        field_name: "is_rush",
        old_value: previousIsRush,
        new_value: nextIsRush,

        metadata: {
          order_id: orderId,

          old_is_rush: previousIsRush,
          new_is_rush: nextIsRush,

          status_id: existingOrder?.status_id ?? null,
          status: existingOrder?.status ?? null,

          customer_id: existingOrder?.customer_id ?? null,
          customer_name: existingOrder?.customer_name ?? null,
          customer_email: existingOrder?.customer_email ?? null,
          customer_phone: existingOrder?.customer_phone ?? null,
          customer_company: existingOrder?.customer_company ?? null,

          product_name: existingOrder?.product_name ?? null,
          product_quantity: existingOrder?.product_quantity ?? null,
          product_sku: existingOrder?.product_sku ?? null,

          source: "orders_table_rush_toggle",
        },
      });

      setStatusUpdateMessage(
        nextIsRush
          ? `Order ${orderId} marked as rush.`
          : `Order ${orderId} removed from rush.`
      );
    } catch (error) {
      console.error(error);

      setRows(previousRows);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the rush order."
      );
    } finally {
      setSavingRushOrderIds((current) =>
        current.filter((id) => id !== orderId)
      );
    }
  };

  const uniqueStatuses = useMemo(() => {
    const statuses = rows
      .map((row) => row.status)
      .filter((status): status is string => Boolean(status));

    return Array.from(new Set(statuses)).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const cleanOrderIdFilter = orderIdFilter.trim().toLowerCase();
    const cleanNameFilter = nameFilter.trim().toLowerCase();
    const cleanStatusFilter = statusFilter.trim().toLowerCase();

    return rows.filter((row) => {
      const orderId = String(row.id ?? "").toLowerCase();
      const name = getRowName(row).toLowerCase();
      const status = String(row.status ?? "").toLowerCase();

      const matchesOrderId =
        !cleanOrderIdFilter || orderId.includes(cleanOrderIdFilter);

      const matchesName = !cleanNameFilter || name.includes(cleanNameFilter);

      const matchesStatus =
        !cleanStatusFilter || status === cleanStatusFilter;

      return matchesOrderId && matchesName && matchesStatus;
    });
  }, [rows, orderIdFilter, nameFilter, statusFilter]);

  const handleClearFilters = () => {
    setOrderIdFilter("");
    setNameFilter("");
    setStatusFilter("");
  };

  useEffect(() => {
    handleLoadOrders();
    handleLoadStatusColors();
  }, []);

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

        <Link
          href="/settings"
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          Settings
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Filters</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Filter the loaded rows by order ID, customer name, or order status.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Order ID
              </label>
              <input
                type="text"
                value={orderIdFilter}
                onChange={(event) => setOrderIdFilter(event.target.value)}
                placeholder="Example: 424128"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Name
              </label>
              <input
                type="text"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Customer name"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Order Status
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">All statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        {statusUpdateMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {statusUpdateMessage}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-500">
            Showing {filteredRows.length} of {rows.length} product line rows
          </div>

          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-100 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th
                    className={`whitespace-nowrap ${TABLE_CELL_BORDER_CLASS} px-3 py-3 font-bold`}
                  >
                    Order ID
                  </th>

                  <th
                    className={`whitespace-nowrap ${TABLE_CELL_BORDER_CLASS} px-3 py-3 text-center font-bold`}
                  >
                    Details
                  </th>

                  <th
                    className={`whitespace-nowrap ${TABLE_CELL_BORDER_CLASS} px-3 py-3 font-bold`}
                  >
                    Rush
                  </th>

                  {visibleColumnsAfterOrderId.map((column) => (
                    <th
                      key={column.key}
                      className={`whitespace-nowrap ${TABLE_CELL_BORDER_CLASS} px-3 py-3 font-bold`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, rowIndex) => {
                    const isRush = getIsRush(row);
                    const isSavingRushOrder = savingRushOrderIds.includes(
                      row.id
                    );

                    return (
                      <tr
                        key={`${row.id}-${row.product_sku}-${rowIndex}`}
                        className="transition hover:brightness-95"
                        style={{
                          backgroundColor:
                            row.status_id !== null &&
                            row.status_id !== undefined
                              ? statusColorMap[row.status_id] || undefined
                              : undefined,
                        }}
                      >
                        <td
                          className={`max-w-[160px] truncate ${TABLE_CELL_BORDER_CLASS} px-3 py-2 align-top font-semibold`}
                          title={formatCellValue(row.id)}
                        >
                          {formatCellValue(row.id)}
                        </td>

                        <td
                          className={`w-[70px] ${TABLE_CELL_BORDER_CLASS} px-3 py-2 text-center align-top`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(row)}
                            title="View order details"
                            className="cursor-pointer inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 bg-white text-base font-bold leading-none text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                          >
                            +
                          </button>
                        </td>

                        <td
                          className={`w-[90px] ${TABLE_CELL_BORDER_CLASS} px-3 py-2 align-top`}
                        >
                          <button
                            type="button"
                            disabled={isSavingRushOrder}
                            onClick={() =>
                              handleToggleRushOrder(row.id, !isRush)
                            }
                            title={
                              isRush
                                ? "Remove rush from this order"
                                : "Mark this order as rush"
                            }
                            className={`cursor-pointer flex items-center gap-2 rounded-lg border px-2 py-1 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              isRush
                                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                : "border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-100"
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full ${
                                isRush ? "bg-red-600" : "bg-zinc-300"
                              }`}
                            />
                            {isRush ? "Rush" : "Normal"}
                          </button>
                        </td>

                        {visibleColumnsAfterOrderId.map((column) => {
                          const isSavingThisOrder = savingOrderIds.includes(
                            row.id
                          );

                          if (column.key === "status") {
                            return (
                              <td
                                key={`${rowIndex}-${column.key}`}
                                className={`min-w-[220px] ${TABLE_CELL_BORDER_CLASS} px-3 py-2 align-top`}
                              >
                                <select
                                  value={row.status_id ?? ""}
                                  disabled={isSavingThisOrder}
                                  onChange={(event) =>
                                    handleUpdateOrderStatus(
                                      row.id,
                                      Number(event.target.value)
                                    )
                                  }
                                  className="cursor-pointer w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <option value="" disabled>
                                    Select status
                                  </option>

                                  {ORDER_STATUS_OPTIONS.map((status) => (
                                    <option key={status.id} value={status.id}>
                                      {status.name}
                                    </option>
                                  ))}
                                </select>

                                {isSavingThisOrder && (
                                  <p className="mt-1 text-[11px] text-zinc-400">
                                    Saving...
                                  </p>
                                )}
                              </td>
                            );
                          }

                          return (
                            <td
                              key={`${rowIndex}-${column.key}`}
                              className={`cursor-pointer max-w-[320px] truncate ${TABLE_CELL_BORDER_CLASS} px-3 py-2 align-top`}
                              title={formatCellValue(row[column.key])}
                            >
                              {formatCellValue(row[column.key])}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={visibleColumnsAfterOrderId.length + 3}
                      className={`px-4 py-12 text-center text-sm text-zinc-400 ${TABLE_CELL_BORDER_CLASS}`}
                    >
                      No orders match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  Order Details
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Order #{selectedOrderDetails.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-5">
              <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
                      getIsRush(selectedOrderDetails)
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-zinc-300 bg-white text-zinc-500"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        getIsRush(selectedOrderDetails)
                          ? "bg-red-600"
                          : "bg-zinc-300"
                      }`}
                    />
                    {getIsRush(selectedOrderDetails)
                      ? "Rush Order"
                      : "Normal Order"}
                  </span>

                  <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                    Status: {selectedOrderDetails.status || "Unknown"}
                  </span>

                  <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                    Customer: {selectedOrderDetails.customer_name || "Unknown"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="rounded-xl border border-zinc-200 bg-white p-3"
                  >
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      {column.label}
                    </p>
                    <p className="break-words text-sm font-medium text-zinc-800">
                      {formatCellValue(selectedOrderDetails[column.key]) || "—"}
                    </p>
                  </div>
                ))}

                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    Rush
                  </p>
                  <p className="break-words text-sm font-medium text-zinc-800">
                    {getIsRush(selectedOrderDetails) ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}