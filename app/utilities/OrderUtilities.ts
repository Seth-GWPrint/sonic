import type {
  ActionApiRow,
  OrderSpreadsheetRow,
  OrderStatusOption,
  StageApiRow,
  StageOption,
  OrderTableRow,
  TableColumnKey,
  BigCommerceShippingAddress, 
  ShippingAddressResponse 
} from "@/app/types/OrderTypes";

import { DEFAULT_ACTION_COLOR, DEFAULT_ROW_COLOR } from "@/app/constants/OrderConstants";

export function formatCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
} 

export function getRowName(row: OrderSpreadsheetRow) {
  return row.customer_name || "";
}

export function getIsRush(row: OrderSpreadsheetRow) {
  return row.is_rush === true || row.is_rush === 1;
}

export function normalizeHexColor(value: unknown) {
  const cleanValue = String(value ?? "").trim();

  if (!cleanValue) return "#FFFFFF";

  return cleanValue.startsWith("#") ? cleanValue : `#${cleanValue}`;
}

export function isValidHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function getSafeHexColor(value: unknown, fallback = "#FFFFFF") {
  const normalizedColor = normalizeHexColor(value);

  return isValidHexColor(normalizedColor) ? normalizedColor : fallback;
}

export function normalizeStageActions(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item ?? "").trim())
          .filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

export function getIsLateValue(proofApprovedDate: string | null) {
  if (!proofApprovedDate) return null;

  const approvedDate = new Date(proofApprovedDate);

  if (Number.isNaN(approvedDate.getTime())) {
    return null;
  }

  const today = new Date();

  const approvedDay = new Date(
    approvedDate.getFullYear(),
    approvedDate.getMonth(),
    approvedDate.getDate()
  );

  const todayDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysSinceProofApproved = Math.floor(
    (todayDay.getTime() - approvedDay.getTime()) / millisecondsPerDay
  );

  return daysSinceProofApproved - 7;
}

export function findStageForAction(
  stages: StageOption[],
  actionId: number | null,
  actionName: string | null
) {
  const cleanActionId =
    actionId === null || actionId === undefined ? "" : String(actionId).trim();

  const cleanActionName = String(actionName ?? "").trim();

  if (!cleanActionId && !cleanActionName) {
    return null;
  }

  return (
    stages.find((stage) =>
      stage.actions.some((stageAction) => {
        const cleanStageAction = String(stageAction ?? "").trim();

        return (
          (!!cleanActionId && cleanStageAction === cleanActionId) ||
          (!!cleanActionName && cleanStageAction === cleanActionName)
        );
      })
    ) ?? null
  );
}

export function getTableCellValue(row: OrderTableRow, key: TableColumnKey) {
  if (key === "stage_name") {
    return row.stage_name;
  }

  return row[key];
}

async function parseJsonResponse(response: Response) {
  const rawText = await response.text();

  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(rawText || "Server returned a non-JSON response.");
  }
}

export async function submitAuditLog({
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
}) {
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

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "Failed to submit audit log.");
    }

    return data;
  } catch (error) {
    console.error("Failed to submit audit log:", error);
  }
}

