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
  shipping_address?: BigCommerceShippingAddress | null;
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

export type BigCommerceShippingAddress = {
  id: number;
  order_id: number;
  first_name: string;
  last_name: string;
  company: string;
  street_1: string;
  street_2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  country_iso2: string;
  phone: string;
  email: string;
  shipping_method: string;
};

export type ShippingAddressResponse = {
  success: boolean;
  orderId: number;
  shippingAddress?: BigCommerceShippingAddress;
  shippingAddresses?: BigCommerceShippingAddress[];
  error?: string;
};

export type AuditMetadata = Record<string, unknown>;

export type AuditLogEntry = {
  id: number;
  username: string | null;
  entity_type: string | null;
  entity_id: number | null;
  action: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: AuditMetadata | null;
  created_at: string | null;
};

export type Vendor = {
  id: number | string;
  vendor_name?: string | null;
  name?: string | null;
  vendor_location?: string | null;
  location?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OrderProductOption = {
  id?: number | string;
  option_id?: number | string;
  display_name?: string | null;
  name?: string | null;
  option_name?: string | null;
  display_value?: string | number | null;
  value?: string | number | null;
  option_value?: string | number | null;
};

export type OrderOptionsProduct = {
  id?: number | string;
  product_id?: number | string;
  line_item_id?: number | string;
  name?: string | null;
  product_name?: string | null;
  sku?: string | null;
  product_sku?: string | null;
  options?: OrderProductOption[];
};

export type OrderDetailsModalProps<TOrder> = {
  selectedOrderDetails: TOrder | null;
  shippingAddress: BigCommerceShippingAddress | null;
  onClose: () => void;
  getIsRush: (order: TOrder) => boolean;
  formatCellValue: (value: unknown) => string;
  onStaffNotesUpdated?: (
    orderId: number | string,
    staffNotes: string
  ) => void;
};