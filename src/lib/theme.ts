import type { Settings } from './types';

export function applyTheme(theme: Settings['theme']): void {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0f17' : '#f8fafc');
  try {
    localStorage.setItem('dtp-theme', theme);
  } catch {
    /* ignoré */
  }
}
