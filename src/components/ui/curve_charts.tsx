import type { AgChartOptions, AgLineSeriesOptions, AgScatterSeriesOptions, DatumKey } from 'ag-charts-community'
import { AgCharts } from 'ag-charts-react'

import { useTheme } from '@/components/theme-provider'
import type { TreasuryForwardCurveNode } from '@/services/finance/treasury.ts'

type CurveChartBaseDatum = {
  id: string
  nodeType: 'anchor' | 'interpolated'
  tenorLabel: string
  instrumentLabel: string | null
  yearFraction: number
  methodLabel: string
}

type CurveChartColors = {
  isDark: boolean
  background: string
  card: string
  cardForeground: string
  mutedForeground: string
  border: string
  primary: string
  chart2: string
  fontFamily: string
}

type CurveChartDomain = { min: number; max: number }
type CurveChartTooltipRow = { label: string; value: string }
type CurveValueKind = 'discountFactor' | 'rate'

const formatRate = (value: number | null) => (typeof value === 'number' ? `${value.toFixed(2)}%` : '—')
const formatYearFraction = (value: number | null) => (typeof value === 'number' ? value.toFixed(6) : '—')
const formatDiscountFactor = (value: number | null) => (typeof value === 'number' ? value.toFixed(6) : '—')

function formatAxisNumber(value: number) {
  return Math.abs(value) >= 10 ? value.toFixed(1) : Math.abs(value) >= 1 ? value.toFixed(2) : value.toFixed(3)
}

const formatAxisDiscountFactor = (value: number) => value.toFixed(4)
const formatAxisRate = (value: number) => `${formatAxisNumber(value)}%`
const formatCurveValue = (kind: CurveValueKind, value: number) => (kind === 'discountFactor' ? formatDiscountFactor(value) : formatRate(value))
const formatCurveAxisValue = (kind: CurveValueKind, value: number) => (kind === 'discountFactor' ? formatAxisDiscountFactor(value) : formatAxisRate(value))
const getCssVariableValue = (styles: CSSStyleDeclaration, variableName: string, fallback: string) => styles.getPropertyValue(variableName).trim() || fallback

function useCurveChartColors(): CurveChartColors {
  const { theme } = useTheme()
  void theme

  if (typeof window === 'undefined') {
    return {
      isDark: true,
      background: '#000000',
      card: '#121212',
      cardForeground: '#f6f3e8',
      mutedForeground: '#909090',
      border: '#202020',
      primary: '#f39000',
      chart2: '#0b85df',
      fontFamily: 'JetBrains Mono Variable, monospace',
    }
  }

  const root = document.documentElement
  const styles = window.getComputedStyle(root)

  return {
    isDark: root.classList.contains('dark'),
    background: getCssVariableValue(styles, '--background', '#000000'),
    card: getCssVariableValue(styles, '--card', '#121212'),
    cardForeground: getCssVariableValue(styles, '--card-foreground', '#f6f3e8'),
    mutedForeground: getCssVariableValue(styles, '--muted-foreground', '#909090'),
    border: getCssVariableValue(styles, '--border', '#202020'),
    primary: getCssVariableValue(styles, '--primary', '#f39000'),
    chart2: getCssVariableValue(styles, '--chart-2', '#0b85df'),
    fontFamily: getCssVariableValue(styles, '--font-mono', 'JetBrains Mono Variable, monospace'),
  }
}

const sortCurveNodes = <T extends { yearFraction: number }>(nodes: T[]) => [...nodes].sort((left, right) => left.yearFraction - right.yearFraction)
const splitCurveNodesByType = <T extends CurveChartBaseDatum>(nodes: T[]) => ({ anchorPoints: nodes.filter((node) => node.nodeType === 'anchor'), interpolatedPoints: nodes.filter((node) => node.nodeType === 'interpolated') })

function getPaddedDomain(
  values: number[],
  { equalPadding, scalePadding, minClamp = Number.NEGATIVE_INFINITY, maxClamp = Number.POSITIVE_INFINITY }: { equalPadding: number; scalePadding: number; minClamp?: number; maxClamp?: number },
): CurveChartDomain {
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const padding = maxValue === minValue ? equalPadding : (maxValue - minValue) * scalePadding

  return {
    min: Math.max(minClamp, minValue - padding),
    max: Math.min(maxClamp, maxValue + padding),
  }
}

