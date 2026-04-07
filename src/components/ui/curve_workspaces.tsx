import type { CSSProperties, ReactNode } from 'react'

import type { ColDef } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

import type { BootstrapInstrument } from '@/app/curveData'
import {
  buildTreasuryDerivedCurveNodes,
  buildTreasuryForwardCurveNodes,
  buildTreasurySpotCurveNodes,
  type TreasuryDerivedCurveNode,
  type TreasuryForwardSmoothingMethod,
  type TreasuryInterpolationMethod,
  type TreasurySpotCurveNode,
} from '@/services/finance/treasury.ts'

import { CurveNodeChart, ForwardCurveChart } from './curve_charts.tsx'
import {
  type CurveWorkspaceTabKey,
  type DerivedInterpolationStep,
  type SelectOption,
  curveWorkspaceTabs,
  datasetColumnDefs,
  datasetDefaultColDef,
  derivedColumnDefs,
  derivedGridColDef,
  derivedInterpolationMethodOptions,
  derivedInterpolationStepSelectOptions,
  formatText,
  forwardColumnDefs,
  forwardGridColDef,
  forwardRateConventionLabel,
  forwardSmoothingHeading,
  forwardSmoothingMethodOptions,
  forwardWorkspaceHeaderStyle,
  getCurveTabButtonClassName,
  interpolatedWorkspaceHeaderStyle,
  interpolationMethodHeading,
  interpolationStepHeading,
  interpolationTargetLabel,
  spotColumnDefs,
  spotGridColDef,
  spotRateConventionLabel,
  workspaceBadgeClassName,
  workspaceChartHeightClassName,
  workspaceGridHeightClassName,
  workspaceHeaderGridClassName,
} from './curve_workspace_config.ts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.tsx'

type CurveWorkspaceNode = { id: string; nodeType: 'anchor' | 'interpolated' }
type CurveWorkspaceStateData = { status: string; error: string | null } | null | undefined
type WorkspaceSelectControl = { label: string; value: string; placeholder: string; options: SelectOption[]; onValueChange: (value: string) => void }

type InterpolatedWorkspaceConfig<TNode extends CurveWorkspaceNode> = {
  buildNodes: (
    instruments: BootstrapInstrument[],
    options: { interpolationIntervalMonths?: number; interpolationMethod?: TreasuryInterpolationMethod },
  ) => TNode[]
  conventionBadge: string
  columnDefs: ColDef<TNode>[]
  defaultColDef: ColDef<TNode>
  renderChart: (nodes: TNode[]) => ReactNode
}

type SharedInterpolationWorkspaceProps = {
  instruments: BootstrapInstrument[]
  interpolationIntervalMonths: DerivedInterpolationStep
  interpolationMethod: TreasuryInterpolationMethod
  onInterpolationIntervalMonthsChange: (value: DerivedInterpolationStep) => void
  onInterpolationMethodChange: (value: TreasuryInterpolationMethod) => void
}

type CurveWorkspaceContentProps = SharedInterpolationWorkspaceProps & {
  activeTab: CurveWorkspaceTabKey
  selectedCurveData: CurveWorkspaceStateData
  latestQuoteDate: string | null
  marketQuoteCount: number
  benchmarkQuoteCount: number
  forwardSmoothingMethod: TreasuryForwardSmoothingMethod
  onForwardSmoothingMethodChange: (value: TreasuryForwardSmoothingMethod) => void
}

