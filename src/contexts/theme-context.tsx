import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { migrateStorageKey } from '@/lib/storage-key-migration.js';

export type ThemePreference = 'system-auto-time' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  activeTheme: ThemeMode;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'armoreum-theme-preference';
const LEGACY_STORAGE_KEY = 'bulletproof-theme-preference';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function migrateThemePreference() {
  migrateStorageKey(window.localStorage, STORAGE_KEY, LEGACY_STORAGE_KEY, isThemePreference);
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system-auto-time' || value === 'light' || value === 'dark';
}

function initialPreference(): ThemePreference {
  try {
    migrateThemePreference();
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system-auto-time';
  } catch {
    return 'system-auto-time';
  }
}

function themeForLocalTime(date = new Date()): ThemeMode {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

function initialTheme(): ThemeMode {
  const applied = document.documentElement.dataset.theme;
  if (applied === 'light' || applied === 'dark') return applied;
  const preference = initialPreference();
  return preference === 'system-auto-time' ? themeForLocalTime() : preference;
}

function millisecondsUntilNextBoundary() {
  const now = new Date();
  const next = new Date(now);
  const hour = now.getHours();
  if (hour < 6) {
    next.setHours(6, 0, 0, 0);
  } else if (hour < 18) {
    next.setHours(18, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }
  return Math.max(1000, next.getTime() - now.getTime() + 25);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [activeTheme, setActiveTheme] = useState<ThemeMode>(initialTheme);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The active choice still applies for this session if storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const apply = () => {
      const mode = preference === 'system-auto-time' ? themeForLocalTime() : preference;
      document.documentElement.dataset.theme = mode;
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.style.colorScheme = mode;
      setActiveTheme(mode);
    };

    apply();
    if (preference !== 'system-auto-time') return;

    let boundaryTimer = 0;
    const scheduleBoundary = () => {
      window.clearTimeout(boundaryTimer);
      boundaryTimer = window.setTimeout(() => {
        apply();
        scheduleBoundary();
      }, millisecondsUntilNextBoundary());
    };
    const onPageActive = () => {
      if (document.visibilityState === 'visible') apply();
    };

    scheduleBoundary();
    const localClockCheck = window.setInterval(apply, 60_000);
    window.addEventListener('focus', onPageActive);
    window.addEventListener('pageshow', onPageActive);
    document.addEventListener('visibilitychange', onPageActive);

    return () => {
      window.clearTimeout(boundaryTimer);
      window.clearInterval(localClockCheck);
      window.removeEventListener('focus', onPageActive);
      window.removeEventListener('pageshow', onPageActive);
      document.removeEventListener('visibilitychange', onPageActive);
    };
  }, [preference]);

  const value = useMemo(() => ({ preference, activeTheme, setPreference }), [preference, activeTheme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemePreference must be used inside ThemeProvider.');
  return value;
}
