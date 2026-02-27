import { useRef, useState } from 'react'

type ResumeUploadProps = {
  uploading: boolean
  uploadProgress: number
  analyzeDisabled: boolean
  onUpload: (file: File) => Promise<void>
  onAnalyze: () => void
  onOpenFeedback?: () => void
}

const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx']

export default function ResumeUpload({
  uploading,
  uploadProgress,
  analyzeDisabled,
  onUpload,
  onAnalyze,
  onOpenFeedback,
}: ResumeUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    await onUpload(file)
  }

  return (
    <section className="ih-card">
      <div className="ih-cardHeader">
        <div className="ih-cardTitle">Resume Upload</div>
      </div>

      <div className="ih-cardBody">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          onChange={(event) => {
            void handleFiles(event.target.files)
            event.currentTarget.value = ''
          }}
        />

        <div
          className={`resume-dropZone ${dragActive ? 'active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragActive(false)
            void handleFiles(event.dataTransfer.files)
          }}
        >
          <div className="ih-muted">Drag & drop resume here</div>
          <div className="ih-muted">Accepted: {ACCEPTED_EXTENSIONS.join(', ').toUpperCase()}</div>
        </div>

        <div className="ih-actions">
          <button className="ih-btnPrimary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Uploading...' : 'Upload PDF/DOC'}
          </button>
          <button className="ih-btnGhost" disabled={analyzeDisabled || uploading} onClick={onAnalyze}>
            Analyze Resume
          </button>
          <button
            className="ih-btnGhost"
            disabled={analyzeDisabled || uploading || !onOpenFeedback}
            onClick={() => onOpenFeedback?.()}
          >
            AI Feedback
          </button>
        </div>

        {uploading ? (
          <div className="resume-progressWrap">
            <div className="resume-progressBar">
              <div className="resume-progressFill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="ih-muted">Uploading: {uploadProgress}%</div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
