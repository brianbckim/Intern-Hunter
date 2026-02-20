import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getToken, login as loginService } from '../lib/authService'
import { useAuthStore } from '../stores/authStore'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setToken = useAuthStore((state) => state.setToken)
  const token = getToken()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token) {
      navigate('/profile', { replace: true })
    }
  }, [token, navigate])

  if (token) {
    return null
  }

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password])

  async function handleLogin() {
    setError(null)
    setSubmitting(true)

    try {
      const token = await loginService(email.trim(), password)
      setToken(token)
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from || '/profile', { replace: true })
    } catch (errorValue) {
      const message =
        errorValue instanceof ApiError
          ? errorValue.message
          : errorValue instanceof Error
            ? errorValue.message
            : 'Login failed. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo" aria-hidden="true">
            <span className="auth-logoCore" />
            <span className="auth-logoOrbit" />
            <span className="auth-logoStar" />
          </div>
          <div>
            <h1>InternHunter Login</h1>
            <p className="auth-subtitle">Sign in to continue your internship journey.</p>
          </div>
        </div>

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
          />
        </label>

        {error ? <p className="auth-error">{error}</p> : null}

        <button className="auth-button" disabled={!canSubmit || submitting} onClick={() => void handleLogin()}>
          {submitting ? 'Logging in...' : 'Login'}
        </button>

        <p className="auth-linkText">
          Don’t have an account? <Link to="/register">Register</Link>
        </p>
      </section>
    </div>
  )
}