const formatCurveNodeHeading = (nodeType: CurveChartBaseDatum['nodeType']) => (nodeType === 'anchor' ? 'Anchor Node' : 'Interpolated Node')
const formatCurveTooltipTitle = (tenorLabel: string, instrumentLabel: string | null) => `${tenorLabel} | ${instrumentLabel ?? 'Synthetic node'}`
const createCurveTooltip = (heading: string, title: string, rows: CurveChartTooltipRow[]) => ({ heading, title, data: rows })

function createCurveLineSeries<TDatum extends CurveChartBaseDatum>({
  data,
  yKey,
  title,
  stroke,
  lineDash,
  showInLegend = false,
  tooltipRenderer,
}: {
  data: TDatum[]
  yKey: keyof TDatum & string
  title: string
  stroke: string
  lineDash?: number[]
  showInLegend?: boolean
  tooltipRenderer: (datum: TDatum) => ReturnType<typeof createCurveTooltip>
}): AgLineSeriesOptions<TDatum> {
  return {
    type: 'line',
    data,
    xKey: 'yearFraction' as DatumKey<TDatum>,
    yKey: yKey as unknown as DatumKey<TDatum>,
    title,
    showInLegend,
    stroke,
    strokeWidth: 2,
    lineDash,
    marker: { enabled: false },
    tooltip: { renderer: (params) => tooltipRenderer(params.datum) },
  }
}

function createCurveMarkerSeries<TDatum extends CurveChartBaseDatum>({
  data,
  yKey,
  title,
  fill,
  stroke,
  strokeWidth,
  size,
  tooltipRenderer,
}: {
  data: TDatum[]
  yKey: keyof TDatum & string
  title: string
  fill: string
  stroke: string
  strokeWidth: number
  size: number
  tooltipRenderer: (datum: TDatum) => ReturnType<typeof createCurveTooltip>
}): AgScatterSeriesOptions<TDatum> {
  return {
    type: 'scatter',
    data,
    xKey: 'yearFraction' as DatumKey<TDatum>,
    yKey: yKey as unknown as DatumKey<TDatum>,
    title,
    fill,
    stroke,
    strokeWidth,
    size,
    tooltip: { renderer: (params) => tooltipRenderer(params.datum) },
  }
}

function createCurveChartOptions<TDatum>({
  colors,
  title,
  xDomain,
  yDomain,
  yAxisFormatter,
  legendMaxWidth,
  series,
}: {
  colors: CurveChartColors
  title: string
  xDomain: CurveChartDomain
  yDomain: CurveChartDomain
  yAxisFormatter: (value: number) => string
  legendMaxWidth: number
  series: Array<AgLineSeriesOptions<TDatum> | AgScatterSeriesOptions<TDatum>>
}): AgChartOptions<TDatum> {
  return {
    theme: {
      baseTheme: colors.isDark ? 'ag-default-dark' : 'ag-default',
      palette: { fills: [colors.primary, colors.chart2, colors.cardForeground], strokes: [colors.primary, colors.chart2, colors.cardForeground] },
    },
    background: { visible: false },
    padding: { top: 12, right: 12, bottom: 8, left: 8 },
    seriesArea: { padding: { top: 8, right: 8, bottom: 4, left: 0 } },
    title: {
      enabled: true,
      text: title,
      textAlign: 'left',
      color: colors.mutedForeground,
      fontFamily: colors.fontFamily,
      fontSize: 11,
      spacing: 8,
    },
    footnote: {
      enabled: true,
      text: 'YEARS TO MATURITY',
      textAlign: 'right',
      color: colors.mutedForeground,
      fontFamily: colors.fontFamily,
      fontSize: 11,
      spacing: 0,
    },
    legend: {
      enabled: true,
      position: { placement: 'top-right', floating: true, xOffset: -12, yOffset: 12 },
      orientation: 'vertical',
      fill: colors.card,
      fillOpacity: 0.92,
      border: { stroke: colors.border, strokeWidth: 1 },
      padding: { top: 10, right: 12, bottom: 10, left: 12 },
      spacing: 0,
      toggleSeries: false,
      item: {
        maxWidth: legendMaxWidth,
        paddingX: 12,
        paddingY: 6,
        showSeriesStroke: true,
        marker: { size: 8, padding: 8, strokeWidth: 1.5 },
        line: { length: 12, strokeWidth: 2 },
        label: { color: colors.cardForeground, fontFamily: colors.fontFamily, fontSize: 10 },
      },
    },
    tooltip: { showArrow: true },
    axes: {
      x: {
        type: 'number',
        position: 'bottom',
        nice: false,
        min: xDomain.min,
        max: xDomain.max,
        label: { color: colors.mutedForeground, fontFamily: colors.fontFamily, fontSize: 10, formatter: (params) => formatAxisNumber(Number(params.value)) },
        line: { stroke: colors.mutedForeground, width: 1 },
        tick: { enabled: false },
        gridLine: { enabled: true, style: [{ stroke: colors.border, strokeWidth: 1, lineDash: [4, 6] }] },
      },
      y: {
        type: 'number',
        position: 'left',
        nice: false,
        min: yDomain.min,
        max: yDomain.max,
        label: { color: colors.mutedForeground, fontFamily: colors.fontFamily, fontSize: 10, formatter: (params) => yAxisFormatter(Number(params.value)) },
        line: { stroke: colors.mutedForeground, width: 1 },
        tick: { enabled: false },
        gridLine: { enabled: true, style: [{ stroke: colors.border, strokeWidth: 1, lineDash: [4, 6] }] },
      },
    },
    series,
  }
}

