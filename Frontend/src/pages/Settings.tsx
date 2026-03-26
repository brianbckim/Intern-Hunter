import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { deleteAccount } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import './Dashboard.css'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme'

function getSavedTheme(): Theme {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return savedTheme === 'dark' ? 'dark' : 'light'
}

export default function Settings() {
  const [theme, setTheme] = useState<Theme>(() => getSavedTheme())
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  // Change‑password form (UI only)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  function handlePasswordSubmit() {
    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg('Please fill in all fields.')
      return
    }
    if (newPw !== confirmPw) {
      setPwMsg('New passwords do not match.')
      return
    }
    setPwMsg('Password change is not connected to the backend yet.')
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      logout()
      navigate('/login', { replace: true })
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete account.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppLayout pageLabel="Settings" activeNav="settings">
      <div className="ih-grid">
        {/* ── Appearance ── */}
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Appearance</div>
            <p className="ih-muted" style={{ marginTop: 4 }}>Switch between light and dark mode.</p>
          </div>

          <div className="ih-cardBody">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={theme === 'dark'}
                onClick={toggleTheme}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 32,
                  width: 56,
                  flexShrink: 0,
                  cursor: 'pointer',
                  borderRadius: 9999,
                  border: 'none',
                  padding: 0,
                  background: theme === 'dark' ? 'var(--primary)' : 'var(--border-strong)',
                  transition: 'background 0.2s',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    height: 24,
                    width: 24,
                    borderRadius: 9999,
                    background: theme === 'dark' ? 'var(--primary-contrast)' : '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transform: theme === 'dark' ? 'translateX(27px)' : 'translateX(3px)',
                    transition: 'transform 0.2s',
                    pointerEvents: 'none',
                  }}
                />
              </button>

              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Dark mode</div>
                <p className="ih-muted" style={{ marginTop: 6 }}>
                  {theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Change Password (UI only) ── */}
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Change Password</div>
            <p className="ih-muted" style={{ marginTop: 4 }}>Update your account password.</p>
          </div>

          <div className="ih-cardBody">
            <div style={{ display: 'grid', gap: 18, maxWidth: 540 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Current Password</span>
                <input
                  className="ih-input"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                />
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>New Password</span>
                <input
                  className="ih-input"
                  type="password"
                  placeholder="Enter new password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Confirm New Password</span>
                <input
                  className="ih-input"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
              </label>

              {pwMsg ? (
                <p className="ih-muted">{pwMsg}</p>
              ) : null}

              <div style={{ paddingTop: 4 }}>
                <button
                  className="ih-btnPrimary"
                  type="button"
                  onClick={handlePasswordSubmit}
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Delete Account ── */}
        <section className="ih-card" style={{ borderColor: '#ef4444' }}>
          <div className="ih-cardHeader">
            <div className="ih-cardTitle" style={{ color: '#ef4444' }}>Delete Account</div>
            <p className="ih-muted" style={{ marginTop: 4 }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>

          <div className="ih-cardBody">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  border: '1px solid #ef4444',
                  background: 'transparent',
                  color: '#ef4444',
                  padding: '12px 16px',
                  fontSize: 20,
                  borderRadius: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Delete My Account
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 14, maxWidth: 540 }}>
                <p style={{ fontSize: 18, color: 'var(--text)' }}>
                  Are you sure? All your data (profile, resumes, feedback) will be permanently removed.
                </p>

                {deleteError ? (
                  <p style={{ color: '#ef4444', fontSize: 18 }}>{deleteError}</p>
                ) : null}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDeleteAccount()}
                    style={{
                      border: 'none',
                      background: '#ef4444',
                      color: '#fff',
                      padding: '12px 16px',
                      fontSize: 20,
                      borderRadius: 12,
                      cursor: deleting ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      opacity: deleting ? 0.7 : 1,
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Yes, Delete My Account'}
                  </button>
                  <button
                    className="ih-btnGhost"
                    type="button"
                    disabled={deleting}
                    onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}