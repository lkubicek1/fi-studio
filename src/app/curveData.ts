import type { CurveSource } from '@/services/api/curves.ts'

export type CurveFieldValue = string | number | boolean | null

export type CurveTenor = {
  label: string
  amount: number
  unit: 'weeks' | 'months' | 'years'
  months: number
}

export type CurvePoint = {
  label: string
  metric: string
  sourceField: string
  tenor: CurveTenor
  value: number
}

export type CurveObservation = {
  id: string | number | null
  entryId: string | null
  date: string | null
  fields: Record<string, CurveFieldValue>
  points: CurvePoint[]
}

export type CurveDocument = {
  sourceKey: string
  title: string | null
  feedId: string | null
  updatedAt: string | null
  observations: CurveObservation[]
}

export type BootstrapInstrumentType = 'coupon_bond' | 'bill'

export type BootstrapQuoteType =
  | 'par_yield'
  | 'real_par_yield'
  | 'bill_discount_rate'
  | 'bill_investment_yield'

export type BootstrapCompounding = 'simple' | 'semiannual'

export type BootstrapInstrument = {
  id: string
  label: string
  sourceKey: string
  sourceEntryId: string | null
  observationId: string | number | null
  observationDate: string | null
  instrumentType: BootstrapInstrumentType
  quoteType: BootstrapQuoteType
  quoteValue: number
  tenor: CurveTenor
  maturityDate: string | null
  couponRate: number | null
  couponFrequencyPerYear: number | null
  dayCount: 'ACT/ACT' | 'ACT/360' | null
  compounding: BootstrapCompounding | null
  cleanPrice: number | null
  settlementDays: number | null
  securityId: string | null
  sourceField: string
  discountRate: number | null
  investmentYield: number | null
}

type CurvePointDefinition = {
  metric: string
  metricLabel: string
  tenor: CurveTenor
}

type CurvePointMatcher = (fieldName: string) => CurvePointDefinition | null

const XML_METADATA_NAMESPACE = 'http://schemas.microsoft.com/ado/2007/08/dataservices/metadata'
const observationDateCandidates = ['NEW_DATE', 'INDEX_DATE', 'QUOTE_DATE']

function getDirectChildElements(parent: Element, localName: string) {
  return Array.from(parent.children).filter((child) => child.localName === localName)
}

function getFirstDirectChildElement(parent: Element, localName: string) {
  return getDirectChildElements(parent, localName)[0] ?? null
}

function getFirstDirectChildText(parent: Element, localName: string) {
  return getFirstDirectChildElement(parent, localName)?.textContent?.trim() || null
}

function getMetadataAttribute(element: Element, attributeName: string) {
  return element.getAttributeNS(XML_METADATA_NAMESPACE, attributeName) ?? element.getAttribute(`m:${attributeName}`)
}

function normalizeDateText(rawValue: string) {
  if (/^\d{4}-\d{2}-\d{2}T/.test(rawValue)) {
    return rawValue.slice(0, 10)
  }

  const slashDateMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (!slashDateMatch) {
    return rawValue
  }

  const [, month, day, year] = slashDateMatch

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseCurveFieldValue(property: Element): CurveFieldValue {
  if (getMetadataAttribute(property, 'null') === 'true') {
    return null
  }

  const rawValue = property.textContent?.trim() ?? ''

  if (!rawValue) {
    return null
  }

  const edmType = getMetadataAttribute(property, 'type')

  if (edmType === 'Edm.Boolean') {
    return rawValue.toLowerCase() === 'true'
  }

  if (edmType && /Edm\.(?:Byte|SByte|Int16|Int32|Int64|Decimal|Double|Single)/.test(edmType)) {
    const parsedNumber = Number(rawValue)

    return Number.isFinite(parsedNumber) ? parsedNumber : rawValue
  }

  if (edmType?.includes('DateTime') || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawValue)) {
    return normalizeDateText(rawValue)
  }

  return rawValue
}

function selectObservationId(fields: Record<string, CurveFieldValue>) {
  const exactId = fields.Id

  if (typeof exactId === 'string' || typeof exactId === 'number') {
    return exactId
  }

  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (/id$/i.test(fieldName) && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
      return fieldValue
    }
  }

  return null
}

function selectObservationDate(fields: Record<string, CurveFieldValue>) {
  for (const candidate of observationDateCandidates) {
    const fieldValue = fields[candidate]

    if (typeof fieldValue === 'string') {
      return fieldValue
    }
  }

  return null
}

function createWeeksTenor(weeks: number): CurveTenor {
  return {
    label: `${weeks}W`,
    amount: weeks,
    unit: 'weeks',
    months: Number(((weeks * 12) / 52).toFixed(6)),
  }
}

function createMonthsTenor(months: number): CurveTenor {
  return {
    label: `${months}M`,
    amount: months,
    unit: 'months',
    months,
  }
}

function createYearsTenor(years: number): CurveTenor {
  return {
    label: `${years}Y`,
    amount: years,
    unit: 'years',
    months: years * 12,
  }
}