const CurveChart = ({ ariaLabel, options }: { ariaLabel: string; options: AgChartOptions }) => <div className="h-full w-full" role="img" aria-label={ariaLabel}><AgCharts options={options} className="h-full w-full" style={{ width: '100%', height: '100%' }} /></div>

function getForwardTooltipRows(point: TreasuryForwardCurveNode): CurveChartTooltipRow[] {
  return [{ label: 'YearFrac', value: formatYearFraction(point.yearFraction) }, { label: 'Spot', value: formatRate(point.spotRate) }, ...(point.forwardRate !== null ? [{ label: 'Forward', value: formatRate(point.forwardRate) }] : []), ...(point.forwardStartYearFraction !== null ? [{ label: 'From', value: formatYearFraction(point.forwardStartYearFraction) }] : []), ...(point.forwardIntervalYears !== null ? [{ label: 'dT', value: formatYearFraction(point.forwardIntervalYears) }] : []), { label: 'Method', value: point.methodLabel }]
}

export function CurveNodeChart<TDatum extends CurveChartBaseDatum>({
  nodes,
  ariaLabel,
  emptyMessage,
  title,
  seriesTitle,
  yKey,
  valueLabel,
  valueKind,
  yDomainOptions,
}: {
  nodes: TDatum[]
  ariaLabel: string
  emptyMessage: string
  title: string
  seriesTitle: string
  yKey: keyof TDatum & string
  valueLabel: string
  valueKind: CurveValueKind
  yDomainOptions: { equalPadding: number; scalePadding: number; minClamp?: number; maxClamp?: number }
}) {
  const colors = useCurveChartColors()

  if (nodes.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{emptyMessage}</div>
  }

  const chartPoints = sortCurveNodes(nodes)
  const { anchorPoints, interpolatedPoints } = splitCurveNodesByType(chartPoints)
  const xDomain = getPaddedDomain(chartPoints.map((point) => point.yearFraction), { equalPadding: 0.25, scalePadding: 0.04, minClamp: 0 })
  const yDomain = getPaddedDomain(chartPoints.map((point) => point[yKey] as number), yDomainOptions)
  const tooltipTitle = (point: TDatum) => formatCurveTooltipTitle(point.tenorLabel, point.instrumentLabel)
  const tooltipRows = (point: TDatum): CurveChartTooltipRow[] => [
    { label: 'YearFrac', value: formatYearFraction(point.yearFraction) },
    { label: valueLabel, value: formatCurveValue(valueKind, point[yKey] as number) },
    { label: 'Method', value: point.methodLabel },
  ]

  return (
    <CurveChart
      ariaLabel={ariaLabel}
      options={createCurveChartOptions<TDatum>({
        colors,
        title,
        xDomain,
        yDomain,
        yAxisFormatter: (value) => formatCurveAxisValue(valueKind, value),
        legendMaxWidth: 144,
        series: [
          createCurveLineSeries({
            data: chartPoints,
            yKey,
            title: seriesTitle,
            stroke: colors.primary,
            tooltipRenderer: (point) => createCurveTooltip(formatCurveNodeHeading(point.nodeType), tooltipTitle(point), tooltipRows(point)),
          }),
          createCurveMarkerSeries({
            data: anchorPoints,
            yKey,
            title: 'Anchor Node',
            fill: colors.primary,
            stroke: colors.background,
            strokeWidth: 1.5,
            size: 10,
            tooltipRenderer: (point) => createCurveTooltip(formatCurveNodeHeading(point.nodeType), tooltipTitle(point), tooltipRows(point)),
          }),
          createCurveMarkerSeries({
            data: interpolatedPoints,
            yKey,
            title: 'Interpolated Node',
            fill: colors.background,
            stroke: colors.mutedForeground,
            strokeWidth: 1.3,
            size: 7,
            tooltipRenderer: (point) => createCurveTooltip(formatCurveNodeHeading(point.nodeType), tooltipTitle(point), tooltipRows(point)),
          }),
        ],
      })}
    />
  )
}

