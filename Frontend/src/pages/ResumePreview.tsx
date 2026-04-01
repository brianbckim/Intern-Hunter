type ResumePreviewProps = {
  loading: boolean
  fileName: string | null
  extractedText: string | null
  pdfUrl: string | null
  docHtml: string | null
  successMessage: string | null
  errorMessage: string | null
  emptyPreviewMessage: string
  onDownloadFile: () => Promise<void>
}

import { useUiText } from '../lib/uiLanguage'

export default function ResumePreview({
  loading,
  fileName,
  extractedText,
  pdfUrl,
  docHtml,
  successMessage,
  errorMessage,
  emptyPreviewMessage,
  onDownloadFile,
}: ResumePreviewProps) {
  const { ui } = useUiText()
  return (
    <section className="ih-card">
      <div className="ih-cardHeader">
        <div className="ih-cardTitle">{ui('Resume Preview Area', '이력서 미리보기')}</div>
      </div>

      <div className="ih-cardBody">
        {successMessage ? <div className="ih-success">{successMessage}</div> : null}
        {errorMessage ? <div className="ih-error">{errorMessage}</div> : null}
        {loading ? <div className="ih-muted">{ui('Loading preview...', '미리보기 불러오는 중...')}</div> : null}

        {!loading && fileName ? (
          <div className="resume-previewToolbar">
            {pdfUrl ? (
              <a className="ih-btnGhost" href={`${pdfUrl}#zoom=page-fit`} target="_blank" rel="noreferrer">
                {ui('Open Full PDF', '전체 PDF 열기')}
              </a>
            ) : (
              <div className="ih-muted">{ui('Word preview is rendered in-app when supported.', '지원되는 경우 Word 미리보기가 화면 내에 표시됩니다.')}</div>
            )}

            <button className="ih-btnGhost" type="button" onClick={() => void onDownloadFile()}>
              {ui('Download File', '파일 다운로드')}
            </button>
          </div>
        ) : null}

        <div className="resume-previewContainer">
          {!loading && pdfUrl ? (
            <iframe title="Resume PDF preview" src={`${pdfUrl}#view=FitH&toolbar=1`} className="resume-pdfFrame" />
          ) : null}

          {!loading && !pdfUrl && !docHtml && extractedText ? (
            <pre className="resume-textPreview">{extractedText}</pre>
          ) : null}

          {!loading && !pdfUrl && docHtml ? (
            <article className="resume-docHtml" dangerouslySetInnerHTML={{ __html: docHtml }} />
          ) : null}

          {!loading && !pdfUrl && !docHtml && !extractedText ? (
            <div className="ih-muted">{emptyPreviewMessage}</div>
          ) : null}
        </div>

        <div className="ih-muted" style={{ marginTop: 10 }}>
          {ui('File', '파일')}: <strong>{fileName ?? '—'}</strong>
        </div>
      </div>
    </section>
  )
}
