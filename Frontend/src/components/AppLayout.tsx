import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMyProfile, type UserProfile } from '../lib/api'
import { useUiText } from '../lib/uiLanguage'
import { useAuthStore } from '../stores/authStore'

type NavKey = 'dashboard' | 'resume' | 'jobs' | 'applications' | 'recruiters' | 'settings'

type AppLayoutProps = {
  pageLabel: string
  activeNav?: NavKey
  children: ReactNode
}

const navItems: Array<{ key: NavKey; label: string; href: string }> = [
  { key: 'dashboard', label: 'Dashboard', href: '/' },
  { key: 'resume', label: 'Resume', href: '/resume' },
  { key: 'jobs', label: 'Jobs', href: '/jobs' },
  { key: 'applications', label: 'Applications', href: '/applications' },
  { key: 'recruiters', label: 'Recruiters', href: '/recruiters' },
  { key: 'settings', label: 'Settings', href: '/settings' },
]

export default function AppLayout({ pageLabel, activeNav, children }: AppLayoutProps) {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const { ui } = useUiText()
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const value = await getMyProfile()
        setProfile(value)
      } catch {
        setProfile(null)
      }
    }

    void loadProfile()
  }, [])

  useEffect(() => {
    function onProfileUpdated(event: Event) {
      const customEvent = event as CustomEvent<UserProfile>
      if (customEvent.detail) {
        setProfile(customEvent.detail)
      }
    }

    window.addEventListener('internhunter:profile-updated', onProfileUpdated as EventListener)
    return () => {
      window.removeEventListener('internhunter:profile-updated', onProfileUpdated as EventListener)
    }
  }, [])

  const displayName = useMemo(() => {
    if (profile?.name?.trim()) return profile.name.trim()
    if (profile?.user_email) return profile.user_email
    return ui('User', '사용자')
  }, [profile, ui])

  const secondaryLabel = useMemo(() => {
    if (profile?.major_or_program?.trim()) return profile.major_or_program.trim()
    return ui('Student', '학생')
  }, [profile, ui])

  return (
    <div className="ih-shell">
      <header className="ih-topbar">
        <div className="ih-brand">
          <div className="ih-logo" aria-hidden="true">
            <span className="ih-logoCore" />
            <span className="ih-logoOrbit" />
            <span className="ih-logoStar" />
          </div>
          <div>
            <div className="ih-brandName">InternHunter</div>
            <div className="ih-muted">{pageLabel}</div>
          </div>
        </div>

        <div className="ih-topActions">
          <button className="ih-btnGhost" type="button">
            {ui('Notifications', '알림')}
          </button>
          <Link className="ih-user ih-userLink" to="/profile">
            <div className="ih-avatar" aria-label="User avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="ih-userText">
              <div className="ih-userName">{displayName}</div>
              <div className="ih-muted">{secondaryLabel}</div>
            </div>
          </Link>
          <button
            className="ih-btnGhost"
            type="button"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            {ui('Logout', '로그아웃')}
          </button>
        </div>
      </header>

      <div className="ih-body">
        <aside className="ih-sidebar">
          <nav className="ih-nav">
            {navItems.map((item) => (
              <Link key={item.key} to={item.href} className={`ih-navItem ${item.key === activeNav ? 'active' : ''}`}>
                {item.key === 'dashboard'
                  ? ui('Dashboard', '대시보드')
                  : item.key === 'resume'
                    ? ui('Resume', '이력서')
                    : item.key === 'jobs'
                      ? ui('Jobs', '채용공고')
                      : item.key === 'applications'
                        ? ui('Applications', '지원현황')
                        : item.key === 'recruiters'
                          ? ui('Recruiters', '리크루터')
                          : ui('Settings', '설정')}
              </Link>
            ))}
          </nav>

          <div className="ih-sidebarFooter">
            <div className="ih-muted">{ui('Tip', '팁')}</div>
            <div className="ih-sidebarTip">{ui('Update your profile and resume to get better internship matches.', '프로필과 이력서를 최신 상태로 유지하면 더 나은 인턴십 매칭을 받을 수 있습니다.')}</div>
          </div>
        </aside>

        <main className="ih-main">{children}</main>
      </div>
    </div>
  )
}
