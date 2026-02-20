import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getToken, register as registerService } from '../lib/authService'
import { useAuthStore } from '../stores/authStore'
import './Auth.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export default function Register() {
  const navigate = useNavigate()
  const setToken = useAuthStore((state) => state.setToken)
  const token = getToken()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

  const validationError = useMemo(() => {
    if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address.'
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }, [confirmPassword, email, password])

  const canSubmit = email.trim().length > 0 && password.length > 0 && !validationError

  async function handleRegister() {
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const token = await registerService({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
      })
      setToken(token)
      navigate('/profile', { replace: true })
    } catch (errorValue) {
      const message =
        errorValue instanceof ApiError
          ? errorValue.message
          : errorValue instanceof Error
            ? errorValue.message
            : 'Registration failed. Please try again.'
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
            <h1>Create Account</h1>
            <p className="auth-subtitle">Create your InternHunter account to get started.</p>
          </div>
        </div>

        <label className="auth-field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your full name"
          />
        </label>

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
            placeholder="At least 8 characters"
          />
        </label>

        <label className="auth-field">
          <span>Confirm Password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Retype your password"
          />
        </label>

        {error || validationError ? <p className="auth-error">{error || validationError}</p> : null}

        <button className="auth-button" disabled={!canSubmit || submitting} onClick={() => void handleRegister()}>
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>

        <p className="auth-linkText">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </div>
  )
}
