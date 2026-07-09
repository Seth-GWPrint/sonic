"use client";

import { TABLE_CELL_BORDER_CLASS } from "../constants/OrderConstants";
import { OrderTableRow, OrderStatusOption } from "../types/OrderTypes";

type ActionSelectCellProps = {
  row: OrderTableRow;
  isSavingThisOrder: boolean;
  orderStatusOptions: OrderStatusOption[];
  handleUpdateOrderStatus: (orderId: number, newStatusId: number) => void;
};

export default function ActionSelectCell({
  row,
  isSavingThisOrder,
  orderStatusOptions,
  handleUpdateOrderStatus,
}: ActionSelectCellProps) {
  const actionBackgroundColor = row.action_color_hex || "#FFFFFF";

  return (
    <td
      className={`min-w-[220px] ${TABLE_CELL_BORDER_CLASS} px-3 py-2 align-top`}
      style={{
        backgroundColor: actionBackgroundColor,
      }}
    >
      <select
        value={row.status_id ?? ""}
        disabled={isSavingThisOrder || orderStatusOptions.length === 0}
        onChange={(event) =>
          handleUpdateOrderStatus(row.id, Number(event.target.value))
        }
        className="w-full cursor-pointer rounded-lg border border-zinc-300 px-2 py-1 text-xs outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          backgroundColor: actionBackgroundColor,
        }}
      >
        <option value="" disabled>
          {orderStatusOptions.length === 0
            ? "Loading actions..."
            : "Select action"}
        </option>

        {orderStatusOptions.map((status) => (
          <option
            key={status.id}
            value={status.id}
            style={{
              backgroundColor: status.color,
            }}
          >
            {status.name}
          </option>
        ))}
      </select>

      {isSavingThisOrder && (
        <p className="mt-1 text-[11px] text-zinc-600">Saving...</p>
      )}
    </td>
  );
}