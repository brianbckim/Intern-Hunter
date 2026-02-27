import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import AppLayout from '../components/AppLayout'
import {
  ApiError,
  downloadResumeFile,
  generateResumeFeedback,
  getResumeFeedback,
  getResume,
  listMyResumeFeedback,
  updateResumeFeedbackNotes,
  type ResumeFeedback,
  type ResumeDetail,
} from '../lib/api'
import './Dashboard.css'

function normalizeError(errorValue: unknown): string {
  if (errorValue instanceof ApiError) return errorValue.message
  if (errorValue instanceof Error) return errorValue.message
  return 'Something went wrong while generating feedback.'
}

export default function ResumeFeedbackPage() {
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<ResumeFeedback | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [historyGroups, setHistoryGroups] = useState<
    Array<{
      resumeId: string | null
      resumeFilename: string
      feedbackItems: Array<{ feedbackId: string; feedback: ResumeFeedback }>
    }>
  >([])

  const loadLatest = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const items = await listMyResumeFeedback(1)
      const latestId = items[0]?.feedback_id
      if (!latestId) {
        setFeedbackId(null)
        setFeedback(null)
        setNotes('')
        return
      }

      const detail = await getResumeFeedback(latestId)
      setFeedbackId(latestId)
      setFeedback(detail)
      setNotes('')
    } catch (errorValue) {
      setError(normalizeError(errorValue))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const items = await listMyResumeFeedback(50)
      const details = await Promise.all(
        items.map(async (row) => {
          try {
            const fb = await getResumeFeedback(row.feedback_id)
            return { feedbackId: row.feedback_id, feedback: fb } as const
          } catch {
            return null
          }
        })
      )
      const feedbackItems = details.filter(Boolean) as Array<{ feedbackId: string; feedback: ResumeFeedback }>

      const resumeIds = Array.from(
        new Set(feedbackItems.map((item) => item.feedback.resume_id).filter((id): id is string => Boolean(id)))
      )

      const resumeDetails = await Promise.all(
        resumeIds.map(async (resumeId) => {
          try {
            const detail = await getResume(resumeId)
            return [resumeId, detail] as const
          } catch {
            return [resumeId, null] as const
          }
        })
      )
      const resumeMap = new Map<string, ResumeDetail | null>(resumeDetails)

      const groupMap = new Map<
        string,
        { resumeId: string | null; resumeFilename: string; feedbackItems: Array<{ feedbackId: string; feedback: ResumeFeedback }> }
      >()

      for (const item of feedbackItems) {
        const resumeId = item.feedback.resume_id
        const key = resumeId ?? '__no_resume__'
        const resumeFilename = resumeId ? resumeMap.get(resumeId)?.original_filename ?? `Resume (${resumeId})` : 'Resume'

        const existing = groupMap.get(key)
        if (existing) {
          existing.feedbackItems.push(item)
        } else {
          groupMap.set(key, { resumeId: resumeId ?? null, resumeFilename, feedbackItems: [item] })
        }
      }

      const groups = Array.from(groupMap.values())
      for (const group of groups) {
        group.feedbackItems.sort((a, b) => (b.feedback.created_at ?? '').localeCompare(a.feedback.created_at ?? ''))
      }
      groups.sort((a, b) => {
        const aTop = a.feedbackItems[0]?.feedback.created_at ?? ''
        const bTop = b.feedbackItems[0]?.feedback.created_at ?? ''
        return bTop.localeCompare(aTop)
      })

      setHistoryGroups(groups)
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    void loadLatest()
    void loadHistory()
  }, [loadHistory, loadLatest])

  const hasFeedback = Boolean(feedback && feedbackId)

  const strongPoints = useMemo(() => feedback?.strong_points ?? [], [feedback])
  const areasToImprove = useMemo(() => feedback?.areas_to_improve ?? [], [feedback])
  const suggestedEdits = useMemo(() => feedback?.suggested_edits ?? [], [feedback])
  const skillGaps = useMemo(() => feedback?.skill_gaps ?? [], [feedback])

  const notesHistory = useMemo(() => {
    const history = feedback?.notes_history
    if (history && Array.isArray(history)) {
      return history
        .filter((item) => item && typeof item.text === 'string' && item.text.trim())
        .map((item) => ({ created_at: item.created_at, text: item.text }))
    }
    if (feedback?.saved_notes?.trim()) {
      return [{ created_at: feedback.created_at, text: feedback.saved_notes }]
    }
    return []
  }, [feedback])

  async function handleGenerateNew() {
    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await generateResumeFeedback()
      setFeedbackId(res.feedback_id)
      setFeedback(res.feedback)
      setNotes('')
      setSuccess('New AI feedback generated from your latest resume.')
      void loadHistory()
    } catch (errorValue) {
      setError(normalizeError(errorValue))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveNotes() {
    if (!feedbackId) return
    const text = notes.trim()
    if (!text) return

    setSavingNotes(true)
    setError(null)
    setSuccess(null)

    try {
      const updated = await updateResumeFeedbackNotes(feedbackId, text)
      setFeedback(updated)
      setNotes('')
      setSuccess('Notes saved.')
      void loadHistory()
    } catch (errorValue) {
      setError(normalizeError(errorValue))
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleDownloadResume(resumeId: string) {
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
      setError(normalizeError(errorValue))
    }
  }

  return (
    <AppLayout pageLabel="AI Resume Feedback" activeNav="resume">
      <div className="ih-grid">
        <Card title="AI Resume Feedback" subtitle="Strong points, areas to improve, and suggested edits">
          {loading ? <p className="ih-muted">Loading…</p> : null}
          {error ? <p className="ih-error">{error}</p> : null}
          {success ? <p className="ih-success">{success}</p> : null}

          {!loading && !hasFeedback ? (
            <div className="ih-muted">
              No feedback yet. Upload and analyze your resume first on <Link to="/resume">Resume</Link>, then click Generate New Review.
            </div>
          ) : null}

          {feedback?.summary ? (
            <div style={{ marginTop: 10 }}>
              <div className="ih-subtitle">Summary</div>
              <div>{feedback.summary}</div>
            </div>
          ) : null}

          <div className="ih-twoCol" style={{ marginTop: 14 }}>
            <div className="ih-card" style={{ border: 'none', boxShadow: 'none' }}>
              <div className="ih-subtitle">Strong points</div>
              {strongPoints.length ? (
                <ul className="ih-list">{strongPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}</ul>
              ) : (
                <div className="ih-muted">—</div>
              )}

              <div className="ih-subtitle" style={{ marginTop: 14 }}>
                Areas to improve
              </div>
              {areasToImprove.length ? (
                <ul className="ih-list">{areasToImprove.map((item) => (
                  <li key={item}>{item}</li>
                ))}</ul>
              ) : (
                <div className="ih-muted">—</div>
              )}
            </div>

            <div className="ih-card" style={{ border: 'none', boxShadow: 'none' }}>
              <div className="ih-subtitle">Suggested edits</div>
              {suggestedEdits.length ? (
                <ul className="ih-list">{suggestedEdits.map((item) => (
                  <li key={item}>{item}</li>
                ))}</ul>
              ) : (
                <div className="ih-muted">—</div>
              )}
            </div>
          </div>

          <div className="ih-divider" />

          <div className="ih-subtitle">Notes</div>
          <textarea
            className="ih-input"
            rows={5}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add a note for this feedback..."
          />

          {notesHistory.length ? (
            <div style={{ marginTop: 10 }}>
              <div className="ih-muted">Saved notes (oldest → newest)</div>
              <ul className="ih-list">
                {notesHistory.map((item, index) => (
                  <li key={`${item.created_at}-${index}`}>{item.text}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="ih-actions">
            <button className="ih-btnGhost" disabled={generating} onClick={() => void handleGenerateNew()}>
              {generating ? 'Generating…' : 'Generate New Review'}
            </button>
            <button
              className="ih-btnPrimary"
              disabled={!feedbackId || savingNotes || generating || !notes.trim()}
              onClick={() => void handleSaveNotes()}
            >
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </Card>

        <Card title="Skill Gaps / Suggestions" subtitle="Suggested skills to add and sections to strengthen">
          {skillGaps.length ? (
            <ul className="ih-list">{skillGaps.map((item) => (
              <li key={item}>{item}</li>
            ))}</ul>
          ) : (
            <div className="ih-muted">No skill gap suggestions yet.</div>
          )}
        </Card>

        <Card title="Resume Feedback History" subtitle="Grouped by resume version (newest at top)">
          {loadingHistory ? <div className="ih-muted">Loading history…</div> : null}

          {!loadingHistory && historyGroups.length === 0 ? (
            <div className="ih-muted">No feedback history yet.</div>
          ) : null}

          {!loadingHistory
            ? historyGroups.map((group) => (
                <section key={group.resumeId ?? 'none'} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                  <div className="ih-row" style={{ alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{group.resumeFilename}</div>
                      <div className="ih-muted">{group.feedbackItems.length} feedback snapshot(s)</div>
                    </div>

                    {group.resumeId ? (
                      <button className="ih-btnGhost" type="button" onClick={() => void handleDownloadResume(group.resumeId!)}>
                        Download Resume
                      </button>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                    {group.feedbackItems.map((item) => {
                      const fb = item.feedback
                      const noteItems = (fb.notes_history && Array.isArray(fb.notes_history)
                        ? fb.notes_history
                            .filter((n) => n && typeof n.text === 'string' && n.text.trim())
                            .map((n) => n.text)
                        : fb.saved_notes?.trim()
                          ? [fb.saved_notes]
                          : [])

                      return (
                        <div key={item.feedbackId} style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                          <div className="ih-muted" style={{ marginBottom: 6 }}>
                            feedback_id: <strong>{item.feedbackId}</strong> · created_at: <strong>{fb.created_at}</strong>
                          </div>

                          {fb.summary ? (
                            <div style={{ marginBottom: 8 }}>
                              <div className="ih-subtitle">Summary</div>
                              <div>{fb.summary}</div>
                            </div>
                          ) : null}

                          <div className="ih-twoCol">
                            <div>
                              <div className="ih-subtitle">Strong points</div>
                              {fb.strong_points?.length ? <ul className="ih-list">{fb.strong_points.map((t) => <li key={t}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}

                              <div className="ih-subtitle" style={{ marginTop: 10 }}>Areas to improve</div>
                              {fb.areas_to_improve?.length ? <ul className="ih-list">{fb.areas_to_improve.map((t) => <li key={t}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}
                            </div>

                            <div>
                              <div className="ih-subtitle">Suggested edits</div>
                              {fb.suggested_edits?.length ? <ul className="ih-list">{fb.suggested_edits.map((t) => <li key={t}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}

                              <div className="ih-subtitle" style={{ marginTop: 10 }}>Skill Gaps / Suggestions</div>
                              {fb.skill_gaps?.length ? <ul className="ih-list">{fb.skill_gaps.map((t) => <li key={t}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}
                            </div>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div className="ih-subtitle">Notes</div>
                            {noteItems.length ? <ul className="ih-list">{noteItems.map((t, idx) => <li key={`${idx}-${t}`}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))
            : null}
        </Card>
      </div>
    </AppLayout>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="ih-card">
      <div className="ih-cardHeader">
        <div className="ih-cardTitle">{title}</div>
        {subtitle ? <div className="ih-muted">{subtitle}</div> : null}
      </div>
      <div className="ih-cardBody">{children}</div>
    </section>
  )
}
