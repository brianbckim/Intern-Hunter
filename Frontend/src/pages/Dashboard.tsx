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
import { useUiText } from '../lib/uiLanguage'
import "./Dashboard.css";

function friendlyResumeError(errorValue: unknown, ui: (english: string, korean: string) => string): string {
    if (errorValue instanceof ApiError) {
        if (errorValue.status === 401) {
            return ui('Please login again to access resume features.', '이력서 기능을 이용하려면 다시 로그인해 주세요.')
        }
        if (errorValue.status === 503 || errorValue.message.includes('MongoDB is not configured')) {
            return ui('Resume services are temporarily unavailable. Please start MongoDB or use the updated local fallback backend.', '이력서 서비스가 일시적으로 사용할 수 없습니다. MongoDB를 시작하거나 최신 로컬 fallback 백엔드를 사용해 주세요.')
        }
        return errorValue.message || ui('Failed to load resume status.', '이력서 상태를 불러오지 못했습니다.')
    }

    if (errorValue instanceof Error) {
        if (errorValue.message.includes('MongoDB is not configured')) {
            return ui('Resume services are temporarily unavailable. Please start MongoDB or use the updated local fallback backend.', '이력서 서비스가 일시적으로 사용할 수 없습니다. MongoDB를 시작하거나 최신 로컬 fallback 백엔드를 사용해 주세요.')
        }
        return errorValue.message
    }

    return ui('Failed to load resume status.', '이력서 상태를 불러오지 못했습니다.')
}

type ActivityItem = {
    key: string
    sortTime: number
    timeLabel: string
    text: string
}

