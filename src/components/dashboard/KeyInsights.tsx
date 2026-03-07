import { useState } from 'react'
import { Lightbulb, AlertTriangle, TrendingUp, Info, ChevronDown, ChevronUp } from 'lucide-react'
import type { Insight, InsightSeverity } from '@/lib/types'

interface KeyInsightsProps {
  insights: Insight[]
  totalTrades: number
}

const MAX_VISIBLE = 5

const severityConfig: Record<InsightSeverity, { border: string; icon: typeof Info; iconColor: string; bg: string }> = {
  critical: {
    border: 'border-l-red-500',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
  },
  warning: {
    border: 'border-l-amber-500',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
  },
  positive: {
    border: 'border-l-green-500',
    icon: TrendingUp,
    iconColor: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950/20',
  },
  info: {
    border: 'border-l-blue-500',
    icon: Info,
    iconColor: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
  },
}

export function KeyInsights({ insights, totalTrades }: KeyInsightsProps) {
  const [expanded, setExpanded] = useState(false)

  if (totalTrades === 0) return null

  const visibleInsights = expanded ? insights : insights.slice(0, MAX_VISIBLE)
  const hasMore = insights.length > MAX_VISIBLE

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-5 text-amber-500" />
        <h3 className="text-lg font-semibold">Key Insights</h3>
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Not enough data for insights
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {visibleInsights.map((insight) => {
              const config = severityConfig[insight.severity]
              const Icon = config.icon
              return (
                <div
                  key={insight.id}
                  className={`rounded-lg border border-l-4 ${config.border} ${config.bg} p-3`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`mt-0.5 size-4 shrink-0 ${config.iconColor}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {insight.title}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                        {insight.description}
                      </div>
                      {insight.recommendation && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-500 italic">
                          {insight.recommendation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="size-3" />
                </>
              ) : (
                <>
                  Show all ({insights.length}) <ChevronDown className="size-3" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}
