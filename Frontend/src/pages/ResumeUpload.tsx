import { useRef, useState } from 'react'
import { useUiText } from '../lib/uiLanguage'

type ResumeUploadProps = {
  uploading: boolean
  uploadProgress: number
  analyzeDisabled: boolean
  onUpload: (file: File) => Promise<void>
  onAnalyze: () => void
  uploadedStatus?: {
    uploaded: boolean
    fileName: string
    lastUpdated: string
  }
}

const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx']

export default function ResumeUpload({
  uploading,
  uploadProgress,
  analyzeDisabled,
  onUpload,
  onAnalyze,
  uploadedStatus,
}: ResumeUploadProps) {
  const { ui } = useUiText()
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
        <div className="ih-cardTitle">{ui('Resume Upload', '이력서 업로드')}</div>
      </div>

      <div className="ih-cardBody">
        {uploadedStatus ? (
          <div style={{ display: 'grid', gap: 4 }}>
            <div className="ih-pill">{uploadedStatus.uploaded ? ui('Uploaded', '업로드됨') : ui('Not uploaded', '업로드 안 됨')}</div>
            <div className="ih-muted">
              {ui('File', '파일')}: <strong>{uploadedStatus.fileName}</strong>
            </div>
            <div className="ih-muted">{ui('Last updated', '마지막 업데이트')}: {uploadedStatus.lastUpdated}</div>
          </div>
        ) : null}

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
          <div className="ih-muted">{ui('Drag & drop resume here', '여기로 이력서를 드래그해 놓으세요')}</div>
          <div className="ih-muted">{ui('Accepted', '지원 형식')}: {ACCEPTED_EXTENSIONS.join(', ').toUpperCase()}</div>
        </div>

        <div className="ih-actions">
          <button className="ih-btnPrimary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? ui('Uploading...', '업로드 중...') : ui('Upload PDF/DOC', 'PDF/DOC 업로드')}
          </button>
          <button className="ih-btnGhost" disabled={analyzeDisabled || uploading} onClick={onAnalyze}>
            {ui('Analyze Resume', '이력서 분석')}
          </button>
        </div>

        {uploading ? (
          <div className="resume-progressWrap">
            <div className="resume-progressBar">
              <div className="resume-progressFill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="ih-muted">{ui('Uploading', '업로드 중')}: {uploadProgress}%</div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
