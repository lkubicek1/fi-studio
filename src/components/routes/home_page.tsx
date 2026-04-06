import { useAppSelector } from '@/app/hooks'
import { selectActiveCurve } from '@/app/curveSelectionSlice'
import { ActiveCurveGrid } from '@/components/ui/active_curve_grid'
import { CurveSelector } from '@/components/ui/curve_selector'

function HomePage() {
  const activeCurve = useAppSelector(selectActiveCurve)

  return (
    <div className="space-y-6">
      <section className="border border-primary/30 bg-card p-5 text-card-foreground md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="text-lg leading-none tracking-[0.28em] text-primary">CURVE ANALYSIS MODULE</h2>
              <div className="inline-flex items-center gap-1 text-[9px] leading-none tracking-[0.18em] text-muted-foreground">
                <div className="size-1.5 animate-pulse rounded-full bg-primary" />
                CONNECTED
              </div>
            </div>
            <p className="max-w-xl text-sm leading-5 text-muted-foreground">
              Select a curve source to inspect rates and benchmark data.
            </p>
            {activeCurve ? (
              <p className="max-w-xl text-sm leading-5 text-muted-foreground">Active Underyling Curve: {activeCurve.title}</p>
            ) : null}
          </div>

          <div className="w-full max-w-sm border border-border bg-background px-4 py-3">
            <div className="mb-1.5 text-xs tracking-[0.18em] text-muted-foreground">SELECT CURVE</div>
            <CurveSelector />
          </div>
        </div>
      </section>

      <div className="relative z-10 -mt-2">
        <ActiveCurveGrid />
      </div>
    </div>
  )
}

export { HomePage }
