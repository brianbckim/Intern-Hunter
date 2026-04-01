import { useCallback, useEffect, useState } from 'react'
import mammoth from 'mammoth'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import {
  ApiError,
  downloadResumeFile,
  downloadResumePreviewFile,
  ensureRecommendations,
  generateResumeFeedback,
  getResume,
  listMyResumes,
  reextractResume,
  uploadResumeWithProgress,
  type ResumeDetail,
  type ResumeUploadResponse,
} from '../lib/api'
import ResumePreview from './ResumePreview'
import ResumeUpload from './ResumeUpload'
import { useUiText } from '../lib/uiLanguage'
import './ResumePage.css'

function cleanExtractedPreview(value: string | null | undefined): string | null {
  if (!value) return null

  const normalized = value.replace(/\r\n?/g, '\n')
  const rawLines = normalized.split('\n').map((line) => line.trimEnd())

  const hardNoiseMarkers = [
    '<?xml',
    'schemas.openxmlformats.org',
    '[content_types].xml',
    '_rels/.rels',
    'word/_rels/',
    'theme/theme',
    'docprops/',
  ]

  const cleaned: string[] = []
  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const lowered = trimmed.toLowerCase()
    const hasHardNoise = hardNoiseMarkers.some((marker) => lowered.includes(marker))
    if (hasHardNoise) {
      if (cleaned.length >= 12) break
      continue
    }

    const alphaCount = Array.from(trimmed).filter((char) => /[a-zA-Z]/.test(char)).length
    const symbolCount = Array.from(trimmed).filter((char) => /[^a-zA-Z0-9\s]/.test(char)).length
    const hasSpaces = /\s/.test(trimmed)
    const looksEncoded = /^[A-Za-z0-9+/=]{14,}$/.test(trimmed)
    const isShortToken = !hasSpaces && trimmed.length <= 6
    const isMostlySymbols = symbolCount > trimmed.length * 0.38

    if (looksEncoded || isShortToken || isMostlySymbols || alphaCount < 2) continue

    const isHeadingLike = /^[A-Z][A-Z\s/&-]{2,}$/.test(trimmed)
    if (!hasSpaces && !isHeadingLike && trimmed.length < 10) continue

    cleaned.push(trimmed)
  }

  return cleaned.join('\n') || null
}

function friendlyErrorMessage(errorValue: unknown, ui: (english: string, korean: string) => string): string {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 401) return ui('You are not authorized. Please log in again.', '권한이 없습니다. 다시 로그인해 주세요.')
    if (errorValue.status === 400) return errorValue.message || ui('Invalid file. Please upload PDF/DOC/DOCX only.', '잘못된 파일입니다. PDF/DOC/DOCX만 업로드해 주세요.')
    return errorValue.message
  }

  if (errorValue instanceof Error) {
    if (errorValue.message.includes('MongoDB is not configured')) {
      return ui('Resume database is unavailable right now. Please start MongoDB or use backend fallback with latest code.', '현재 이력서 데이터베이스를 사용할 수 없습니다. MongoDB를 시작하거나 최신 백엔드 fallback을 사용해 주세요.')
    }
    return errorValue.message
  }

  return ui('Something went wrong while processing resume.', '이력서 처리 중 문제가 발생했습니다.')
}

