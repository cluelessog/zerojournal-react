import { Link } from 'react-router-dom'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SymbolPerformance } from '@/components/analysis/SymbolPerformance'
import { ChargesBreakdown } from '@/components/analysis/ChargesBreakdown'
import { OpenPositions } from '@/components/analysis/OpenPositions'
import { CrossReferenceView } from '@/components/analysis/CrossReferenceView'

export default function AnalysisPage() {
  const symbolPnL = usePortfolioStore((s) => s.symbolPnL)
  const pnlSummary = usePortfolioStore((s) => s.pnlSummary)
  const trades = usePortfolioStore((s) => s.trades)
  const isLoaded = usePortfolioStore((s) => s.isLoaded)

  if (!isLoaded || symbolPnL.length === 0 || !pnlSummary) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Analysis</h1>
        <EmptyState
          title="No data imported yet"
          description="Import data to see detailed analysis of your trades, charges, and open positions."
          action={
            <Button asChild>
              <Link to="/import">Go to Import</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analysis</h1>

      <Tabs defaultValue="performance">
        <TabsList className="mb-4 overflow-x-auto flex-shrink-0 flex-nowrap">
          <TabsTrigger value="performance" className="flex-shrink-0">Symbol Performance</TabsTrigger>
          <TabsTrigger value="charges" className="flex-shrink-0">Charges</TabsTrigger>
          <TabsTrigger value="open" className="flex-shrink-0">Open Positions</TabsTrigger>
          <TabsTrigger value="crossref" className="flex-shrink-0">Cross-Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <SymbolPerformance symbolPnL={symbolPnL} />
        </TabsContent>

        <TabsContent value="charges">
          <ChargesBreakdown pnlSummary={pnlSummary} />
        </TabsContent>

        <TabsContent value="open">
          <OpenPositions symbolPnL={symbolPnL} />
        </TabsContent>

        <TabsContent value="crossref">
          <CrossReferenceView
            trades={trades}
            symbolPnL={symbolPnL}
            pnlSummary={pnlSummary}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
