import { useCallback } from 'react'
import { useLanguageStore } from '../stores/langStore'

export function useUiText() {
  const language = useLanguageStore((state) => state.language)

  const ui = useCallback((english: string, korean: string,): string => {
    const map = { en: english, ko: korean,}
    return map[language as keyof typeof map] ?? english
  }, [language])

  return {language, ui}
}