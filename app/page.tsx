"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OrderDetailsModal from "./components/OrderDetailsModal";
import OrderFilters from "./components/OrderFilters";
import OrdersTable from "./components/OrdersTable";

import type {
  OrderTableRow,
  OrderStatusOption,
  OrderSpreadsheetRow,
  StageOption,
} from "@/app/types/OrderTypes";

import {
  formatCellValue,
  getIsRush,
  loadActions,
  loadStages,
  loadOrders,
  submitAuditLog,
  updateOrderStatus,
  updateRushOrder,
  buildFilteredOrderRows,
} from "./utilities/OrderUtilities";

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

  const [actionColorMap, setActionColorMap] = useState<Record<number, string>>(
    {}
  );
  const [orderStatusOptions, setOrderStatusOptions] = useState<
    OrderStatusOption[]
  >([]);
  const [stages, setStages] = useState<StageOption[]>([]);

  const [selectedOrderDetails, setSelectedOrderDetails] =
    useState<OrderTableRow | null>(null);

  const handleLoadActions = async () => {
    try {
      const { orderStatusOptions, actionColorMap } = await loadActions();

      setOrderStatusOptions(orderStatusOptions);
      setActionColorMap(actionColorMap);
    } catch (error) {
      console.error("Failed to load actions:", error);
      setOrderStatusOptions([]);
      setActionColorMap({});
    }
  };

  const handleLoadStages = async () => {
    try {
      const loadedStages = await loadStages();

      setStages(loadedStages);
    } catch (error) {
      console.error("Failed to load stages:", error);
      setStages([]);
    }
  };

  const handleLoadOrders = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const loadedRows = await loadOrders();

      setRows(loadedRows);
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
    const selectedStatus = orderStatusOptions.find(
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
      const data = await updateOrderStatus({
        orderId,
        statusId: selectedStatus.id,
        status: selectedStatus.name,
      });

      await submitAuditLog({
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

      const proofApprovedDate =
        data.proofApprovedDate ?? existingOrder?.proof_approved_date ?? null;

      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === orderId
            ? {
                ...row,
                status_id: selectedStatus.id,
                status: selectedStatus.name,
                proof_approved_date: proofApprovedDate,
              }
            : row
        )
      );

      setStatusUpdateMessage(`Order ${orderId} action updated.`);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the order action."
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
      await updateRushOrder({
        orderId,
        isRush: nextIsRush,
      });

      await submitAuditLog({
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

  const filteredRows = useMemo(
    () =>
      buildFilteredOrderRows({
        rows,
        stages,
        actionColorMap,
        orderIdFilter,
        nameFilter,
        statusFilter,
      }),
    [rows, stages, actionColorMap, orderIdFilter, nameFilter, statusFilter]
  );

  const handleClearFilters = () => {
    setOrderIdFilter("");
    setNameFilter("");
    setStatusFilter("");
  };

  useEffect(() => {
    handleLoadOrders();
    handleLoadActions();
    handleLoadStages();
  }, []);

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

        <Link
          href="/settings"
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          Settings
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
        <OrderFilters
          orderIdFilter={orderIdFilter}
          setOrderIdFilter={setOrderIdFilter}
          nameFilter={nameFilter}
          setNameFilter={setNameFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          orderStatusOptions={orderStatusOptions}
          handleClearFilters={handleClearFilters}
        />

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

        <OrdersTable
          rows={rows}
          filteredRows={filteredRows}
          isLoading={isLoading}
          orderStatusOptions={orderStatusOptions}
          savingOrderIds={savingOrderIds}
          savingRushOrderIds={savingRushOrderIds}
          setSelectedOrderDetails={setSelectedOrderDetails}
          handleUpdateOrderStatus={handleUpdateOrderStatus}
          handleToggleRushOrder={handleToggleRushOrder}
        />
      </main>

      <OrderDetailsModal
        selectedOrderDetails={selectedOrderDetails}
        onClose={() => setSelectedOrderDetails(null)}
        getIsRush={getIsRush}
        formatCellValue={formatCellValue}
      />
    </div>
  );
}