export function ForwardCurveChart({ nodes, ariaLabel }: { nodes: TreasuryForwardCurveNode[]; ariaLabel: string }) {
  const colors = useCurveChartColors()
  const chartPoints = sortCurveNodes(nodes)
  const forwardPoints = chartPoints.filter((point) => point.forwardRate !== null)
  const forwardRates = forwardPoints.flatMap((point) => (point.forwardRate === null ? [] : [point.forwardRate]))

  if (chartPoints.length === 0 || forwardPoints.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No forward-rate nodes are available for the forward-rate chart.
      </div>
    )
  }

  const { anchorPoints, interpolatedPoints } = splitCurveNodesByType(forwardPoints)
  const xDomain = getPaddedDomain(chartPoints.map((point) => point.yearFraction), { equalPadding: 0.25, scalePadding: 0.04, minClamp: 0 })
  const yDomain = getPaddedDomain([...chartPoints.map((point) => point.spotRate), ...forwardRates], { equalPadding: 0.25, scalePadding: 0.08 })
  const tooltipTitle = (point: TreasuryForwardCurveNode) => formatCurveTooltipTitle(point.tenorLabel, point.instrumentLabel)

  return (
    <CurveChart
      ariaLabel={ariaLabel}
      options={createCurveChartOptions<TreasuryForwardCurveNode>({
        colors,
        title: 'SPOT / FORWARD RATE (%)',
        xDomain,
        yDomain,
        yAxisFormatter: formatAxisRate,
        legendMaxWidth: 184,
        series: [
          createCurveLineSeries({
            data: chartPoints,
            yKey: 'spotRate',
            title: 'Spot Curve',
            stroke: colors.chart2,
            lineDash: [6, 5],
            showInLegend: true,
            tooltipRenderer: (point) => createCurveTooltip('Spot Curve', tooltipTitle(point), getForwardTooltipRows(point)),
          }),
          createCurveLineSeries<TreasuryForwardCurveNode>({
            data: forwardPoints,
            yKey: 'forwardRate',
            title: 'Forward Curve',
            stroke: colors.primary,
            showInLegend: true,
            tooltipRenderer: (point) => createCurveTooltip('Forward Curve', tooltipTitle(point), getForwardTooltipRows(point)),
          }),
          createCurveMarkerSeries<TreasuryForwardCurveNode>({
            data: anchorPoints,
            yKey: 'forwardRate',
            title: 'Anchor Node',
            fill: colors.primary,
            stroke: colors.background,
            strokeWidth: 1.5,
            size: 10,
            tooltipRenderer: (point) => createCurveTooltip(formatCurveNodeHeading(point.nodeType), tooltipTitle(point), getForwardTooltipRows(point)),
          }),
          createCurveMarkerSeries<TreasuryForwardCurveNode>({
            data: interpolatedPoints,
            yKey: 'forwardRate',
            title: 'Interpolated Node',
            fill: colors.background,
            stroke: colors.primary,
            strokeWidth: 1.3,
            size: 7,
            tooltipRenderer: (point) => createCurveTooltip(formatCurveNodeHeading(point.nodeType), tooltipTitle(point), getForwardTooltipRows(point)),
          }),
        ],
      })}
    />
  )
}
