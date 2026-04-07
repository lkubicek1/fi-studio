import type { CSSProperties } from 'react'

import type { ColDef, ValueFormatterParams } from 'ag-grid-community'

import type { BootstrapInstrument } from '@/app/curveData'
import { cn } from '@/lib/utils'
import type {
  TreasuryDerivedCurveNode,
  TreasuryForwardCurveNode,
  TreasuryForwardSmoothingMethod,
  TreasuryInterpolationMethod,
  TreasurySpotCurveNode,
} from '@/services/finance/treasury.ts'

export type DerivedInterpolationStep = 1 | 3 | 6 | 12
export type CurveWorkspaceTabKey = 'dataset' | 'derived' | 'spot' | 'forward'
export type SelectOption<TValue extends string | number = string> = { value: TValue; label: string }

type CurveWorkspaceNode = { id: string; nodeType: 'anchor' | 'interpolated' }
type ColumnOptions<TRow> = Omit<ColDef<TRow>, 'field' | 'headerName'>
type DatasetColumnKind = 'text' | 'rate' | 'price' | 'yearFraction' | 'integer' | 'enum' | 'raw'
type DatasetColumnSpec = readonly [field: keyof BootstrapInstrument & string, headerName: string, kind: DatasetColumnKind, options?: ColumnOptions<BootstrapInstrument>]

function numberFormatter<TRow>(format: (value: number | null) => string) {
  return (params: ValueFormatterParams<TRow, number | null>) => format(typeof params.value === 'number' ? params.value : null)
}

function textFormatter<TRow>(format: (value: string | null) => string) {
  return (params: ValueFormatterParams<TRow, string | null>) => format(typeof params.value === 'string' ? params.value : null)
}

function column<TRow>(field: keyof TRow & string, headerName: string, options: ColumnOptions<TRow> = {}): ColDef<TRow> {
  return { field: field as never, headerName, ...options }
}

function textColumn<TRow>(field: keyof TRow & string, headerName: string, options: ColumnOptions<TRow> = {}) {
  return column(field, headerName, { ...options, valueFormatter: textFormatter(formatText) })
}

function numberColumn<TRow>(field: keyof TRow & string, headerName: string, format: (value: number | null) => string, options: ColumnOptions<TRow> = {}) {
  return column(field, headerName, { ...options, valueFormatter: numberFormatter(format) })
}

function enumColumn<TRow>(field: keyof TRow & string, headerName: string, options: ColumnOptions<TRow> = {}) {
  return column(field, headerName, {
    ...options,
    valueFormatter: (params) => formatEnumLabel(String(params.value ?? '')),
  })
}

function curveNodeTypeColumn<TRow extends CurveWorkspaceNode>(): ColDef<TRow> {
  return {
    field: 'nodeType' as never,
    headerName: 'Type',
    valueFormatter: (params) => formatCurveNodeType(typeof params.value === 'string' ? params.value : null),
    cellClass: (params) => getCurveNodeTypeCellClass(typeof params.value === 'string' ? params.value : null),
    width: 110,
    minWidth: 102,
    maxWidth: 120,
  }
}

function curveTenorColumn<TRow extends { tenorLabel: string }>(): ColDef<TRow> {
  return column('tenorLabel', 'Tenor', { flex: 0.7, minWidth: 76, maxWidth: 92 })
}

function curveInstrumentColumn<TRow extends { instrumentLabel: string | null }>(flex = 1.7): ColDef<TRow> {
  return column('instrumentLabel', 'Instrument', {
    flex,
    minWidth: 150,
    valueFormatter: textFormatter(formatText),
  })
}

function curveYearFractionColumn<TRow extends { yearFraction: number }>(): ColDef<TRow> {
  return numberColumn('yearFraction', 'YearFrac', formatYearFraction, { ...focusColumn, flex: 1, minWidth: 96 })
}

function curveDiscountFactorColumn<TRow extends { discountFactor: number }>(): ColDef<TRow> {
  return numberColumn('discountFactor', 'DF', formatDiscountFactor, { ...focusColumn, flex: 0.9, minWidth: 98 })
}

