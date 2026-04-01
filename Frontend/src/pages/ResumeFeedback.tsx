import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AppLayout from '../components/AppLayout'
import {
  ApiError,
  downloadResumeFile,
  deleteResume,
  getResumeFeedback,
  getResume,
  listMyResumeFeedback,
  listMyResumes,
  updateResumeFeedbackNotes,
  type ResumeFeedback,
  type ResumeDetail,
} from '../lib/api'
import { useUiText } from '../lib/uiLanguage'
import './Dashboard.css'

function normalizeError(errorValue: unknown, ui: (english: string, korean: string) => string): string {
  if (errorValue instanceof ApiError) return errorValue.message
  if (errorValue instanceof Error) return errorValue.message
  return ui('Something went wrong while generating feedback.', '피드백 생성 중 문제가 발생했습니다.')
}

export default function ResumeFeedbackPage() {
  const navigate = useNavigate()
  const { ui } = useUiText()
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<ResumeFeedback | null>(null)
  const [latestResumeId, setLatestResumeId] = useState<string | null>(null)
  const [waitingForResumeId, setWaitingForResumeId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function parseTimeMs(value: string | null | undefined): number {
    if (!value) return 0
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? 0 : ms
  }

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
    setWaitingForResumeId(null)

    try {
      const resumes = await listMyResumes()
      const currentResumeId = resumes[0]?.resume_id ?? null
      setLatestResumeId(currentResumeId)

      if (!currentResumeId) {
        navigate('/resume', { replace: true })
        setFeedbackId(null)
        setFeedback(null)
        setNotes('')
        return
      }

      const items = await listMyResumeFeedback(20)
      if (!items.length) {
        // No feedback at all yet.
        setFeedbackId(null)
        setFeedback(null)
        setNotes('')
        return
      }

      // Prefer feedback for the current (latest) resume.
      const matching = items.find((row) => row.resume_id === currentResumeId) ?? null
      if (!matching?.feedback_id) {
        // We have older feedback, but not for the latest resume yet.
        // Don't show stale data; show a loading state until generation completes.
        setFeedbackId(null)
        setFeedback(null)
        setNotes('')
        setWaitingForResumeId(currentResumeId)
        return
      }

      const detail = await getResumeFeedback(matching.feedback_id)
      setFeedbackId(matching.feedback_id)
      setFeedback(detail)
      setNotes('')
    } catch (errorValue) {
      setError(normalizeError(errorValue, ui))
    } finally {
      setLoading(false)
    }
  }, [navigate, ui])

  useEffect(() => {
    if (!waitingForResumeId) return
    let cancelled = false
    let timer: number | null = null

    async function poll() {
      if (cancelled) return
      try {
        const items = await listMyResumeFeedback(20)
        if (cancelled) return

        const matching = items.find((row) => row.resume_id === waitingForResumeId) ?? null
        if (matching?.feedback_id) {
          const detail = await getResumeFeedback(matching.feedback_id)
          if (cancelled) return
          setFeedbackId(matching.feedback_id)
          setFeedback(detail)
          setWaitingForResumeId(null)
          setLoading(false)
          return
        }

        // Still waiting.
        timer = window.setTimeout(() => void poll(), 1500)
      } catch {
        timer = window.setTimeout(() => void poll(), 2000)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [waitingForResumeId])

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
        group.feedbackItems.sort((a, b) => parseTimeMs(b.feedback.created_at) - parseTimeMs(a.feedback.created_at))
      }
      groups.sort((a, b) => {
        const aTop = parseTimeMs(a.feedbackItems[0]?.feedback.created_at)
        const bTop = parseTimeMs(b.feedbackItems[0]?.feedback.created_at)
        return bTop - aTop
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
      setSuccess(ui('Notes saved.', '메모가 저장되었습니다.'))
      void loadHistory()
    } catch (errorValue) {
      setError(normalizeError(errorValue, ui))
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
      setError(normalizeError(errorValue, ui))
    }
  }

  async function handleDeleteResume(resumeId: string, resumeFilename: string) {
    if (deletingResumeId) return

    const ok = window.confirm(ui(`Delete this resume and its feedback history?\n\n${resumeFilename}`, `이 이력서와 피드백 기록을 삭제할까요?\n\n${resumeFilename}`))
    if (!ok) return

    setDeletingResumeId(resumeId)
    setError(null)
    setSuccess(null)

    try {
      await deleteResume(resumeId)
      setSuccess(ui('Deleted resume history.', '이력서 기록이 삭제되었습니다.'))
      await loadLatest()
      await loadHistory()
    } catch (errorValue) {
      setError(normalizeError(errorValue, ui))
    } finally {
      setDeletingResumeId(null)
    }
  }

  return (
    <AppLayout pageLabel={ui('AI Resume Feedback', 'AI 이력서 피드백')} activeNav="resume">
      <div className="ih-grid">
        <div className="ih-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <Link className="ih-btnGhost" to="/resume?from=resume-feedback">
            {ui('Resume', '이력서')}
          </Link>
          <Link className="ih-btnPrimary" to="/resume-feedback">
            {ui('AI Feedback', 'AI 피드백')}
          </Link>
        </div>

        <Card title={ui('AI Resume Feedback', 'AI 이력서 피드백')} subtitle={ui('Strong points, areas to improve, and suggested edits', '강점, 개선점, 추천 수정을 확인하세요')}>
          {loading ? <p className="ih-muted">{ui('Loading…', '불러오는 중…')}</p> : null}
          {error ? <p className="ih-error">{error}</p> : null}
          {success ? <p className="ih-success">{success}</p> : null}

          {!loading && waitingForResumeId ? (
            <p className="ih-muted">{ui('Generating feedback for your latest resume…', '최신 이력서 피드백을 생성하는 중입니다…')}</p>
          ) : null}

          {!loading && !hasFeedback ? (
            <div className="ih-muted">
              {latestResumeId
                ? ui('No feedback for your latest resume yet. If you just uploaded, this page will update automatically when generation completes.', '최신 이력서에 대한 피드백이 아직 없습니다. 방금 업로드했다면 생성이 끝나면 이 페이지가 자동으로 업데이트됩니다.')
                : (
                    <>
                      {ui('No feedback yet. Upload your resume first on ', '아직 피드백이 없습니다. 먼저 ')}<Link to="/resume">{ui('Resume', '이력서')}</Link>{ui(' and then return here.', '에서 이력서를 업로드한 뒤 다시 오세요.')}
                    </>
                  )}
            </div>
          ) : null}

          {feedback?.summary ? (
            <div style={{ marginTop: 10 }}>
              <div className="ih-subtitle">{ui('Summary', '요약')}</div>
              <div>{feedback.summary}</div>
            </div>
          ) : null}

          <div className="ih-twoCol" style={{ marginTop: 14 }}>
            <div className="ih-card" style={{ border: 'none', boxShadow: 'none' }}>
              <div className="ih-subtitle">{ui('Strong points', '강점')}</div>
              {strongPoints.length ? (
                <ul className="ih-list">{strongPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}</ul>
              ) : (
                <div className="ih-muted">—</div>
              )}

              <div className="ih-subtitle" style={{ marginTop: 14 }}>
                {ui('Areas to improve', '개선할 점')}
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
              <div className="ih-subtitle">{ui('Suggested edits', '추천 수정사항')}</div>
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

          <div style={{ marginTop: 10 }}>
            <div className="ih-subtitle">{ui('Skill Gaps / Suggestions', '기술 격차 / 제안')}</div>
            {skillGaps.length ? (
              <ul className="ih-list">{skillGaps.map((item) => (
                <li key={item}>{item}</li>
              ))}</ul>
            ) : (
              <div className="ih-muted">—</div>
            )}
          </div>

          <div className="ih-divider" />

          <div className="ih-subtitle">{ui('Notes', '메모')}</div>
          <textarea
            className="ih-input"
            rows={5}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={ui('Add a note for this feedback...', '이 피드백에 대한 메모를 남기세요...')}
          />

          {notesHistory.length ? (
            <div style={{ marginTop: 10 }}>
              <div className="ih-muted">{ui('Saved notes (oldest → newest)', '저장된 메모 (오래된 순 → 최신 순)')}</div>
              <ul className="ih-list">
                {notesHistory.map((item, index) => (
                  <li key={`${item.created_at}-${index}`}>{item.text}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="ih-actions">
            <button
              className="ih-btnPrimary"
              disabled={!feedbackId || savingNotes || !notes.trim()}
              onClick={() => void handleSaveNotes()}
            >
              {savingNotes ? ui('Saving…', '저장 중…') : ui('Save Notes', '메모 저장')}
            </button>
          </div>
        </Card>

        <Card title={ui('Resume Feedback History', '이력서 피드백 기록')} subtitle={ui('Grouped by resume version (newest at top)', '이력서 버전별로 그룹화됨 (최신 순)')}>
          {loadingHistory ? <div className="ih-muted">{ui('Loading history…', '기록 불러오는 중…')}</div> : null}

          {!loadingHistory && historyGroups.length === 0 ? (
            <div className="ih-muted">{ui('No feedback history yet.', '아직 피드백 기록이 없습니다.')}</div>
          ) : null}

          {!loadingHistory
            ? historyGroups.map((group) => (
                <section key={group.resumeId ?? 'none'} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                  <div className="ih-row" style={{ alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{group.resumeFilename}</div>
                      <div className="ih-muted">{ui(`${group.feedbackItems.length} feedback snapshot(s)`, `피드백 스냅샷 ${group.feedbackItems.length}개`)}</div>
                    </div>

                    {group.resumeId ? (
                      <div className="ih-actions" style={{ gap: 8 }}>
                        <button
                          className="ih-btnGhost"
                          type="button"
                          disabled={Boolean(deletingResumeId)}
                          onClick={() => void handleDownloadResume(group.resumeId!)}
                        >
                          {ui('Download Resume', '이력서 다운로드')}
                        </button>
                        <button
                          className="ih-btnGhost"
                          type="button"
                          disabled={Boolean(deletingResumeId)}
                          onClick={() => void handleDeleteResume(group.resumeId!, group.resumeFilename)}
                        >
                          {deletingResumeId === group.resumeId ? ui('Deleting…', '삭제 중…') : ui('Delete', '삭제')}
                        </button>
                      </div>
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
                            feedback_id: <strong>{item.feedbackId}</strong> · {ui('created_at', '생성 시각')}: <strong>{fb.created_at}</strong>
                          </div>

                          {fb.summary ? (
                            <div style={{ marginBottom: 8 }}>
                              <div className="ih-subtitle">{ui('Summary', '요약')}</div>
                              <div>{fb.summary}</div>
                            </div>
                          ) : null}

                          <div className="ih-twoCol">
                            <div>
                              <div className="ih-subtitle">{ui('Strong points', '강점')}</div>
                              {fb.strong_points?.length ? <ul className="ih-list">{fb.strong_points.map((t) => <li key={t}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}

                              <div className="ih-subtitle" style={{ marginTop: 10 }}>{ui('Areas to improve', '개선할 점')}</div>
                              {fb.areas_to_improve?.length ? <ul className="ih-list">{fb.areas_to_improve.map((t) => <li key={t}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}
                            </div>

                            <div>
                              <div className="ih-subtitle">{ui('Suggested edits', '추천 수정사항')}</div>
                              {fb.suggested_edits?.length ? <ul className="ih-list">{fb.suggested_edits.map((t) => <li key={t}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}

                              <div className="ih-subtitle" style={{ marginTop: 10 }}>{ui('Skill Gaps / Suggestions', '기술 격차 / 제안')}</div>
                              {fb.skill_gaps?.length ? <ul className="ih-list">{fb.skill_gaps.map((t) => <li key={t}>{t}</li>)}</ul> : <div className="ih-muted">—</div>}
                            </div>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div className="ih-subtitle">{ui('Notes', '메모')}</div>
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
