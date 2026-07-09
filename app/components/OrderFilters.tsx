"use client";

import type { Dispatch, SetStateAction } from "react";
import type { OrderStatusOption } from "../types/OrderTypes";

type OrderFiltersProps = {
  orderIdFilter: string;
  setOrderIdFilter: Dispatch<SetStateAction<string>>;
  nameFilter: string;
  setNameFilter: Dispatch<SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  orderStatusOptions: OrderStatusOption[];
  handleClearFilters: () => void;
};

export default function OrderFilters({
  orderIdFilter,
  setOrderIdFilter,
  nameFilter,
  setNameFilter,
  statusFilter,
  setStatusFilter,
  orderStatusOptions,
  handleClearFilters,
}: OrderFiltersProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Filter the loaded rows by order ID, customer name, or action.
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
            Action
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
          >
            <option value="">All actions</option>

            {orderStatusOptions.map((status) => (
              <option key={status.id} value={String(status.id)}>
                {status.name}
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
  );
}