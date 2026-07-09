"use client";

import type React from "react";
import { useMemo, useState } from "react";

type ActionOption = {
  id: number | string;
  name: string;
};

type Stage = {
  stage_id: number | string;
  stage_name: string;
  color_hex: string;
  actions?: Array<string | number> | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EditableStage = {
  originalStageId: number | string;
  stage_id: number | string;
  stage_name: string;
  color_hex: string;
  actions: string[];
  created_at?: string | null;
  updated_at?: string | null;
  isNew?: boolean;
};

const EMPTY_STAGE: Omit<EditableStage, "stage_id" | "originalStageId"> = {
  stage_name: "",
  color_hex: "#FFFFFF",
  actions: [],
  isNew: true,
};

function normalizeHexColor(value: string) {
  const cleanValue = value.trim();

  if (!cleanValue) return "#FFFFFF";

  return cleanValue.startsWith("#") ? cleanValue : `#${cleanValue}`;
}

function isValidHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function normalizeStageActions(value: unknown): string[] {
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

function getActionValue(action: ActionOption) {
  // This stores action names in stages.actions.
  // If you would rather store IDs, change this to: return String(action.id);
  return action.name;
}

export default function StagesManager() {
  const [isStagesOpen, setIsStagesOpen] = useState(false);
  const [stages, setStages] = useState<EditableStage[]>([]);
  const [deletedStages, setDeletedStages] = useState<EditableStage[]>([]);
  const [actions, setActions] = useState<ActionOption[]>([]);

  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [isSavingStages, setIsSavingStages] = useState(false);
  const [stageErrorMessage, setStageErrorMessage] = useState("");
  const [stageSuccessMessage, setStageSuccessMessage] = useState("");

  const usedActionsByOtherStages = useMemo(() => {
    const actionMap = new Map<string, string>();

    stages.forEach((stage) => {
      stage.actions.forEach((actionName) => {
        actionMap.set(actionName, String(stage.originalStageId));
      });
    });

    return actionMap;
  }, [stages]);

  async function handleLoadActions() {
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

    const loadedActions: ActionOption[] = Array.isArray(data.actions)
      ? data.actions
          .map((action: any, index: number) => ({
            id: action.action_id ?? action.id ?? index,
            name: String(
              action.action_name ??
                action.name ??
                action.status_name ??
                ""
            ).trim(),
          }))
          .filter((action: ActionOption) => action.name)
      : [];

    setActions(loadedActions);
  }

  async function handleLoadStages() {
    const response = await fetch("/api/sonic/stages", {
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
      throw new Error(data.error || "Failed to load stages.");
    }

    const loadedStages: EditableStage[] = Array.isArray(data.stages)
      ? data.stages.map((stage: Stage) => ({
          stage_id: stage.stage_id,
          originalStageId: stage.stage_id,
          stage_name: stage.stage_name || "",
          color_hex: stage.color_hex || "#FFFFFF",
          actions: normalizeStageActions(stage.actions),
          created_at: stage.created_at,
          updated_at: stage.updated_at,
          isNew: false,
        }))
      : [];

    setStages(
      loadedStages.sort(
        (a, b) => Number(a.stage_id ?? 0) - Number(b.stage_id ?? 0)
      )
    );
  }

  async function handleOpenStages() {
    setIsStagesOpen(true);
    setStageErrorMessage("");
    setStageSuccessMessage("");
    setDeletedStages([]);
    setIsLoadingStages(true);

    try {
      await Promise.all([handleLoadActions(), handleLoadStages()]);
    } catch (error) {
      console.error("Load stages failed:", error);

      setStageErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading stages."
      );
    } finally {
      setIsLoadingStages(false);
    }
  }

  function handleAddNewStage() {
    const temporaryId = Date.now() * -1;

    setStages((currentStages) => [
      ...currentStages,
      {
        stage_id: temporaryId,
        originalStageId: temporaryId,
        ...EMPTY_STAGE,
      },
    ]);
  }

  function handleDeleteStage(stageToDelete: EditableStage) {
    setStages((currentStages) =>
      currentStages.filter(
        (stage) =>
          String(stage.originalStageId) !== String(stageToDelete.originalStageId)
      )
    );

    if (!stageToDelete.isNew) {
      setDeletedStages((currentDeletedStages) => [
        ...currentDeletedStages,
        stageToDelete,
      ]);
    }
  }

  function handleStageChange(
    originalStageId: number | string,
    field: "stage_name" | "color_hex",
    value: string
  ) {
    setStages((currentStages) =>
      currentStages.map((stage) =>
        String(stage.originalStageId) === String(originalStageId)
          ? {
              ...stage,
              [field]: value,
            }
          : stage
      )
    );
  }

  function handleToggleAction(
    originalStageId: number | string,
    actionValue: string
  ) {
    setStages((currentStages) =>
      currentStages.map((stage) => {
        if (String(stage.originalStageId) !== String(originalStageId)) {
          return stage;
        }

        const alreadySelected = stage.actions.includes(actionValue);

        return {
          ...stage,
          actions: alreadySelected
            ? stage.actions.filter((currentAction) => currentAction !== actionValue)
            : [...stage.actions, actionValue],
        };
      })
    );
  }

  function getDuplicateActionName() {
    const seenActions = new Set<string>();

    for (const stage of stages) {
      for (const action of stage.actions) {
        if (seenActions.has(action)) {
          return action;
        }

        seenActions.add(action);
      }
    }

    return null;
  }

  async function handleSaveStages() {
    setIsSavingStages(true);
    setStageErrorMessage("");
    setStageSuccessMessage("");

    const invalidStage = stages.find((stage) => {
      const stageName = String(stage.stage_name || "").trim();
      const colorHex = normalizeHexColor(String(stage.color_hex || ""));

      return !stageName || !isValidHexColor(colorHex);
    });

    if (invalidStage) {
      setStageErrorMessage(
        "Each stage needs a valid stage name and hex color like #FFFFFF."
      );
      setIsSavingStages(false);
      return;
    }

    const duplicateActionName = getDuplicateActionName();

    if (duplicateActionName) {
      setStageErrorMessage(
        `The action "${duplicateActionName}" is already assigned to another stage. Each action can only belong to one stage.`
      );
      setIsSavingStages(false);
      return;
    }

    try {
      await Promise.all(
        deletedStages.map(async (stage) => {
          const response = await fetch(
            `/api/sonic/stages?stageId=${stage.originalStageId}`,
            {
              method: "DELETE",
            }
          );

          const rawText = await response.text();

          let data: any;

          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            throw new Error(rawText || "Server returned a non-JSON response.");
          }

          if (!response.ok || !data.success) {
            throw new Error(
              data.error || `Failed to delete ${stage.stage_name}.`
            );
          }
        })
      );

      const savedStages = await Promise.all(
        stages.map(async (stage) => {
          const payload = {
            stage_id: stage.isNew ? undefined : Number(stage.originalStageId),
            stage_name: String(stage.stage_name || "").trim(),
            color_hex: normalizeHexColor(String(stage.color_hex || "")),
            actions: stage.actions,
          };

          const response = await fetch("/api/sonic/stages", {
            method: stage.isNew ? "POST" : "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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
                `Failed to ${stage.isNew ? "create" : "update"} ${
                  stage.stage_name
                }.`
            );
          }

          return data.stage;
        })
      );

      const normalizedSavedStages: EditableStage[] = savedStages
        .filter(Boolean)
        .map((stage: Stage) => ({
          stage_id: stage.stage_id,
          originalStageId: stage.stage_id,
          stage_name: stage.stage_name || "",
          color_hex: stage.color_hex || "#FFFFFF",
          actions: normalizeStageActions(stage.actions),
          created_at: stage.created_at,
          updated_at: stage.updated_at,
          isNew: false,
        }))
        .sort((a, b) => Number(a.stage_id ?? 0) - Number(b.stage_id ?? 0));

      setStages(normalizedSavedStages);
      setDeletedStages([]);
      setStageSuccessMessage("Stages saved.");
      setIsStagesOpen(false);
    } catch (error) {
      console.error("Save stages failed:", error);

      setStageErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving stages."
      );
    } finally {
      setIsSavingStages(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Stages</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Add, remove, and edit production stages for your order workflow.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleOpenStages}
            className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            Change Stages
          </button>
        </div>
      </div>

      {stageErrorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {stageErrorMessage}
        </div>
      )}

      {stageSuccessMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {stageSuccessMessage}
        </div>
      )}

      {isStagesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Change Stages</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add, delete, rename, color, and assign actions to stages. Each
                  action can only belong to one stage.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsStagesOpen(false)}
                disabled={isSavingStages}
                className="rounded-lg px-2 py-1 text-xl font-semibold leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close stage settings"
              >
                ×
              </button>
            </div>

            <div className="border-b border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={handleAddNewStage}
                disabled={isSavingStages || isLoadingStages}
                className="cursor-pointer rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add New Stage
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto px-5 py-4">
              {isLoadingStages ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  Loading stages...
                </div>
              ) : stages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm font-semibold text-zinc-500">
                  No stages found yet. Click “Add New Stage” to create one.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {stages.map((stage) => (
                    <div
                      key={stage.originalStageId}
                      className="rounded-xl border border-zinc-200 p-4"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-zinc-900">
                            {stage.stage_name || "New Stage"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {stage.isNew
                              ? "Unsaved stage"
                              : `Stage ID: ${stage.stage_id}`}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteStage(stage)}
                          disabled={isSavingStages}
                          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-red-700 text-lg font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Delete stage ${stage.stage_name}`}
                        >
                          ×
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <StageField label="Stage Name">
                          <input
                            type="text"
                            value={stage.stage_name || ""}
                            onChange={(event) =>
                              handleStageChange(
                                stage.originalStageId,
                                "stage_name",
                                event.target.value
                              )
                            }
                            placeholder="Example: Proofing"
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                          />
                        </StageField>

                        <StageField label="Stage Color">
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={
                                isValidHexColor(
                                  normalizeHexColor(
                                    String(stage.color_hex || "")
                                  )
                                )
                                  ? normalizeHexColor(
                                      String(stage.color_hex || "")
                                    )
                                  : "#FFFFFF"
                              }
                              onChange={(event) =>
                                handleStageChange(
                                  stage.originalStageId,
                                  "color_hex",
                                  event.target.value
                                )
                              }
                              className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1"
                            />

                            <input
                              type="text"
                              value={stage.color_hex || ""}
                              onChange={(event) =>
                                handleStageChange(
                                  stage.originalStageId,
                                  "color_hex",
                                  event.target.value
                                )
                              }
                              placeholder="#FFFFFF"
                              className="w-full rounded-xl border border-zinc-300 px-3 py-2 font-mono text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
                            />
                          </div>
                        </StageField>
                      </div>

                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold text-zinc-500">
                          Actions
                        </p>

                        {actions.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-medium text-zinc-500">
                            No actions found. Add actions first, then come back
                            to assign them to stages.
                          </div>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {actions.map((action) => {
                              const actionValue = getActionValue(action);
                              const selected =
                                stage.actions.includes(actionValue);

                              const usedByStageId =
                                usedActionsByOtherStages.get(actionValue);

                              const usedByAnotherStage =
                                !!usedByStageId &&
                                String(usedByStageId) !==
                                  String(stage.originalStageId);

                              return (
                                <label
                                  key={String(action.id)}
                                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                                    usedByAnotherStage
                                      ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                                      : "cursor-pointer border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={
                                      isSavingStages || usedByAnotherStage
                                    }
                                    onChange={() =>
                                      handleToggleAction(
                                        stage.originalStageId,
                                        actionValue
                                      )
                                    }
                                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-zinc-300 disabled:cursor-not-allowed"
                                  />

                                  <span>
                                    <span className="block font-semibold">
                                      {action.name}
                                    </span>

                                    {usedByAnotherStage && (
                                      <span className="mt-0.5 block text-xs">
                                        Already assigned to another stage
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsStagesOpen(false)}
                disabled={isSavingStages || isLoadingStages}
                className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveStages}
                disabled={isSavingStages || isLoadingStages}
                className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingStages ? "Saving..." : "Save Stages"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StageField({
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