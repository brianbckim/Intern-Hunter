import AppLayout from '../components/AppLayout'
import './Dashboard.css'

export default function Settings() {
  return (
    <AppLayout pageLabel="Settings" activeNav="settings">
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Settings</div>
          </div>
          <div className="ih-cardBody">
            <div className="ih-muted">Settings module is coming soon.</div>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
