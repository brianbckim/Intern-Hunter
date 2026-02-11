import type { ReactNode } from "react";
import "./Dashboard.css";

type NavItem = { label: string; href: string; active?: boolean };

const navItems: NavItem[] = [
    { label: "Dashboard", href: "/", active: true },
    { label: "Resume", href: "/resume" },
    { label: "Jobs", href: "/jobs" },
    { label: "Applications", href: "/applications" },
    { label: "Settings", href: "/settings" },
];

export default function Dashboard() {
    const resume = {
        uploaded: true,
        fileName: "resume.pdf",
        lastUpdated: "Feb 10, 2026",
        completeness: 82,
    };

    const aiFeedback = [
        "Strong project section — keep it near the top.",
        "Add 2–3 quantified bullets (impact + numbers).",
        "Tighten summary to 1–2 lines for clarity.",
    ];

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
        <div className="ih-shell">
            <TopBar />
            <div className="ih-body">
                <Sidebar items={navItems} />
                <main className="ih-main">
                    <div className="ih-grid">
                        <Card title="Resume Status" subtitle="Resume uploaded status and quick summary">
                            <div className="ih-row">
                                <div>
                                    <div className="ih-pill">
                                        {resume.uploaded ? "Uploaded" : "Not uploaded"}
                                    </div>
                                    <div className="ih-muted" style={{ marginTop: 8 }}>
                                        File: <strong>{resume.fileName}</strong>
                                    </div>
                                    <div className="ih-muted">Last updated: {resume.lastUpdated}</div>
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
                                <button className="ih-btnPrimary">
                                    {resume.uploaded ? "Update Resume" : "Upload Resume"}
                                </button>
                                <button className="ih-btnGhost">Request AI Review</button>
                            </div>
                        </Card>

                        <Card title="AI Feedback Summary" subtitle="High-level notes from AI review">
                            <ul className="ih-list">
                                {aiFeedback.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                            <div className="ih-actions">
                                <button className="ih-btnPrimary">View Full Feedback</button>
                                <button className="ih-btnGhost">Download Suggestions</button>
                            </div>
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
                </main>
            </div>
        </div>
    );
}

function TopBar() {
    return (
        <header className="ih-topbar">
            <div className="ih-brand">
                <div className="ih-logo">IH</div>
                <div>
                    <div className="ih-brandName">InternHunter</div>
                    <div className="ih-muted">Dashboard</div>
                </div>
            </div>

            <div className="ih-topActions">
                <button className="ih-btnGhost">Notifications</button>
                <div className="ih-user">
                    <div className="ih-avatar" aria-label="User avatar">
                        U
                    </div>
                    <div className="ih-userText">
                        <div className="ih-userName">User</div>
                        <div className="ih-muted">Student</div>
                    </div>
                </div>
            </div>
        </header>
    );
}

function Sidebar({ items }: { items: NavItem[] }) {
    return (
        <aside className="ih-sidebar">
            <nav className="ih-nav">
                {items.map((item) => (
                    <a
                        key={item.label}
                        href={item.href}
                        className={`ih-navItem ${item.active ? "active" : ""}`}
                    >
                        {item.label}
                    </a>
                ))}
            </nav>

            <div className="ih-sidebarFooter">
                <div className="ih-muted">Tip</div>
                <div className="ih-sidebarTip">
                    Keep your resume updated before applying to new roles.
                </div>
            </div>
        </aside>
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