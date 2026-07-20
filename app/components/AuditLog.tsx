"use client";

import { useMemo, useState } from "react";
 
import { AuditLogEntry, AuditMetadata } from "../types/OrderTypes";

function formatAuditDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatActionName(value: string | null) {
  if (!value) return "Unknown Action";

  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AuditLog() {
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditLogErrorMessage, setAuditLogErrorMessage] = useState("");

  const [searchValue, setSearchValue] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  async function loadAuditLogs() {
    setIsLoadingAuditLogs(true);
    setAuditLogErrorMessage("");

    try {
      const response = await fetch("/api/sonic/pull-audit-log", {
        method: "GET",
        cache: "no-store",
      });

      const rawText = await response.text();

      let data: any;

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(
          `Server returned a non-JSON response: ${rawText.slice(0, 300)}`
        );
      }

      console.log("pull-audit-log response:", data);

      const returnedAudits = Array.isArray(data)
        ? data
        : Array.isArray(data.auditLogs)
        ? data.auditLogs
        : Array.isArray(data.auditLog)
        ? data.auditLog
        : Array.isArray(data.audits)
        ? data.audits
        : Array.isArray(data.rows)
        ? data.rows
        : Array.isArray(data.data)
        ? data.data
        : null;

      if (!returnedAudits) {
        throw new Error(
          `The audit API response did not contain an audit array. Returned keys: ${
            data && typeof data === "object"
              ? Object.keys(data).join(", ")
              : "none"
          }`
        );
      }

      const loadedAuditLogs: AuditLogEntry[] = returnedAudits
        .map(
          (audit: Record<string, unknown>): AuditLogEntry => ({
            id: Number(audit.id),

            username:
              typeof audit.username === "string"
                ? audit.username
                : null,

            entity_type:
              typeof audit.entity_type === "string"
                ? audit.entity_type
                : null,

            entity_id:
              audit.entity_id === null ||
              audit.entity_id === undefined ||
              audit.entity_id === ""
                ? null
                : Number(audit.entity_id),

            action:
              typeof audit.action === "string"
                ? audit.action
                : null,

            field_name:
              typeof audit.field_name === "string"
                ? audit.field_name
                : null,

            old_value:
              typeof audit.old_value === "string"
                ? audit.old_value
                : null,

            new_value:
              typeof audit.new_value === "string"
                ? audit.new_value
                : null,

            metadata:
              audit.metadata &&
              typeof audit.metadata === "object" &&
              !Array.isArray(audit.metadata)
                ? (audit.metadata as AuditMetadata)
                : null,

            created_at:
              typeof audit.created_at === "string"
                ? audit.created_at
                : null,
          })
        )
        .sort(
          (firstEntry: AuditLogEntry, secondEntry: AuditLogEntry) => {
            const firstDate = firstEntry.created_at
              ? new Date(firstEntry.created_at).getTime()
              : 0;

            const secondDate = secondEntry.created_at
              ? new Date(secondEntry.created_at).getTime()
              : 0;

            return secondDate - firstDate;
          }
        );

      console.log("Normalized audit logs:", loadedAuditLogs);

      setAuditLogs(loadedAuditLogs);
    } catch (error) {
      console.error("Load audit log failed:", error);

      setAuditLogs([]);

      setAuditLogErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading the audit log."
      );
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }

  async function handleOpenAuditLog() {
    setIsAuditLogOpen(true);
    setAuditLogErrorMessage("");

    await loadAuditLogs();
  }

  function handleClearFilters() {
    setSearchValue("");
    setUsernameFilter("");
    setActionFilter("");
    setOrderIdFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
  }

  const usernameOptions = useMemo(() => {
    return Array.from(
      new Set(
        auditLogs
          .map((audit) => String(audit.username || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [auditLogs]);

  const actionOptions = useMemo(() => {
    return Array.from(
      new Set(
        auditLogs
          .map((audit) => String(audit.action || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) =>
      formatActionName(a).localeCompare(formatActionName(b))
    );
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const normalizedEntityId = orderIdFilter.trim();

    return auditLogs.filter((audit) => {
      const username = String(audit.username || "").toLowerCase();
      const action = String(audit.action || "").toLowerCase();
      const entityType = String(audit.entity_type || "").toLowerCase();
      const entityId = String(audit.entity_id ?? "");
      const fieldName = String(audit.field_name || "").toLowerCase();
      const oldValue = String(audit.old_value || "").toLowerCase();
      const newValue = String(audit.new_value || "").toLowerCase();
      const metadata = JSON.stringify(audit.metadata || {}).toLowerCase();
      const auditId = String(audit.id);

      const matchesSearch =
        !normalizedSearch ||
        username.includes(normalizedSearch) ||
        action.includes(normalizedSearch) ||
        entityType.includes(normalizedSearch) ||
        entityId.includes(normalizedSearch) ||
        fieldName.includes(normalizedSearch) ||
        oldValue.includes(normalizedSearch) ||
        newValue.includes(normalizedSearch) ||
        metadata.includes(normalizedSearch) ||
        auditId.includes(normalizedSearch);

      const matchesUsername =
        !usernameFilter ||
        String(audit.username || "") === usernameFilter;

      const matchesAction =
        !actionFilter ||
        String(audit.action || "") === actionFilter;

      const matchesEntityId =
        !normalizedEntityId ||
        entityId.includes(normalizedEntityId);

      let matchesStartDate = true;
      let matchesEndDate = true;

      if (audit.created_at) {
        const auditDate = new Date(audit.created_at);

        if (startDateFilter) {
          const startDate = new Date(`${startDateFilter}T00:00:00`);
          matchesStartDate = auditDate >= startDate;
        }

        if (endDateFilter) {
          const endDate = new Date(`${endDateFilter}T23:59:59.999`);
          matchesEndDate = auditDate <= endDate;
        }
      } else if (startDateFilter || endDateFilter) {
        matchesStartDate = false;
        matchesEndDate = false;
      }

      return (
        matchesSearch &&
        matchesUsername &&
        matchesAction &&
        matchesEntityId &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [
    auditLogs,
    searchValue,
    usernameFilter,
    actionFilter,
    orderIdFilter,
    startDateFilter,
    endDateFilter,
  ]);

  const hasActiveFilters =
    searchValue ||
    usernameFilter ||
    actionFilter ||
    orderIdFilter ||
    startDateFilter ||
    endDateFilter;

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Audit Log</h2>

        <p className="mt-1 text-sm text-zinc-500">
          Review user activity and changes made throughout Sonic.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleOpenAuditLog}
            className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            View Audit Log
          </button>
        </div>
      </div>

      {auditLogErrorMessage && !isAuditLogOpen && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {auditLogErrorMessage}
        </div>
      )}

      {isAuditLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Audit Log</h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Showing activity from most recent to least recent.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAuditLogOpen(false)}
                className="rounded-lg px-2 py-1 text-xl font-semibold leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Close audit log"
              >
                ×
              </button>
            </div>

            <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AuditFilterField label="Search">
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search usernames, actions, or details..."
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                  />
                </AuditFilterField>

                <AuditFilterField label="Username">
                  <select
                    value={usernameFilter}
                    onChange={(event) =>
                      setUsernameFilter(event.target.value)
                    }
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">All Users</option>

                    {usernameOptions.map((username) => (
                      <option key={username} value={username}>
                        {username}
                      </option>
                    ))}
                  </select>
                </AuditFilterField>

                <AuditFilterField label="Thing Done">
                  <select
                    value={actionFilter}
                    onChange={(event) => setActionFilter(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">All Actions</option>

                    {actionOptions.map((action) => (
                      <option key={action} value={action}>
                        {formatActionName(action)}
                      </option>
                    ))}
                  </select>
                </AuditFilterField>

                <AuditFilterField label="Order ID">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={orderIdFilter}
                    onChange={(event) =>
                      setOrderIdFilter(event.target.value)
                    }
                    placeholder="Example: 428371"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                  />
                </AuditFilterField>

                <AuditFilterField label="Start Date">
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(event) =>
                      setStartDateFilter(event.target.value)
                    }
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                  />
                </AuditFilterField>

                <AuditFilterField label="End Date">
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(event) =>
                      setEndDateFilter(event.target.value)
                    }
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                  />
                </AuditFilterField>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-600">
                  {filteredAuditLogs.length} of {auditLogs.length} audit
                  {auditLogs.length === 1 ? "" : "s"}
                </p>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    disabled={!hasActiveFilters}
                    className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear Filters
                  </button>

                  <button
                    type="button"
                    onClick={loadAuditLogs}
                    disabled={isLoadingAuditLogs}
                    className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoadingAuditLogs ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {auditLogErrorMessage && (
                <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {auditLogErrorMessage}
                </div>
              )}

              {isLoadingAuditLogs ? (
                <div className="py-16 text-center text-sm text-zinc-500">
                  Loading audit log...
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="m-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm font-semibold text-zinc-500">
                  {auditLogs.length === 0
                    ? "No audit log entries were found."
                    : "No audit log entries match the selected filters."}
                </div>
              ) : (
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-zinc-100">
                    <tr>
                      <AuditTableHeader>Date</AuditTableHeader>
                      <AuditTableHeader>Username</AuditTableHeader>
                      <AuditTableHeader>Thing Done</AuditTableHeader>
                      <AuditTableHeader>Entity</AuditTableHeader>
                      <AuditTableHeader>Details</AuditTableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAuditLogs.map((audit) => (
                      <tr
                        key={audit.id}
                        className="border-b border-zinc-200 align-top transition hover:bg-zinc-50"
                      >
                        <AuditTableCell className="whitespace-nowrap">
                          {formatAuditDate(audit.created_at)}
                        </AuditTableCell>

                        <AuditTableCell>
                          <span className="font-semibold text-zinc-900">
                            {audit.username || "Unknown User"}
                          </span>
                        </AuditTableCell>

                        <AuditTableCell>
                          <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                            {formatActionName(audit.action)}
                          </span>
                        </AuditTableCell>

                        <AuditTableCell>
                          {audit.entity_id !== null ? (
                            <div>
                              <span className="font-semibold">
                                #{audit.entity_id}
                              </span>

                              {audit.entity_type && (
                                <p className="mt-1 text-xs capitalize text-zinc-500">
                                  {audit.entity_type}
                                </p>
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </AuditTableCell>

                        <AuditTableCell className="min-w-[400px]">
                          <div className="space-y-2">
                            {audit.field_name && (
                              <p>
                                <span className="font-semibold text-zinc-900">
                                  Field:
                                </span>{" "}
                                {formatActionName(audit.field_name)}
                              </p>
                            )}

                            <div className="grid gap-2 lg:grid-cols-2">
                              <div className="rounded-lg border border-red-100 bg-red-50 p-2">
                                <p className="text-xs font-semibold uppercase text-red-700">
                                  Old Value
                                </p>

                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700">
                                  {audit.old_value || "—"}
                                </p>
                              </div>

                              <div className="rounded-lg border border-green-100 bg-green-50 p-2">
                                <p className="text-xs font-semibold uppercase text-green-700">
                                  New Value
                                </p>

                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700">
                                  {audit.new_value || "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </AuditTableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsAuditLogOpen(false)}
                className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AuditFilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-500">
        {label}
      </span>

      {children}
    </label>
  );
}

function AuditTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-zinc-300 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-600">
      {children}
    </th>
  );
}

function AuditTableCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-zinc-700 ${className}`}>
      {children}
    </td>
  );
}