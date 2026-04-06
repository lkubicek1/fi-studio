import { Link, Outlet } from '@tanstack/react-router'
import { Activity } from 'lucide-react'

import { MarketStatus } from '@/components/ui/market_status.tsx'

function RootLayout() {
  const navItemClassName =
    'inline-flex items-center justify-center border border-border/70 px-2.5 py-1 text-center text-[11px] tracking-[0.14em] uppercase md:border-0 md:px-0 md:py-0 md:text-sm md:tracking-normal md:normal-case'

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b-2 border-primary">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-0 md:px-0 md:py-0">
          <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:gap-6 md:px-4 md:py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:pr-12">
              <Activity className="h-5 w-5 animate-pulse text-[#00ff41]" />
              <h1 className="font-medium text-primary">FI Studio</h1>
              <div className="text-xs">v0.0.1</div>
            </div>
            <nav className="grid grid-cols-3 gap-2 text-muted-foreground md:flex md:items-center md:gap-3">
              <Link to="/" className={`${navItemClassName} bg-primary text-primary-foreground md:px-2 md:py-1`}>
                Curves
              </Link>
              <span className={navItemClassName}>Pricing</span>
              <span className={navItemClassName}>Risk</span>
            </nav>
          </div>
          <MarketStatus />
        </div>
      </header>
      <main className="container mx-auto max-w-7xl px-4 py-5 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}

export { RootLayout }