function formatRelativeDate(iso: string, ui: (english: string, korean: string) => string): string {
    if (!iso) return ui('Recently', '최근')
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ui('Recently', '최근')

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
    if (target === current) return ui('Today', '오늘')

    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (target === toEasternDay(yesterday)) return ui('Yesterday', '어제')

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
    const { ui } = useUiText()

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
                setResumeError(friendlyResumeError(e, ui))
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
                setFeedbackError(e instanceof Error ? e.message : ui('Failed to load AI feedback.', 'AI 피드백을 불러오지 못했습니다.'))
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
                setApplicationsError(e instanceof Error ? e.message : ui('Failed to load job tracking data.', '채용 추적 데이터를 불러오지 못했습니다.'))
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
                setRecommendationsError(e instanceof Error ? e.message : ui('Failed to load recommendations.', '추천 결과를 불러오지 못했습니다.'))
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
            setResumeError(friendlyResumeError(e, ui))
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
            let text = ui(`Updated job tracking: ${row.job_title || 'Untitled role'}${company}`, `지원 추적 업데이트: ${row.job_title || '제목 없는 공고'}${company}`)
            if (row.status === 'saved') {
                text = ui(`Saved job: ${row.job_title || 'Untitled role'}${company}`, `공고 저장: ${row.job_title || '제목 없는 공고'}${company}`)
            } else if (row.created_at === row.updated_at && isActionableApplicationStatus(row.status)) {
                text = ui(`Submitted application: ${row.job_title || 'Untitled role'}${company}`, `지원 제출: ${row.job_title || '제목 없는 공고'}${company}`)
            } else if (row.status === 'interview') {
                text = ui(`Moved to interview stage: ${row.job_title || 'Untitled role'}${company}`, `면접 단계 진입: ${row.job_title || '제목 없는 공고'}${company}`)
            } else if (row.status === 'offer') {
                text = ui(`Received offer update: ${row.job_title || 'Untitled role'}${company}`, `오퍼 업데이트: ${row.job_title || '제목 없는 공고'}${company}`)
            }

            rows.push({
                key: `app-${row.application_id}`,
                sortTime: new Date(timestamp).getTime() || 0,
                timeLabel: formatRelativeDate(timestamp, ui),
                text,
            })
        }

        for (const resume of items ?? []) {
            rows.push({
                key: `resume-${resume.resume_id}`,
                sortTime: new Date(resume.uploaded_at).getTime() || 0,
                timeLabel: formatRelativeDate(resume.uploaded_at, ui),
                text: ui(`Uploaded resume: ${resume.original_filename}`, `이력서 업로드: ${resume.original_filename}`),
            })
        }

        for (const entry of feedbackList) {
            rows.push({
                key: `feedback-${entry.feedback_id}`,
                sortTime: new Date(entry.created_at).getTime() || 0,
                timeLabel: formatRelativeDate(entry.created_at, ui),
                text: ui('Generated AI resume feedback', 'AI 이력서 피드백 생성'),
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
            steps.push(ui('Upload your latest resume to unlock AI feedback and recommendations.', '최신 이력서를 업로드하면 AI 피드백과 추천을 사용할 수 있습니다.'))
        }
        if (!feedback) {
            steps.push(ui('Generate AI resume feedback to catch missing metrics and role-specific gaps.', 'AI 이력서 피드백을 생성해 누락된 지표와 직무별 격차를 확인하세요.'))
        }
        if (savedCount > 0) {
            steps.push(ui(`Apply to ${savedCount} saved job${savedCount === 1 ? '' : 's'} this week.`, `이번 주에 저장한 공고 ${savedCount}건에 지원해 보세요.`))
        }
        if (interviewingCount > 0) {
            steps.push(ui(`Prepare follow-up notes for ${interviewingCount} interviewing role${interviewingCount === 1 ? '' : 's'}.`, `면접 진행 중인 공고 ${interviewingCount}건에 대한 후속 메모를 준비하세요.`))
        }
        if (staleAppliedCount > 0) {
            steps.push(ui(`Follow up on ${staleAppliedCount} application${staleAppliedCount === 1 ? '' : 's'} older than 10 days.`, `10일 이상 지난 지원 ${staleAppliedCount}건을 팔로업하세요.`))
        }
        if (steps.length === 0) {
            steps.push(ui('Browse new roles and save a few strong matches for your next application batch.', '새 공고를 둘러보고 다음 지원을 위해 잘 맞는 공고를 몇 개 저장해 두세요.'))
        }
        return steps.slice(0, 3)
    }, [applicationRows, feedback, latest, ui])

    return (
        <AppLayout pageLabel={ui('Dashboard', '대시보드')} activeNav="dashboard">
            <div className="ih-grid">
                        <Card title={ui('Resume Status', '이력서 상태')} subtitle={ui('Resume uploaded status and quick summary', '이력서 업로드 상태와 요약')}>
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
                                        {resume.uploaded ? ui('Uploaded', '업로드됨') : ui('Not uploaded', '업로드 안 됨')}
                                    </div>
                                    <div className="ih-muted" style={{ marginTop: 8 }}>
                                        {ui('File', '파일')}: <strong>{resume.fileName}</strong>
                                    </div>
                                    <div className="ih-muted">{ui('Last updated', '마지막 업데이트')}: {resume.lastUpdated}</div>
                                    {loadingResume ? <div className="ih-muted">{ui('Loading…', '불러오는 중…')}</div> : null}
                                    {resumeError ? (
                                        <div className="ih-muted" style={{ marginTop: 8 }}>
                                            {resumeError}
                                        </div>
                                    ) : null}
                                    {!token ? (
                                        <div className="ih-muted" style={{ marginTop: 8 }}>
                                            <Link to="/login">{ui('Login', '로그인')}</Link>{ui(' to upload your resume.', ' 후 이력서를 업로드하세요.')}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="ih-progressWrap">
                                    <div className="ih-muted">{ui('Completeness', '완성도')}</div>
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
                                    {uploading ? ui('Uploading…', '업로드 중…') : resume.uploaded ? ui('Update Resume', '이력서 업데이트') : ui('Upload Resume', '이력서 업로드')}
                                </button>
                                <button
                                    className="ih-btnGhost"
                                    disabled={!resume.uploaded}
                                    onClick={() => navigate('/resume-feedback')}
                                >
                                    {ui('AI Feedback', 'AI 피드백')}
                                </button>
                            </div>
                        </Card>

                        <Card title={ui('AI Feedback Summary', 'AI 피드백 요약')} subtitle={ui('High-level notes from AI review', 'AI 검토의 핵심 메모')}>
                            {loadingFeedback ? <div className="ih-muted">{ui('Loading…', '불러오는 중…')}</div> : null}
                            {feedbackError ? <div className="ih-muted">{feedbackError}</div> : null}

                            {!loadingFeedback && aiFeedback.length === 0 ? (
                                <div className="ih-muted">{ui('No AI feedback yet. Click “AI Feedback” to generate one.', '아직 AI 피드백이 없습니다. “AI 피드백”을 눌러 생성하세요.')}</div>
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
                                    {ui('View Full Feedback', '전체 피드백 보기')}
                                </button>
                                <button className="ih-btnGhost" disabled>
                                    {ui('Download Suggestions', '제안 다운로드')}
                                </button>
                            </div>
                        </Card>

                        <Card title={ui('AI Recommendations', 'AI 추천')} subtitle={ui('Personalized career & internship matches based on your resume', '이력서를 기반으로 한 맞춤형 커리어/인턴십 매칭')}>
                            {!token ? (
                                <div className="ih-muted">{ui('Login to see recommendations.', '추천을 보려면 로그인하세요.')}</div>
                            ) : !latest?.resume_id ? (
                                <div className="ih-muted">{ui('Upload a resume to get AI-based recommendations.', 'AI 기반 추천을 받으려면 이력서를 업로드하세요.')}</div>
                            ) : null}

                            {loadingRecommendations ? <div className="ih-muted">{ui('Loading…', '불러오는 중…')}</div> : null}
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
                                    {ui('View Recommendations', '추천 보기')}
                                </button>
                                <button className="ih-btnGhost" disabled={!token || !latest?.resume_id || loadingRecommendations} onClick={() => void refreshRecommendations()}>
                                    {ui('Refresh', '새로고침')}
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