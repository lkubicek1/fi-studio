import { useState } from 'react'

import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

import type { BootstrapInstrument } from '@/app/curveData'
import { useAppSelector } from '@/app/hooks'
import {
  selectSelectedCurveData,
  selectSelectedCurveLatestBootstrapInstruments,
  selectSelectedCurveLatestQuoteDate,
} from '@/app/curveSelectionSlice'
import { cn } from '@/lib/utils'
import {
  buildTreasuryDerivedCurveNodes,
  buildTreasurySpotCurveNodes,
  type TreasuryDerivedCurveNode,
  type TreasuryInterpolationMethod,
  type TreasurySpotCurveNode,
} from '@/services/finance/treasury.ts'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.tsx'

function formatRate(value: number | null) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : '—'
}

function formatPrice(value: number | null) {
  return typeof value === 'number' ? value.toFixed(3) : '—'
}

function formatYearFraction(value: number | null) {
  return typeof value === 'number' ? value.toFixed(6) : '—'
}

function formatDiscountFactor(value: number | null) {
  return typeof value === 'number' ? value.toFixed(6) : '—'
}

function formatInteger(value: number | null) {
  return typeof value === 'number' ? Math.round(value).toString() : '—'
}

function formatText(value: string | null) {
  return value || '—'
}

function formatRateValue(params: ValueFormatterParams<BootstrapInstrument, number | null>) {
  return formatRate(typeof params.value === 'number' ? params.value : null)
}

function formatPriceValue(params: ValueFormatterParams<BootstrapInstrument, number | null>) {
  return formatPrice(typeof params.value === 'number' ? params.value : null)
}

function formatYearFractionValue(params: ValueFormatterParams<BootstrapInstrument, number | null>) {
  return formatYearFraction(typeof params.value === 'number' ? params.value : null)
}

function formatIntegerValue(params: ValueFormatterParams<BootstrapInstrument, number | null>) {
  return formatInteger(typeof params.value === 'number' ? params.value : null)
}

function formatTextValue(params: ValueFormatterParams<BootstrapInstrument, string | null>) {
  return formatText(typeof params.value === 'string' ? params.value : null)
}

function formatEnumLabel(value: string) {
  return value.replaceAll('_', ' ')
}

function formatCurveNodeType(value: string | null | undefined) {
  return value === 'anchor' ? 'Anchor' : value === 'interpolated' ? 'Interpolated' : '—'
}

function getCurveNodeTypeCellClass(value: string | null | undefined) {
  return cn(
    'derived-type-cell',
    value === 'anchor' ? 'derived-type-anchor' : undefined,
    value === 'interpolated' ? 'derived-type-interpolated' : undefined,
  )
}

function compareByTenor(left?: BootstrapInstrument, right?: BootstrapInstrument) {
  return (left?.tenor.months ?? Number.MAX_SAFE_INTEGER) - (right?.tenor.months ?? Number.MAX_SAFE_INTEGER)
}

const defaultColDef: ColDef<BootstrapInstrument> = {
  sortable: true,
  filter: true,
  resizable: true,
  minWidth: 120,
  suppressHeaderMenuButton: true,
}

const derivedGridColDef: ColDef<TreasuryDerivedCurveNode> = {
  sortable: false,
  filter: false,
  resizable: true,
  minWidth: 88,
  suppressHeaderMenuButton: true,
}

const spotGridColDef: ColDef<TreasurySpotCurveNode> = {
  sortable: false,
  filter: false,
  resizable: true,
  minWidth: 88,
  suppressHeaderMenuButton: true,
}

