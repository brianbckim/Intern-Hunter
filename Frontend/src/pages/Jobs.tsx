import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Dashboard.css";

type NavItem = { label: string; href: string; active?: boolean };

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Resume", href: "/resume" },
  { label: "Jobs", href: "/jobs", active: true },
  { label: "Applications", href: "/applications" },
  { label: "Settings", href: "/settings" },
];

type Job = {
  external_id: string;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  date_posted?: number;
  category?: string;
};

const PAGE_SIZE = 20;

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/jobs/")
      .then((res) => res.json())
      .then((data) => {
        setJobs(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  function formatDate(timestamp?: number) {
    if (!timestamp) return "";
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function normalizeCategory(cat?: string) {
    if (!cat) return "";
    if (cat.toLowerCase().includes("software")) return "Software";
    return cat;
  }

  const categories = useMemo(() => {
    const normalized = jobs
      .map((j) => normalizeCategory(j.category))
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const keyword = search.toLowerCase();

    let result = jobs.filter((job) => {
      const matchesSearch =
        job.title?.toLowerCase().includes(keyword) ||
        job.company?.toLowerCase().includes(keyword) ||
        job.location?.toLowerCase().includes(keyword);

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(normalizeCategory(job.category));

      return matchesSearch && matchesCategory;
    });

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => (b.date_posted ?? 0) - (a.date_posted ?? 0));
        break;
      case "oldest":
        result.sort((a, b) => (a.date_posted ?? 0) - (b.date_posted ?? 0));
        break;
      case "company":
        result.sort((a, b) =>
          (a.company ?? "").localeCompare(b.company ?? "")
        );
        break;
      case "title":
        result.sort((a, b) =>
          (a.title ?? "").localeCompare(b.title ?? "")
        );
        break;
    }

    return result;
  }, [jobs, search, selectedCategories, sortBy]);

  const totalPages = Math.ceil(filteredJobs.length / PAGE_SIZE);
  const paginatedJobs = filteredJobs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategories, sortBy]);

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat)
        ? prev.filter((c) => c !== cat)
        : [...prev, cat]
    );
  }

  return (
    <div className="ih-shell">
      <TopBar />

      <div className="ih-body">
        <Sidebar items={navItems} />

        <main className="ih-main">
          <section className="ih-card">
            <div className="ih-cardHeader">
              <div className="ih-cardTitle">Internships</div>
              <div className="ih-muted">
                {filteredJobs.length} results
              </div>
            </div>

            <div className="ih-cardBody">

              {/* 搜索 + 排序 */}
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <input
                  placeholder="Search title, company, location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    flex: 1,
                  }}
                />

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                  }}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="company">Company A-Z</option>
                  <option value="title">Title A-Z</option>
                </select>
              </div>

              {/* 分类筛选 */}
              <div
                style={{
                  marginBottom: 24,
                  padding: 16,
                  background: "#f9fafb",
                  borderRadius: 10,
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                  Category
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {categories.map((cat) => (
                    <label key={cat} style={{ fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                        style={{ marginRight: 6 }}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>

              {loading ? (
                <div>Loading...</div>
              ) : (
                <>
                  {paginatedJobs.map((job) => (
                    <div
                      key={job.external_id}
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: 20,
                        marginBottom: 20,
                        borderRadius: 12,
                        background: "#fff",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          marginBottom: 6,
                        }}
                      >
                        {job.title}
                      </div>

                      <div style={{ color: "#555", marginBottom: 6 }}>
                        {job.company} • {job.location}
                      </div>

                      <div style={{ fontSize: 13, color: "#888" }}>
                        Posted: {formatDate(job.date_posted)}
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            backgroundColor: "#000",
                            color: "#fff",
                            padding: "8px 16px",
                            borderRadius: 8,
                            textDecoration: "none",
                            fontWeight: 500,
                            display: "inline-block",
                          }}
                        >
                          Apply
                        </a>
                      </div>
                    </div>
                  ))}

                  <div
                    style={{
                      marginTop: 30,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </button>

                    <span>
                      Page {page} of {totalPages}
                    </span>

                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
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
          <div className="ih-muted">Jobs</div>
        </div>
      </div>

      <div className="ih-topActions">
        <Link className="ih-btnGhost" to="/">
          Dashboard
        </Link>
      </div>
    </header>
  );
}

function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="ih-sidebar">
      <nav className="ih-nav">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className={`ih-navItem ${item.active ? "active" : ""}`}
          >
            {item.label}
          </Link>
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