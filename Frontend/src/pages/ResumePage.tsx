import { useCallback, useEffect, useState } from 'react'
import mammoth from 'mammoth'
import AppLayout from '../components/AppLayout'
import {
  ApiError,
  downloadResumeFile,
  downloadResumePreviewFile,
  getResume,
  listMyResumes,
  reextractResume,
  uploadResumeWithProgress,
  type ResumeDetail,
  type ResumeUploadResponse,
} from '../lib/api'
import ResumePreview from './ResumePreview'
import ResumeUpload from './ResumeUpload'
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

function friendlyErrorMessage(errorValue: unknown): string {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 401) return 'You are not authorized. Please log in again.'
    if (errorValue.status === 400) return errorValue.message || 'Invalid file. Please upload PDF/DOC/DOCX only.'
    return errorValue.message
  }

  if (errorValue instanceof Error) {
    if (errorValue.message.includes('MongoDB is not configured')) {
      return 'Resume database is unavailable right now. Please start MongoDB or use backend fallback with latest code.'
    }
    return errorValue.message
  }

  return 'Something went wrong while processing resume.'
}

export default function ResumePage() {
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [resumeDetail, setResumeDetail] = useState<ResumeDetail | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [emptyPreviewMessage, setEmptyPreviewMessage] = useState<string>('No preview available yet. Upload a file to start.')

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
              'Inline preview is unavailable for this Word file. Use Download File to open it in Microsoft Word.'
            )
          }
        }
      }
      return detail
    } catch (errorValue) {
      setError(friendlyErrorMessage(errorValue))
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
        setResumeId(items[0]?.resume_id ?? null)
      } catch (errorValue) {
        setError(friendlyErrorMessage(errorValue))
      }
    }

    void loadLatestResumeId()
  }, [])

  useEffect(() => {
    if (resumeId) {
      void loadResumePreview(resumeId)
    } else {
      setResumeDetail(null)
      setPdfUrl(null)
      setDocHtml(null)
      setEmptyPreviewMessage('No preview available yet. Upload a file to start.')
    }
  }, [loadResumePreview, resumeId])

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
      setSuccess('Resume uploaded successfully.')
    } catch (errorValue) {
      setError(friendlyErrorMessage(errorValue))
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
      setError(friendlyErrorMessage(errorValue))
    }
  }

  return (
    <AppLayout pageLabel="Resume Upload" activeNav="resume">
      <div className="ih-grid">
        <ResumeUpload
          uploading={uploading}
          uploadProgress={uploadProgress}
          analyzeDisabled={!resumeId}
          onUpload={handleUpload}
          onAnalyze={async () => {
            if (!resumeId) return
            setSuccess(null)
            setError(null)

            try {
              await reextractResume(resumeId)
            } catch (errorValue) {
              setError(friendlyErrorMessage(errorValue))
              return
            }

            const detail = await loadResumePreview(resumeId)
            if (!detail) return
            if (detail.extracted_text || detail.original_filename.toLowerCase().endsWith('.pdf')) {
              setSuccess('Resume analyzed and preview updated.')
            } else {
              setSuccess('Resume uploaded, but preview text is unavailable for this file type.')
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
