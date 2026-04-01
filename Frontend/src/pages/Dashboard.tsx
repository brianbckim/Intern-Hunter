import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    ApiError,
    ensureRecommendations,
    generateResumeFeedback,
    generateRecommendations,
    getResumeFeedback,
    listMyApplications,
    listMyResumeFeedback,
    listMyResumes,
    uploadResume,
    type JobApplicationRecord,
    type ResumeFeedbackListItem,
    type RecommendationsResponse,
    type ResumeFeedback,
    type ResumeListItem,
} from '../lib/api'
import { getAccessToken } from '../lib/auth'
import AppLayout from '../components/AppLayout'
import "./Dashboard.css";

function friendlyResumeError(errorValue: unknown): string {
    if (errorValue instanceof ApiError) {
        if (errorValue.status === 401) {
            return 'Please login again to access resume features.'
        }
        if (errorValue.status === 503 || errorValue.message.includes('MongoDB is not configured')) {
            return 'Resume services are temporarily unavailable. Please start MongoDB or use the updated local fallback backend.'
        }
        return errorValue.message || 'Failed to load resume status.'
    }

    if (errorValue instanceof Error) {
        if (errorValue.message.includes('MongoDB is not configured')) {
            return 'Resume services are temporarily unavailable. Please start MongoDB or use the updated local fallback backend.'
        }
        return errorValue.message
    }

    return 'Failed to load resume status.'
}

type ActivityItem = {
    key: string
    sortTime: number
    timeLabel: string
    text: string
}

function formatRelativeDate(iso: string): string {
    if (!iso) return 'Recently'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return 'Recently'

    const today = new Date()
    const toEasternDay = (value: Date) =>
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(value)

    const target = toEasternDay(date)
    const current = toEasternDay(today)
    if (target === current) return 'Today'

    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (target === toEasternDay(yesterday)) return 'Yesterday'

    return date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
    })
}

function isActionableApplicationStatus(status: string): boolean {
    return status === 'applied' || status === 'interview' || status === 'offer'
}