export default function ResumePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { ui } = useUiText()
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [resumeDetail, setResumeDetail] = useState<ResumeDetail | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [emptyPreviewMessage, setEmptyPreviewMessage] = useState<string>(ui('No preview available yet. Upload a file to start.', '아직 미리보기가 없습니다. 파일을 업로드해 시작하세요.'))

  function formatDate(isoOrDate: string | null | undefined): string {
    if (!isoOrDate) return '—'
    const d = new Date(isoOrDate)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const loadResumePreview = useCallback(async (targetResumeId: string) => {
    setLoadingPreview(true)
    setError(null)

    try {
      const detail = await getResume(targetResumeId)
      setResumeDetail(detail)

      const isPdf = detail.content_type?.includes('pdf') || detail.original_filename.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        const fileResponse = await downloadResumeFile(targetResumeId)
        const objectUrl = URL.createObjectURL(fileResponse.blob)
        setPdfUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous)
          return objectUrl
        })
        setDocHtml(null)
        setEmptyPreviewMessage('')
      } else {
        setPdfUrl(null)
        // First try backend-generated PDF preview (for legacy .doc conversion)
        try {
          const previewResponse = await downloadResumePreviewFile(targetResumeId)
          const isPreviewPdf =
            previewResponse.contentType?.includes('pdf') || previewResponse.filename.toLowerCase().endsWith('.pdf')
          if (isPreviewPdf) {
            const previewUrl = URL.createObjectURL(previewResponse.blob)
            setPdfUrl((previous) => {
              if (previous) URL.revokeObjectURL(previous)
              return previewUrl
            })
            setDocHtml(null)
            setEmptyPreviewMessage('')
            return detail
          }
        } catch {
          // fallback to in-browser DOCX/text preview
        }

        let renderedDocHtml = false
        try {
          const fileResponse = await downloadResumeFile(targetResumeId)
          const buffer = await fileResponse.blob.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          const html = result.value?.trim() || ''
          if (html) {
            setDocHtml(html)
            renderedDocHtml = true
            setEmptyPreviewMessage('')
          } else {
            setDocHtml(null)
          }
        } catch {
          setDocHtml(null)
        }

        if (!renderedDocHtml) {
          if (detail.extracted_text) {
            setEmptyPreviewMessage('')
          } else {
            setEmptyPreviewMessage(
              ui('Inline preview is unavailable for this Word file. Use Download File to open it in Microsoft Word.', '이 Word 파일은 화면 내 미리보기를 지원하지 않습니다. 파일 다운로드로 Microsoft Word에서 열어 주세요.')
            )
          }
        }
      }
      return detail
    } catch (errorValue) {
      setError(friendlyErrorMessage(errorValue, ui))
      return null
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  useEffect(() => {
    async function loadLatestResumeId() {
      setError(null)
      try {
        const items = await listMyResumes()

        const existingResumeId = items[0]?.resume_id ?? null
        const params = new URLSearchParams(location.search)
        const from = params.get('from')
        const allowResumeView = from === 'resume-feedback'

        // If a resume is already uploaded, route users to /resume-feedback by default.
        // Only allow /resume when explicitly coming from the Resume tab on /resume-feedback.
        if (existingResumeId && !allowResumeView) {
          navigate('/resume-feedback', { replace: true })
          return
        }

        setResumeId(existingResumeId)
      } catch (errorValue) {
        setError(friendlyErrorMessage(errorValue, ui))
      }
    }

    void loadLatestResumeId()
  }, [location.search, navigate])

  useEffect(() => {
    if (resumeId) {
      void loadResumePreview(resumeId)
    } else {
      setResumeDetail(null)
      setPdfUrl(null)
      setDocHtml(null)
      setEmptyPreviewMessage(ui('No preview available yet. Upload a file to start.', '아직 미리보기가 없습니다. 파일을 업로드해 시작하세요.'))
    }
  }, [loadResumePreview, resumeId, ui])

  useEffect(() => {
    return () => {
      setPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return null
      })
      setDocHtml(null)
    }
  }, [])

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    setSuccess(null)

    try {
      const response: ResumeUploadResponse = await uploadResumeWithProgress(file, (percent) => {
        setUploadProgress(percent)
      })
      setResumeId(response.resume_id)
      setSuccess(ui('Resume uploaded successfully.', '이력서가 업로드되었습니다.'))

      // Start feedback and recommendations in parallel after upload.
      void (async () => {
        const feedbackPromise = generateResumeFeedback(response.resume_id)
        const recommendationsPromise = ensureRecommendations({
            limit: 20,
            candidate_pool: 40,
            use_ai: true,
            resume_id: response.resume_id,
          })

        await Promise.allSettled([feedbackPromise, recommendationsPromise])
      })()
    } catch (errorValue) {
      setError(friendlyErrorMessage(errorValue, ui))
    } finally {
      setUploading(false)
    }
  }

  async function handleDownloadCurrent() {
    if (!resumeId) return
    try {
      const { blob, filename } = await downloadResumeFile(resumeId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (errorValue) {
      setError(friendlyErrorMessage(errorValue, ui))
    }
  }

  return (
    <AppLayout pageLabel={ui('Resume Upload', '이력서 업로드')} activeNav="resume">
      <div className="ih-grid">
        <div className="ih-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <Link className="ih-btnPrimary" to="/resume">
            {ui('Resume', '이력서')}
          </Link>
          <Link className="ih-btnGhost" to="/resume-feedback">
            {ui('AI Feedback', 'AI 피드백')}
          </Link>
        </div>

        <ResumeUpload
          uploading={uploading}
          uploadProgress={uploadProgress}
          analyzeDisabled={!resumeId}
          onUpload={handleUpload}
          uploadedStatus={{
            uploaded: Boolean(resumeId),
            fileName: resumeDetail?.original_filename ?? '—',
            lastUpdated: formatDate(resumeDetail?.uploaded_at),
          }}
          onAnalyze={async () => {
            if (!resumeId) return
            setSuccess(null)
            setError(null)

            try {
              await reextractResume(resumeId)
            } catch (errorValue) {
              setError(friendlyErrorMessage(errorValue, ui))
              return
            }

            const detail = await loadResumePreview(resumeId)
            if (!detail) return
            if (detail.extracted_text || detail.original_filename.toLowerCase().endsWith('.pdf')) {
              setSuccess(ui('Resume analyzed and preview updated.', '이력서 분석이 완료되었고 미리보기가 업데이트되었습니다.'))
            } else {
              setSuccess(ui('Resume uploaded, but preview text is unavailable for this file type.', '이력서는 업로드되었지만 이 파일 형식은 텍스트 미리보기를 지원하지 않습니다.'))
            }
          }}
        />

        <ResumePreview
          loading={loadingPreview}
          fileName={resumeDetail?.original_filename ?? null}
          extractedText={cleanExtractedPreview(resumeDetail?.extracted_text)}
          pdfUrl={pdfUrl}
          docHtml={docHtml}
          successMessage={success}
          errorMessage={error}
          emptyPreviewMessage={emptyPreviewMessage}
          onDownloadFile={handleDownloadCurrent}
        />
      </div>
    </AppLayout>
  )
}
