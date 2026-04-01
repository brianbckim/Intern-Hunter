import { useCallback } from 'react'
import { useLanguageStore } from '../stores/langStore'

export function useUiText() {
  const language = useLanguageStore((state) => state.language)
  const isKorean = language === 'ko'

  const ui = useCallback((english: string, korean: string): string => {
    return isKorean ? korean : english
  }, [isKorean])

  return { language, isKorean, ui }
}