import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getToken, login as loginService } from '../lib/authService'
import { useUiText } from '../lib/uiLanguage'
import { useAuthStore } from '../stores/authStore'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setToken = useAuthStore((state) => state.setToken)
  const token = getToken()
  const { ui } = useUiText()

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
            : ui('Login failed. Please try again.', '로그인에 실패했습니다. 다시 시도해 주세요.')
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
            <p className="auth-subtitle">{ui('Sign in to continue your internship journey.', '인턴십 여정을 계속하려면 로그인하세요.')}</p>
          </div>
        </div>

        <label className="auth-field">
          <span>{ui('Email', '이메일')}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="auth-field">
          <span>{ui('Password', '비밀번호')}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={ui('Enter your password', '비밀번호를 입력하세요')}
          />
        </label>

        {error ? <p className="auth-error">{error}</p> : null}

        <button className="auth-button" disabled={!canSubmit || submitting} onClick={() => void handleLogin()}>
          {submitting ? ui('Logging in...', '로그인 중...') : ui('Login', '로그인')}
        </button>

        <p className="auth-linkText">
          {ui('Don’t have an account?', '계정이 없으신가요?')} <Link to="/register">{ui('Register', '회원가입')}</Link>
        </p>
      </section>
    </div>
  )
}