function createHeaderStyle(optionGroups: Array<Array<{ label: string }>>, badgeColumns: number): CSSProperties {
  return {
    '--workspace-header-columns': [
      ...optionGroups.map((options) => `${Math.max(...options.map((option) => option.label.length)) + 6}ch`),
      ...Array.from({ length: badgeColumns }, () => 'max-content'),
    ].join(' '),
  } as CSSProperties
}

function compareByTenor(left?: BootstrapInstrument, right?: BootstrapInstrument) {
  return (left?.tenor.months ?? Number.MAX_SAFE_INTEGER) - (right?.tenor.months ?? Number.MAX_SAFE_INTEGER)
}

function createDatasetColumn([field, headerName, kind, options = {}]: DatasetColumnSpec) {
  const columnFactory =
    kind === 'text'
      ? textColumn
      : kind === 'rate'
        ? (datasetField: keyof BootstrapInstrument & string, datasetHeader: string, datasetOptions?: ColumnOptions<BootstrapInstrument>) =>
            numberColumn(datasetField, datasetHeader, formatRate, datasetOptions)
        : kind === 'price'
          ? (datasetField: keyof BootstrapInstrument & string, datasetHeader: string, datasetOptions?: ColumnOptions<BootstrapInstrument>) =>
              numberColumn(datasetField, datasetHeader, formatPrice, datasetOptions)
          : kind === 'yearFraction'
            ? (datasetField: keyof BootstrapInstrument & string, datasetHeader: string, datasetOptions?: ColumnOptions<BootstrapInstrument>) =>
                numberColumn(datasetField, datasetHeader, formatYearFraction, datasetOptions)
            : kind === 'integer'
              ? (datasetField: keyof BootstrapInstrument & string, datasetHeader: string, datasetOptions?: ColumnOptions<BootstrapInstrument>) =>
                  numberColumn(datasetField, datasetHeader, formatInteger, datasetOptions)
              : kind === 'enum'
                ? enumColumn
                : column

  return columnFactory(field, headerName, options)
}

function createCurveColumns<
  TNode extends CurveWorkspaceNode & { tenorLabel: string; instrumentLabel: string | null; yearFraction: number }
>(
  instrumentFlex: number,
  extras: ColDef<TNode>[],
): ColDef<TNode>[] {
  return [
    curveNodeTypeColumn<TNode>(),
    curveTenorColumn<TNode>(),
    curveInstrumentColumn<TNode>(instrumentFlex),
    curveYearFractionColumn<TNode>(),
    ...extras,
  ]
}

export const formatRate = (value: number | null) => (typeof value === 'number' ? `${value.toFixed(2)}%` : '—')
export const formatPrice = (value: number | null) => (typeof value === 'number' ? value.toFixed(3) : '—')
export const formatYearFraction = (value: number | null) => (typeof value === 'number' ? value.toFixed(6) : '—')
export const formatDiscountFactor = (value: number | null) => (typeof value === 'number' ? value.toFixed(6) : '—')
export const formatInteger = (value: number | null) => (typeof value === 'number' ? Math.round(value).toString() : '—')
export const formatText = (value: string | null) => value || '—'
export const formatEnumLabel = (value: string) => value.replaceAll('_', ' ')
export const formatCurveNodeType = (value: string | null | undefined) => (value === 'anchor' ? 'Anchor' : value === 'interpolated' ? 'Interpolated' : '—')
export const getCurveNodeTypeCellClass = (value: string | null | undefined) =>
  cn('derived-type-cell', value === 'anchor' ? 'derived-type-anchor' : undefined, value === 'interpolated' ? 'derived-type-interpolated' : undefined)

export const datasetDefaultColDef: ColDef<BootstrapInstrument> = { sortable: true, filter: true, resizable: true, minWidth: 120, suppressHeaderMenuButton: true }
const curveGridColDef = { sortable: false, filter: false, resizable: true, minWidth: 88, suppressHeaderMenuButton: true }
const focusColumn = { headerClass: 'bootstrap-focus-header', cellClass: 'bootstrap-focus-cell' }

export const derivedGridColDef = curveGridColDef as ColDef<TreasuryDerivedCurveNode>
export const spotGridColDef = curveGridColDef as ColDef<TreasurySpotCurveNode>
export const forwardGridColDef = curveGridColDef as ColDef<TreasuryForwardCurveNode>