const columnDefs: ColDef<BootstrapInstrument>[] = [
  {
    headerName: 'Tenor',
    valueGetter: (params) => params.data?.tenor.label,
    comparator: (_left, _right, leftNode, rightNode) => compareByTenor(leftNode.data, rightNode.data),
    pinned: 'left',
    width: 78,
    minWidth: 72,
    },
  {
    field: 'label',
    headerName: 'Instrument',
    pinned: 'left',
    width: 170,
    minWidth: 155,
    },
  {
    field: 'securityId',
    headerName: 'CUSIP',
    valueFormatter: formatTextValue,
    width: 112,
    minWidth: 100,
  },
  {
    field: 'maturityDate',
    headerName: 'Maturity',
    valueFormatter: formatTextValue,
    width: 108,
    minWidth: 100,
    },
  {
    field: 'yearFractionToMaturity',
    headerName: 'YearFrac',
    valueFormatter: formatYearFractionValue,
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    width: 94,
    minWidth: 88,
    },
  {
    field: 'quoteType',
    headerName: 'Quote Type',
    valueFormatter: (params) => formatEnumLabel(String(params.value ?? '')),
    width: 120,
    minWidth: 108,
    },
  {
    field: 'quoteValue',
    headerName: 'Quote',
    valueFormatter: formatRateValue,
    width: 88,
    minWidth: 80,
    },
  {
    field: 'couponRate',
    headerName: 'Coupon',
    valueFormatter: formatRateValue,
    width: 86,
    minWidth: 80,
    },
  {
    field: 'cleanPrice',
    headerName: 'Clean Px',
    valueFormatter: formatPriceValue,
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    width: 92,
    minWidth: 86,
    },
  {
    field: 'currentYield',
    headerName: 'Current Yld',
    valueFormatter: formatRateValue,
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    width: 98,
    minWidth: 90,
    },
  {
    field: 'yieldToMaturity',
    headerName: 'YTM',
    valueFormatter: formatRateValue,
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    width: 84,
    minWidth: 78,
    },
  {
    field: 'dayCount',
    headerName: 'Day Ct',
    valueFormatter: formatTextValue,
    width: 88,
    minWidth: 82,
    },
  {
    field: 'couponFrequencyPerYear',
    headerName: 'Freq',
    valueFormatter: formatIntegerValue,
    width: 68,
    minWidth: 62,
    },
  {
    field: 'compounding',
    headerName: 'Comp',
    valueFormatter: (params) => formatEnumLabel(String(params.value ?? '')),
    width: 96,
    minWidth: 88,
    },
  {
    field: 'issueDate',
    headerName: 'Issue',
    valueFormatter: formatTextValue,
    width: 102,
    minWidth: 96,
    },
  {
    field: 'dirtyPrice',
    headerName: 'Dirty Px',
    valueFormatter: formatPriceValue,
    width: 92,
    minWidth: 86,
    },
  {
    field: 'accruedInterest',
    headerName: 'Accrued',
    valueFormatter: formatPriceValue,
    width: 92,
    minWidth: 86,
    },
  {
    field: 'discountRate',
    headerName: 'Discount',
    valueFormatter: formatRateValue,
    width: 90,
    minWidth: 82,
    },
  {
    field: 'investmentYield',
    headerName: 'Inv. Yield',
    valueFormatter: formatRateValue,
    width: 96,
    minWidth: 88,
    },
  {
    field: 'quoteDate',
    headerName: 'Quote Dt',
    valueFormatter: formatTextValue,
    width: 102,
    minWidth: 96,
  },
  {
    field: 'settlementDate',
    headerName: 'Settle',
    valueFormatter: formatTextValue,
    width: 102,
    minWidth: 96,
  },
  {
    field: 'daysToMaturity',
    headerName: 'Days',
    valueFormatter: formatIntegerValue,
    width: 82,
    minWidth: 76,
    },
  {
    field: 'bootstrapRole',
    headerName: 'Role',
    valueFormatter: (params) => formatEnumLabel(String(params.value ?? '')),
    width: 128,
    minWidth: 116,
    },
  {
    field: 'quoteOrigin',
    headerName: 'Quote Src',
    valueFormatter: (params) => formatEnumLabel(String(params.value ?? '')),
    width: 102,
    minWidth: 94,
    },
  {
    field: 'priceOrigin',
    headerName: 'Price Src',
    valueFormatter: (params) => formatEnumLabel(String(params.value ?? '')),
    width: 102,
    minWidth: 94,
    },
  {
    field: 'auctionHighPrice',
    headerName: 'Auction Px',
    valueFormatter: formatPriceValue,
    width: 96,
    minWidth: 88,
    },
  {
    field: 'auctionHighYield',
    headerName: 'Auction Yld',
    valueFormatter: formatRateValue,
    width: 102,
    minWidth: 94,
    },
  {
    field: 'previousCouponDate',
    headerName: 'Prev Cpn',
    valueFormatter: formatTextValue,
    width: 108,
    minWidth: 100,
    },
  {
    field: 'nextCouponDate',
    headerName: 'Next Cpn',
    valueFormatter: formatTextValue,
    width: 108,
    minWidth: 100,
    },
  {
    field: 'remainingCouponCount',
    headerName: 'Cpns Left',
    valueFormatter: formatIntegerValue,
    width: 92,
    minWidth: 84,
    },
  {
    field: 'sourceLabel',
    headerName: 'Source',
    valueFormatter: formatTextValue,
    minWidth: 220,
  },
  {
    field: 'sourceField',
    headerName: 'Source Field',
    minWidth: 180,
  },
  {
    field: 'pricingNotes',
    headerName: 'Pricing Notes',
    valueFormatter: formatTextValue,
    minWidth: 320,
  },
]

