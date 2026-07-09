export type OrderSpreadsheetRow = {
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
  proof_approved_date: string | null;
  is_late?: number | null;
  location: string | null;
};

export type ActionApiRow = {
  id?: number;
  action_id?: number;
  status_id?: number;
  name?: string;
  action_name?: string;
  status_name?: string;
  color?: string;
  color_hex?: string;
};

export type StageApiRow = {
  stage_id: number;
  stage_name: string;
  color_hex: string;
  actions?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OrderTableRow = OrderSpreadsheetRow & {
  products: OrderSpreadsheetRow[];
  stage_name: string | null;
  stage_color_hex: string | null;
  action_color_hex: string | null;
};

export type TableColumnKey = keyof OrderSpreadsheetRow | "stage_name";

export type OrderStatusOption = {
  id: number;
  name: string;
  color: string;
};

export type StageOption = {
  stage_id: number;
  stage_name: string;
  color_hex: string;
  actions: string[];
};