import { Component, ErrorInfo } from 'react'

interface Props {
  children: React.ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Something Went Wrong</h1>
          <p className="text-gray-600 mb-4">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <div className="flex justify-center gap-4 mb-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            <button
              onClick={() => {
                this.handleReset()
                window.location.href = '/import'
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Reset Data
            </button>
          </div>
          {isDev && this.state.error && (
            <details className="mt-4 text-left max-w-xl mx-auto">
              <summary className="cursor-pointer text-sm text-gray-500">Error details (dev only)</summary>
              <pre className="mt-2 p-3 bg-red-50 text-red-800 text-xs rounded overflow-auto">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