function parseTreasuryCurveTenor(fieldSegment: string) {
  const monthMatch = fieldSegment.match(/^(\d+(?:_\d+)?)MONTH$/)

  if (monthMatch) {
    return createMonthsTenor(Number(monthMatch[1].replace('_', '.')))
  }

  const yearMatch = fieldSegment.match(/^(\d+)YEAR$/)

  if (yearMatch) {
    return createYearsTenor(Number(yearMatch[1]))
  }

  return null
}

function parseTreasuryBillTenor(fieldSegment: string) {
  const weekMatch = fieldSegment.match(/^(\d+)WK$/)

  if (!weekMatch) {
    return null
  }

  return createWeeksTenor(Number(weekMatch[1]))
}

function createTreasuryCurveMatcher(metric: string, metricLabel: string): CurvePointMatcher {
  return (fieldName) => {
    const fieldMatch = fieldName.match(/^BC_(.+)$/)

    if (!fieldMatch || fieldMatch[1] === '30YEARDISPLAY') {
      return null
    }

    const tenor = parseTreasuryCurveTenor(fieldMatch[1])

    if (!tenor) {
      return null
    }

    return {
      metric,
      metricLabel,
      tenor,
    }
  }
}

function createTreasuryBillMatcher(): CurvePointMatcher {
  return (fieldName) => {
    const quotedRateMatch = fieldName.match(/^ROUND_B1_(CLOSE|YIELD)_(\d+WK)_2$/)

    if (quotedRateMatch) {
      const tenor = parseTreasuryBillTenor(quotedRateMatch[2])

      if (!tenor) {
        return null
      }

      return {
        metric: quotedRateMatch[1] === 'CLOSE' ? 'close' : 'yield',
        metricLabel: quotedRateMatch[1] === 'CLOSE' ? 'Close' : 'Yield',
        tenor,
      }
    }

    const averageRateMatch = fieldName.match(/^CS_(\d+WK)_(CLOSE|YIELD)_AVG$/)

    if (!averageRateMatch) {
      return null
    }

    const tenor = parseTreasuryBillTenor(averageRateMatch[1])

    if (!tenor) {
      return null
    }

    return {
      metric: averageRateMatch[2] === 'CLOSE' ? 'average_close' : 'average_yield',
      metricLabel: averageRateMatch[2] === 'CLOSE' ? 'Average Close' : 'Average Yield',
      tenor,
    }
  }
}

function getCurvePointMatcher(curve: CurveSource): CurvePointMatcher {
  switch (curve.key) {
    case 'ust_par_nominal':
      return createTreasuryCurveMatcher('par_yield', 'Par Yield')
    case 'ust_real_par':
      return createTreasuryCurveMatcher('real_yield', 'Real Yield')
    case 'ust_bill_rates':
      return createTreasuryBillMatcher()
    default:
      return () => null
  }
}

function buildCurvePoints(fields: Record<string, CurveFieldValue>, matchCurvePoint: CurvePointMatcher) {
  const points: CurvePoint[] = []

  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (typeof fieldValue !== 'number') {
      continue
    }

    const pointDefinition = matchCurvePoint(fieldName)

    if (!pointDefinition) {
      continue
    }

    points.push({
      label: `${pointDefinition.tenor.label} ${pointDefinition.metricLabel}`,
      metric: pointDefinition.metric,
      sourceField: fieldName,
      tenor: pointDefinition.tenor,
      value: fieldValue,
    })
  }

  return points.sort((left, right) => {
    const tenorDifference = left.tenor.months - right.tenor.months

    if (tenorDifference !== 0) {
      return tenorDifference
    }

    return left.label.localeCompare(right.label)
  })
}

function parseCurveObservation(entry: Element, matchCurvePoint: CurvePointMatcher): CurveObservation {
  const content = getFirstDirectChildElement(entry, 'content')
  const properties = content ? getFirstDirectChildElement(content, 'properties') : null
  const fields: Record<string, CurveFieldValue> = {}

  for (const property of properties ? Array.from(properties.children) : []) {
    fields[property.localName] = parseCurveFieldValue(property)
  }

  return {
    id: selectObservationId(fields),
    entryId: getFirstDirectChildText(entry, 'id'),
    date: selectObservationDate(fields),
    fields,
    points: buildCurvePoints(fields, matchCurvePoint),
  }
}

function getNumericField(fields: Record<string, CurveFieldValue>, fieldName: string) {
  const fieldValue = fields[fieldName]

  return typeof fieldValue === 'number' ? fieldValue : null
}

function getStringField(fields: Record<string, CurveFieldValue>, fieldName: string) {
  const fieldValue = fields[fieldName]

  return typeof fieldValue === 'string' ? fieldValue : null
}

function createBootstrapInstrumentId(...parts: Array<string | number | null>) {
  return parts.filter((part) => part !== null && part !== '').join(':')
}

