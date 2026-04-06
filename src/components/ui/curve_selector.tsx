import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { cacheCurveData, selectActiveCurve, selectSelectedCurve } from '@/app/curveSelectionSlice'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.tsx'

function CurveSourceSummary() {
  const dispatch = useAppDispatch()
  const selectedCurve = useAppSelector(selectSelectedCurve)
  const activeCurve = useAppSelector(selectActiveCurve)

  useEffect(() => {
    if (selectedCurve) {
      void dispatch(cacheCurveData(selectedCurve))
    }
  }, [dispatch, selectedCurve])

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="text-[10px] tracking-[0.18em] text-muted-foreground">PUBLIC DATASET</div>
        <div className="text-sm text-foreground">{activeCurve?.title ?? 'No active dataset'}</div>
      </div>

      {activeCurve?.sourceComponents?.length ? (
        <Select>
          <SelectTrigger aria-label="Underlying sources" className="w-full justify-between px-3 text-left text-foreground">
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
      ) : null}
    </div>
  )
}

export { CurveSourceSummary }
