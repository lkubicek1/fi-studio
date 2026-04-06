import { Link, Outlet } from '@tanstack/react-router'
import { Activity } from 'lucide-react'

import { MarketStatus } from '@/components/ui/market_status.tsx'

function RootLayout() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b-2 border-primary">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="flex items-center gap-6 px-4 py-3 text-sm">
            <div className="flex items-center gap-3 pr-12">
              <Activity className="h-5 w-5 animate-pulse text-[#00ff41]" />
              <h1 className="font-medium text-primary">FI Studio</h1>
              <div className="text-xs">v0.0.1</div>
            </div>
            <nav className="flex items-center gap-3 text-muted-foreground">
              <Link to="/" className="bg-primary px-2 py-1 text-primary-foreground">
                Curves
              </Link>
              <span>Pricing</span>
              <span>Risk</span>
            </nav>
          </div>
          <MarketStatus />
        </div>
      </header>
      <main className="container mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  )
}

export { RootLayout }