const derivedColumnDefs: ColDef<TreasuryDerivedCurveNode>[] = [
  {
    field: 'nodeType',
    headerName: 'Type',
    valueFormatter: (params) => formatCurveNodeType(typeof params.value === 'string' ? params.value : null),
    cellClass: (params) => getCurveNodeTypeCellClass(typeof params.value === 'string' ? params.value : null),
    width: 110,
    minWidth: 102,
    maxWidth: 120,
  },
  {
    field: 'tenorLabel',
    headerName: 'Tenor',
    flex: 0.7,
    minWidth: 76,
    maxWidth: 92,
  },
  {
    field: 'instrumentLabel',
    headerName: 'Instrument',
    valueFormatter: (params) => formatText(typeof params.value === 'string' ? params.value : null),
    flex: 1.7,
    minWidth: 150,
  },
  {
    field: 'yearFraction',
    headerName: 'YearFrac',
    valueFormatter: (params) => formatYearFraction(typeof params.value === 'number' ? params.value : null),
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    flex: 1,
    minWidth: 96,
  },
  {
    field: 'cleanPrice',
    headerName: 'Clean Px',
    valueFormatter: (params) => formatPrice(typeof params.value === 'number' ? params.value : null),
    flex: 0.9,
    minWidth: 92,
  },
  {
    field: 'discountFactor',
    headerName: 'DF',
    valueFormatter: (params) => formatDiscountFactor(typeof params.value === 'number' ? params.value : null),
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    flex: 0.9,
    minWidth: 98,
  },
]

const spotColumnDefs: ColDef<TreasurySpotCurveNode>[] = [
  {
    field: 'nodeType',
    headerName: 'Type',
    valueFormatter: (params) => formatCurveNodeType(typeof params.value === 'string' ? params.value : null),
    cellClass: (params) => getCurveNodeTypeCellClass(typeof params.value === 'string' ? params.value : null),
    width: 110,
    minWidth: 102,
    maxWidth: 120,
  },
  {
    field: 'tenorLabel',
    headerName: 'Tenor',
    flex: 0.7,
    minWidth: 76,
    maxWidth: 92,
  },
  {
    field: 'instrumentLabel',
    headerName: 'Instrument',
    valueFormatter: (params) => formatText(typeof params.value === 'string' ? params.value : null),
    flex: 1.7,
    minWidth: 150,
  },
  {
    field: 'yearFraction',
    headerName: 'YearFrac',
    valueFormatter: (params) => formatYearFraction(typeof params.value === 'number' ? params.value : null),
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    flex: 1,
    minWidth: 96,
  },
  {
    field: 'discountFactor',
    headerName: 'DF',
    valueFormatter: (params) => formatDiscountFactor(typeof params.value === 'number' ? params.value : null),
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    flex: 0.9,
    minWidth: 98,
  },
  {
    field: 'spotRate',
    headerName: 'Spot',
    valueFormatter: (params) => formatRate(typeof params.value === 'number' ? params.value : null),
    headerClass: 'bootstrap-focus-header',
    cellClass: 'bootstrap-focus-cell',
    flex: 0.9,
    minWidth: 94,
  },
]

type DerivedInterpolationStep = 1 | 3 | 6 | 12

const derivedInterpolationStepOptions: Array<{ value: DerivedInterpolationStep; label: string }> = [
  { value: 1, label: '1M' },
  { value: 3, label: '3M' },
  { value: 6, label: '6M' },
  { value: 12, label: '12M' },
]

const derivedInterpolationMethodOptions: Array<{ value: TreasuryInterpolationMethod; label: string }> = [
  { value: 'linear_discount_factor', label: 'Linear DF' },
  { value: 'log_linear_discount_factor', label: 'Log-Linear DF' },
]

const interpolationMethodHeading = 'METHOD'
const interpolationStepHeading = 'STEP'
const interpolationTargetLabel = 'Interpolation Target: Discount Factor'
const workspaceBadgeClassName = 'inline-flex h-8 items-center whitespace-nowrap border border-border bg-background px-2.5 text-xs tracking-wide text-muted-foreground'
const workspaceHeaderGridTemplateColumns = [
  `${Math.max(...derivedInterpolationMethodOptions.map((option) => option.label.length)) + 6}ch`,
  `${Math.max(...derivedInterpolationStepOptions.map((option) => option.label.length)) + 6}ch`,
  'max-content',
  'max-content',
  'max-content',
].join(' ')

type CurveWorkspaceTabKey = 'dataset' | 'derived' | 'spot'

type CurveWorkspaceTab = {
  key: CurveWorkspaceTabKey
  label: string
  indexLabel: string
}

const curveWorkspaceTabs: CurveWorkspaceTab[] = [
  { key: 'dataset', label: 'Underlying Dataset', indexLabel: '01' },
  { key: 'derived', label: 'Derived Layer', indexLabel: '02' },
  { key: 'spot', label: 'Spot Curve', indexLabel: '03' },
]

function formatAxisNumber(value: number) {
  if (Math.abs(value) >= 10) {
    return value.toFixed(1)
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(2)
  }

  return value.toFixed(3)
}

function formatAxisDiscountFactor(value: number) {
  return value.toFixed(4)
}

function formatAxisRate(value: number) {
  return `${formatAxisNumber(value)}%`
}

