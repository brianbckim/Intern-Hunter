import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    ApiError,
    generateRecommendations,
    getResumeFeedback,
    listMyResumeFeedback,
    listMyResumes,
    uploadResume,
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

    const token = getAccessToken()
    const latest = useMemo(() => (items && items.length > 0 ? items[0] : null), [items])

    function formatDate(isoOrDate: string): string {
        const d = new Date(isoOrDate)
        if (Number.isNaN(d.getTime())) return ''
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
            return
        }
        void refreshFeedback()
    }, [refreshFeedback, token])

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
                use_ai: true,
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
            await uploadResume(file)
            await refreshResumes()
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

    const savedJobs = [
        { title: "Software Engineering Intern", company: "Stripe" },
        { title: "Backend Intern", company: "Amazon" },
        { title: "Full Stack Intern", company: "MongoDB" },
    ];

    const applications = {
        applied: 12,
        interviewing: 2,
        offers: 0,
    };

    const activity = [
        { time: "Today", text: "Saved job: Backend Intern @ Amazon" },
        { time: "Yesterday", text: "Submitted application: SWE Intern @ Stripe" },
        { time: "2 days ago", text: "Uploaded resume (v3) and requested AI review" },
    ];

    const nextSteps = [
        "Apply to 3 saved jobs this week",
        "Add metrics to 2 resume bullets",
        "Follow up on 2 applications older than 10 days",
    ];

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
                                    Request AI Review
                                </button>
                            </div>
                        </Card>

                        <Card title="AI Feedback Summary" subtitle="High-level notes from AI review">
                            {loadingFeedback ? <div className="ih-muted">Loading…</div> : null}
                            {feedbackError ? <div className="ih-muted">{feedbackError}</div> : null}

                            {!loadingFeedback && aiFeedback.length === 0 ? (
                                <div className="ih-muted">No AI feedback yet. Click “Request AI Review” to generate one.</div>
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
                                    {savedJobs.map((j) => (
                                        <div key={`${j.title}-${j.company}`} className="ih-miniItem">
                                            <div className="ih-miniTitle">{j.title}</div>
                                            <div className="ih-muted">{j.company}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="ih-actions">
                                    <button className="ih-btnPrimary">Browse Jobs</button>
                                    <button className="ih-btnGhost">View Saved</button>
                                </div>
                            </Card>

                            <Card title="Applications" subtitle="Applied / Interviewing / Offers">
                                <div className="ih-kpis">
                                    <KPI label="Applied" value={applications.applied} />
                                    <KPI label="Interviewing" value={applications.interviewing} />
                                    <KPI label="Offers" value={applications.offers} />
                                </div>

                                <div className="ih-actions">
                                    <button className="ih-btnPrimary">Track Applications</button>
                                    <button className="ih-btnGhost">Add Application</button>
                                </div>
                            </Card>
                        </div>

                        <Card title="Recent Activity" subtitle="Latest actions and next steps">
                            <div className="ih-activity">
                                {activity.map((a) => (
                                    <div key={`${a.time}-${a.text}`} className="ih-activityItem">
                                        <div className="ih-activityTime">{a.time}</div>
                                        <div>{a.text}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="ih-divider" />

                            <div className="ih-subtitle">Next steps</div>
                            <ul className="ih-list">
                                {nextSteps.map((s) => (
                                    <li key={s}>{s}</li>
                                ))}
                            </ul>

                            <div className="ih-actions">
                                <button className="ih-btnPrimary">Create Plan</button>
                                <button className="ih-btnGhost">Dismiss</button>
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