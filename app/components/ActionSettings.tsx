"use client";

import { useState } from "react";

type ActionColor = {
  id: number;
  originalId: number;
  name: string;
  color: string;
};

const DEFAULT_ACTION_COLORS: ActionColor[] = [
  { id: 0, originalId: 0, name: "Incomplete", color: "#000000" },
  { id: 1, originalId: 1, name: "Pending", color: "#000000" },
  { id: 2, originalId: 2, name: "Shipped", color: "#000000" },
  { id: 3, originalId: 3, name: "Partially Shipped", color: "#000000" },
  { id: 4, originalId: 4, name: "Refunded", color: "#000000" },
  { id: 5, originalId: 5, name: "Cancelled", color: "#000000" },
  { id: 6, originalId: 6, name: "Declined", color: "#000000" },
  { id: 7, originalId: 7, name: "Awaiting Payment", color: "#000000" },
  { id: 8, originalId: 8, name: "Awaiting Pickup", color: "#000000" },
  { id: 9, originalId: 9, name: "Awaiting Shipment", color: "#000000" },
  { id: 10, originalId: 10, name: "Completed", color: "#000000" },
  { id: 11, originalId: 11, name: "Awaiting Fulfillment", color: "#000000" },
  {
    id: 12,
    originalId: 12,
    name: "Manual Verification Required",
    color: "#000000",
  },
  { id: 13, originalId: 13, name: "Disputed", color: "#000000" },
  { id: 14, originalId: 14, name: "Partially Refunded", color: "#000000" },
];

function isValidHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