export async function loadActions() {
  const response = await fetch("/api/sonic/actions", {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to load actions.");
  }

  const actionRows: ActionApiRow[] = Array.isArray(data.actions)
    ? data.actions
    : Array.isArray(data.statuses)
      ? data.statuses
      : Array.isArray(data.statusColors)
        ? data.statusColors
        : [];

  console.log("Loaded action rows:", actionRows);

  const orderStatusOptions: OrderStatusOption[] = actionRows
    .map((action, index) => ({
      id: Number(action.action_id ?? action.id ?? action.status_id ?? index),
      name: String(
        action.action_name ?? action.name ?? action.status_name ?? ""
      ).trim(),
      color: getSafeHexColor(action.color ?? action.color_hex),
    }))
    .filter((action) => action.name && Number.isInteger(action.id));

  const actionColorMap = orderStatusOptions.reduce<Record<number, string>>(
    (acc, action) => {
      acc[action.id] = action.color;
      return acc;
    },
    {}
  );

  return {
    orderStatusOptions,
    actionColorMap,
  };
}

export async function loadStages() {
  const response = await fetch("/api/sonic/stages", {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to load stages.");
  }

  const stageRows: StageApiRow[] = Array.isArray(data.stages)
    ? data.stages
    : [];

  console.log("Loaded stage rows:", stageRows);

  const normalizedStages: StageOption[] = stageRows
    .map((stage) => ({
      stage_id: Number(stage.stage_id),
      stage_name: String(stage.stage_name ?? "").trim(),
      color_hex: getSafeHexColor(stage.color_hex),
      actions: normalizeStageActions(stage.actions),
    }))
    .filter((stage) => stage.stage_name && Number.isInteger(stage.stage_id));

  return normalizedStages;
}

export async function loadOrders() {
  const response = await fetch("/api/sonic/pull-orders-from-db", {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Failed to load orders from database.");
  }

  return Array.isArray(data.rows) ? data.rows : [];
}

export async function updateOrderStatus({
  orderId,
  statusId,
  status,
}: {
  orderId: number;
  statusId: number;
  status: string;
}) {
  const response = await fetch("/api/sonic/update-order-status", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId,
      statusId,
      status,
    }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Failed to update order status.");
  }

  return data;
}

export async function updateRushOrder({
  orderId,
  isRush,
}: {
  orderId: number;
  isRush: boolean;
}) {
  const response = await fetch("/api/sonic/update-rush-order", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId,
      isRush,
    }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Failed to update rush order.");
  }

  return data;
}

export function buildFilteredOrderRows({
  rows,
  stages,
  actionColorMap,
  orderIdFilter,
  nameFilter,
  statusFilter,
}: {
  rows: OrderSpreadsheetRow[];
  stages: StageOption[];
  actionColorMap: Record<number, string>;
  orderIdFilter: string;
  nameFilter: string;
  statusFilter: string;
}) {
  const cleanOrderIdFilter = orderIdFilter.trim().toLowerCase();
  const cleanNameFilter = nameFilter.trim().toLowerCase();
  const cleanStatusFilter = statusFilter.trim();

  const matchingRows = rows.filter((row) => {
    const orderId = String(row.id ?? "").toLowerCase();
    const name = getRowName(row).toLowerCase();
    const statusId = String(row.status_id ?? "");

    const matchesOrderId =
      !cleanOrderIdFilter || orderId.includes(cleanOrderIdFilter);

    const matchesName = !cleanNameFilter || name.includes(cleanNameFilter);

    const matchesStatus =
      !cleanStatusFilter || statusId === cleanStatusFilter;

    return matchesOrderId && matchesName && matchesStatus;
  });

  const groupedOrders = new Map<number, OrderTableRow>();

  matchingRows.forEach((row) => {
    const matchingStage = findStageForAction(
      stages,
      row.status_id,
      row.status
    );

    const actionColor =
      row.status_id !== null && row.status_id !== undefined
        ? actionColorMap[row.status_id] || DEFAULT_ACTION_COLOR
        : DEFAULT_ACTION_COLOR;

    const existingOrder = groupedOrders.get(row.id);

    if (!existingOrder) {
      groupedOrders.set(row.id, {
        ...row,
        product_name: null,
        product_quantity: null,
        product_total_ex_tax: null,
        product_total_inc_tax: null,
        product_sku: null,
        products: [row],
        stage_name: matchingStage?.stage_name ?? null,
        stage_color_hex: matchingStage?.color_hex ?? DEFAULT_ROW_COLOR,
        action_color_hex: actionColor,
      });

      return;
    }

    existingOrder.products.push(row);
  });

  return Array.from(groupedOrders.values()).map((order) => {
    const hasMultipleProducts = order.products.length > 1;
    const firstProduct = order.products[0];

    return {
      ...order,
      is_late: getIsLateValue(order.proof_approved_date),
      product_name: hasMultipleProducts
        ? "Multiple Products"
        : firstProduct.product_name,
      product_quantity: hasMultipleProducts ? null : firstProduct.product_quantity,
      product_total_ex_tax: hasMultipleProducts
        ? null
        : firstProduct.product_total_ex_tax,
      product_total_inc_tax: hasMultipleProducts
        ? null
        : firstProduct.product_total_inc_tax,
      product_sku: hasMultipleProducts ? null : firstProduct.product_sku,
    };
  });
}

export async function getOrderShippingAddress(
  orderId: number
): Promise<BigCommerceShippingAddress | null> {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error("A valid order ID is required.");
  }

  const response = await fetch(
    `/api/bigcommerce/order-shipping-address?orderId=${encodeURIComponent(
      orderId
    )}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const data = (await response.json()) as ShippingAddressResponse;

  if (response.status === 404) {
    return null;
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to retrieve shipping address.");
  }

  return data.shippingAddress ?? null;
}

export function formatShippingAddress(
  address: BigCommerceShippingAddress | null | undefined
): string {
  if (!address) {
    return "";
  }

  const street = [address.street_1, address.street_2]
    .filter(Boolean)
    .join(", ");

  const cityStateZip = [
    address.city,
    [address.state, address.zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return [street, cityStateZip, address.country]
    .filter(Boolean)
    .join(", ");
}