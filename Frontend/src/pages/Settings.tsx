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
        <div className="ih-card">
          <h2>Settings</h2>

          <p>Switch between light and dark mode.</p>

          <button onClick={toggleTheme}>
            {theme === "light" ? "Enable Dark Mode" : "Enable Light Mode"}
          </button>
        </div>
      </AppLayout>
    </div>
  )
}