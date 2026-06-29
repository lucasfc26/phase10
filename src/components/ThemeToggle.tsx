import { Moon, Sun } from 'lucide-react';
import { applyTheme, type Theme } from '../lib/theme';

type ThemeToggleProps = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  className?: string;
};

export function ThemeToggle({ theme, onThemeChange, className = '' }: ThemeToggleProps) {
  const next = theme === 'dark' ? 'light' : 'dark';

  const handleToggle = () => {
    applyTheme(next);
    onThemeChange(next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`theme-toggle ${className}`}
      title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span className="hidden sm:inline">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
    </button>
  );
}