const datasetColumnSpecs: DatasetColumnSpec[] = [
  ['securityId', 'CUSIP', 'text', { width: 112, minWidth: 100 }],
  ['maturityDate', 'Maturity', 'text', { width: 108, minWidth: 100 }],
  ['yearFractionToMaturity', 'YearFrac', 'yearFraction', { ...focusColumn, width: 94, minWidth: 88 }],
  ['quoteType', 'Quote Type', 'enum', { width: 120, minWidth: 108 }],
  ['quoteValue', 'Quote', 'rate', { width: 88, minWidth: 80 }],
  ['couponRate', 'Coupon', 'rate', { width: 86, minWidth: 80 }],
  ['cleanPrice', 'Clean Px', 'price', { ...focusColumn, width: 92, minWidth: 86 }],
  ['currentYield', 'Current Yld', 'rate', { ...focusColumn, width: 98, minWidth: 90 }],
  ['yieldToMaturity', 'YTM', 'rate', { ...focusColumn, width: 84, minWidth: 78 }],
  ['dayCount', 'Day Ct', 'text', { width: 88, minWidth: 82 }],
  ['couponFrequencyPerYear', 'Freq', 'integer', { width: 68, minWidth: 62 }],
  ['compounding', 'Comp', 'enum', { width: 96, minWidth: 88 }],
  ['issueDate', 'Issue', 'text', { width: 102, minWidth: 96 }],
  ['dirtyPrice', 'Dirty Px', 'price', { width: 92, minWidth: 86 }],
  ['accruedInterest', 'Accrued', 'price', { width: 92, minWidth: 86 }],
  ['discountRate', 'Discount', 'rate', { width: 90, minWidth: 82 }],
  ['investmentYield', 'Inv. Yield', 'rate', { width: 96, minWidth: 88 }],
  ['quoteDate', 'Quote Dt', 'text', { width: 102, minWidth: 96 }],
  ['settlementDate', 'Settle', 'text', { width: 102, minWidth: 96 }],
  ['daysToMaturity', 'Days', 'integer', { width: 82, minWidth: 76 }],
  ['bootstrapRole', 'Role', 'enum', { width: 128, minWidth: 116 }],
  ['quoteOrigin', 'Quote Src', 'enum', { width: 102, minWidth: 94 }],
  ['priceOrigin', 'Price Src', 'enum', { width: 102, minWidth: 94 }],
  ['auctionHighPrice', 'Auction Px', 'price', { width: 96, minWidth: 88 }],
  ['auctionHighYield', 'Auction Yld', 'rate', { width: 102, minWidth: 94 }],
  ['previousCouponDate', 'Prev Cpn', 'text', { width: 108, minWidth: 100 }],
  ['nextCouponDate', 'Next Cpn', 'text', { width: 108, minWidth: 100 }],
  ['remainingCouponCount', 'Cpns Left', 'integer', { width: 92, minWidth: 84 }],
  ['sourceLabel', 'Source', 'text', { minWidth: 220 }],
  ['sourceField', 'Source Field', 'raw', { minWidth: 180 }],
  ['pricingNotes', 'Pricing Notes', 'text', { minWidth: 320 }],
]

export const datasetColumnDefs: ColDef<BootstrapInstrument>[] = [
  {
    headerName: 'Tenor',
    valueGetter: (params) => params.data?.tenor.label,
    comparator: (_left, _right, leftNode, rightNode) => compareByTenor(leftNode.data, rightNode.data),
    pinned: 'left',
    width: 78,
    minWidth: 72,
  },
  column('label', 'Instrument', { pinned: 'left', width: 170, minWidth: 155 }),
  ...datasetColumnSpecs.map(createDatasetColumn),
]

export const derivedColumnDefs: ColDef<TreasuryDerivedCurveNode>[] = createCurveColumns(1.7, [
  numberColumn('cleanPrice', 'Clean Px', formatPrice, { flex: 0.9, minWidth: 92 }),
  curveDiscountFactorColumn(),
])

