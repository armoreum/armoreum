import { Moon, Sun } from 'lucide-react';
import { useThemePreference } from '@/contexts/theme-context';

type ThemeControlVariant = 'sidebar' | 'mobile' | 'header';

export function ThemeControl({ variant = 'sidebar' }: { variant?: ThemeControlVariant }) {
  const { activeTheme, setPreference } = useThemePreference();
  const nextTheme = activeTheme === 'light' ? 'dark' : 'light';
  const Icon = activeTheme === 'light' ? Moon : Sun;

  return <button
    type="button"
    className={`theme-toggle theme-toggle-${variant}`}
    aria-label={`Switch to ${nextTheme} mode`}
    title={`Switch to ${nextTheme} mode`}
    data-testid="button-theme-toggle"
    onClick={() => setPreference(nextTheme)}
  >
    <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
  </button>;
}
