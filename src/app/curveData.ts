import {
  treasuryAuctionSource,
  treasuryBillRatesSource,
  treasuryParYieldSource,
  type CurveSourceComponent,
} from '@/services/api/curves.ts'
import {
  addBusinessDays,
  buildTreasuryCouponSchedule,
  calculateYearFraction,
  deriveBillPrice,
  deriveBillYieldToMaturityFromPrice,
  deriveCurrentYield,
  getDayDifference,
  priceTreasuryCouponBond,
} from '@/services/finance/treasury.ts'

export type CurveTenor = {
  label: string
  amount: number
  unit: 'weeks' | 'months' | 'years'
  months: number
}

export type BootstrapInstrumentType = 'bill' | 'coupon_bond'
export type BootstrapQuoteType = 'par_yield' | 'bill_discount_rate' | 'bill_investment_yield'
export type BootstrapCompounding = 'simple' | 'semiannual'
export type BootstrapRole = 'money_market' | 'coupon_benchmark'
export type BootstrapQuoteOrigin = 'market' | 'benchmark'
export type BootstrapPriceOrigin = 'derived'

export type BootstrapInstrument = {
  id: string
  label: string
  tenor: CurveTenor
  instrumentType: BootstrapInstrumentType
  bootstrapRole: BootstrapRole
  quoteOrigin: BootstrapQuoteOrigin
  priceOrigin: BootstrapPriceOrigin
  quoteType: BootstrapQuoteType
  quoteValue: number
  quoteDate: string | null
  settlementDate: string | null
  issueDate: string | null
  maturityDate: string | null
  securityId: string | null
  couponRate: number | null
  couponFrequencyPerYear: number | null
  dayCount: 'ACT/ACT' | 'ACT/360' | null
  compounding: BootstrapCompounding | null
  cleanPrice: number | null
  currentYield: number | null
  yieldToMaturity: number | null
  dirtyPrice: number | null
  accruedInterest: number | null
  discountRate: number | null
  investmentYield: number | null
  benchmarkYield: number | null
  auctionHighPrice: number | null
  auctionHighYield: number | null
  daysToMaturity: number | null
  yearFractionToMaturity: number | null
  previousCouponDate: string | null
  nextCouponDate: string | null
  remainingCouponCount: number | null
  sourceField: string
  sourceLabel: string
  pricingNotes: string | null
}

type CurveFieldValue = string | number | boolean | null

type CurvePoint = {
  metric: string
  sourceField: string
  tenor: CurveTenor
  value: number
}

type CurveObservation = {
  date: string | null
  fields: Record<string, CurveFieldValue>
  points: CurvePoint[]
}

type CurveDocument = {
  observations: CurveObservation[]
}

type CurvePointDefinition = {
  metric: string
  tenor: CurveTenor
}

type CurvePointMatcher = (fieldName: string) => CurvePointDefinition | null

type TreasuryAuctionRecord = {
  auctionDate: string | null
  issueDate: string | null
  maturityDate: string | null
  securityType: string | null
  originalSecurityTerm: string | null
  securityTerm: string | null
  securityId: string | null
  couponRate: number | null
  highPrice: number | null
  highYield: number | null
  floatingRate: boolean
  reopening: boolean
}

type TreasuryPublicCurveBodies = {
  billRatesBody: string
  parYieldBody: string
  auctionBody: string
}

const XML_METADATA_NAMESPACE = 'http://schemas.microsoft.com/ado/2007/08/dataservices/metadata'
const observationDateCandidates = ['NEW_DATE', 'INDEX_DATE', 'QUOTE_DATE']

const couponBenchmarkTerms = [
  { tenor: createYearsTenor(2), originalSecurityTerm: '2-Year' },
  { tenor: createYearsTenor(3), originalSecurityTerm: '3-Year' },
  { tenor: createYearsTenor(5), originalSecurityTerm: '5-Year' },
  { tenor: createYearsTenor(7), originalSecurityTerm: '7-Year' },
  { tenor: createYearsTenor(10), originalSecurityTerm: '10-Year' },
  { tenor: createYearsTenor(20), originalSecurityTerm: '20-Year' },
  { tenor: createYearsTenor(30), originalSecurityTerm: '30-Year' },
] as const

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

function getDirectChildElements(parent: Element, localName: string) {
  return Array.from(parent.children).filter((child) => child.localName === localName)
}

