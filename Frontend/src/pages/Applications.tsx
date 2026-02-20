import AppLayout from '../components/AppLayout'
import './Dashboard.css'

export default function Applications() {
  return (
    <AppLayout pageLabel="Applications" activeNav="applications">
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Applications</div>
          </div>
          <div className="ih-cardBody">
            <div className="ih-muted">Applications tracking module is coming soon.</div>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