function sortBootstrapInstruments(instruments: BootstrapInstrument[]) {
  return instruments.sort((left, right) => {
    const leftDate = left.observationDate ?? ''
    const rightDate = right.observationDate ?? ''

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate)
    }

    const tenorDifference = left.tenor.months - right.tenor.months

    if (tenorDifference !== 0) {
      return tenorDifference
    }

    return left.label.localeCompare(right.label)
  })
}

function createParCurveBootstrapInstruments(
  curve: CurveSource,
  document: CurveDocument,
  quoteType: Extract<BootstrapQuoteType, 'par_yield' | 'real_par_yield'>,
  pointMetric: CurvePoint['metric'],
) {
  const instruments: BootstrapInstrument[] = []

  for (const observation of document.observations) {
    for (const point of observation.points) {
      if (point.metric !== pointMetric) {
        continue
      }

      instruments.push({
        id: createBootstrapInstrumentId(curve.key, observation.date, point.sourceField),
        label: `${point.tenor.label} ${curve.title}`,
        sourceKey: curve.key,
        sourceEntryId: observation.entryId,
        observationId: observation.id,
        observationDate: observation.date,
        instrumentType: 'coupon_bond',
        quoteType,
        quoteValue: point.value,
        tenor: point.tenor,
        maturityDate: null,
        couponRate: point.value,
        couponFrequencyPerYear: 2,
        dayCount: 'ACT/ACT',
        compounding: 'semiannual',
        cleanPrice: 100,
        settlementDays: 1,
        securityId: null,
        sourceField: point.sourceField,
        discountRate: null,
        investmentYield: null,
      })
    }
  }

  return sortBootstrapInstruments(instruments)
}

function createTreasuryBillBootstrapInstruments(curve: CurveSource, document: CurveDocument) {
  const instruments: BootstrapInstrument[] = []

  for (const observation of document.observations) {
    const tenorSegments = new Set<string>()

    for (const fieldName of Object.keys(observation.fields)) {
      const fieldMatch = fieldName.match(/^ROUND_B1_(?:CLOSE|YIELD)_(\d+WK)_2$/)

      if (fieldMatch) {
        tenorSegments.add(fieldMatch[1])
      }
    }

    for (const tenorSegment of tenorSegments) {
      const tenor = parseTreasuryBillTenor(tenorSegment)

      if (!tenor) {
        continue
      }

      const discountRate = getNumericField(observation.fields, `ROUND_B1_CLOSE_${tenorSegment}_2`)
      const investmentYield = getNumericField(observation.fields, `ROUND_B1_YIELD_${tenorSegment}_2`)
      const quoteValue = discountRate ?? investmentYield

      if (quoteValue === null) {
        continue
      }

      instruments.push({
        id: createBootstrapInstrumentId(curve.key, observation.date, tenorSegment),
        label: `${tenor.label} Treasury Bill`,
        sourceKey: curve.key,
        sourceEntryId: observation.entryId,
        observationId: observation.id,
        observationDate: observation.date,
        instrumentType: 'bill',
        quoteType: discountRate !== null ? 'bill_discount_rate' : 'bill_investment_yield',
        quoteValue,
        tenor,
        maturityDate: getStringField(observation.fields, `MATURITY_DATE_${tenorSegment}`),
        couponRate: null,
        couponFrequencyPerYear: null,
        dayCount: 'ACT/360',
        compounding: 'simple',
        cleanPrice: null,
        settlementDays: 1,
        securityId: getStringField(observation.fields, `CUSIP_${tenorSegment}`),
        sourceField:
          discountRate !== null ? `ROUND_B1_CLOSE_${tenorSegment}_2` : `ROUND_B1_YIELD_${tenorSegment}_2`,
        discountRate,
        investmentYield,
      })
    }
  }

  return sortBootstrapInstruments(instruments)
}

export function createBootstrapInstruments(curve: CurveSource, document: CurveDocument) {
  switch (curve.key) {
    case 'ust_par_nominal':
      return createParCurveBootstrapInstruments(curve, document, 'par_yield', 'par_yield')
    case 'ust_real_par':
      return createParCurveBootstrapInstruments(curve, document, 'real_par_yield', 'real_yield')
    case 'ust_bill_rates':
      return createTreasuryBillBootstrapInstruments(curve, document)
    default:
      return []
  }
}

export function marshalCurveData(curve: CurveSource, rawBody: string): CurveDocument {
  const xmlDocument = new DOMParser().parseFromString(rawBody, 'application/xml')

  if (xmlDocument.querySelector('parsererror')) {
    throw new Error('Unable to parse curve XML response')
  }

  const feed = xmlDocument.documentElement

  if (!feed || feed.localName !== 'feed') {
    throw new Error('Unexpected curve XML document structure')
  }

  const matchCurvePoint = getCurvePointMatcher(curve)

  return {
    sourceKey: curve.key,
    title: getFirstDirectChildText(feed, 'title'),
    feedId: getFirstDirectChildText(feed, 'id'),
    updatedAt: getFirstDirectChildText(feed, 'updated'),
    observations: getDirectChildElements(feed, 'entry').map((entry) => parseCurveObservation(entry, matchCurvePoint)),
  }
}