function getFirstDirectChildElement(parent: Element, localName: string) {
  return getDirectChildElements(parent, localName)[0] ?? null
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

function selectObservationDate(fields: Record<string, CurveFieldValue>) {
  for (const candidate of observationDateCandidates) {
    const fieldValue = fields[candidate]

    if (typeof fieldValue === 'string') {
      return fieldValue
    }
  }

  return null
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

function createTreasuryCurveMatcher(metric: string): CurvePointMatcher {
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
        tenor,
      }
    }

    return null
  }
}

function getCurvePointMatcher(source: CurveSourceComponent): CurvePointMatcher {
  switch (source.key) {
    case treasuryParYieldSource.key:
      return createTreasuryCurveMatcher('par_yield')
    case treasuryBillRatesSource.key:
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

    return left.sourceField.localeCompare(right.sourceField)
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
    date: selectObservationDate(fields),
    fields,
    points: buildCurvePoints(fields, matchCurvePoint),
  }
}

function marshalCurveData(source: CurveSourceComponent, rawBody: string): CurveDocument {
  const xmlDocument = new DOMParser().parseFromString(rawBody, 'application/xml')

  if (xmlDocument.querySelector('parsererror')) {
    throw new Error(`Unable to parse ${source.title}`)
  }

  const feed = xmlDocument.documentElement

  if (!feed || feed.localName !== 'feed') {
    throw new Error(`Unexpected XML structure for ${source.title}`)
  }

  const matchCurvePoint = getCurvePointMatcher(source)

  return {
    observations: getDirectChildElements(feed, 'entry').map((entry) => parseCurveObservation(entry, matchCurvePoint)),
  }
}

function parseOptionalNumber(rawValue: unknown) {
  if (rawValue === null || rawValue === undefined || rawValue === '' || rawValue === 'null') {
    return null
  }

  const parsedNumber = Number(rawValue)

  return Number.isFinite(parsedNumber) ? parsedNumber : null
}

function parseOptionalString(rawValue: unknown) {
  if (typeof rawValue !== 'string') {
    return null
  }

  const trimmedValue = rawValue.trim()

  return trimmedValue && trimmedValue !== 'null' ? trimmedValue : null
}

