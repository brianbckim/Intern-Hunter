import { useEffect, useState } from 'react'
import { useUiText } from '../lib/uiLanguage'

export default function Home() {
  const { ui } = useUiText()
  const [status, setStatus] = useState('loading...')

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div>
      <h1>Intern Hunter</h1>
      <p>{ui('Backend status', '백엔드 상태')}: {status === 'loading...' ? ui('loading...', '불러오는 중...') : status === 'error' ? ui('error', '오류') : status}</p>
    </div>
  )
}
