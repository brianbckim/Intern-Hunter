import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'
import { useUiText } from '../lib/uiLanguage'

export default function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { ui } = useUiText()

  let note = ui('This page is not finished yet.', '이 페이지는 아직 완성되지 않았습니다.')
  if (isRouteErrorResponse(error)) {
    note = ui(`This page returned ${error.status} ${error.statusText}. It may not be finished yet.`, `이 페이지는 ${error.status} ${error.statusText}를 반환했습니다. 아직 완성되지 않았을 수 있습니다.`)
  } else if (error && typeof (error as Error).message === 'string') {
    note = (error as Error).message
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>{ui('Not finished yet', '아직 준비 중')}</h1>
      <p style={{ color: '#6b7280' }}>{note}</p>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '8px 12px', borderRadius: 8 }}
        >
          {ui('Go home', '홈으로 가기')}
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 12px', borderRadius: 8 }}
        >
          {ui('Reload', '새로고침')}
        </button>
      </div>
    </div>
  )
}
