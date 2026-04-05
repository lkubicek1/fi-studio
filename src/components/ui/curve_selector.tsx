import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { cacheCurveData, selectActiveCurve, selectSelectedCurve, setSelectedCurve } from '@/app/curveSelectionSlice'
import { curveSources } from '@/services/api/curves.ts'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.tsx'

function CurveSelector() {
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
      <Select value={selectedCurve} onValueChange={(value) => dispatch(setSelectedCurve(value))}>
        <SelectTrigger
          aria-label="Select curve source"
          className="h-10 w-full px-3 text-left text-foreground"
        >
          <SelectValue placeholder="Choose a curve source" />
        </SelectTrigger>
        <SelectContent align="end" className="border-border">
          {curveSources.map((curve) => (
            <SelectItem
              key={curve.key}
              value={curve.key}
              disabled={curve.requiresExternalConfiguration}
            >
              {curve.requiresExternalConfiguration ? `${curve.title} (Needs external config)` : curve.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeCurve ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-wide text-muted-foreground">
          <span>{activeCurve.market}</span>
          <span className="text-border">/</span>
          <span>{activeCurve.kind.replaceAll('_', ' ')}</span>
        </div>
      ) : null}
    </div>
  )
}

export { CurveSelector }