export default function ActionSettings() {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [actions, setActions] = useState<ActionColor[]>(DEFAULT_ACTION_COLORS);
  const [originalActions, setOriginalActions] =
    useState<ActionColor[]>(DEFAULT_ACTION_COLORS);
  const [deletedActions, setDeletedActions] = useState<ActionColor[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleOpenActions = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setDeletedActions([]);
    setIsActionsOpen(true);
    setIsLoadingActions(true);

    try {
      const response = await fetch("/api/sonic/actions", {
        method: "GET",
        cache: "no-store",
      });

      const rawText = await response.text();

      let data: any;

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(rawText || "Server returned a non-JSON response.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load actions.");
      }

      const loadedActions: ActionColor[] = Array.isArray(data.actions)
        ? data.actions.map(
            (action: { actionId: number; name: string; color: string }) => ({
              id: Number(action.actionId),
              originalId: Number(action.actionId),
              name: action.name,
              color: action.color,
            })
          )
        : DEFAULT_ACTION_COLORS.map((action) => ({
            ...action,
            originalId: action.id,
          }));

      setActions(loadedActions);
      setOriginalActions(loadedActions);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading actions."
      );
    } finally {
      setIsLoadingActions(false);
    }
  };

  const handleActionIdChange = (originalId: number, newId: string) => {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.originalId === originalId
          ? {
              ...action,
              id: Number(newId),
            }
          : action
      )
    );
  };

  const handleActionNameChange = (originalId: number, newName: string) => {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.originalId === originalId
          ? {
              ...action,
              name: newName,
            }
          : action
      )
    );
  };

  const handleColorChange = (originalId: number, newColor: string) => {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.originalId === originalId
          ? {
              ...action,
              color: newColor,
            }
          : action
      )
    );
  };

  const handleAddNewAction = () => {
    const highestActionId =
      actions.length > 0
        ? Math.max(...actions.map((action) => Number(action.id) || 0))
        : 0;

    const temporaryOriginalId = Date.now() * -1;

    const newAction: ActionColor = {
      id: highestActionId + 1,
      originalId: temporaryOriginalId,
      name: "New Action",
      color: "#000000",
    };

    setActions((currentActions) => [...currentActions, newAction]);
  };

  const handleDeleteAction = (actionToDelete: ActionColor) => {
    setActions((currentActions) =>
      currentActions.filter(
        (action) => action.originalId !== actionToDelete.originalId
      )
    );

    // Only queue existing database actions for DELETE.
    // New unsaved actions have negative originalId values.
    if (actionToDelete.originalId >= 0) {
      setDeletedActions((currentDeletedActions) => [
        ...currentDeletedActions,
        actionToDelete,
      ]);
    }
  };

  const handleSubmitAuditLog = async ({
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
  }) => {
    const response = await fetch("/api/sonic/update-audit-log", {
      method: "POST",
      credentials: "include",
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

    const rawText = await response.text();

    let data: any;

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(rawText || "Server returned a non-JSON response.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Failed to submit audit log.");
    }

    return data;
  };

  const handleSaveActions = async () => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const invalidActionId = actions.find(
      (action) => !Number.isInteger(Number(action.id)) || Number(action.id) < 0
    );

    if (invalidActionId) {
      setErrorMessage(
        `${invalidActionId.name || "An action"} needs a valid action ID.`
      );
      setIsSaving(false);
      return;
    }

    const duplicateActionId = actions.find((action, index) =>
      actions.some(
        (otherAction, otherIndex) =>
          otherIndex !== index && Number(otherAction.id) === Number(action.id)
      )
    );

    if (duplicateActionId) {
      setErrorMessage(
        `Action ID ${duplicateActionId.id} is being used more than once. Each action ID must be unique.`
      );
      setIsSaving(false);
      return;
    }

    const invalidActionName = actions.find(
      (action) => !action.name || !action.name.trim()
    );

    if (invalidActionName) {
      setErrorMessage("Each action needs an action name.");
      setIsSaving(false);
      return;
    }

    const invalidActionColor = actions.find(
      (action) => !isValidHexColor(action.color)
    );

    if (invalidActionColor) {
      setErrorMessage(
        `${invalidActionColor.name} needs a valid hex color like #000000. You entered: "${invalidActionColor.color}"`
      );
      setIsSaving(false);
      return;
    }

    try {
      await Promise.all(
        deletedActions.map(async (action) => {
          const response = await fetch("/api/sonic/actions", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              statusId: action.originalId,
            }),
          });

          const rawText = await response.text();

          let data: any;

          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            throw new Error(rawText || "Server returned a non-JSON response.");
          }

          if (!response.ok || !data.success) {
            throw new Error(data.error || `Failed to delete ${action.name}.`);
          }

          await handleSubmitAuditLog({
            entity_type: "action",
            entity_id: action.originalId,
            action: "action_deleted",
            field_name: "action",
            old_value: JSON.stringify({
              status_id: action.originalId,
              status_name: action.name,
              color: action.color,
            }),
            new_value: null,
            metadata: {
              status_id: action.originalId,
              status_name: action.name,
              color: action.color,
              source: "settings_actions_modal",
            },
          });
        })
      );

      const actionsToSave = actions.filter((action) => {
        if (action.originalId < 0) return true;

        const originalAction = originalActions.find(
          (original) => original.originalId === action.originalId
        );

        if (!originalAction) return true;

        return (
          Number(originalAction.id) !== Number(action.id) ||
          originalAction.name.trim() !== action.name.trim() ||
          originalAction.color.trim() !== action.color.trim()
        );
      });

      await Promise.all(
        actionsToSave.map(async (action) => {
          const newActionId = Number(action.id);
          const newActionName = action.name.trim();
          const newColor = action.color.trim();

          const isNewAction = action.originalId < 0;

          const response = await fetch("/api/sonic/actions", {
            method: isNewAction ? "POST" : "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(
              isNewAction
                ? {
                    // The API/database still expects statusId/statusName.
                    statusId: newActionId,
                    statusName: newActionName,
                    colorHex: newColor,
                  }
                : {
                    // The API/database still expects statusId/statusName.
                    originalStatusId: action.originalId,
                    statusId: newActionId,
                    statusName: newActionName,
                    colorHex: newColor,
                  }
            ),
          });

          const rawText = await response.text();

          let data: any;

          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            throw new Error(rawText || "Server returned a non-JSON response.");
          }

          if (!response.ok || !data.success) {
            throw new Error(
              data.error ||
                `Failed to ${isNewAction ? "add" : "update"} ${action.name}.`
            );
          }

          if (isNewAction) {
            await handleSubmitAuditLog({
              entity_type: "action",
              entity_id: newActionId,
              action: "action_created",
              field_name: "action",
              old_value: null,
              new_value: JSON.stringify({
                status_id: newActionId,
                status_name: newActionName,
                color: newColor,
              }),
              metadata: {
                status_id: newActionId,
                status_name: newActionName,
                color: newColor,
                source: "settings_actions_modal",
              },
            });

            return;
          }

          const originalAction = originalActions.find(
            (original) => original.originalId === action.originalId
          );

          const oldActionId = originalAction?.id ?? null;
          const oldActionName = originalAction?.name?.trim() ?? null;
          const oldColor = originalAction?.color?.trim() ?? null;

          if (
            oldActionId !== newActionId ||
            oldActionName !== newActionName ||
            oldColor !== newColor
          ) {
            await handleSubmitAuditLog({
              entity_type: "action",
              entity_id: action.originalId,
              action: "action_updated",
              field_name: "action",
              old_value: JSON.stringify({
                status_id: oldActionId,
                status_name: oldActionName,
                color: oldColor,
              }),
              new_value: JSON.stringify({
                status_id: newActionId,
                status_name: newActionName,
                color: newColor,
              }),
              metadata: {
                original_status_id: action.originalId,
                old_status_id: oldActionId,
                new_status_id: newActionId,
                old_status_name: oldActionName,
                new_status_name: newActionName,
                old_color: oldColor,
                new_color: newColor,
                source: "settings_actions_modal",
              },
            });
          }
        })
      );

      const updatedOriginalActions = actions
        .map((action) => ({
          ...action,
          id: Number(action.id),
          originalId: Number(action.id),
          name: action.name.trim(),
          color: action.color.trim(),
        }))
        .sort((a, b) => a.id - b.id);

      setActions(updatedOriginalActions);
      setOriginalActions(updatedOriginalActions);
      setDeletedActions([]);
      setSuccessMessage("Actions saved.");
      setIsActionsOpen(false);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving actions."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Actions</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Add, remove, rename, and recolor order actions.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleOpenActions}
            className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            Change Actions
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMessage}
        </div>
      )}

      {isActionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Change Actions</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add, delete, rename, renumber, and recolor order actions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsActionsOpen(false)}
                className="rounded-lg px-2 py-1 text-xl font-semibold leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Close action settings"
              >
                ×
              </button>
            </div>

            <div className="border-b border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={handleAddNewAction}
                className="cursor-pointer rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                Add New Action
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto px-5 py-4">
              {isLoadingActions ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  Loading actions...
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {actions.map((action) => (
                    <div
                      key={action.originalId}
                      className="grid gap-3 rounded-xl border border-zinc-200 p-3 sm:grid-cols-[44px_120px_1fr_160px_40px] sm:items-start"
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteAction(action)}
                        className="mt-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-red-700 text-lg font-bold text-white transition hover:bg-red-800"
                        aria-label={`Delete action ${action.name}`}
                      >
                        ×
                      </button>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-500">
                          Action ID
                        </label>
                        <input
                          type="number"
                          value={action.id}
                          onChange={(event) =>
                            handleActionIdChange(
                              action.originalId,
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-500">
                          Action Name
                        </label>
                        <input
                          type="text"
                          value={action.name}
                          onChange={(event) =>
                            handleActionNameChange(
                              action.originalId,
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-500">
                          Color
                        </label>
                        <input
                          type="text"
                          value={action.color}
                          onChange={(event) =>
                            handleColorChange(
                              action.originalId,
                              event.target.value
                            )
                          }
                          placeholder="#000000"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      <div
                        className="mt-4 h-10 w-10 rounded-lg border border-zinc-300"
                        style={{
                          backgroundColor: isValidHexColor(action.color)
                            ? action.color
                            : "#ffffff",
                        }}
                        title={action.color}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsActionsOpen(false)}
                disabled={isSaving || isLoadingActions}
                className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveActions}
                disabled={isSaving || isLoadingActions}
                className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}