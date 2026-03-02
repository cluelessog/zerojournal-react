import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import DashboardPage from '@/pages/DashboardPage'
import TradesPage from '@/pages/TradesPage'
import AnalysisPage from '@/pages/AnalysisPage'
import ImportPage from '@/pages/ImportPage'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function App() {
  const isLoaded = usePortfolioStore((s) => s.isLoaded)
  const loadFromDB = usePortfolioStore((s) => s.loadFromDB)

  // Hydrate from IndexedDB on first mount
  useEffect(() => {
    loadFromDB()
  }, [loadFromDB])

  return (
    <ErrorBoundary>
      <AppShell>
        <Routes>
          <Route
            path="/"
            element={isLoaded ? <DashboardPage /> : <Navigate to="/import" replace />}
          />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </AppShell>
    </ErrorBoundary>
  )
}
