import type { TableColumnKey } from "../types/OrderTypes";

export const TABLE_BORDER_COLOR_CLASS = "border-zinc-800";
export const TABLE_CELL_BORDER_CLASS = `border ${TABLE_BORDER_COLOR_CLASS}`;

export const DEFAULT_ROW_COLOR = "#FFFFFF";
export const DEFAULT_ACTION_COLOR = "#FFFFFF";

export const columns: {
  key: TableColumnKey;
  label: string;
}[] = [
  { key: "id", label: "Order ID" },
  { key: "is_late", label: "Is Late?" },
  { key: "customer_id", label: "Customer ID" },
  { key: "customer_name", label: "Customer Name" },
  { key: "customer_email", label: "Customer Email" },
  { key: "customer_phone", label: "Customer Phone" },
  { key: "customer_company", label: "Company" },
  { key: "date_created", label: "Date Created" },
  { key: "status_id", label: "Action ID" },
  { key: "status", label: "Action" },
  { key: "stage_name", label: "Stage" },
  { key: "subtotal_ex_tax", label: "Subtotal Ex Tax" },
  { key: "staff_notes", label: "Staff Notes" },
  { key: "customer_message", label: "Customer Message" },
  { key: "custom_status", label: "Custom Action" },
  { key: "product_name", label: "Product Ordered" },
  { key: "product_quantity", label: "Product Quantity" },
  { key: "product_total_ex_tax", label: "Product Total Ex Tax" },
  { key: "product_total_inc_tax", label: "Product Total Inc Tax" },
  { key: "product_sku", label: "Product SKU" },
  { key: "proof_approved_date", label: "Proof Approved Date" },
  { key: "location", label: "Location" },
];

export const hiddenColumnKeys: TableColumnKey[] = [
  "date_created",
  "status_id",
  "subtotal_ex_tax",
  "product_total_ex_tax",
  "product_total_inc_tax",
  "custom_status",
  "customer_id",
  "customer_email",
  "customer_phone",
  "customer_company",
  "staff_notes",
  "customer_message",
  "proof_approved_date",
  "product_sku",
  "product_quantity",
];

export const visibleColumns = columns.filter(
  (column) => !hiddenColumnKeys.includes(column.key)
);

export const visibleColumnsAfterOrderId = visibleColumns.filter(
  (column) => column.key !== "id"
);