export default function Dashboard() {
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [items, setItems] = useState<ResumeListItem[] | null>(null)
    const [loadingResume, setLoadingResume] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [resumeError, setResumeError] = useState<string | null>(null)

    const [feedback, setFeedback] = useState<ResumeFeedback | null>(null)
    const [loadingFeedback, setLoadingFeedback] = useState(true)
    const [feedbackError, setFeedbackError] = useState<string | null>(null)

    const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null)
    const [loadingRecommendations, setLoadingRecommendations] = useState(false)
    const [recommendationsError, setRecommendationsError] = useState<string | null>(null)

    const [applicationRows, setApplicationRows] = useState<JobApplicationRecord[] | null>(null)
    const [loadingApplications, setLoadingApplications] = useState(true)
    const [applicationsError, setApplicationsError] = useState<string | null>(null)

    const [feedbackList, setFeedbackList] = useState<ResumeFeedbackListItem[]>([])
    const [activityDismissed, setActivityDismissed] = useState(false)

    const token = getAccessToken()
    const latest = useMemo(() => (items && items.length > 0 ? items[0] : null), [items])

    function formatDate(isoOrDate: string): string {
        const d = new Date(isoOrDate)
        if (Number.isNaN(d.getTime())) return ''
        return d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })
    }

    const refreshResumes = useCallback(async () => {
        setResumeError(null)
        setLoadingResume(true)
        try {
            const list = await listMyResumes()
            setItems(list)
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                setItems([])
            } else {
                setResumeError(friendlyResumeError(e))
            }
        } finally {
            setLoadingResume(false)
        }
    }, [])

    useEffect(() => {
        void refreshResumes()
    }, [refreshResumes])

    const refreshFeedback = useCallback(async () => {
        setFeedbackError(null)
        setLoadingFeedback(true)
        try {
            const rows = await listMyResumeFeedback(1)
            const latestId = rows[0]?.feedback_id
            if (!latestId) {
                setFeedback(null)
                return
            }
            const detail = await getResumeFeedback(latestId)
            setFeedback(detail)
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                setFeedback(null)
            } else {
                setFeedbackError(e instanceof Error ? e.message : 'Failed to load AI feedback.')
            }
        } finally {
            setLoadingFeedback(false)
        }
    }, [])

    useEffect(() => {
        if (!token) {
            setFeedback(null)
            setLoadingFeedback(false)
            setFeedbackList([])
            return
        }
        void refreshFeedback()
    }, [refreshFeedback, token])

    const refreshApplications = useCallback(async () => {
        if (!token) {
            setApplicationRows([])
            setLoadingApplications(false)
            return
        }

        setApplicationsError(null)
        setLoadingApplications(true)
        try {
            const rows = await listMyApplications()
            setApplicationRows(rows)
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                setApplicationRows([])
            } else {
                setApplicationsError(e instanceof Error ? e.message : 'Failed to load job tracking data.')
            }
        } finally {
            setLoadingApplications(false)
        }
    }, [token])

    useEffect(() => {
        void refreshApplications()
    }, [refreshApplications])

    const refreshFeedbackList = useCallback(async () => {
        if (!token) {
            setFeedbackList([])
            return
        }

        try {
            const rows = await listMyResumeFeedback(5)
            setFeedbackList(rows)
        } catch {
            setFeedbackList([])
        }
    }, [token])

    useEffect(() => {
        void refreshFeedbackList()
    }, [refreshFeedbackList])

    const refreshRecommendations = useCallback(async () => {
        if (!token) {
            setRecommendations(null)
            return
        }

        if (!latest?.resume_id) {
            setRecommendations(null)
            return
        }

        setRecommendationsError(null)
        setLoadingRecommendations(true)
        try {
            const value = await generateRecommendations({
                limit: 3,
                candidate_pool: 40,
                use_ai: false,
                resume_id: latest.resume_id,
            })
            setRecommendations(value)
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                setRecommendations(null)
            } else {
                setRecommendationsError(e instanceof Error ? e.message : 'Failed to load recommendations.')
            }
        } finally {
            setLoadingRecommendations(false)
        }
    }, [latest?.resume_id, token])

    useEffect(() => {
        void refreshRecommendations()
    }, [refreshRecommendations])

    async function onPickFile(file: File) {
        setResumeError(null)
        setUploading(true)
        try {
            const uploaded = await uploadResume(file)
            await refreshResumes()
            void refreshApplications()

            void (async () => {
                const feedbackPromise = generateResumeFeedback(uploaded.resume_id)
                    .then(async () => {
                        await refreshFeedback()
                        await refreshFeedbackList()
                    })
                const recommendationsPromise = ensureRecommendations({
                        limit: 20,
                        candidate_pool: 40,
                        use_ai: true,
                        resume_id: uploaded.resume_id,
                    })

                await Promise.allSettled([feedbackPromise, recommendationsPromise])
            })()
        } catch (e) {
            setResumeError(friendlyResumeError(e))
        } finally {
            setUploading(false)
        }
    }

    const resume = {
        uploaded: Boolean(latest),
        fileName: latest?.original_filename ?? '—',
        lastUpdated: latest ? formatDate(latest.uploaded_at) : '—',
        completeness: latest ? 100 : 0,
    };

    const aiFeedback = (() => {
        if (!feedback) return []
        const items: string[] = []
        if (feedback.strong_points?.[0]) items.push(feedback.strong_points[0])
        if (feedback.areas_to_improve?.[0]) items.push(feedback.areas_to_improve[0])
        if (feedback.suggested_edits?.[0]) items.push(feedback.suggested_edits[0])
        if (items.length === 0 && feedback.summary) items.push(feedback.summary)
        return items.slice(0, 3)
    })()

    const savedJobs = useMemo(
        () => (applicationRows ?? []).filter((row) => row.status === 'saved').slice(0, 3),
        [applicationRows]
    )

    const applications = useMemo(() => {
        const rows = applicationRows ?? []
        return {
            applied: rows.filter((row) => row.status === 'applied').length,
            interviewing: rows.filter((row) => row.status === 'interview').length,
            offers: rows.filter((row) => row.status === 'offer').length,
        }
    }, [applicationRows])

    const activity = useMemo(() => {
        const rows: ActivityItem[] = []

        for (const row of applicationRows ?? []) {
            const timestamp = row.updated_at || row.created_at
            const company = row.job_company ? ` @ ${row.job_company}` : ''
            let text = `Updated job tracking: ${row.job_title || 'Untitled role'}${company}`
            if (row.status === 'saved') {
                text = `Saved job: ${row.job_title || 'Untitled role'}${company}`
            } else if (row.created_at === row.updated_at && isActionableApplicationStatus(row.status)) {
                text = `Submitted application: ${row.job_title || 'Untitled role'}${company}`
            } else if (row.status === 'interview') {
                text = `Moved to interview stage: ${row.job_title || 'Untitled role'}${company}`
            } else if (row.status === 'offer') {
                text = `Received offer update: ${row.job_title || 'Untitled role'}${company}`
            }

            rows.push({
                key: `app-${row.application_id}`,
                sortTime: new Date(timestamp).getTime() || 0,
                timeLabel: formatRelativeDate(timestamp),
                text,
            })
        }

        for (const resume of items ?? []) {
            rows.push({
                key: `resume-${resume.resume_id}`,
                sortTime: new Date(resume.uploaded_at).getTime() || 0,
                timeLabel: formatRelativeDate(resume.uploaded_at),
                text: `Uploaded resume: ${resume.original_filename}`,
            })
        }

        for (const entry of feedbackList) {
            rows.push({
                key: `feedback-${entry.feedback_id}`,
                sortTime: new Date(entry.created_at).getTime() || 0,
                timeLabel: formatRelativeDate(entry.created_at),
                text: 'Generated AI resume feedback',
            })
        }

        return rows.sort((left, right) => right.sortTime - left.sortTime).slice(0, 5)
    }, [applicationRows, feedbackList, items])

    const nextSteps = useMemo(() => {
        const rows = applicationRows ?? []
        const savedCount = rows.filter((row) => row.status === 'saved').length
        const interviewingCount = rows.filter((row) => row.status === 'interview').length
        const staleAppliedCount = rows.filter((row) => {
            if (row.status !== 'applied') return false
            const updated = new Date(row.updated_at || row.created_at)
            return Date.now() - updated.getTime() > 10 * 24 * 60 * 60 * 1000
        }).length

        const steps: string[] = []
        if (!latest) {
            steps.push('Upload your latest resume to unlock AI feedback and recommendations.')
        }
        if (!feedback) {
            steps.push('Generate AI resume feedback to catch missing metrics and role-specific gaps.')
        }
        if (savedCount > 0) {
            steps.push(`Apply to ${savedCount} saved job${savedCount === 1 ? '' : 's'} this week.`)
        }
        if (interviewingCount > 0) {
            steps.push(`Prepare follow-up notes for ${interviewingCount} interviewing role${interviewingCount === 1 ? '' : 's'}.`)
        }
        if (staleAppliedCount > 0) {
            steps.push(`Follow up on ${staleAppliedCount} application${staleAppliedCount === 1 ? '' : 's'} older than 10 days.`)
        }
        if (steps.length === 0) {
            steps.push('Browse new roles and save a few strong matches for your next application batch.')
        }
        return steps.slice(0, 3)
    }, [applicationRows, feedback, latest])

    return (
        <AppLayout pageLabel="Dashboard" activeNav="dashboard">
            <div className="ih-grid">
                        <Card title="Resume Status" subtitle="Resume uploaded status and quick summary">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) void onPickFile(f)
                                    e.currentTarget.value = ''
                                }}
                            />

                            <div className="ih-row">
                                <div>
                                    <div className="ih-pill">
                                        {resume.uploaded ? "Uploaded" : "Not uploaded"}
                                    </div>
                                    <div className="ih-muted" style={{ marginTop: 8 }}>
                                        File: <strong>{resume.fileName}</strong>
                                    </div>
                                    <div className="ih-muted">Last updated: {resume.lastUpdated}</div>
                                    {loadingResume ? <div className="ih-muted">Loading…</div> : null}
                                    {resumeError ? (
                                        <div className="ih-muted" style={{ marginTop: 8 }}>
                                            {resumeError}
                                        </div>
                                    ) : null}
                                    {!token ? (
                                        <div className="ih-muted" style={{ marginTop: 8 }}>
                                            <Link to="/login">Login</Link> to upload your resume.
                                        </div>
                                    ) : null}
                                </div>

                                <div className="ih-progressWrap">
                                    <div className="ih-muted">Completeness</div>
                                    <div className="ih-progress">
                                        <div
                                            className="ih-progressFill"
                                            style={{ width: `${resume.completeness}%` }}
                                        />
                                    </div>
                                    <div className="ih-muted">{resume.completeness}%</div>
                                </div>
                            </div>

                            <div className="ih-actions">
                                <button
                                    className="ih-btnPrimary"
                                    disabled={!token || uploading}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading ? 'Uploading…' : resume.uploaded ? "Update Resume" : "Upload Resume"}
                                </button>
                                <button
                                    className="ih-btnGhost"
                                    disabled={!resume.uploaded}
                                    onClick={() => navigate('/resume-feedback')}
                                >
                                    AI Feedback
                                </button>
                            </div>
                        </Card>

                        <Card title="AI Feedback Summary" subtitle="High-level notes from AI review">
                            {loadingFeedback ? <div className="ih-muted">Loading…</div> : null}
                            {feedbackError ? <div className="ih-muted">{feedbackError}</div> : null}

                            {!loadingFeedback && aiFeedback.length === 0 ? (
                                <div className="ih-muted">No AI feedback yet. Click “AI Feedback” to generate one.</div>
                            ) : null}

                            {aiFeedback.length ? (
                                <ul className="ih-list">
                                    {aiFeedback.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            ) : null}
                            <div className="ih-actions">
                                <button className="ih-btnPrimary" onClick={() => navigate('/resume-feedback')}>
                                    View Full Feedback
                                </button>
                                <button className="ih-btnGhost" disabled>
                                    Download Suggestions
                                </button>
                            </div>
                        </Card>

                        <Card title="AI Recommendations" subtitle="Personalized career & internship matches based on your resume">
                            {!token ? (
                                <div className="ih-muted">Login to see recommendations.</div>
                            ) : !latest?.resume_id ? (
                                <div className="ih-muted">Upload a resume to get AI-based recommendations.</div>
                            ) : null}

                            {loadingRecommendations ? <div className="ih-muted">Loading…</div> : null}
                            {recommendationsError ? <div className="ih-muted">{recommendationsError}</div> : null}

                            {recommendations?.career_summary ? (
                                <div className="ih-muted" style={{ marginBottom: 12 }}>
                                    {recommendations.career_summary}
                                </div>
                            ) : null}

                            {recommendations?.jobs?.length ? (
                                <ul className="ih-list">
                                    {recommendations.jobs.slice(0, 3).map((job) => (
                                        <li key={job.uid}>
                                            <strong>{job.title || 'Untitled role'}</strong>
                                            {job.company ? ` — ${job.company}` : ''}
                                            {job.location ? ` (${job.location})` : ''}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}

                            <div className="ih-actions">
                                <button className="ih-btnPrimary" onClick={() => navigate('/jobs?tab=ai')}>
                                    View Recommendations
                                </button>
                                <button className="ih-btnGhost" disabled={!token || !latest?.resume_id || loadingRecommendations} onClick={() => void refreshRecommendations()}>
                                    Refresh
                                </button>
                            </div>

                            {recommendations ? (
                                <div className="ih-muted" style={{ marginTop: 10 }}>
                                    {recommendations.ai_used ? 'AI ordering enabled.' : 'AI ordering unavailable; showing heuristic matches.'}
                                </div>
                            ) : null}
                        </Card>

                        <div className="ih-twoCol">
                            <Card title="Saved Jobs" subtitle="Count + recently saved">
                                <div className="ih-statRow">
                                    <div className="ih-statBig">{savedJobs.length}</div>
                                    <div className="ih-muted">saved</div>
                                </div>

                                <div className="ih-miniList">
                                    {loadingApplications ? <div className="ih-muted">Loading…</div> : null}
                                    {!loadingApplications && savedJobs.length === 0 ? <div className="ih-muted">No saved jobs yet.</div> : null}
                                    {savedJobs.map((j) => (
                                        <div key={j.application_id} className="ih-miniItem">
                                            <div className="ih-miniTitle">{j.job_title || 'Untitled role'}</div>
                                            <div className="ih-muted">{j.job_company || 'Unknown company'}</div>
                                        </div>
                                    ))}
                                </div>

                                {applicationsError ? <div className="ih-muted" style={{ marginTop: 10 }}>{applicationsError}</div> : null}

                                <div className="ih-actions">
                                    <button className="ih-btnPrimary" onClick={() => navigate('/jobs')}>Browse Jobs</button>
                                    <button className="ih-btnGhost" onClick={() => navigate('/applications?status=saved')}>View Saved</button>
                                </div>
                            </Card>

                            <Card title="Applications" subtitle="Applied / Interviewing / Offers">
                                <div className="ih-kpis">
                                    <KPI label="Applied" value={applications.applied} />
                                    <KPI label="Interviewing" value={applications.interviewing} />
                                    <KPI label="Offers" value={applications.offers} />
                                </div>

                                {loadingApplications ? <div className="ih-muted" style={{ marginTop: 10 }}>Loading…</div> : null}

                                <div className="ih-actions">
                                    <button className="ih-btnPrimary" onClick={() => navigate('/applications')}>Track Applications</button>
                                    <button className="ih-btnGhost" onClick={() => navigate('/jobs')}>Add Application</button>
                                </div>
                            </Card>
                        </div>

                        <Card title="Recent Activity" subtitle="Latest actions and next steps">
                            <div className="ih-activity">
                                {activity.length === 0 ? <div className="ih-muted">No recent activity yet.</div> : null}
                                {activity.map((a) => (
                                    <div key={a.key} className="ih-activityItem">
                                        <div className="ih-activityTime">{a.timeLabel}</div>
                                        <div>{a.text}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="ih-divider" />

                            <div className="ih-subtitle">Next steps</div>
                            {!activityDismissed ? (
                                <ul className="ih-list">
                                    {nextSteps.map((s) => (
                                        <li key={s}>{s}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="ih-muted" style={{ marginTop: 10 }}>Plan dismissed for now. Click Create Plan to show it again.</div>
                            )}

                            <div className="ih-actions">
                                <button className="ih-btnPrimary" onClick={() => setActivityDismissed(false)}>Create Plan</button>
                                <button className="ih-btnGhost" onClick={() => setActivityDismissed(true)}>Dismiss</button>
                            </div>
                        </Card>
            </div>
        </AppLayout>
    );
}

function Card({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: ReactNode;
}) {
    return (
        <section className="ih-card">
            <div className="ih-cardHeader">
                <div className="ih-cardTitle">{title}</div>
                {subtitle ? <div className="ih-muted">{subtitle}</div> : null}
            </div>
            <div className="ih-cardBody">{children}</div>
        </section>
    );
}

function KPI({ label, value }: { label: string; value: number }) {
    return (
        <div className="ih-kpi">
            <div className="ih-kpiValue">{value}</div>
            <div className="ih-muted">{label}</div>
        </div>
    );
}