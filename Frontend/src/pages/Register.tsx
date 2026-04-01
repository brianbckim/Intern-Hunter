import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getToken, register as registerService } from '../lib/authService'
import { useUiText } from '../lib/uiLanguage'
import { useAuthStore } from '../stores/authStore'
import './Auth.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export default function Register() {
  const navigate = useNavigate()
  const setToken = useAuthStore((state) => state.setToken)
  const token = getToken()
  const { ui } = useUiText()

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
    if (!EMAIL_REGEX.test(email.trim())) return ui('Please enter a valid email address.', '유효한 이메일 주소를 입력해 주세요.')
    if (password.length < MIN_PASSWORD_LENGTH) {
      return ui(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`)
    }
    if (password !== confirmPassword) return ui('Passwords do not match.', '비밀번호가 일치하지 않습니다.')
    return null
  }, [confirmPassword, email, password, ui])

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
            : ui('Registration failed. Please try again.', '회원가입에 실패했습니다. 다시 시도해 주세요.')
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
            <h1>{ui('Create Account', '계정 만들기')}</h1>
            <p className="auth-subtitle">{ui('Create your InternHunter account to get started.', '시작하려면 InternHunter 계정을 만들어 주세요.')}</p>
          </div>
        </div>

        <label className="auth-field">
          <span>{ui('Name', '이름')}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={ui('Your full name', '이름을 입력하세요')}
          />
        </label>

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
            placeholder={ui('At least 8 characters', '최소 8자 이상')}
          />
        </label>

        <label className="auth-field">
          <span>{ui('Confirm Password', '비밀번호 확인')}</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={ui('Retype your password', '비밀번호를 다시 입력하세요')}
          />
        </label>

        {error || validationError ? <p className="auth-error">{error || validationError}</p> : null}

        <button className="auth-button" disabled={!canSubmit || submitting} onClick={() => void handleRegister()}>
          {submitting ? ui('Creating account...', '계정 생성 중...') : ui('Create Account', '계정 만들기')}
        </button>

        <p className="auth-linkText">
          {ui('Already have an account?', '이미 계정이 있으신가요?')} <Link to="/login">{ui('Login', '로그인')}</Link>
        </p>
      </section>
    </div>
  )
}
