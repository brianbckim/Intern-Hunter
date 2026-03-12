import { useEffect, useState } from "react"
import AppLayout from "../components/AppLayout"
import "./Dashboard.css"

type Theme = "light" | "dark"

export default function Settings() {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute("data-theme", savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme: Theme = theme === "light" ? "dark" : "light"

    setTheme(newTheme)
    document.documentElement.setAttribute("data-theme", newTheme)
    localStorage.setItem("theme", newTheme)
  }

  return (
    <div className="app">
      <AppLayout pageLabel="Settings" activeNav="settings">
        <div className="ih-grid">
          <section className="ih-card">
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
                  {theme === "light" ? "Enable Dark Mode" : "Enable Light Mode"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </AppLayout>
    </div>
  )
}