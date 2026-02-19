import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, login, register } from '../lib/api'
import { setAccessToken } from '../lib/auth'
import './Dashboard.css'

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length >= 8, [email, password])

  async function doLogin() {
    setError(null)
    setBusy(true)
    try {
      const res = await login(email.trim(), password)
      setAccessToken(res.access_token)
      navigate('/')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Login failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function doRegister() {
    setError(null)
    setBusy(true)
    try {
      const res = await register(email.trim(), password, fullName.trim() || undefined)
      setAccessToken(res.access_token)
      navigate('/') 
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Register failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ih-shell">
      <header className="ih-topbar">
        <div className="ih-brand">
          <div className="ih-logo">IH</div>
          <div>
            <div className="ih-brandName">InternHunter</div>
            <div className="ih-muted">Login / Register</div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 520, margin: '24px auto', width: '100%', padding: '0 16px' }}>
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div>
              <div className="ih-cardTitle">Auth</div>
              <div className="ih-muted">Sign in to upload your resume</div>
            </div>
          </div>
          <div className="ih-cardBody">
            <div style={{ display: 'grid', gap: 10 }}>
              <label>
                <div className="ih-muted">Email</div>
                <input
                  className="ih-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>

              <label>
                <div className="ih-muted">Password</div>
                <input
                  className="ih-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  type="password"
                />
              </label>

              <label>
                <div className="ih-muted">Full name (optional)</div>
                <input
                  className="ih-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
            </div>

            {error ? <div className="ih-muted" style={{ marginTop: 12 }}>Error: {error}</div> : null}

            <div className="ih-actions" style={{ marginTop: 14 }}>
              <button className="ih-btnPrimary" disabled={!canSubmit || busy} onClick={() => void doLogin()}>
                {busy ? 'Working…' : 'Login'}
              </button>
              <button className="ih-btnGhost" disabled={!canSubmit || busy} onClick={() => void doRegister()}>
                Register
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

