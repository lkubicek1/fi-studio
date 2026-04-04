import { Outlet, createRootRoute, Link } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-4 py-3 text-sm">
          <h1 className="font-medium text-primary">FI Studio</h1>
          <nav className="flex items-center gap-3 text-muted-foreground">
            <Link to="/" className="bg-primary px-2 py-1 text-primary-foreground">
              Curves
            </Link>
            <span>Pricing</span>
            <span>Risk</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl gap-4 p-4 md:grid-cols-[2fr_1fr]">
        <Outlet />
      </main>
    </div>
  )
}
