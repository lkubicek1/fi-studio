import { useState } from 'react'

import { useAppSelector } from '@/app/hooks'
import {
  selectSelectedCurveData,
  selectSelectedCurveLatestBootstrapInstruments,
  selectSelectedCurveLatestQuoteDate,
} from '@/app/curveSelectionSlice'
import type { TreasuryForwardSmoothingMethod, TreasuryInterpolationMethod } from '@/services/finance/treasury.ts'

import { type CurveWorkspaceTabKey, type DerivedInterpolationStep } from './curve_workspace_config.ts'
import { CurveWorkspaceContent, CurveWorkspaceTabs } from './curve_workspaces.tsx'

function ActiveCurveGrid() {
  const [activeTab, setActiveTab] = useState<CurveWorkspaceTabKey>('dataset')
  const [interpolationIntervalMonths, setInterpolationIntervalMonths] = useState<DerivedInterpolationStep>(6)
  const [interpolationMethod, setInterpolationMethod] = useState<TreasuryInterpolationMethod>('log_linear_discount_factor')
  const [forwardSmoothingMethod, setForwardSmoothingMethod] = useState<TreasuryForwardSmoothingMethod>('monotone_convex')

  const selectedCurveData = useAppSelector(selectSelectedCurveData)
  const instruments = useAppSelector(selectSelectedCurveLatestBootstrapInstruments)
  const latestQuoteDate = useAppSelector(selectSelectedCurveLatestQuoteDate)
  const marketQuoteCount = instruments.filter((instrument) => instrument.quoteOrigin === 'market').length
  const benchmarkQuoteCount = instruments.filter((instrument) => instrument.quoteOrigin === 'benchmark').length

  return (
    <section className="relative text-card-foreground">
      <CurveWorkspaceTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <CurveWorkspaceContent
        activeTab={activeTab}
        selectedCurveData={selectedCurveData}
        instruments={instruments}
        latestQuoteDate={latestQuoteDate}
        marketQuoteCount={marketQuoteCount}
        benchmarkQuoteCount={benchmarkQuoteCount}
        interpolationIntervalMonths={interpolationIntervalMonths}
        interpolationMethod={interpolationMethod}
        forwardSmoothingMethod={forwardSmoothingMethod}
        onInterpolationIntervalMonthsChange={setInterpolationIntervalMonths}
        onInterpolationMethodChange={setInterpolationMethod}
        onForwardSmoothingMethodChange={setForwardSmoothingMethod}
      />
    </section>
  )
}

export { ActiveCurveGrid }