function createLinearTicks(min: number, max: number, count: number) {
  if (count <= 1 || min === max) {
    return [min]
  }

  const step = (max - min) / (count - 1)

  return Array.from({ length: count }, (_, index) => min + step * index)
}

function DerivedLayerChart({
  nodes,
  ariaLabel,
  showCurveLine = true,
  showInterpolatedLegend = true,
}: {
  nodes: TreasuryDerivedCurveNode[]
  ariaLabel: string
  showCurveLine?: boolean
  showInterpolatedLegend?: boolean
}) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No discount-factor nodes are available for the derived-layer chart.
      </div>
    )
  }

  const chartPoints = [...nodes].sort((left, right) => left.yearFraction - right.yearFraction)

  const width = 720
  const height = 560
  const padding = { top: 28, right: 24, bottom: 48, left: 68 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const yearFractions = chartPoints.map((point) => point.yearFraction)
  const discountFactors = chartPoints.map((point) => point.discountFactor)
  const minYearFraction = Math.min(...yearFractions)
  const maxYearFraction = Math.max(...yearFractions)
  const minDiscountFactor = Math.min(...discountFactors)
  const maxDiscountFactor = Math.max(...discountFactors)
  const xPadding = maxYearFraction === minYearFraction ? 0.25 : (maxYearFraction - minYearFraction) * 0.04
  const yPadding = maxDiscountFactor === minDiscountFactor ? 0.02 : (maxDiscountFactor - minDiscountFactor) * 0.08
  const xDomainMin = Math.max(0, minYearFraction - xPadding)
  const xDomainMax = maxYearFraction + xPadding
  const yDomainMin = Math.max(0, minDiscountFactor - yPadding)
  const yDomainMax = Math.min(1.05, maxDiscountFactor + yPadding)
  const xTicks = createLinearTicks(xDomainMin, xDomainMax, 5)
  const yTicks = createLinearTicks(yDomainMin, yDomainMax, 5)
  const linePath = chartPoints.map((point) => `${scaleX(point.yearFraction)},${scaleY(point.discountFactor)}`).join(' ')

  function scaleX(value: number) {
    return padding.left + ((value - xDomainMin) / (xDomainMax - xDomainMin)) * plotWidth
  }

  function scaleY(value: number) {
    return height - padding.bottom - ((value - yDomainMin) / (yDomainMax - yDomainMin)) * plotHeight
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
      <rect x="0" y="0" width={width} height={height} fill="var(--background)" opacity="0.35" />

      {yTicks.map((tick) => {
        const y = scaleY(tick)

        return (
          <g key={`y-${tick}`}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="4 6" opacity="0.9" />
            <text x={padding.left - 12} y={y + 4} fill="var(--muted-foreground)" fontSize="10" textAnchor="end">
              {formatAxisDiscountFactor(tick)}
            </text>
          </g>
        )
      })}

      {xTicks.map((tick) => {
        const x = scaleX(tick)

        return (
          <g key={`x-${tick}`}>
            <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="var(--border)" strokeDasharray="4 6" opacity="0.75" />
            <text x={x} y={height - 18} fill="var(--muted-foreground)" fontSize="10" textAnchor="middle">
              {formatAxisNumber(tick)}
            </text>
          </g>
        )
      })}

      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--muted-foreground)" opacity="0.9" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--muted-foreground)" opacity="0.9" />

      <g transform={`translate(${width - padding.right - 136}, ${padding.top + 6})`}>
        <rect x="0" y="0" width="136" height="42" fill="var(--background)" fillOpacity="0.72" stroke="var(--border)" />
        <circle cx="14" cy="14" r="4.5" fill="var(--primary)" stroke="var(--background)" strokeWidth="1.5" />
        <text x="26" y="18" fill="var(--card-foreground)" fontSize="10">
          Anchor Node
        </text>
        {showInterpolatedLegend ? (
          <>
            <circle cx="14" cy="30" r="3.25" fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth="1.3" />
            <text x="26" y="34" fill="var(--muted-foreground)" fontSize="10">
              Interpolated Node
            </text>
          </>
        ) : null}
      </g>

      {showCurveLine ? <polyline fill="none" points={linePath} stroke="var(--primary)" strokeOpacity="0.8" strokeWidth="2" /> : null}

      {chartPoints.map((point) => (
        <circle
          key={point.id}
          cx={scaleX(point.yearFraction)}
          cy={scaleY(point.discountFactor)}
          r={point.nodeType === 'anchor' ? 5 : 3.25}
          fill={point.nodeType === 'anchor' ? 'var(--primary)' : 'var(--background)'}
          stroke={point.nodeType === 'anchor' ? 'var(--background)' : 'var(--muted-foreground)'}
          strokeWidth={point.nodeType === 'anchor' ? 1.5 : 1.3}
        >
          <title>{`${point.nodeType === 'anchor' ? 'Anchor' : 'Interpolated'} | ${point.tenorLabel} | ${point.instrumentLabel ?? 'Synthetic node'} | YearFrac ${formatYearFraction(point.yearFraction)} | DF ${formatDiscountFactor(point.discountFactor)} | ${point.methodLabel}`}</title>
        </circle>
      ))}

      <text x={padding.left} y={16} fill="var(--muted-foreground)" fontSize="11" letterSpacing="0.18em">
        DISCOUNT FACTOR
      </text>
      <text x={width / 2 + padding.left} y={height} fill="var(--muted-foreground)" fontSize="11" letterSpacing="0.18em" textAnchor="end">
        YEARS TO MATURITY
      </text>
    </svg>
  )
}

