import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { cacheCurveData, selectActiveCurve, selectSelectedCurve, selectSelectedCurveData } from '@/app/curveSelectionSlice'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RefreshCwIcon } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.tsx'

function CurveSourceSummary() {
  const dispatch = useAppDispatch()
  const selectedCurve = useAppSelector(selectSelectedCurve)
  const activeCurve = useAppSelector(selectActiveCurve)
  const selectedCurveData = useAppSelector(selectSelectedCurveData)
  const isRefreshing = selectedCurveData?.status === 'loading'

  useEffect(() => {
    if (selectedCurve) {
      void dispatch(cacheCurveData({ curveKey: selectedCurve }))
    }
  }, [dispatch, selectedCurve])

  function handleRefresh() {
    if (!selectedCurve || isRefreshing) {
      return
    }

    void dispatch(cacheCurveData({ curveKey: selectedCurve, force: true }))
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="text-[10px] tracking-[0.18em] text-muted-foreground">PUBLIC DATASET</div>
        <div className="text-sm text-foreground">{activeCurve?.title ?? 'No active dataset'}</div>
      </div>

      {activeCurve?.sourceComponents?.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select>
            <SelectTrigger aria-label="Underlying sources" className="w-full min-w-0 flex-1 justify-between px-3 text-left text-foreground sm:min-w-[240px]">
              <SelectValue placeholder="Underlying Sources" />
            </SelectTrigger>
            <SelectContent align="end" position="popper" className="w-[420px] max-w-[calc(100vw-2rem)] border-border">
              {activeCurve.sourceComponents.map((component) => (
                <SelectItem key={component.key} value={component.key} disabled className="py-3 data-disabled:opacity-100">
                  <span className="flex max-w-[380px] flex-col gap-0.5 whitespace-normal leading-5">
                    <span className="text-foreground">{component.title}</span>
                    {component.note ? <span className="text-muted-foreground">{component.note}</span> : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            data-icon="inline-start"
            onClick={handleRefresh}
            disabled={!selectedCurve || isRefreshing}
          >
            <RefreshCwIcon className={cn('size-3.5', isRefreshing ? 'animate-spin' : undefined)} />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export { CurveSourceSummary }
