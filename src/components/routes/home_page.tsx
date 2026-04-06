import { ActiveCurveGrid } from '@/components/ui/active_curve_grid'
import { CurveSourceSummary } from '@/components/ui/curve_selector'

function HomePage() {
  return (
    <div className="space-y-6">
      <section className="border border-primary/30 bg-card p-4 text-card-foreground md:p-5">
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
              Public Treasury bootstrap inputs assembled from official sources. Bill rows use current
              benchmark bill quotes; coupon bond rows use active on-the-run issue metadata with benchmark-derived
              prices.
            </p>
          </div>

          <div className="w-full max-w-md border border-border bg-background px-4 py-3">
            <CurveSourceSummary />
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