export const spotColumnDefs: ColDef<TreasurySpotCurveNode>[] = createCurveColumns(1.7, [
  curveDiscountFactorColumn(),
  numberColumn('spotRate', 'Spot', formatRate, { ...focusColumn, flex: 0.9, minWidth: 94 }),
])

export const forwardColumnDefs: ColDef<TreasuryForwardCurveNode>[] = createCurveColumns(1.6, [
  numberColumn('discountFactor', 'DF', formatDiscountFactor, { flex: 0.9, minWidth: 98 }),
  numberColumn('spotRate', 'Spot', formatRate, { ...focusColumn, flex: 0.9, minWidth: 94 }),
  numberColumn('forwardRate', 'Forward', formatRate, { ...focusColumn, flex: 0.95, minWidth: 100 }),
  numberColumn('forwardStartYearFraction', 'Fwd From', formatYearFraction, { flex: 1, minWidth: 96 }),
  numberColumn('forwardIntervalYears', 'dT', formatYearFraction, { flex: 0.85, minWidth: 88 }),
])

export const derivedInterpolationStepOptions: SelectOption<DerivedInterpolationStep>[] = [{ value: 1, label: '1M' }, { value: 3, label: '3M' }, { value: 6, label: '6M' }, { value: 12, label: '12M' }]
export const derivedInterpolationStepSelectOptions: SelectOption[] = derivedInterpolationStepOptions.map((option) => ({ value: String(option.value), label: option.label }))
export const derivedInterpolationMethodOptions: SelectOption<TreasuryInterpolationMethod>[] = [{ value: 'linear_discount_factor', label: 'Linear DF' }, { value: 'log_linear_discount_factor', label: 'Log-Linear DF' }]
export const forwardSmoothingMethodOptions: SelectOption<TreasuryForwardSmoothingMethod>[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'monotone_convex', label: 'Monotone Convex' },
  { value: 'pchip_log_discount_factor', label: 'PCHIP Log DF' },
  { value: 'nelson_siegel_svensson', label: 'NSS' },
]

export const curveWorkspaceTabs = [
  { key: 'dataset', label: 'Underlying Dataset', indexLabel: '01' },
  { key: 'derived', label: 'Derived Layer', indexLabel: '02' },
  { key: 'spot', label: 'Spot Curve', indexLabel: '03' },
  { key: 'forward', label: 'Forward Rates', indexLabel: '04' },
] as const satisfies Array<{ key: CurveWorkspaceTabKey; label: string; indexLabel: string }>

export const interpolationMethodHeading = 'METHOD'
export const interpolationStepHeading = 'STEP'
export const forwardSmoothingHeading = 'SMOOTHING'
export const interpolationTargetLabel = 'Interpolation Target: Discount Factor'
export const spotRateConventionLabel = 'Spot Convention: Semiannual'
export const forwardRateConventionLabel = 'Forward Convention: Continuous'

export const workspaceBadgeClassName = 'inline-flex min-h-8 w-full items-center border border-border bg-background px-2.5 py-1 text-xs leading-4 tracking-wide text-muted-foreground whitespace-normal md:w-auto md:whitespace-nowrap'
export const workspaceHeaderGridClassName = 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:min-w-max md:[grid-template-columns:var(--workspace-header-columns)]'
export const workspaceGridHeightClassName = 'h-[420px] sm:h-[500px] lg:h-[560px]'
export const workspaceChartHeightClassName = 'h-[320px] sm:h-[420px] lg:h-[560px]'
export const interpolatedWorkspaceHeaderStyle = createHeaderStyle([derivedInterpolationMethodOptions, derivedInterpolationStepOptions], 3)
export const forwardWorkspaceHeaderStyle = createHeaderStyle([derivedInterpolationMethodOptions, derivedInterpolationStepOptions, forwardSmoothingMethodOptions], 2)

export function getCurveTabButtonClassName(isActive: boolean) {
  return cn(
    'relative min-h-[4.5rem] min-w-0 border border-primary/30 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 md:min-h-0 md:min-w-38 md:border-b-0',
    isActive
      ? 'bg-card/95 text-card-foreground shadow-[0_-12px_26px_-20px_rgba(243,144,0,0.9)]'
      : 'bg-background/82 text-muted-foreground hover:bg-card/80 hover:text-card-foreground',
  )
}
