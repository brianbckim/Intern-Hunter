import { useEffect, useMemo, useState, type FormEvent } from 'react'
import AppLayout from '../components/AppLayout'
import { searchRecruiters, type RecruiterSearchRequest, type RecruiterSearchResponse } from '../lib/api'
import './Dashboard.css'

type FieldKey = 'name' | 'locality' | 'region' | 'country'

const fieldConfig: Array<{ key: FieldKey; label: string; placeholder: string }> = [
  { key: 'name', label: 'Name', placeholder: 'e.g. warfield talent' },
  { key: 'locality', label: 'Locality', placeholder: 'e.g. boston' },
  { key: 'region', label: 'Region', placeholder: 'e.g. massachusetts' },
  { key: 'country', label: 'Country', placeholder: 'e.g. united states' },
]

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

export default function Recruiters() {
  const [filters, setFilters] = useState<Record<FieldKey, string>>({
    name: '',
    locality: '',
    region: '',
    country: '',
  })
  const [enabledFields, setEnabledFields] = useState<Record<FieldKey, boolean>>({
    name: true,
    locality: true,
    region: true,
    country: true,
  })

  const [activeFilters, setActiveFilters] = useState<RecruiterSearchRequest | null>(null)
  const [data, setData] = useState<RecruiterSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const hasSearched = activeFilters !== null

  const activeFieldCount = useMemo(
    () => Object.values(enabledFields).filter(Boolean).length,
    [enabledFields]
  )

  function buildFilters(): RecruiterSearchRequest {
    const next: RecruiterSearchRequest = {}
    fieldConfig.forEach((field) => {
      if (!enabledFields[field.key]) return
      const value = filters[field.key].trim()
      if (value) {
        next[field.key] = value
      }
    })
    return next
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setActiveFilters(buildFilters())
  }

  function handleClear() {
    setFilters({ name: '', locality: '', region: '', country: '' })
    setEnabledFields({ name: true, locality: true, region: true, country: true })
    setActiveFilters(null)
    setData(null)
    setError(null)
    setPage(1)
  }

  function clampPage(nextPage: number, maxPages: number): number {
    const safeMax = Math.max(1, maxPages)
    if (nextPage < 1) return 1
    if (nextPage > safeMax) return safeMax
    return nextPage
  }

  useEffect(() => {
    if (!hasSearched || !activeFilters) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const payload: RecruiterSearchRequest = { ...activeFilters, page, limit }
    void searchRecruiters(payload)
      .then((response) => {
        if (cancelled) return
        setData(response)
      })
      .catch((errorValue) => {
        if (cancelled) return
        setError(errorValue instanceof Error ? errorValue.message : 'Failed to load recruiters.')
        setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeFilters, page, limit, hasSearched])

  useEffect(() => {
    if (!data) return
    const safePage = clampPage(page, data.pages)
    if (safePage !== page) {
      setPage(safePage)
    }
  }, [data, page])

  return (
    <AppLayout pageLabel="Recruiters" activeNav="recruiters">
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Recruiters Search</div>
            <div className="ih-muted">
              Search by name, locality, region, and country. Select multiple fields and combine filters.
            </div>
          </div>

          <div className="ih-cardBody">
            <form onSubmit={handleSubmit}>
              <div className="ih-formGrid" style={{ maxWidth: 880 }}>
                {fieldConfig.map((field) => (
                  <label key={field.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={enabledFields[field.key]}
                        onChange={(event) =>
                          setEnabledFields((prev) => ({ ...prev, [field.key]: event.target.checked }))
                        }
                      />
                      <span>Search by {field.label}</span>
                    </div>
                    <input
                      className="ih-input"
                      placeholder={field.placeholder}
                      value={filters[field.key]}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          [field.key]: event.target.value,
                        }))
                      }
                      disabled={!enabledFields[field.key]}
                    />
                  </label>
                ))}
              </div>

              {activeFieldCount === 0 ? (
                <div className="ih-muted" style={{ marginTop: 10 }}>
                  Select at least one field to search.
                </div>
              ) : null}

              <div className="ih-actions">
                <button className="ih-btnPrimary" type="submit" disabled={activeFieldCount === 0}>
                  Search
                </button>
                <button className="ih-btnGhost" type="button" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Results</div>
            <div className="ih-muted">
              {hasSearched ? `Total: ${data?.total ?? 0}` : 'Run a search to see recruiters.'}
            </div>
          </div>

          <div className="ih-cardBody">
            {loading ? <div className="ih-muted">Loading...</div> : null}
            {error ? <div className="ih-error">{error}</div> : null}

            {!loading && hasSearched && data && data.items.length === 0 ? (
              <div className="ih-muted">No recruiters matched your search.</div>
            ) : null}

            {!loading && data && data.items.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>Locality</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>Region</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>Country</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>LinkedIn</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item, index) => {
                      const linkedIn = normalizeUrl(item.linkedin_url)
                      const website = normalizeUrl(item.website)
                      return (
                        <tr key={`${item.name ?? 'recruiter'}-${index}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '10px 8px' }}>{item.name ?? 'N/A'}</td>
                          <td style={{ padding: '10px 8px' }}>{item.locality ?? 'N/A'}</td>
                          <td style={{ padding: '10px 8px' }}>{item.region ?? 'N/A'}</td>
                          <td style={{ padding: '10px 8px' }}>{item.country ?? 'N/A'}</td>
                          <td style={{ padding: '10px 8px' }}>
                            {linkedIn ? (
                              <a className="ih-btnGhost" href={linkedIn} target="_blank" rel="noreferrer">
                                View
                              </a>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            {website ? (
                              <a className="ih-btnGhost" href={website} target="_blank" rel="noreferrer">
                                Visit
                              </a>
                            ) : (
                              'N/A'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {hasSearched ? (
              <div style={{ marginTop: 16 }}>
                <div className="ih-row">
                  <div className="ih-muted">
                    Page {data?.page ?? page} of {data?.pages ?? 1}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      Rows per page
                      <select
                        className="ih-input"
                        style={{ width: 120 }}
                        value={limit}
                        onChange={(event) => {
                          setLimit(Number(event.target.value))
                          setPage(1)
                        }}
                      >
                        {[10, 20, 50, 100, 200].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="ih-row" style={{ marginTop: 10 }}>
                  <div className="ih-actions" style={{ marginTop: 0 }}>
                    <button
                      className="ih-btnGhost"
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((current) => clampPage(current - 1, data?.pages ?? 1))}
                    >
                      Previous
                    </button>
                    <button
                      className="ih-btnGhost"
                      type="button"
                      disabled={page >= (data?.pages ?? 1) || loading}
                      onClick={() => setPage((current) => clampPage(current + 1, data?.pages ?? 1))}
                    >
                      Next
                    </button>
                  </div>

                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    Go to page
                    <input
                      className="ih-input"
                      style={{ width: 120 }}
                      type="number"
                      min={1}
                      max={data?.pages ?? 1}
                      value={page}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        if (Number.isNaN(next)) return
                        setPage(clampPage(next, data?.pages ?? 1))
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
