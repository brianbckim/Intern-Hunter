import { useEffect, useState } from "react"
import AppLayout from "../components/AppLayout"
import "./Dashboard.css"

type Theme = "light" | "dark"

export default function Settings() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "light"
  })

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"))
  }

  return (
    <div className="app">
      <AppLayout pageLabel="Settings" activeNav="settings">
        <div className="ih-grid">
          <section className="ih-card" style={{ background: "var(--card-bg)", color: "var(--text-color)" }}>
            <div className="ih-cardHeader">
              <div className="ih-cardTitle">Settings</div>
            </div>

            <div className="ih-cardBody">
              <div className="ih-settingRow">
                <div>
                  <div className="ih-settingLabel">Theme</div>
                  <div className="ih-muted">
                    Switch between light and dark mode.
                  </div>
                </div>

                <button
                  className="ih-themeToggle"
                  onClick={toggleTheme}
                >
                  {theme === "light"
                    ? "Enable Dark Mode"
                    : "Enable Light Mode"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </AppLayout>
    </div>
  )
}