function parseTreasuryAuctionData(rawBody: string) {
  const parsedPayload = JSON.parse(rawBody) as { data?: Array<Record<string, unknown>> }
  const rows = Array.isArray(parsedPayload.data) ? parsedPayload.data : []

  return rows.map<TreasuryAuctionRecord>((row) => ({
    auctionDate: parseOptionalString(row.auction_date),
    issueDate: parseOptionalString(row.issue_date),
    maturityDate: parseOptionalString(row.maturity_date),
    securityType: parseOptionalString(row.security_type),
    originalSecurityTerm: parseOptionalString(row.original_security_term),
    securityTerm: parseOptionalString(row.security_term),
    securityId: parseOptionalString(row.cusip),
    couponRate: parseOptionalNumber(row.int_rate),
    highPrice: parseOptionalNumber(row.high_price),
    highYield: parseOptionalNumber(row.high_yield),
    floatingRate: parseOptionalString(row.floating_rate) === 'Yes',
    reopening: parseOptionalString(row.reopening) === 'Yes',
  }))
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

function findObservationByDate(document: CurveDocument, targetDate: string | null) {
  return document.observations.find((observation) => observation.date === targetDate) ?? null
}

function selectLatestSharedObservationDate(leftDocument: CurveDocument, rightDocument: CurveDocument) {
  const rightDates = new Set(
    rightDocument.observations
      .map((observation) => observation.date)
      .filter((date): date is string => typeof date === 'string'),
  )

  return (
    leftDocument.observations
      .map((observation) => observation.date)
      .filter((date): date is string => typeof date === 'string' && rightDates.has(date))
      .sort((left, right) => left.localeCompare(right))
      .at(-1) ?? null
  )
}

function createTreasuryBillBootstrapInstruments(
  quoteDate: string,
  settlementDate: string,
  observation: CurveObservation,
) {
  const instruments: BootstrapInstrument[] = []
  const tenorSegments = new Set<string>()

  for (const fieldName of Object.keys(observation.fields)) {
    const fieldMatch = fieldName.match(/^ROUND_B1_(?:CLOSE|YIELD)_(\d+WK)_2$/)

    if (fieldMatch) {
      tenorSegments.add(fieldMatch[1])
    }
  }

  for (const tenorSegment of tenorSegments) {
    const tenor = parseTreasuryBillTenor(tenorSegment)
    const maturityDate = getStringField(observation.fields, `MATURITY_DATE_${tenorSegment}`)
    const discountRate = getNumericField(observation.fields, `ROUND_B1_CLOSE_${tenorSegment}_2`)
    const investmentYield = getNumericField(observation.fields, `ROUND_B1_YIELD_${tenorSegment}_2`)
    const securityId = getStringField(observation.fields, `CUSIP_${tenorSegment}`)
    const daysToMaturity = getDayDifference(settlementDate, maturityDate)

    if (!tenor || !maturityDate || daysToMaturity === null || daysToMaturity <= 0) {
      continue
    }

    const quoteData = deriveBillPrice(discountRate, investmentYield, daysToMaturity)

    if (!quoteData) {
      continue
    }

    const pricingNotes =
      quoteData.quoteType === 'bill_discount_rate'
        ? 'Current benchmark Treasury bill close quote converted to price using the Treasury ACT/360 discount basis.'
        : 'Current benchmark Treasury bill investment yield converted to price using a simple ACT/365 money-market basis.'

    instruments.push({
      id: createBootstrapInstrumentId(treasuryBillRatesSource.key, quoteDate, tenorSegment),
      label: `${tenor.label} Treasury Bill`,
      tenor,
      instrumentType: 'bill',
      bootstrapRole: 'money_market',
      quoteOrigin: 'market',
      priceOrigin: 'derived',
      quoteType: quoteData.quoteType,
      quoteValue: quoteData.quoteValue,
      quoteDate,
      settlementDate,
      issueDate: null,
      maturityDate,
      securityId,
      couponRate: null,
      couponFrequencyPerYear: null,
      dayCount: 'ACT/360',
      compounding: 'simple',
      cleanPrice: quoteData.cleanPrice,
      currentYield: null,
      yieldToMaturity: deriveBillYieldToMaturityFromPrice(quoteData.cleanPrice, daysToMaturity),
      dirtyPrice: quoteData.cleanPrice,
      accruedInterest: 0,
      discountRate,
      investmentYield,
      benchmarkYield: null,
      auctionHighPrice: null,
      auctionHighYield: null,
      daysToMaturity,
      yearFractionToMaturity: calculateYearFraction(settlementDate, maturityDate, 'ACT/ACT'),
      previousCouponDate: null,
      nextCouponDate: null,
      remainingCouponCount: null,
      sourceField:
        quoteData.quoteType === 'bill_discount_rate'
          ? `ROUND_B1_CLOSE_${tenorSegment}_2`
          : `ROUND_B1_YIELD_${tenorSegment}_2`,
      sourceLabel: treasuryBillRatesSource.title,
      pricingNotes,
    })
  }

  return instruments
}

function selectActiveCouponAuctionRecords(quoteDate: string, settlementDate: string, auctions: TreasuryAuctionRecord[]) {
  const auctionByTenor = new Map<string, TreasuryAuctionRecord>()

  for (const benchmark of couponBenchmarkTerms) {
    const matchingAuction = auctions
      .filter((auction) => {
        if (auction.floatingRate) {
          return false
        }

        if (auction.originalSecurityTerm !== benchmark.originalSecurityTerm) {
          return false
        }

        if (auction.securityType !== 'Note' && auction.securityType !== 'Bond') {
          return false
        }

        if (!auction.issueDate || auction.issueDate > quoteDate) {
          return false
        }

        if (!auction.maturityDate || auction.maturityDate <= settlementDate) {
          return false
        }

        return true
      })
      .sort((left, right) => {
        const issueDateComparison = (right.issueDate ?? '').localeCompare(left.issueDate ?? '')

        if (issueDateComparison !== 0) {
          return issueDateComparison
        }

        return (right.auctionDate ?? '').localeCompare(left.auctionDate ?? '')
      })[0]

    if (matchingAuction) {
      auctionByTenor.set(benchmark.tenor.label, matchingAuction)
    }
  }

  return auctionByTenor
}

function createTreasuryCouponBenchmarkInstruments(
  quoteDate: string,
  settlementDate: string,
  parObservation: CurveObservation,
  auctions: TreasuryAuctionRecord[],
) {
  const instruments: BootstrapInstrument[] = []
  const auctionByTenor = selectActiveCouponAuctionRecords(quoteDate, settlementDate, auctions)
  const parPointsByTenor = new Map(
    parObservation.points
      .filter((point) => point.metric === 'par_yield')
      .map((point) => [point.tenor.label, point] as const),
  )

  for (const benchmark of couponBenchmarkTerms) {
    const parPoint = parPointsByTenor.get(benchmark.tenor.label)
    const auction = auctionByTenor.get(benchmark.tenor.label)

    if (!parPoint || !auction || auction.couponRate === null || !auction.maturityDate) {
      continue
    }

    const daysToMaturity = getDayDifference(settlementDate, auction.maturityDate)

    if (daysToMaturity === null || daysToMaturity <= 0) {
      continue
    }

    const schedule = buildTreasuryCouponSchedule(settlementDate, auction.maturityDate)
    const pricing = priceTreasuryCouponBond(auction.couponRate, parPoint.value, settlementDate, schedule)

    instruments.push({
      id: createBootstrapInstrumentId(treasuryParYieldSource.key, quoteDate, benchmark.tenor.label, auction.securityId),
      label: `${benchmark.tenor.label} Treasury ${auction.securityType ?? 'Bond'}`,
      tenor: benchmark.tenor,
      instrumentType: 'coupon_bond',
      bootstrapRole: 'coupon_benchmark',
      quoteOrigin: 'benchmark',
      priceOrigin: 'derived',
      quoteType: 'par_yield',
      quoteValue: parPoint.value,
      quoteDate,
      settlementDate,
      issueDate: auction.issueDate,
      maturityDate: auction.maturityDate,
      securityId: auction.securityId,
      couponRate: auction.couponRate,
      couponFrequencyPerYear: 2,
      dayCount: 'ACT/ACT',
      compounding: 'semiannual',
      cleanPrice: pricing.cleanPrice,
      currentYield: deriveCurrentYield(auction.couponRate, pricing.cleanPrice),
      yieldToMaturity: parPoint.value,
      dirtyPrice: pricing.dirtyPrice,
      accruedInterest: pricing.accruedInterest,
      discountRate: null,
      investmentYield: null,
      benchmarkYield: parPoint.value,
      auctionHighPrice: auction.highPrice,
      auctionHighYield: auction.highYield,
      daysToMaturity,
      yearFractionToMaturity: calculateYearFraction(settlementDate, auction.maturityDate, 'ACT/ACT'),
      previousCouponDate: schedule.previousCouponDate,
      nextCouponDate: schedule.nextCouponDate,
      remainingCouponCount: schedule.remainingCouponCount,
      sourceField: parPoint.sourceField,
      sourceLabel: `${treasuryParYieldSource.title} + ${treasuryAuctionSource.title}`,
      pricingNotes:
        'Current clean price is derived from the official Treasury benchmark par yield using the active on-the-run fixed-coupon issue cash-flow schedule.',
    })
  }

  return instruments
}

function sortBootstrapInstruments(instruments: BootstrapInstrument[]) {
  return instruments.sort((left, right) => {
    const quoteDateComparison = (left.quoteDate ?? '').localeCompare(right.quoteDate ?? '')

    if (quoteDateComparison !== 0) {
      return quoteDateComparison
    }

    const daysToMaturityDifference = (left.daysToMaturity ?? Number.MAX_SAFE_INTEGER) - (right.daysToMaturity ?? Number.MAX_SAFE_INTEGER)

    if (daysToMaturityDifference !== 0) {
      return daysToMaturityDifference
    }

    return left.label.localeCompare(right.label)
  })
}

export function createTreasuryPublicBootstrapInstruments(rawBodies: TreasuryPublicCurveBodies) {
  const billDocument = marshalCurveData(treasuryBillRatesSource, rawBodies.billRatesBody)
  const parYieldDocument = marshalCurveData(treasuryParYieldSource, rawBodies.parYieldBody)
  const auctions = parseTreasuryAuctionData(rawBodies.auctionBody)
  const quoteDate = selectLatestSharedObservationDate(billDocument, parYieldDocument)

  if (!quoteDate) {
    throw new Error('Unable to align Treasury bill and par-yield observations on a common quote date')
  }

  const settlementDate = addBusinessDays(quoteDate, 1)

  if (!settlementDate) {
    throw new Error('Unable to calculate the Treasury settlement date')
  }

  const billObservation = findObservationByDate(billDocument, quoteDate)
  const parObservation = findObservationByDate(parYieldDocument, quoteDate)

  if (!billObservation || !parObservation) {
    throw new Error('Unable to locate the Treasury observations for the aligned quote date')
  }

  return sortBootstrapInstruments([
    ...createTreasuryBillBootstrapInstruments(quoteDate, settlementDate, billObservation),
    ...createTreasuryCouponBenchmarkInstruments(quoteDate, settlementDate, parObservation, auctions),
  ])
}
