import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

import type { BootstrapInstrument } from '@/app/curveData'
import { useAppSelector } from '@/app/hooks'
import {
  selectActiveCurve,
  selectSelectedCurveData,
  selectSelectedCurveLatestBootstrapInstruments,
  selectSelectedCurveLatestObservationDate,
} from '@/app/curveSelectionSlice'

function formatRate(value: number | null) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : '—'
}

function formatText(value: string | null) {
  return value || '—'
}

function formatNumberValue(params: ValueFormatterParams<BootstrapInstrument, number | null>) {
  return formatRate(typeof params.value === 'number' ? params.value : null)
}

function formatTextValue(params: ValueFormatterParams<BootstrapInstrument, string | null>) {
  return formatText(typeof params.value === 'string' ? params.value : null)
}

function formatEnumLabel(value: string) {
  return value.replaceAll('_', ' ')
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
    sort: 'asc',
    minWidth: 96,
    maxWidth: 110,
  },
  {
    field: 'label',
    headerName: 'Instrument',
    minWidth: 220,
  },
  {
    field: 'instrumentType',
    headerName: 'Type',
    valueFormatter: (params) => formatEnumLabel(String(params.value ?? '')),
    minWidth: 130,
  },
  {
    field: 'quoteType',
    headerName: 'Quote Type',
    valueFormatter: (params) => formatEnumLabel(String(params.value ?? '')),
    minWidth: 170,
  },
  {
    field: 'quoteValue',
    headerName: 'Quote',
    valueFormatter: formatNumberValue,
    minWidth: 110,
    maxWidth: 120,
  },
  {
    field: 'discountRate',
    headerName: 'Discount',
    valueFormatter: formatNumberValue,
    minWidth: 120,
    maxWidth: 125,
  },
  {
    field: 'investmentYield',
    headerName: 'Yield',
    valueFormatter: formatNumberValue,
    minWidth: 120,
    maxWidth: 125,
  },
  {
    field: 'couponRate',
    headerName: 'Coupon',
    valueFormatter: formatNumberValue,
    minWidth: 120,
    maxWidth: 125,
  },
  {
    field: 'cleanPrice',
    headerName: 'Price Anchor',
    valueFormatter: formatNumberValue,
    minWidth: 130,
    maxWidth: 140,
  },
  {
    field: 'maturityDate',
    headerName: 'Maturity',
    valueFormatter: formatTextValue,
    minWidth: 135,
  },
  {
    field: 'securityId',
    headerName: 'CUSIP',
    valueFormatter: formatTextValue,
    minWidth: 130,
  },
  {
    field: 'dayCount',
    headerName: 'Day Count',
    valueFormatter: formatTextValue,
    minWidth: 120,
  },
  {
    field: 'sourceField',
    headerName: 'Source Field',
    minWidth: 200,
  },
]

function ActiveCurveGrid() {
  const activeCurve = useAppSelector(selectActiveCurve)
  const selectedCurveData = useAppSelector(selectSelectedCurveData)
  const latestObservationDate = useAppSelector(selectSelectedCurveLatestObservationDate)
  const bootstrapInstruments = useAppSelector(selectSelectedCurveLatestBootstrapInstruments)

  return (
    <section className="relative border border-primary/30 bg-card/95 p-4 text-card-foreground shadow-[0_18px_50px_-34px_rgba(243,144,0,0.55)] md:p-5">
      <div className="space-y-2">
        <div className="text-xs tracking-[0.22em] text-muted-foreground">ACTIVE CURVE SNAPSHOT</div>
        <div className="space-y-1">
          <h3 className="text-base tracking-[0.18em] text-primary">{activeCurve?.title ?? 'No active curve'}</h3>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Latest cached snapshot rendered as bootstrap-ready instruments so the grid shows the quote convention you can
            actually feed into a spot curve bootstrap.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-wide text-muted-foreground">
          <span className="border border-border px-2 py-1">Status: {selectedCurveData?.status ?? 'idle'}</span>
          <span className="border border-border px-2 py-1">Snapshot: {formatText(latestObservationDate)}</span>
          <span className="border border-border px-2 py-1">Rows: {bootstrapInstruments.length}</span>
          <span className="border border-border px-2 py-1">Market: {activeCurve?.market ?? '—'}</span>
        </div>
      </div>

      {selectedCurveData?.status === 'failed' ? (
        <div className="mt-4 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {selectedCurveData.error ?? 'Unable to load curve data.'}
        </div>
      ) : null}

      {selectedCurveData?.status === 'loading' && bootstrapInstruments.length === 0 ? (
        <div className="mt-4 border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          Loading curve data...
        </div>
      ) : null}

      {selectedCurveData?.status === 'succeeded' && bootstrapInstruments.length === 0 ? (
        <div className="mt-4 border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          No bootstrap instruments were produced for this curve source.
        </div>
      ) : null}

      {bootstrapInstruments.length > 0 ? (
        <div className="mt-4 border border-border bg-background/80 p-2">
          <div className="ag-theme-quartz-dark curve-grid h-[460px] w-full">
            <AgGridReact
              rowData={bootstrapInstruments}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows
              getRowId={(params) => params.data.id}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

export { ActiveCurveGrid }
