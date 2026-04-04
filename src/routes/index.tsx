import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <>
        <section className="min-h-96 border bg-card p-4 text-sm text-muted-foreground">Workbench placeholder</section>
        <aside className="border border-dashed p-4 text-sm text-muted-foreground">Outputs placeholder</aside>
    </>
  )
}
