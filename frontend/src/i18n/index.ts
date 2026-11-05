import en from './en.json';
import fa from './fa.json';

export type Locale = 'fa' | 'en';

const catalogs = { fa, en } as const;

type NestedKeys<T> = T extends object
  ? { [K in keyof T]: `${Exclude<K, symbol>}` | `${Exclude<K, symbol>}.${NestedKeys<T[K]>}` }[keyof T]
  : never;

export type I18nKey = NestedKeys<typeof fa>;

function lookup(locale: Locale, key: string): string | undefined {
  let node: unknown = catalogs[locale];
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function t(key: I18nKey, vars?: Record<string, string | number>, locale: Locale = 'fa'): string {
  const raw = lookup(locale, key) ?? lookup('fa', key) ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
    raw,
  );
}
