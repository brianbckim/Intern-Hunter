import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import {
  ApiError,
  deleteMyApplication,
  listMyApplications,
  recordJobApplication,
  type JobApplicationRecord,
} from '../lib/api'
import { useUiText } from '../lib/uiLanguage'
import { useLanguageStore } from '../stores/langStore'
import type { Language } from '../stores/langStore'
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

function formatStatusLabel(status: string, language: Language): string {
  if (!status) {
    const emptyMap = {
      en: '—',
      ko: '없음',
      es: '—',
      fr: '—'
    }
    return emptyMap[language]
  }

  const labels: Record<string, Record<Language, string>> = {
    saved: { en: 'Saved', ko: '저장됨', es: 'Guardado', fr: 'Enregistré' },
    applied: { en: 'Applied', ko: '지원 완료', es: 'Aplicado', fr: 'Candidature envoyée' },
    interview: { en: 'Interviewing', ko: '면접 진행', es: 'Entrevista', fr: 'Entretien' },
    offer: { en: 'Offered', ko: '오퍼', es: 'Oferta', fr: 'Offre' },
    rejected: { en: 'Rejected', ko: '불합격', es: 'Rechazado', fr: 'Refusé' }
  }

  if (labels[status]) {
    return labels[status][language]
  }

  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
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

function getOutcomeSelectValue(status: string): 'applied' | 'interview' | 'offer' | 'rejected' | '' {
  if (status === 'applied' || status === 'interview' || status === 'offer' || status === 'rejected') {
    return status
  }
  return ''
}

function getStatusClassName(status: string): string {
  switch (status) {
    case 'saved':
      return 'ih-appStatus ih-appStatus--saved'
    case 'applied':
      return 'ih-appStatus ih-appStatus--applied'
    case 'interview':
      return 'ih-appStatus ih-appStatus--interview'
    case 'offer':
      return 'ih-appStatus ih-appStatus--offer'
    case 'rejected':
      return 'ih-appStatus ih-appStatus--rejected'
    default:
      return 'ih-appStatus'
  }
}

export default function Applications() {
  const { ui } = useUiText()
  const language = useLanguageStore((state) => state.language)

  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<JobApplicationRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingOutcomeId, setUpdatingOutcomeId] = useState<string | null>(null)

  const statusFilter = searchParams.get('status')?.trim().toLowerCase() || 'all'

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const list = await listMyApplications()
      setRows(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError(ui(
          'Please sign in again.',
          '다시 로그인해 주세요.',
        ))
      } else {
        setError(
          e instanceof Error
            ? e.message
            : ui(
                'Failed to load applications.',
                '지원 내역을 불러오지 못했습니다.',
              )
        )
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
      ui(
        `Remove “${row.job_title || 'this application'}” from your list?`,
        `목록에서 “${row.job_title || '이 지원 내역'}”을 삭제할까요?`,
      )
    )
    if (!ok) return

    setDeletingId(row.application_id)
    setError(null)

    try {
      await deleteMyApplication(row.application_id)
      setRows((prev) => prev ? prev.filter((r) => r.application_id !== row.application_id) : prev)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ui(
              'Failed to delete.',
              '삭제하지 못했습니다.',
            )
      )
    } finally {
      setDeletingId(null)
    }
  }

  async function handleOutcomeChange(
    row: JobApplicationRecord,
    nextStatus: 'applied' | 'interview' | 'offer' | 'rejected'
  ): Promise<void> {
    setUpdatingOutcomeId(row.application_id)
    setError(null)

    try {
      const updated = await recordJobApplication({
        job_source: row.job_source,
        job_external_id: row.job_external_id,
        status: nextStatus,
        job_title: row.job_title,
        job_company: row.job_company,
        job_location: row.job_location,
        job_url: row.job_url,
      })

      setRows((prev) =>
        prev
          ? prev.map((item) => (item.application_id === row.application_id ? updated : item))
          : prev
      )
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ui(
              'Failed to update application outcome.',
              'Failed to update application outcome.',
            )
      )
    } finally {
      setUpdatingOutcomeId(null)
    }
  }

  return (
    <AppLayout
      pageLabel={ui('Applications', '지원현황')}
      activeNav="applications"
    >
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">
              {ui('Applications', '지원현황')}
            </div>
            <div className="ih-muted" style={{ marginTop: 8 }}>
              {ui(
                'Roles you marked as applied from the Jobs page.',
                'Jobs 페이지에서 추적한 지원 내역입니다.',
              )}
            </div>
          </div>

          <div className="ih-cardBody">
            <div className="ih-appToolbar">
              <input
                className="ih-input ih-appSearch"
                type="search"
                placeholder={ui(
                  'Search title, company, location, status…',
                  '직무명, 회사, 지역, 상태 검색…'
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={ui(
                  'Search applications',
                  '지원 내역 검색'
                )}
              />

              <select
                className="ih-input"
                value={statusFilter}
                onChange={(e) => {
                  const next = e.target.value
                  setSearchParams((prev) => {
                    const params = new URLSearchParams(prev)
                    if (next === 'all') params.delete('status')
                    else params.set('status', next)
                    return params
                  })
                }}
                aria-label={ui(
                  'Filter application status',
                  '지원 상태 필터'
                )}
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

              <Link className="ih-btnGhost" to="/jobs">
                {ui('Browse jobs', '채용공고 보기')}
              </Link>
            </div>

            {error && <p className="ih-error">{error}</p>}
            {loading && <div className="ih-muted">{ui('Loading…', '불러오는 중…')}</div>}

            {!loading && rows && rows.length === 0 && !error && (
              <div className="ih-muted">
                {ui(
                  'No tracked jobs yet. Open ',
                  '아직 추적 중인 공고가 없습니다. '
                )}
                <Link to="/jobs">{ui('Jobs', 'Jobs')}</Link>
                {ui(
                  ', then save a role or click Apply and confirm with “Yes, Applied” when you return.',
                  '에서 공고를 저장하거나 지원 후 돌아와 “지원 완료”를 확인하세요.'
                )}
              </div>
            )}

            {!loading && rows && filteredRows.length === 0 && (
              <div className="ih-muted">
                {ui(
                  `No matches for “${search}”.`,
                  `“${search}”와 일치하는 결과가 없습니다.`
                )}
              </div>
            )}

            {filteredRows.length > 0 && (
              <table className="ih-appTable">
                <thead>
                  <tr>
                    <th>{ui('Job title', '직무명')}</th>
                    <th>{ui('Company', '회사')}</th>
                    <th>{ui('Location', '지역')}</th>
                    <th>{ui('Date applied', '지원일')}</th>
                    <th>{ui('Status', '상태')}</th>
                    <th>{ui('Link', '링크')}</th>
                    <th>{ui('Post Application Outcomes', 'Post Application Outcomes')}</th>
                    <th>{ui('Manage', '관리')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.application_id}>
                      <td>{row.job_title || '—'}</td>
                      <td>{row.job_company || '—'}</td>
                      <td>{row.job_location || '—'}</td>
                      <td>{formatAppliedDate(row.created_at || row.updated_at)}</td>
                      <td>
                        <span className={getStatusClassName(row.status)}>
                          {formatStatusLabel(row.status, language)}
                        </span>
                      </td>
                      <td>
                        {row.job_url ? (
                          <a href={row.job_url} target="_blank" rel="noreferrer">
                            {ui('Open', '열기')}
                          </a>
                        ) : '—'}
                      </td>
                      <td>
                        <select
                          className="ih-input"
                          value={getOutcomeSelectValue(row.status)}
                          disabled={updatingOutcomeId === row.application_id}
                          onChange={(event) => {
                            const nextStatus = event.target.value as 'applied' | 'interview' | 'offer' | 'rejected' | ''
                            if (!nextStatus) return
                            void handleOutcomeChange(row, nextStatus)
                          }}
                          aria-label={ui(
                            'Post application outcomes',
                            'Post application outcomes',
                          )}
                        >
                          <option value="">
                            {updatingOutcomeId === row.application_id
                              ? ui('Updating...', 'Updating...')
                              : ui('Choose outcome', 'Choose outcome')}
                          </option>
                          <option value="applied">
                            {ui('Applied', 'Applied')}
                          </option>
                          <option value="interview">
                            {ui('Interviewing', 'Interviewing')}
                          </option>
                          <option value="offer">
                            {ui('Offered', 'Offered')}
                          </option>
                          <option value="rejected">
                            {ui('Rejected', 'Rejected')}
                          </option>
                        </select>
                      </td>
                      <td>
                        <button
                          className="ih-appDeleteBtn"
                          type="button"
                          disabled={deletingId === row.application_id}
                          onClick={() => void handleDelete(row)}
                        >
                          {deletingId === row.application_id
                            ? ui('Removing…', '삭제 중…')
                            : ui('Delete', '삭제')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
