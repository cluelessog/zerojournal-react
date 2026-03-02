import { Component, ErrorInfo } from 'react'

interface Props {
  children: React.ReactNode
  chartName?: string
}

interface State {
  hasError: boolean
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const name = this.props.chartName ?? 'unknown'
    console.error(`[ChartErrorBoundary] Chart "${name}" failed:`, error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex items-center justify-center h-full min-h-[200px] rounded-lg bg-gray-50 border border-gray-200"
          role="status"
          aria-label="Chart failed to load"
        >
          <p className="text-sm text-gray-500">Chart failed to load</p>
        </div>
      )
    }

    return this.props.children
  }
}