function SpotCurveChart({
  nodes,
  ariaLabel,
  showCurveLine = true,
  showInterpolatedLegend = true,
}: {
  nodes: TreasurySpotCurveNode[]
  ariaLabel: string
  showCurveLine?: boolean
  showInterpolatedLegend?: boolean
}) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No spot-rate nodes are available for the spot-curve chart.
      </div>
    )
  }

  const chartPoints = [...nodes].sort((left, right) => left.yearFraction - right.yearFraction)

  const width = 720
  const height = 560
  const padding = { top: 28, right: 24, bottom: 48, left: 68 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const yearFractions = chartPoints.map((point) => point.yearFraction)
  const spotRates = chartPoints.map((point) => point.spotRate)
  const minYearFraction = Math.min(...yearFractions)
  const maxYearFraction = Math.max(...yearFractions)
  const minSpotRate = Math.min(...spotRates)
  const maxSpotRate = Math.max(...spotRates)
  const xPadding = maxYearFraction === minYearFraction ? 0.25 : (maxYearFraction - minYearFraction) * 0.04
  const yPadding = maxSpotRate === minSpotRate ? 0.25 : (maxSpotRate - minSpotRate) * 0.08
  const xDomainMin = Math.max(0, minYearFraction - xPadding)
  const xDomainMax = maxYearFraction + xPadding
  const yDomainMin = minSpotRate - yPadding
  const yDomainMax = maxSpotRate + yPadding
  const xTicks = createLinearTicks(xDomainMin, xDomainMax, 5)
  const yTicks = createLinearTicks(yDomainMin, yDomainMax, 5)
  const linePath = chartPoints.map((point) => `${scaleX(point.yearFraction)},${scaleY(point.spotRate)}`).join(' ')

  function scaleX(value: number) {
    return padding.left + ((value - xDomainMin) / (xDomainMax - xDomainMin)) * plotWidth
  }

  function scaleY(value: number) {
    return height - padding.bottom - ((value - yDomainMin) / (yDomainMax - yDomainMin)) * plotHeight
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
      <rect x="0" y="0" width={width} height={height} fill="var(--background)" opacity="0.35" />

      {yTicks.map((tick) => {
        const y = scaleY(tick)

        return (
          <g key={`y-${tick}`}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="4 6" opacity="0.9" />
            <text x={padding.left - 12} y={y + 4} fill="var(--muted-foreground)" fontSize="10" textAnchor="end">
              {formatAxisRate(tick)}
            </text>
          </g>
        )
      })}

      {xTicks.map((tick) => {
        const x = scaleX(tick)

        return (
          <g key={`x-${tick}`}>
            <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="var(--border)" strokeDasharray="4 6" opacity="0.75" />
            <text x={x} y={height - 18} fill="var(--muted-foreground)" fontSize="10" textAnchor="middle">
              {formatAxisNumber(tick)}
            </text>
          </g>
        )
      })}

      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--muted-foreground)" opacity="0.9" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--muted-foreground)" opacity="0.9" />

      <g transform={`translate(${width - padding.right - 136}, ${padding.top + 6})`}>
        <rect x="0" y="0" width="136" height="42" fill="var(--background)" fillOpacity="0.72" stroke="var(--border)" />
        <circle cx="14" cy="14" r="4.5" fill="var(--primary)" stroke="var(--background)" strokeWidth="1.5" />
        <text x="26" y="18" fill="var(--card-foreground)" fontSize="10">
          Anchor Node
        </text>
        {showInterpolatedLegend ? (
          <>
            <circle cx="14" cy="30" r="3.25" fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth="1.3" />
            <text x="26" y="34" fill="var(--muted-foreground)" fontSize="10">
              Interpolated Node
            </text>
          </>
        ) : null}
      </g>

      {showCurveLine ? <polyline fill="none" points={linePath} stroke="var(--primary)" strokeOpacity="0.8" strokeWidth="2" /> : null}

      {chartPoints.map((point) => (
        <circle
          key={point.id}
          cx={scaleX(point.yearFraction)}
          cy={scaleY(point.spotRate)}
          r={point.nodeType === 'anchor' ? 5 : 3.25}
          fill={point.nodeType === 'anchor' ? 'var(--primary)' : 'var(--background)'}
          stroke={point.nodeType === 'anchor' ? 'var(--background)' : 'var(--muted-foreground)'}
          strokeWidth={point.nodeType === 'anchor' ? 1.5 : 1.3}
        >
          <title>{`${point.nodeType === 'anchor' ? 'Anchor' : 'Interpolated'} | ${point.tenorLabel} | ${point.instrumentLabel ?? 'Synthetic node'} | YearFrac ${formatYearFraction(point.yearFraction)} | Spot ${formatRate(point.spotRate)} | ${point.methodLabel}`}</title>
        </circle>
      ))}

      <text x={padding.left} y={16} fill="var(--muted-foreground)" fontSize="11" letterSpacing="0.18em">
        SPOT RATE (%)
      </text>
      <text x={width / 2 + padding.left} y={height} fill="var(--muted-foreground)" fontSize="11" letterSpacing="0.18em" textAnchor="end">
        YEARS TO MATURITY
      </text>
    </svg>
  )
}

