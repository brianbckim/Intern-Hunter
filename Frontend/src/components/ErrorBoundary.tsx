import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log error to console or remote reporting here
    console.error('Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h1>Something went wrong</h1>
          <pre style={{ color: '#6b7280' }}>{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: 8, borderRadius: 8 }}>
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
