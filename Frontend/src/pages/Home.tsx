import { useEffect, useState } from 'react'

export default function Home() {
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
      <p>Backend status: {status}</p>
    </div>
  )
}
