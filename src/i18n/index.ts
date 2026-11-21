import { useCallback } from 'react';
import { useSettings } from '../store/settings';
import { el } from './el';
import { en, type TKey } from './en';

const dicts = { el, en };

export function translate(lang: 'el' | 'en', key: TKey | string, vars?: Record<string, string | number>) {
  let s: string = (dicts[lang] as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useT() {
  const lang = useSettings((s) => s.lang);
  return useCallback((key: TKey | string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

export type { TKey };
