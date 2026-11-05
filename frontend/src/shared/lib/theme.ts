const STORAGE_KEY = 'kms_theme';

export function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
}
