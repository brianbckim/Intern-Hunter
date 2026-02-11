import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'

export default function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()

  let note = 'This page is not finished yet.'
  if (isRouteErrorResponse(error)) {
    note = `This page returned ${error.status} ${error.statusText}. It may not be finished yet.`
  } else if (error && typeof (error as Error).message === 'string') {
    note = (error as Error).message
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Not finished yet</h1>
      <p style={{ color: '#6b7280' }}>{note}</p>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '8px 12px', borderRadius: 8 }}
        >
          Go home
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 12px', borderRadius: 8 }}
        >
          Reload
        </button>
      </div>
    </div>
  )
}
