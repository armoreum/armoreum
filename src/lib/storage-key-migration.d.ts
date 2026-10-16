export type StorageMigrationResult =
  | 'missing'
  | 'migrated'
  | 'already-present'
  | 'invalid-legacy'
  | 'destination-conflict'
  | 'verification-failed'
  | 'storage-unavailable';

export type StringStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function migrateStorageKey(
  storage: StringStorage,
  currentKey: string,
  legacyKey: string,
  validate: (value: string) => boolean,
): StorageMigrationResult;
