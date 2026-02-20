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
  return (
    <section className="ih-card">
      <div className="ih-cardHeader">
        <div className="ih-cardTitle">Resume Preview Area</div>
      </div>

      <div className="ih-cardBody">
        {successMessage ? <div className="ih-success">{successMessage}</div> : null}
        {errorMessage ? <div className="ih-error">{errorMessage}</div> : null}
        {loading ? <div className="ih-muted">Loading preview...</div> : null}

        {!loading && fileName ? (
          <div className="resume-previewToolbar">
            {pdfUrl ? (
              <a className="ih-btnGhost" href={`${pdfUrl}#zoom=page-fit`} target="_blank" rel="noreferrer">
                Open Full PDF
              </a>
            ) : (
              <div className="ih-muted">Word preview is rendered in-app when supported.</div>
            )}

            <button className="ih-btnGhost" type="button" onClick={() => void onDownloadFile()}>
              Download File
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
          File: <strong>{fileName ?? '—'}</strong>
        </div>
      </div>
    </section>
  )
}
