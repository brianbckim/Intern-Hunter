import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { ApiError, deleteMyApplication, listMyApplications, type JobApplicationRecord } from '../lib/api'
import { useUiText } from '../lib/uiLanguage'
import './Dashboard.css'

function formatAppliedDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

function formatStatusLabel(status: string, isKorean: boolean): string {
  if (!status) return isKorean ? '없음' : '—'
  if (!isKorean) return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')

  const labels: Record<string, string> = {
    saved: '저장됨',
    applied: '지원 완료',
    interview: '면접 진행',
    offer: '오퍼',
    rejected: '불합격',
  }
  return labels[status] ?? status
}

function rowMatchesQuery(row: JobApplicationRecord, q: string): boolean {
  if (!q.trim()) return true
  const needle = q.trim().toLowerCase()
  const hay = [
    row.job_title,
    row.job_company,
    row.job_location,
    row.status,
    row.job_url,
    row.job_source,
    row.job_external_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(needle)
}

export default function Applications() {
  const { ui, isKorean } = useUiText()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<JobApplicationRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const statusFilter = searchParams.get('status')?.trim().toLowerCase() || 'all'

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const list = await listMyApplications()
      setRows(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError(ui('Please sign in again.', '다시 로그인해 주세요.'))
      } else {
        setError(e instanceof Error ? e.message : ui('Failed to load applications.', '지원 내역을 불러오지 못했습니다.'))
      }
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [ui])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredRows = useMemo(() => {
    if (!rows) return []
    return rows.filter((row) => {
      const matchesQuery = rowMatchesQuery(row, search)
      const matchesStatus = statusFilter === 'all' ? true : row.status.toLowerCase() === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [rows, search, statusFilter])

  async function handleDelete(row: JobApplicationRecord): Promise<void> {
    if (!row.application_id) return
    const ok = window.confirm(
      ui(`Remove “${row.job_title || 'this application'}” from your list?`, `목록에서 “${row.job_title || '이 지원 내역'}”을 삭제할까요?`)
    )
    if (!ok) return
    setDeletingId(row.application_id)
    setError(null)
    try {
      await deleteMyApplication(row.application_id)
      setRows((prev) => (prev ? prev.filter((r) => r.application_id !== row.application_id) : prev))
    } catch (e) {
      setError(e instanceof Error ? e.message : ui('Failed to delete.', '삭제하지 못했습니다.'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppLayout pageLabel={ui('Applications', '지원현황')} activeNav="applications">
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">{ui('Applications', '지원현황')}</div>
            <div className="ih-muted" style={{ marginTop: 8 }}>
              {ui('Roles you marked as applied from the Jobs page.', 'Jobs 페이지에서 추적한 지원 내역입니다.')}
            </div>
          </div>
          <div className="ih-cardBody">
            <div className="ih-appToolbar">
              <input
                className="ih-input ih-appSearch"
                type="search"
                placeholder={ui('Search title, company, location, status…', '직무명, 회사, 지역, 상태 검색…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={ui('Search applications', '지원 내역 검색')}
              />
              <select
                className="ih-input"
                value={statusFilter}
                onChange={(e) => {
                  const next = e.target.value
                  setSearchParams((prev) => {
                    const params = new URLSearchParams(prev)
                    if (next === 'all') {
                      params.delete('status')
                    } else {
                      params.set('status', next)
                    }
                    return params
                  })
                }}
                aria-label={ui('Filter application status', '지원 상태 필터')}
              >
                <option value="all">{ui('All statuses', '전체 상태')}</option>
                <option value="saved">{ui('Saved jobs', '저장한 공고')}</option>
                <option value="applied">{ui('Applied', '지원 완료')}</option>
                <option value="interview">{ui('Interviewing', '면접 진행')}</option>
                <option value="offer">{ui('Offers', '오퍼')}</option>
                <option value="rejected">{ui('Rejected', '불합격')}</option>
              </select>
              <button className="ih-btnGhost" type="button" disabled={loading} onClick={() => void refresh()}>
                {ui('Refresh', '새로고침')}
              </button>
              <Link className="ih-btnGhost" to="/jobs" style={{ textDecoration: 'none', display: 'inline-block' }}>
                {ui('Browse jobs', '채용공고 보기')}
              </Link>
            </div>

            {error ? <p className="ih-error">{error}</p> : null}
            {loading ? <div className="ih-muted">{ui('Loading…', '불러오는 중…')}</div> : null}

            {!loading && rows && rows.length === 0 && !error ? (
              <div className="ih-muted">
                {ui('No tracked jobs yet. Open ', '아직 추적 중인 공고가 없습니다. ')}<Link to="/jobs">{ui('Jobs', 'Jobs')}</Link>{ui(', then save a role or click Apply and confirm with “Yes, Applied” when you return.', '에서 공고를 저장하거나 지원 후 돌아와 “지원 완료”를 확인하세요.')}
              </div>
            ) : null}

            {!loading && rows && rows.length > 0 && filteredRows.length === 0 ? (
              <div className="ih-muted">{ui(`No matches for “${search}”. Clear the search to see all applications.`, `“${search}”와 일치하는 결과가 없습니다. 검색어를 지우면 전체 지원 내역을 볼 수 있습니다.`)}</div>
            ) : null}

            {!loading && rows && rows.length > 0 && filteredRows.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="ih-appTable">
                  <thead>
                    <tr>
                      <th>{ui('Job title', '직무명')}</th>
                      <th>{ui('Company', '회사')}</th>
                      <th>{ui('Location', '지역')}</th>
                      <th>{ui('Date applied', '지원일')}</th>
                      <th>{ui('Status', '상태')}</th>
                      <th>{ui('Link', '링크')}</th>
                      <th>{ui('Manage', '관리')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={`${row.job_source}-${row.job_external_id}-${row.application_id}`}>
                        <td>{row.job_title || '—'}</td>
                        <td>{row.job_company || '—'}</td>
                        <td>{row.job_location || '—'}</td>
                        <td>{formatAppliedDate(row.created_at || row.updated_at)}</td>
                        <td>
                          <span className="ih-appStatus">{formatStatusLabel(row.status, isKorean)}</span>
                        </td>
                        <td>
                          {row.job_url ? (
                            <a
                              className="ih-appLinkBtn"
                              href={row.job_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {ui('Open', '열기')}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <button
                            className="ih-appDeleteBtn"
                            type="button"
                            disabled={deletingId === row.application_id}
                            onClick={() => void handleDelete(row)}
                          >
                            {deletingId === row.application_id ? ui('Removing…', '삭제 중…') : ui('Delete', '삭제')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
