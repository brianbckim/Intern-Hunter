import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { ApiError, deleteMyApplication, listMyApplications, type JobApplicationRecord } from '../lib/api'
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
    interview: { en: 'Interview', ko: '면접 진행', es: 'Entrevista', fr: 'Entretien' },
    offer: { en: 'Offer', ko: '오퍼', es: 'Oferta', fr: 'Offre' },
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

export default function Applications() {
  const { ui } = useUiText()
  const language = useLanguageStore((state) => state.language)

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
        setError(ui(
          'Please sign in again.',
          '다시 로그인해 주세요.',
          'Por favor, inicie sesión de nuevo.',
          'Veuillez vous reconnecter.'
        ))
      } else {
        setError(
          e instanceof Error
            ? e.message
            : ui(
                'Failed to load applications.',
                '지원 내역을 불러오지 못했습니다.',
                'No se pudieron cargar las aplicaciones.',
                'Échec du chargement des candidatures.'
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
        `¿Eliminar “${row.job_title || 'esta solicitud'}” de tu lista?`,
        `Supprimer “${row.job_title || 'cette candidature'}” de votre liste ?`
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
              'No se pudo eliminar.',
              'Échec de la suppression.'
            )
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppLayout
      pageLabel={ui('Applications', '지원현황', 'Solicitudes', 'Candidatures')}
      activeNav="applications"
    >
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">
              {ui('Applications', '지원현황', 'Solicitudes', 'Candidatures')}
            </div>
            <div className="ih-muted" style={{ marginTop: 8 }}>
              {ui(
                'Roles you marked as applied from the Jobs page.',
                'Jobs 페이지에서 추적한 지원 내역입니다.',
                'Puestos que marcaste como solicitados desde la página de empleos.',
                'Postes que vous avez marqués comme candidats depuis la page emplois.'
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
                  '직무명, 회사, 지역, 상태 검색…',
                  'Buscar puesto, empresa, ubicación, estado…',
                  'Rechercher poste, entreprise, lieu, statut…'
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={ui(
                  'Search applications',
                  '지원 내역 검색',
                  'Buscar solicitudes',
                  'Rechercher des candidatures'
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
                  '지원 상태 필터',
                  'Filtrar estado de la solicitud',
                  'Filtrer le statut des candidatures'
                )}
              >
                <option value="all">{ui('All statuses', '전체 상태', 'Todos los estados', 'Tous les statuts')}</option>
                <option value="saved">{ui('Saved jobs', '저장한 공고', 'Trabajos guardados', 'Offres enregistrées')}</option>
                <option value="applied">{ui('Applied', '지원 완료', 'Aplicado', 'Candidature envoyée')}</option>
                <option value="interview">{ui('Interviewing', '면접 진행', 'Entrevistando', 'Entretien en cours')}</option>
                <option value="offer">{ui('Offers', '오퍼', 'Ofertas', 'Offres')}</option>
                <option value="rejected">{ui('Rejected', '불합격', 'Rechazado', 'Refusé')}</option>
              </select>

              <button className="ih-btnGhost" type="button" disabled={loading} onClick={() => void refresh()}>
                {ui('Refresh', '새로고침', 'Actualizar', 'Actualiser')}
              </button>

              <Link className="ih-btnGhost" to="/jobs">
                {ui('Browse jobs', '채용공고 보기', 'Ver empleos', 'Parcourir les offres')}
              </Link>
            </div>

            {error && <p className="ih-error">{error}</p>}
            {loading && <div className="ih-muted">{ui('Loading…', '불러오는 중…', 'Cargando…', 'Chargement…')}</div>}

            {!loading && rows && rows.length === 0 && !error && (
              <div className="ih-muted">
                {ui(
                  'No tracked jobs yet. Open ',
                  '아직 추적 중인 공고가 없습니다. ',
                  'Aún no hay trabajos guardados. Abre ',
                  'Aucune candidature suivie pour le moment. Ouvrez '
                )}
                <Link to="/jobs">{ui('Jobs', 'Jobs', 'Empleos', 'Emplois')}</Link>
                {ui(
                  ', then save a role or click Apply and confirm with “Yes, Applied” when you return.',
                  '에서 공고를 저장하거나 지원 후 돌아와 “지원 완료”를 확인하세요.',
                  ', luego guarda un puesto o aplica y confirma con “Sí, aplicado”.',
                  ', puis enregistrez un poste ou postulez et confirmez avec « Oui ».'
                )}
              </div>
            )}

            {!loading && rows && filteredRows.length === 0 && (
              <div className="ih-muted">
                {ui(
                  `No matches for “${search}”.`,
                  `“${search}”와 일치하는 결과가 없습니다.`,
                  `No hay resultados para “${search}”.`,
                  `Aucun résultat pour “${search}”.`
                )}
              </div>
            )}

            {filteredRows.length > 0 && (
              <table className="ih-appTable">
                <thead>
                  <tr>
                    <th>{ui('Job title', '직무명', 'Puesto', 'Poste')}</th>
                    <th>{ui('Company', '회사', 'Empresa', 'Entreprise')}</th>
                    <th>{ui('Location', '지역', 'Ubicación', 'Lieu')}</th>
                    <th>{ui('Date applied', '지원일', 'Fecha', 'Date')}</th>
                    <th>{ui('Status', '상태', 'Estado', 'Statut')}</th>
                    <th>{ui('Link', '링크', 'Enlace', 'Lien')}</th>
                    <th>{ui('Manage', '관리', 'Gestionar', 'Gérer')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.application_id}>
                      <td>{row.job_title || '—'}</td>
                      <td>{row.job_company || '—'}</td>
                      <td>{row.job_location || '—'}</td>
                      <td>{formatAppliedDate(row.created_at || row.updated_at)}</td>
                      <td>{formatStatusLabel(row.status, language)}</td>
                      <td>
                        {row.job_url ? (
                          <a href={row.job_url} target="_blank" rel="noreferrer">
                            {ui('Open', '열기', 'Abrir', 'Ouvrir')}
                          </a>
                        ) : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          disabled={deletingId === row.application_id}
                          onClick={() => void handleDelete(row)}
                        >
                          {deletingId === row.application_id
                            ? ui('Removing…', '삭제 중…', 'Eliminando…', 'Suppression…')
                            : ui('Delete', '삭제', 'Eliminar', 'Supprimer')}
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