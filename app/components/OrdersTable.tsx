"use client";

import type { Dispatch, SetStateAction } from "react";
import ActionSelectCell from "./ActionSelectCell";
import { TABLE_CELL_BORDER_CLASS, visibleColumnsAfterOrderId } from "../constants/OrderConstants";
import {
  formatCellValue,
  formatShippingAddress,
  getIsRush,
  getTableCellValue,
} from "../utilities/OrderUtilities";
import type { BigCommerceShippingAddress, OrderStatusOption, OrderSpreadsheetRow, OrderTableRow } from "../types/OrderTypes";

type OrdersTableProps = {
  rows: OrderSpreadsheetRow[];
  filteredRows: OrderTableRow[];
  isLoading: boolean;
  orderStatusOptions: OrderStatusOption[];
  savingOrderIds: number[];
  savingRushOrderIds: number[];
  setSelectedOrderDetails: Dispatch<SetStateAction<OrderTableRow | null>>;
  handleUpdateOrderStatus: (orderId: number, newStatusId: number) => void;
  handleToggleRushOrder: (orderId: number, nextIsRush: boolean) => void;
  shippingAddresses: Record<
    number,
    BigCommerceShippingAddress | null
  >;
};

export default function OrdersTable({
  rows,
  filteredRows,
  isLoading,
  orderStatusOptions,
  savingOrderIds,
  savingRushOrderIds,
  setSelectedOrderDetails,
  handleUpdateOrderStatus,
  handleToggleRushOrder,
  shippingAddresses,
}: OrdersTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-500">
        {isLoading ? (
          "Loading orders..."
        ) : (
          <>
            Showing {filteredRows.length} of{" "}
            {new Set(rows.map((row) => row.id)).size} orders
          </>
        )}
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

              <th
                className={`whitespace-nowrap ${TABLE_CELL_BORDER_CLASS} px-3 py-3 font-bold`}
              >
                Shipping Address
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
                const isSavingRushOrder = savingRushOrderIds.includes(row.id);
                const rowBackgroundColor = row.stage_color_hex || "#FFFFFF";

                const orderId = Number(row.id);
                const shippingAddress = shippingAddresses[orderId];
                const hasLoadedShippingAddress = orderId in shippingAddresses;

                return (
                  <tr
                    key={row.id}
                    className="transition hover:brightness-95"
                    style={{
                      backgroundColor: rowBackgroundColor,
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
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-zinc-300 bg-white text-base font-bold leading-none text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
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
                        onClick={() => handleToggleRushOrder(row.id, !isRush)}
                        title={
                          isRush
                            ? "Remove rush from this order"
                            : "Mark this order as rush"
                        }
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
                    
                    <td
                      className={`max-w-[280px] ${TABLE_CELL_BORDER_CLASS} px-3 py-2 align-top`}
                      title={
                        formatShippingAddress(shippingAddress) || "No shipping address"
                      }
                    >
                      {hasLoadedShippingAddress ? (
                        shippingAddress ? (
                          <div className="max-w-[280px]">
                            <div className="truncate font-semibold text-zinc-800">
                              {shippingAddress.street_1 || "—"}
                            </div>

                            <div className="truncate text-[11px] text-zinc-500">
                              {[
                                shippingAddress.city,
                                shippingAddress.state,
                                shippingAddress.zip,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-400">No shipping address</span>
                        )
                      ) : (
                        <span className="text-zinc-400">Loading...</span>
                      )}
                    </td>

                    {visibleColumnsAfterOrderId.map((column) => {
                      const isSavingThisOrder = savingOrderIds.includes(row.id);

                      if (column.key === "status") {
                        return (
                          <ActionSelectCell
                            key={`${rowIndex}-${column.key}`}
                            row={row}
                            isSavingThisOrder={isSavingThisOrder}
                            orderStatusOptions={orderStatusOptions}
                            handleUpdateOrderStatus={handleUpdateOrderStatus}
                          />
                        );
                      }

                      if (column.key === "stage_name") {
                        return (
                          <td
                            key={`${rowIndex}-${column.key}`}
                            className={`max-w-[220px] truncate ${TABLE_CELL_BORDER_CLASS} px-3 py-2 align-top font-semibold`}
                            title={formatCellValue(row.stage_name)}
                          >
                            {row.stage_name || ""}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={`${rowIndex}-${column.key}`}
                          className={`max-w-[320px] cursor-pointer truncate ${TABLE_CELL_BORDER_CLASS} px-3 py-2 align-top`}
                          title={formatCellValue(
                            getTableCellValue(row, column.key)
                          )}
                        >
                          {formatCellValue(getTableCellValue(row, column.key))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={visibleColumnsAfterOrderId.length + 4}
                  className={`px-4 py-12 text-center text-sm text-zinc-400 ${TABLE_CELL_BORDER_CLASS}`}
                >
                  {isLoading
                    ? "Loading orders..."
                    : "No orders match the current filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}