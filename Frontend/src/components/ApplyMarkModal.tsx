import './ApplyMarkModal.css'
import { useUiText } from '../lib/uiLanguage'

export type ApplyMarkModalProps = {
  open: boolean
  jobTitle: string
  company: string
  location: string
  saving?: boolean
  error?: string | null
  onMarkApplied: () => void
  onClose: () => void
}

export default function ApplyMarkModal({
  open,
  jobTitle,
  company,
  location,
  saving = false,
  error = null,
  onMarkApplied,
  onClose,
}: ApplyMarkModalProps) {
  const { ui } = useUiText()
  if (!open) return null

  return (
    <div
      className="ih-applyMark-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ih-apply-mark-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ih-applyMark-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="ih-applyMark-closeX"
          aria-label={ui('Close', '닫기')}
          disabled={saving}
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="ih-apply-mark-title" className="ih-applyMark-title">
          {ui('Track this application', '이 지원 내역 추적하기')}
        </h2>
        <p className="ih-applyMark-lead">
          {ui(
            'Complete your application on the employer site (opened in a new tab when available). When you are finished, save it to your tracker below.',
            '기업 사이트에서 지원을 완료한 뒤, 아래에서 이 내역을 추적 목록에 저장하세요. 가능하면 새 탭에서 열립니다.'
          )}
        </p>
        <div className="ih-applyMark-job">
          <div className="ih-applyMark-jobTitle">{jobTitle}</div>
          <div className="ih-muted ih-applyMark-jobMeta">
            {company} • {location}
          </div>
        </div>
        {error ? <p className="ih-error ih-applyMark-error">{error}</p> : null}
        <div className="ih-applyMark-actions">
          <button className="ih-btnPrimary" type="button" disabled={saving} onClick={onMarkApplied}>
            {saving ? ui('Saving…', '저장 중…') : ui('Applied', '지원 완료')}
          </button>
          <button className="ih-btnGhost" type="button" disabled={saving} onClick={onClose}>
            {ui('Close', '닫기')}
          </button>
        </div>
      </div>
    </div>
  )
}
