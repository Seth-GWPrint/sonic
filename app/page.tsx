"use client";

import { useState } from "react";

type OrderSpreadsheetRow = {
  id: number;
  customer_id: number;
  date_created: string;
  status_id: number;
  status: string;
  subtotal_ex_tax: string;
  staff_notes: string;
  customer_message: string;
  custom_status: string;
  product_name: string;
  product_quantity: number;
  product_total_ex_tax: string;
  product_total_inc_tax: string;
  product_sku: string;
};

const columns: {
  key: keyof OrderSpreadsheetRow;
  label: string;
}[] = [
  { key: "id", label: "ID" },
  { key: "customer_id", label: "Customer ID" },
  { key: "date_created", label: "Date Created" },
  { key: "status_id", label: "Status ID" },
  { key: "status", label: "Status" },
  { key: "subtotal_ex_tax", label: "Subtotal Ex Tax" },
  { key: "staff_notes", label: "Staff Notes" },
  { key: "customer_message", label: "Customer Message" },
  { key: "custom_status", label: "Custom Status" },
  { key: "product_name", label: "Product Title" },
  { key: "product_quantity", label: "Product Quantity" },
  { key: "product_total_ex_tax", label: "Product Total Ex Tax" },
  { key: "product_total_inc_tax", label: "Product Total Inc Tax" },
  { key: "product_sku", label: "Product SKU" },
];

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export default function Home() {
  const [rows, setRows] = useState<OrderSpreadsheetRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleImportOrders = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/import-orders", {
        method: "GET",
      });

      const rawText = await response.text();

      let data: any;

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(rawText || "Server returned a non-JSON response.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to import orders.");
      }

      setRows(data.rows || []);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while importing orders."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans text-zinc-900">
      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Order Spreadsheet
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Import the latest 100 BigCommerce orders. Orders with multiple
              products will appear as multiple rows.
            </p>
          </div>

          <button
            type="button"
            onClick={handleImportOrders}
            disabled={isLoading}
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Importing..." : "Import Orders"}
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-500">
            Showing {rows.length} product line rows
          </div>

          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-100 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="whitespace-nowrap border-b border-r border-zinc-200 px-3 py-3 font-bold"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.length > 0 ? (
                  rows.map((row, rowIndex) => (
                    <tr
                      key={`${row.id}-${row.product_sku}-${rowIndex}`}
                      className="hover:bg-zinc-50"
                    >
                      {columns.map((column) => (
                        <td
                          key={`${rowIndex}-${column.key}`}
                          className="max-w-[320px] truncate border-b border-r border-zinc-100 px-3 py-2 align-top"
                          title={formatCellValue(row[column.key])}
                        >
                          {formatCellValue(row[column.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-12 text-center text-sm text-zinc-400"
                    >
                      No orders imported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}