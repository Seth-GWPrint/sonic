export type OrderStatusOption = {
  id: number;
  name: string;
};

export const ORDER_STATUS_OPTIONS: OrderStatusOption[] = [
  { id: 0, name: "New" },
  { id: 1, name: "Awaiting Customer" },
  { id: 2, name: "On Hold" },
  { id: 3, name: "Needs Proof" },
  { id: 4, name: "Proof Sent" },
  { id: 5, name: "Proof Approved" },
  { id: 6, name: "Pre-Production" },
  { id: 7, name: "Production: LOCAL" },
  { id: 8, name: "Production: VENDOR" },
  { id: 9, name: "Shipped" },
  { id: 10, name: "Cancelled" },
  { id: 11, name: "Refunded" },
  { id: 12, name: "Completed" },
  { id: 13, name: "Needs to ship in OD" },
];

export type BigCommerceOrderStatusName =
  | "Awaiting Fulfillment"
  | "Proof Sent"
  | "In Production"
  | "Shipped"
  | "Cancelled"
  | "Refunded"
  | "Completed";

export const SONIC_TO_BIGCOMMERCE_STATUS: Record<
  string,
  BigCommerceOrderStatusName
> = {
  New: "Awaiting Fulfillment",
  "Awaiting Customer": "Awaiting Fulfillment",
  "On Hold": "Awaiting Fulfillment",
  "Needs Proof": "Awaiting Fulfillment",
  "Proof Sent": "Proof Sent",
  "Proof Approved": "In Production",
  "Pre-Production": "In Production",
  "Production: LOCAL": "In Production",
  "Production: VENDOR": "In Production",
  Shipped: "Shipped",
  Cancelled: "Cancelled",
  Refunded: "Refunded",
  Completed: "Completed",
  "Needs to ship in OD": "Awaiting Fulfillment",
};

export function getBigCommerceStatusFromSonicStatus(
  sonicStatusName: string
): BigCommerceOrderStatusName | null {
  return SONIC_TO_BIGCOMMERCE_STATUS[sonicStatusName] ?? null;
}