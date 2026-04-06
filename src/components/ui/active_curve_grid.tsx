import { useState, type ReactNode } from 'react'

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

function formatRate(value: number | null) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : '—'
}

function formatPrice(value: number | null) {
  return typeof value === 'number' ? value.toFixed(3) : '—'
}

function formatYearFraction(value: number | null) {
  return typeof value === 'number' ? value.toFixed(6) : '—'
}

function formatInteger(value: number | null) {
  return typeof value === 'number' ? Math.round(value).toString() : '—'
}

function formatText(value: string | null) {
  return value || '—'
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return '—'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString()
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

type CurveWorkspaceTabKey = 'dataset' | 'derived' | 'spot' | 'chart'

type CurveWorkspaceTab = {
  key: CurveWorkspaceTabKey
  label: string
  indexLabel: string
}

const curveWorkspaceTabs: CurveWorkspaceTab[] = [
  { key: 'dataset', label: 'Underlying Dataset', indexLabel: '01' },
  { key: 'derived', label: 'Derived Layer', indexLabel: '02' },
  { key: 'spot', label: 'Spot Curve', indexLabel: '03' },
  { key: 'chart', label: 'Curve Chart', indexLabel: '04' },
]

type PlaceholderPanelProps = {
  badges: string[]
  eyebrow: string
  title: string
  description: string
  viewportLabel: string
  actions?: ReactNode
}

function PlaceholderPanel({ badges, eyebrow, title, description, viewportLabel, actions }: PlaceholderPanelProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] tracking-wide text-muted-foreground">
        {badges.map((badge) => (
          <span key={badge} className="border border-border px-2 py-1">
            {badge}
          </span>
        ))}
      </div>

      <div className="border border-border bg-background/80 p-2">
        <div className="grid gap-2 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border border-dashed border-primary/25 bg-card/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] tracking-[0.22em] text-primary">{eyebrow}</p>
                <h3 className="mt-3 text-sm tracking-[0.14em] text-card-foreground">{title}</h3>
              </div>

              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>

            <p className="mt-3 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
          </div>

          <div className="flex h-[560px] items-center justify-center border border-dashed border-border bg-background/65 p-6 text-center text-sm text-muted-foreground">
            {viewportLabel}
          </div>
        </div>
      </div>
    </>
  )
}

function ActiveCurveGrid() {
  const [activeTab, setActiveTab] = useState<CurveWorkspaceTabKey>('dataset')
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
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] tracking-wide text-muted-foreground">
              <span className="border border-border px-2 py-1">Status: {selectedCurveData?.status ?? 'idle'}</span>
              <span className="border border-border px-2 py-1">Quote Date: {formatText(latestQuoteDate)}</span>
              <span className="border border-border px-2 py-1">Settlement: T+1</span>
              <span className="border border-border px-2 py-1">Universe: On-the-run / benchmark</span>
              <span className="border border-border px-2 py-1">Rows: {bootstrapInstruments.length}</span>
              <span className="border border-border px-2 py-1">Bills: {marketQuoteCount}</span>
              <span className="border border-border px-2 py-1">Coupon Nodes: {benchmarkQuoteCount}</span>
            </div>

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
              <div className="border border-border bg-background/80 p-2">
                <div className="ag-theme-quartz-dark curve-grid h-[560px] w-full">
                  <AgGridReact
                    rowData={bootstrapInstruments}
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
            ) : null}
          </>
        ) : null}

        {activeTab === 'derived' ? (
          <PlaceholderPanel
            badges={['Controls: Placeholder', 'Tenor Interval: TBD', 'Interpolation: TBD', 'Derived Grid: Pending']}
            eyebrow="DERIVED LAYER"
            title="Interpolation workspace placeholder"
            description="This tab will host the control shelf above a live AG Grid showing the dense intermediary tenor layer used for curve construction."
            viewportLabel="Derived-tenor AG Grid placeholder"
          />
        ) : null}

        {activeTab === 'spot' ? (
          <PlaceholderPanel
            badges={['Bootstrap Engine: Placeholder', 'Input: Derived Layer', 'Rate Convention: TBD', 'Zero Nodes: Pending']}
            eyebrow="SPOT CURVE"
            title="Spot-rate output placeholder"
            description="This tab will surface the bootstrapped zero curve table once the derived discount-factor layer and curve-solving logic are in place."
            viewportLabel="Spot-curve AG Grid placeholder"
          />
        ) : null}

        {activeTab === 'chart' ? (
          <PlaceholderPanel
            badges={[
              `Underlying Data: ${selectedCurveData?.status ?? 'idle'}`,
              `Last Fetch: ${formatTimestamp(selectedCurveData?.fetchedAt ?? null)}`,
              'Library: AG Charts',
              'Series: Spot Curve',
            ]}
            eyebrow="CURVE CHART"
            title="Visualization placeholder"
            description="This tab will render the final spot curve visually, with room for later overlays such as par yields, forwards, or selected node markers."
            viewportLabel="AG Charts spot-curve placeholder"
          />
        ) : null}
      </div>
    </section>
  )
}

export { ActiveCurveGrid }