function DerivedLayerWorkspace({
  instruments,
  interpolationIntervalMonths,
  interpolationMethod,
  onInterpolationIntervalMonthsChange,
  onInterpolationMethodChange,
}: {
  instruments: BootstrapInstrument[]
  interpolationIntervalMonths: DerivedInterpolationStep
  interpolationMethod: TreasuryInterpolationMethod
  onInterpolationIntervalMonthsChange: (value: DerivedInterpolationStep) => void
  onInterpolationMethodChange: (value: TreasuryInterpolationMethod) => void
}) {
  const derivedNodes = buildTreasuryDerivedCurveNodes(instruments, {
    interpolationIntervalMonths,
    interpolationMethod,
  })
  const anchorCount = derivedNodes.filter((node) => node.nodeType === 'anchor').length
  const interpolatedCount = derivedNodes.length - anchorCount

  return (
    <div className="border border-border bg-background/80 p-2">
      <div className="mb-2 border border-border bg-card/55 p-3">
        <div className="overflow-x-auto">
          <div className="grid min-w-max gap-3" style={{ gridTemplateColumns: workspaceHeaderGridTemplateColumns }}>
            <div className="space-y-1">
              <div className="h-4 text-[10px] tracking-[0.18em] text-muted-foreground">{interpolationMethodHeading}</div>
              <Select value={interpolationMethod} onValueChange={(value) => onInterpolationMethodChange(value as TreasuryInterpolationMethod)}>
                <SelectTrigger className="w-full min-w-0 bg-background text-left text-foreground">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent align="start" position="popper" className="border-border">
                  {derivedInterpolationMethodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="h-4 text-[10px] tracking-[0.18em] text-muted-foreground">{interpolationStepHeading}</div>
              <Select value={String(interpolationIntervalMonths)} onValueChange={(value) => onInterpolationIntervalMonthsChange(Number(value) as DerivedInterpolationStep)}>
                <SelectTrigger className="w-full min-w-0 bg-background text-left text-foreground">
                  <SelectValue placeholder="Select step" />
                </SelectTrigger>
                <SelectContent align="start" position="popper" className="border-border">
                  {derivedInterpolationStepOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="h-4" aria-hidden="true" />
              <span className={workspaceBadgeClassName}>
                {interpolationTargetLabel}
              </span>
            </div>

            <div className="space-y-1">
              <div className="h-4" aria-hidden="true" />
              <span className={workspaceBadgeClassName}>
                Anchor Nodes: {anchorCount}
              </span>
            </div>

            <div className="space-y-1">
              <div className="h-4" aria-hidden="true" />
              <span className={workspaceBadgeClassName}>
                Interpolated Nodes: {interpolatedCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="ag-theme-quartz-dark curve-grid h-[560px] w-full">
          <AgGridReact<TreasuryDerivedCurveNode>
            rowData={derivedNodes}
            columnDefs={derivedColumnDefs}
            defaultColDef={derivedGridColDef}
            animateRows
            theme="legacy"
            getRowClass={(params) => (params.data?.nodeType === 'anchor' ? 'derived-anchor-row' : 'derived-interpolated-row')}
            getRowId={(params) => params.data.id}
          />
        </div>

        <div className="h-[560px] border border-border bg-background/65 p-3">
          <DerivedLayerChart
            nodes={derivedNodes}
            ariaLabel="Derived layer discount factor by year fraction chart"
          />
        </div>
      </div>
    </div>
  )
}

function SpotCurveWorkspace({
  instruments,
  interpolationIntervalMonths,
  interpolationMethod,
  onInterpolationIntervalMonthsChange,
  onInterpolationMethodChange,
}: {
  instruments: BootstrapInstrument[]
  interpolationIntervalMonths: DerivedInterpolationStep
  interpolationMethod: TreasuryInterpolationMethod
  onInterpolationIntervalMonthsChange: (value: DerivedInterpolationStep) => void
  onInterpolationMethodChange: (value: TreasuryInterpolationMethod) => void
}) {
  const spotNodes = buildTreasurySpotCurveNodes(instruments, {
    interpolationIntervalMonths,
    interpolationMethod,
  })
  const anchorCount = spotNodes.filter((node) => node.nodeType === 'anchor').length
  const interpolatedCount = spotNodes.length - anchorCount

  return (
    <div className="border border-border bg-background/80 p-2">
      <div className="mb-2 border border-border bg-card/55 p-3">
        <div className="overflow-x-auto">
          <div className="grid min-w-max gap-3" style={{ gridTemplateColumns: workspaceHeaderGridTemplateColumns }}>
            <div className="space-y-1">
              <div className="h-4 text-[10px] tracking-[0.18em] text-muted-foreground">{interpolationMethodHeading}</div>
              <Select value={interpolationMethod} onValueChange={(value) => onInterpolationMethodChange(value as TreasuryInterpolationMethod)}>
                <SelectTrigger className="w-full min-w-0 bg-background text-left text-foreground">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent align="start" position="popper" className="border-border">
                  {derivedInterpolationMethodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="h-4 text-[10px] tracking-[0.18em] text-muted-foreground">{interpolationStepHeading}</div>
              <Select value={String(interpolationIntervalMonths)} onValueChange={(value) => onInterpolationIntervalMonthsChange(Number(value) as DerivedInterpolationStep)}>
                <SelectTrigger className="w-full min-w-0 bg-background text-left text-foreground">
                  <SelectValue placeholder="Select step" />
                </SelectTrigger>
                <SelectContent align="start" position="popper" className="border-border">
                  {derivedInterpolationStepOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="h-4" aria-hidden="true" />
              <span className={workspaceBadgeClassName}>Rate Convention: Semiannual</span>
            </div>

            <div className="space-y-1">
              <div className="h-4" aria-hidden="true" />
              <span className={workspaceBadgeClassName}>Anchor Nodes: {anchorCount}</span>
            </div>

            <div className="space-y-1">
              <div className="h-4" aria-hidden="true" />
              <span className={workspaceBadgeClassName}>Interpolated Nodes: {interpolatedCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="ag-theme-quartz-dark curve-grid h-[560px] w-full">
          <AgGridReact<TreasurySpotCurveNode>
            rowData={spotNodes}
            columnDefs={spotColumnDefs}
            defaultColDef={spotGridColDef}
            animateRows
            theme="legacy"
            getRowClass={(params) => (params.data?.nodeType === 'anchor' ? 'derived-anchor-row' : 'derived-interpolated-row')}
            getRowId={(params) => params.data.id}
          />
        </div>

        <div className="h-[560px] border border-border bg-background/65 p-3">
          <SpotCurveChart
            nodes={spotNodes}
            ariaLabel="Treasury spot rate by year fraction chart"
          />
        </div>
      </div>
    </div>
  )
}

function DatasetLayerWorkspace({
  instruments,
  selectedCurveStatus,
  latestQuoteDate,
  marketQuoteCount,
  benchmarkQuoteCount,
}: {
  instruments: BootstrapInstrument[]
  selectedCurveStatus: string
  latestQuoteDate: string | null
  marketQuoteCount: number
  benchmarkQuoteCount: number
}) {
  return (
    <div className="border border-border bg-background/80 p-2">
      <div className="mb-2 border border-border bg-card/55 p-3">
        <div className="flex flex-wrap items-center gap-3 pt-5">
          <span className={workspaceBadgeClassName}>Status: {selectedCurveStatus}</span>
          <span className={workspaceBadgeClassName}>Dataset: UST</span>
          <span className={workspaceBadgeClassName}>Quote Date: {formatText(latestQuoteDate)}</span>
          <span className={workspaceBadgeClassName}>Settlement: T+1</span>
          <span className={workspaceBadgeClassName}>Bills: {marketQuoteCount}</span>
          <span className={workspaceBadgeClassName}>Coupon Nodes: {benchmarkQuoteCount}</span>
          <span className={workspaceBadgeClassName}>Total Bonds: {benchmarkQuoteCount + marketQuoteCount}</span>
        </div>
      </div>

      <div className="ag-theme-quartz-dark curve-grid h-[560px] w-full">
        <AgGridReact
          rowData={instruments}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          autoSizeStrategy={{ type: 'fitCellContents' }}
          animateRows
          onFirstDataRendered={(event) => event.api.autoSizeAllColumns()}
          theme="legacy"
          getRowId={(params) => params.data.id}
        />
      </div>
    </div>
  )
}

function ActiveCurveGrid() {
  const [activeTab, setActiveTab] = useState<CurveWorkspaceTabKey>('dataset')
  const [interpolationIntervalMonths, setInterpolationIntervalMonths] = useState<DerivedInterpolationStep>(6)
  const [interpolationMethod, setInterpolationMethod] = useState<TreasuryInterpolationMethod>('log_linear_discount_factor')
  const selectedCurveData = useAppSelector(selectSelectedCurveData)
  const bootstrapInstruments = useAppSelector(selectSelectedCurveLatestBootstrapInstruments)
  const latestQuoteDate = useAppSelector(selectSelectedCurveLatestQuoteDate)

  const marketQuoteCount = bootstrapInstruments.filter((instrument) => instrument.quoteOrigin === 'market').length
  const benchmarkQuoteCount = bootstrapInstruments.filter((instrument) => instrument.quoteOrigin === 'benchmark').length

  return (
    <section className="relative text-card-foreground">
      <div className="relative z-10 flex flex-wrap items-end gap-1 px-3 md:px-4">
        {curveWorkspaceTabs.map((tab) => {
          const isActive = tab.key === activeTab

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative min-w-38 border border-primary/30 border-b-0 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60',
                isActive
                  ? 'bg-card/95 text-card-foreground shadow-[0_-12px_26px_-20px_rgba(243,144,0,0.9)]'
                  : 'bg-background/82 text-muted-foreground hover:bg-card/80 hover:text-card-foreground',
              )}
              aria-pressed={isActive}
            >
              <div className="text-[9px] tracking-[0.24em] text-primary/80">{tab.indexLabel}</div>
              <div className="mt-1 text-[11px] tracking-[0.14em]">{tab.label}</div>
            </button>
          )
        })}
      </div>

      <div className="-mt-px border border-primary/30 bg-card/95 p-4 shadow-[0_18px_50px_-34px_rgba(243,144,0,0.55)] md:p-5">
        {activeTab === 'dataset' ? (
          <>
            {selectedCurveData?.status === 'failed' ? (
              <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                {selectedCurveData.error ?? 'Unable to load curve data.'}
              </div>
            ) : null}

            {selectedCurveData?.status === 'loading' && bootstrapInstruments.length === 0 ? (
              <div className="border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                Loading the public Treasury bootstrap dataset...
              </div>
            ) : null}

            {selectedCurveData?.status === 'succeeded' && bootstrapInstruments.length === 0 ? (
              <div className="border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                No bootstrap instruments were produced for this Treasury dataset.
              </div>
            ) : null}

            {bootstrapInstruments.length > 0 ? (
              <DatasetLayerWorkspace
                instruments={bootstrapInstruments}
                selectedCurveStatus={selectedCurveData?.status ?? 'idle'}
                latestQuoteDate={latestQuoteDate}
                marketQuoteCount={marketQuoteCount}
                benchmarkQuoteCount={benchmarkQuoteCount}
              />
            ) : null}
          </>
        ) : null}

        {activeTab === 'derived' ? (
          <>
            {selectedCurveData?.status === 'failed' ? (
              <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                {selectedCurveData.error ?? 'Unable to load curve data.'}
              </div>
            ) : null}

            {selectedCurveData?.status === 'loading' && bootstrapInstruments.length === 0 ? (
              <div className="border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                Loading the public Treasury bootstrap dataset...
              </div>
            ) : null}

            {selectedCurveData?.status === 'succeeded' && bootstrapInstruments.length === 0 ? (
              <div className="border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                No bootstrap instruments were produced for this Treasury dataset.
              </div>
            ) : null}

            {bootstrapInstruments.length > 0 ? (
              <DerivedLayerWorkspace
                instruments={bootstrapInstruments}
                interpolationIntervalMonths={interpolationIntervalMonths}
                interpolationMethod={interpolationMethod}
                onInterpolationIntervalMonthsChange={setInterpolationIntervalMonths}
                onInterpolationMethodChange={setInterpolationMethod}
              />
            ) : null}
          </>
        ) : null}

        {activeTab === 'spot' ? (
          <>
            {selectedCurveData?.status === 'failed' ? (
              <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                {selectedCurveData.error ?? 'Unable to load curve data.'}
              </div>
            ) : null}

            {selectedCurveData?.status === 'loading' && bootstrapInstruments.length === 0 ? (
              <div className="border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                Loading the public Treasury bootstrap dataset...
              </div>
            ) : null}

            {selectedCurveData?.status === 'succeeded' && bootstrapInstruments.length === 0 ? (
              <div className="border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                No bootstrap instruments were produced for this Treasury dataset.
              </div>
            ) : null}

            {bootstrapInstruments.length > 0 ? (
              <SpotCurveWorkspace
                instruments={bootstrapInstruments}
                interpolationIntervalMonths={interpolationIntervalMonths}
                interpolationMethod={interpolationMethod}
                onInterpolationIntervalMonthsChange={setInterpolationIntervalMonths}
                onInterpolationMethodChange={setInterpolationMethod}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}

export { ActiveCurveGrid }
