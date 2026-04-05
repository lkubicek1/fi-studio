import { Outlet, createRootRoute, Link } from '@tanstack/react-router'
import { Activity } from 'lucide-react'
import { MarketStatus } from '../components/ui/market_status.tsx'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="flex items-center justify-between mx-auto flex w-full max-w-7xl">
          <div className="flex items-center gap-6 px-4 py-3 text-sm">
            <div className="flex gap-3 pr-12 items-center">
              <Activity className="w-5 h-5 text-[#00ff41] animate-pulse" />
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
      <main className="mx-auto grid w-full max-w-7xl gap-4 p-4 md:grid-cols-[2fr_1fr]">
        <Outlet />
      </main>
    </div>
  )
}
