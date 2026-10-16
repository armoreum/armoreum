export type LaunchDraftMode = "pons-v2" | "ethereum" | "multichain";
export type LaunchDraftStorageField = "draft" | "id";

export interface LaunchDraftStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export const legacyLaunchDraftStorageKeys = {
  draft: "bulletproof.launch-draft.v2",
  id: "bulletproof.launch-draft-id.v2",
};

const modeKeys: Record<LaunchDraftMode, Record<LaunchDraftStorageField, string>> = {
  "pons-v2": {
    draft: "armoreum.launch-draft.v2",
    id: "armoreum.launch-draft-id.v2",
  },
  ethereum: {
    draft: "armoreum.launch-draft.v2.ethereum",
    id: "armoreum.launch-draft-id.v2.ethereum",
  },
  multichain: {
    draft: "armoreum.launch-draft.v2.multichain",
    id: "armoreum.launch-draft-id.v2.multichain",
  },
};

export function getLaunchDraftStorageKey(mode: LaunchDraftMode | null, field: LaunchDraftStorageField) {
  return modeKeys[mode ?? "pons-v2"][field];
}

export function readLaunchDraftStorageValue(
  storage: Pick<LaunchDraftStorage, "getItem">,
  mode: LaunchDraftMode | null,
  field: LaunchDraftStorageField,
) {
  try {
    const primary = storage.getItem(getLaunchDraftStorageKey(mode, field));
    if (primary) return primary;
    // Older Pons and Multichain drafts shared the original unscoped key.
    if (mode === "multichain") {
      return storage.getItem(modeKeys["pons-v2"][field]) || null;
    }
  } catch {
    return null;
  }
  return null;
}

function isValidDraftId(value: string | null) {
  return Boolean(value && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value));
}

function hasTokenDetails(value: string | null) {
  if (!value) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    return ["name", "symbol", "description", "imageUrl", "imageObjectPath", "websiteUrl", "xUrl"]
      .some((field) => typeof (parsed as Record<string, unknown>)[field] === "string"
        && ((parsed as Record<string, string>)[field] ?? "").trim().length > 0);
  } catch {
    return false;
  }
}

export function hasSavedLaunchDraft(
  storage: Pick<LaunchDraftStorage, "getItem">,
  mode: LaunchDraftMode,
  fragmentDraftId = "",
) {
  return isValidDraftId(fragmentDraftId)
    || isValidDraftId(readLaunchDraftStorageValue(storage, mode, "id"))
    || hasTokenDetails(readLaunchDraftStorageValue(storage, mode, "draft"));
}

export function clearLocalLaunchDrafts(storage: LaunchDraftStorage) {
  const keys = new Set([
    ...Object.values(modeKeys).flatMap((entry) => Object.values(entry)),
    ...Object.values(legacyLaunchDraftStorageKeys),
  ]);
  try {
    for (const key of keys) storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function clearCompletedLaunchDraft(
  storage: LaunchDraftStorage,
  mode: LaunchDraftMode,
  completedDraftId: string,
) {
  if (!isValidDraftId(completedDraftId)) return false;
  try {
    const activeKeys = modeKeys[mode];
    const activeId = storage.getItem(activeKeys.id);
    // A different tab may have started a newer draft in this same mode.
    if (activeId && activeId !== completedDraftId) return false;
    for (const entry of Object.values(modeKeys)) {
      if (storage.getItem(entry.id) !== completedDraftId) continue;
      storage.removeItem(entry.id);
      storage.removeItem(entry.draft);
    }

    if (storage.getItem(legacyLaunchDraftStorageKeys.id) === completedDraftId) {
      storage.removeItem(legacyLaunchDraftStorageKeys.id);
      storage.removeItem(legacyLaunchDraftStorageKeys.draft);
    }

    if (!storage.getItem(activeKeys.id)) storage.removeItem(activeKeys.draft);
    return true;
  } catch {
    return false;
  }
}
