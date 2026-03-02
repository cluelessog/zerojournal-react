interface ChartSkeletonProps {
  height?: number
}

export function ChartSkeleton({ height = 300 }: ChartSkeletonProps) {
  return (
    <div
      className="w-full animate-pulse rounded-lg border bg-card"
      style={{ height: height + 80 }}
      aria-label="Loading chart..."
      role="status"
    >
      <div className="p-6">
        {/* Title placeholder */}
        <div className="h-4 w-32 rounded bg-muted mb-4" />
        {/* Chart area placeholder */}
        <div
          className="w-full rounded bg-muted"
          style={{ height }}
        />
      </div>
    </div>
  )
}
