import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Interval } from '../types';

export type Lang = 'el' | 'en';
export type Theme = 'dark' | 'light';

interface SettingsState {
  lang: Lang;
  theme: Theme;
  ratingInterval: Interval;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  setRatingInterval: (i: Interval) => void;
}

const initialLang: Lang = typeof navigator !== 'undefined' && !navigator.language.startsWith('el') ? 'en' : 'el';

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: initialLang,
      theme: 'dark',
      ratingInterval: '1d',
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme;
        try {
          localStorage.setItem('ci-theme', theme);
        } catch {
          /* ignore */
        }
        set({ theme });
      },
      setRatingInterval: (ratingInterval) => set({ ratingInterval }),
    }),
    { name: 'ci-settings' },
  ),
);