function WorkspaceSelectField({
  label,
  value,
  placeholder,
  options,
  onValueChange,
}: {
  label: string
  value: string
  placeholder: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <div className="h-4 text-[10px] tracking-[0.18em] text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full min-w-0 bg-background text-left text-foreground">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start" position="popper" className="border-border">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function WorkspaceBadge({ children }: { children: ReactNode }) {
  return <div className="space-y-1"><div className="h-4" aria-hidden="true" /><span className={workspaceBadgeClassName}>{children}</span></div>
}

function WorkspaceHeader({ controls, badges }: { controls: WorkspaceSelectControl[]; badges: ReactNode[] }) {
  return (
    <>
      {controls.map((control) => <WorkspaceSelectField key={control.label} {...control} />)}
      {badges.map((badge, index) => <WorkspaceBadge key={index}>{badge}</WorkspaceBadge>)}
    </>
  )
}

function createInterpolationControls({
  interpolationIntervalMonths,
  interpolationMethod,
  onInterpolationIntervalMonthsChange,
  onInterpolationMethodChange,
}: SharedInterpolationWorkspaceProps): WorkspaceSelectControl[] {
  return [
    { label: interpolationMethodHeading, value: interpolationMethod, placeholder: 'Select method', options: derivedInterpolationMethodOptions, onValueChange: (value) => onInterpolationMethodChange(value as TreasuryInterpolationMethod) },
    { label: interpolationStepHeading, value: String(interpolationIntervalMonths), placeholder: 'Select step', options: derivedInterpolationStepSelectOptions, onValueChange: (value) => onInterpolationIntervalMonthsChange(Number(value) as DerivedInterpolationStep) },
  ]
}

function CurveWorkspaceShell<TNode extends CurveWorkspaceNode>({
  headerStyle,
  controls,
  badges,
  rowData,
  columnDefs,
  defaultColDef,
  chart,
}: {
  headerStyle: CSSProperties
  controls: WorkspaceSelectControl[]
  badges: ReactNode[]
  rowData: TNode[]
  columnDefs: ColDef<TNode>[]
  defaultColDef: ColDef<TNode>
  chart: ReactNode
}) {
  return (
    <div className="border border-border bg-background/80 p-2">
      <div className="mb-2 border border-border bg-card/55 p-3">
        <div className="overflow-x-auto">
          <div className={workspaceHeaderGridClassName} style={headerStyle}>
            <WorkspaceHeader controls={controls} badges={badges} />
          </div>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className={`ag-theme-quartz-dark curve-grid w-full ${workspaceGridHeightClassName}`}>
          <AgGridReact<TNode>
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows
            theme="legacy"
            getRowClass={(params) => (params.data?.nodeType === 'anchor' ? 'derived-anchor-row' : 'derived-interpolated-row')}
            getRowId={(params) => params.data.id}
          />
        </div>

        <div className={`${workspaceChartHeightClassName} border border-border bg-background/65 p-3`}>{chart}</div>
      </div>
    </div>
  )
}

function InterpolatedCurveWorkspace<TNode extends CurveWorkspaceNode>({
  instruments,
  interpolationIntervalMonths,
  interpolationMethod,
  onInterpolationIntervalMonthsChange,
  onInterpolationMethodChange,
  config,
}: SharedInterpolationWorkspaceProps & { config: InterpolatedWorkspaceConfig<TNode> }) {
  const nodes = config.buildNodes(instruments, { interpolationIntervalMonths, interpolationMethod })
  const anchorCount = nodes.filter((node) => node.nodeType === 'anchor').length
  const controls = createInterpolationControls({ instruments, interpolationIntervalMonths, interpolationMethod, onInterpolationIntervalMonthsChange, onInterpolationMethodChange })

  return (
    <CurveWorkspaceShell
      headerStyle={interpolatedWorkspaceHeaderStyle}
      controls={controls}
      badges={[config.conventionBadge, `Anchor Nodes: ${anchorCount}`, `Interpolated Nodes: ${nodes.length - anchorCount}`]}
      rowData={nodes}
      columnDefs={config.columnDefs}
      defaultColDef={config.defaultColDef}
      chart={config.renderChart(nodes)}
    />
  )
}

function ForwardCurveWorkspace({
  instruments,
  interpolationIntervalMonths,
  interpolationMethod,
  smoothingMethod,
  onInterpolationIntervalMonthsChange,
  onInterpolationMethodChange,
  onSmoothingMethodChange,
}: SharedInterpolationWorkspaceProps & {
  smoothingMethod: TreasuryForwardSmoothingMethod
  onSmoothingMethodChange: (value: TreasuryForwardSmoothingMethod) => void
}) {
  const forwardNodes = buildTreasuryForwardCurveNodes(instruments, {
    interpolationIntervalMonths,
    interpolationMethod,
    smoothingMethod,
  })
  const controls = [
    ...createInterpolationControls({ instruments, interpolationIntervalMonths, interpolationMethod, onInterpolationIntervalMonthsChange, onInterpolationMethodChange }),
    { label: forwardSmoothingHeading, value: smoothingMethod, placeholder: 'Select smoothing', options: forwardSmoothingMethodOptions, onValueChange: (value: string) => onSmoothingMethodChange(value as TreasuryForwardSmoothingMethod) },
  ]

  return (
    <CurveWorkspaceShell
      headerStyle={forwardWorkspaceHeaderStyle}
      controls={controls}
      badges={[forwardRateConventionLabel, `Forward Rates: ${forwardNodes.filter((node) => node.forwardRate !== null).length}`]}
      rowData={forwardNodes}
      columnDefs={forwardColumnDefs}
      defaultColDef={forwardGridColDef}
      chart={<ForwardCurveChart nodes={forwardNodes} ariaLabel="Treasury forward and spot rate by year fraction chart" />}
    />
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
        <div className="flex flex-wrap items-center gap-3 pt-2 sm:pt-5">{[`Status: ${selectedCurveStatus}`, 'Dataset: UST', `Quote Date: ${formatText(latestQuoteDate)}`, 'Settlement: T+1', `Bills: ${marketQuoteCount}`, `Coupon Nodes: ${benchmarkQuoteCount}`, `Total Bonds: ${benchmarkQuoteCount + marketQuoteCount}`].map((badge) => <span key={badge} className={workspaceBadgeClassName}>{badge}</span>)}</div>
      </div>

      <div className={`ag-theme-quartz-dark curve-grid w-full ${workspaceGridHeightClassName}`}>
        <AgGridReact
          rowData={instruments}
          columnDefs={datasetColumnDefs}
          defaultColDef={datasetDefaultColDef}
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

function CurveWorkspaceState({ selectedCurveData, hasInstruments, children }: { selectedCurveData: CurveWorkspaceStateData; hasInstruments: boolean; children: ReactNode }) {
  if (selectedCurveData?.status === 'failed') {
    return <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">{selectedCurveData.error ?? 'Unable to load curve data.'}</div>
  }

  if (selectedCurveData?.status === 'loading' && !hasInstruments) {
    return <div className="border border-border bg-background px-4 py-3 text-sm text-muted-foreground">Loading the public Treasury bootstrap dataset...</div>
  }

  if (selectedCurveData?.status === 'succeeded' && !hasInstruments) {
    return <div className="border border-border bg-background px-4 py-3 text-sm text-muted-foreground">No bootstrap instruments were produced for this Treasury dataset.</div>
  }

  return hasInstruments ? children : null
}

const derivedWorkspaceConfig: InterpolatedWorkspaceConfig<TreasuryDerivedCurveNode> = {
  buildNodes: buildTreasuryDerivedCurveNodes,
  conventionBadge: interpolationTargetLabel,
  columnDefs: derivedColumnDefs,
  defaultColDef: derivedGridColDef,
  renderChart: (nodes) => (
    <CurveNodeChart<TreasuryDerivedCurveNode>
      nodes={nodes}
      ariaLabel="Derived layer discount factor by year fraction chart"
      emptyMessage="No discount-factor nodes are available for the derived-layer chart."
      title="DISCOUNT FACTOR"
      seriesTitle="Discount Factor"
      yKey="discountFactor"
      valueLabel="DF"
      valueKind="discountFactor"
      yDomainOptions={{ equalPadding: 0.02, scalePadding: 0.08, minClamp: 0, maxClamp: 1.05 }}
    />
  ),
}

const spotWorkspaceConfig: InterpolatedWorkspaceConfig<TreasurySpotCurveNode> = {
  buildNodes: buildTreasurySpotCurveNodes,
  conventionBadge: spotRateConventionLabel,
  columnDefs: spotColumnDefs,
  defaultColDef: spotGridColDef,
  renderChart: (nodes) => (
    <CurveNodeChart<TreasurySpotCurveNode>
      nodes={nodes}
      ariaLabel="Treasury spot rate by year fraction chart"
      emptyMessage="No spot-rate nodes are available for the spot-curve chart."
      title="SPOT RATE (%)"
      seriesTitle="Spot Rate"
      yKey="spotRate"
      valueLabel="Spot"
      valueKind="rate"
      yDomainOptions={{ equalPadding: 0.25, scalePadding: 0.08 }}
    />
  ),
}

export function CurveWorkspaceTabs({ activeTab, onTabChange }: { activeTab: CurveWorkspaceTabKey; onTabChange: (tab: CurveWorkspaceTabKey) => void }) {
  return (
    <div className="relative z-10 grid grid-cols-2 gap-1 px-2 sm:px-3 md:flex md:flex-wrap md:items-end md:px-4">
      {curveWorkspaceTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={getCurveTabButtonClassName(tab.key === activeTab)}
          aria-pressed={tab.key === activeTab}
        >
          <div className="text-[9px] tracking-[0.24em] text-primary/80">{tab.indexLabel}</div>
          <div className="mt-1 text-[11px] tracking-[0.14em]">{tab.label}</div>
        </button>
      ))}
    </div>
  )
}

export function CurveWorkspaceContent({
  activeTab,
  selectedCurveData,
  instruments,
  latestQuoteDate,
  marketQuoteCount,
  benchmarkQuoteCount,
  interpolationIntervalMonths,
  interpolationMethod,
  forwardSmoothingMethod,
  onInterpolationIntervalMonthsChange,
  onInterpolationMethodChange,
  onForwardSmoothingMethodChange,
}: CurveWorkspaceContentProps) {
  const hasInstruments = instruments.length > 0
  const sharedInterpolationProps = {
    instruments,
    interpolationIntervalMonths,
    interpolationMethod,
    onInterpolationIntervalMonthsChange,
    onInterpolationMethodChange,
  }

  const activeWorkspace =
    activeTab === 'dataset' ? (
      <DatasetLayerWorkspace
        instruments={instruments}
        selectedCurveStatus={selectedCurveData?.status ?? 'idle'}
        latestQuoteDate={latestQuoteDate}
        marketQuoteCount={marketQuoteCount}
        benchmarkQuoteCount={benchmarkQuoteCount}
      />
    ) : activeTab === 'derived' ? <InterpolatedCurveWorkspace {...sharedInterpolationProps} config={derivedWorkspaceConfig} />
      : activeTab === 'spot' ? <InterpolatedCurveWorkspace {...sharedInterpolationProps} config={spotWorkspaceConfig} />
      : <ForwardCurveWorkspace {...sharedInterpolationProps} smoothingMethod={forwardSmoothingMethod} onSmoothingMethodChange={onForwardSmoothingMethodChange} />

  return (
    <div className="border border-primary/30 bg-card/95 p-3 shadow-[0_18px_50px_-34px_rgba(243,144,0,0.55)] sm:p-4 md:-mt-px md:p-5">
      <CurveWorkspaceState selectedCurveData={selectedCurveData} hasInstruments={hasInstruments}>
        {activeWorkspace}
      </CurveWorkspaceState>
    </div>
  )
}
