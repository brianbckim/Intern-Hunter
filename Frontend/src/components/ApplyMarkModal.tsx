import './ApplyMarkModal.css'

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
          aria-label="Close"
          disabled={saving}
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="ih-apply-mark-title" className="ih-applyMark-title">
          Track this application
        </h2>
        <p className="ih-applyMark-lead">
          Complete your application on the employer site (opened in a new tab when available). When you are finished,
          save it to your tracker below.
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
            {saving ? 'Saving…' : 'Applied'}
          </button>
          <button className="ih-btnGhost" type="button" disabled={saving} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
