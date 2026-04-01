import { create } from 'zustand'

export type Language = 'en' | 'es' | 'fr' | 'ko'

type LanguageStore = {
  language: Language
  setLanguage: (lang: Language) => void
}

const LANG_STORAGE_KEY = 'lang'

function getSavedLanguage(): Language {
  if (typeof window === 'undefined') return 'en'

  const saved = window.localStorage.getItem(LANG_STORAGE_KEY)

  if (saved === 'es' || saved === 'fr' || saved === 'ko') return saved

  return 'en'
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: getSavedLanguage(),

  setLanguage: (lang) => {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang)
    set({ language: lang })
  },
}))