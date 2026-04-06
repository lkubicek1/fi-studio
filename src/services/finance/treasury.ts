export type TreasuryDayCount = 'ACT/ACT' | 'ACT/360'
export type TreasuryBillQuoteType = 'bill_discount_rate' | 'bill_investment_yield'

export type TreasuryCouponSchedule = {
  paymentDates: string[]
  previousCouponDate: string | null
  nextCouponDate: string | null
  remainingCouponCount: number | null
}

export type TreasuryBondPricing = {
  cleanPrice: number | null
  dirtyPrice: number | null
  accruedInterest: number | null
}

export type TreasuryBillPricing = {
  cleanPrice: number | null
  quoteType: TreasuryBillQuoteType
  quoteValue: number
}

export type TreasuryDiscountCurveInstrument = {
  id: string
  label: string
  tenor: {
    label: string
    months: number
  }
  instrumentType: 'bill' | 'coupon_bond'
  settlementDate: string | null
  maturityDate: string | null
  couponRate: number | null
  couponFrequencyPerYear: number | null
  cleanPrice: number | null
  dirtyPrice: number | null
  yearFractionToMaturity: number | null
}

export type TreasuryDerivedCurveNode = {
  id: string
  nodeType: 'anchor' | 'interpolated'
  tenorLabel: string
  instrumentLabel: string | null
  yearFraction: number
  cleanPrice: number | null
  discountFactor: number
  sourceLabel: string
  methodLabel: string
}

type DiscountFactorAnchor = TreasuryDerivedCurveNode

const DAY_IN_MS = 24 * 60 * 60 * 1000
const CURVE_COORDINATE_EPSILON = 1e-8

function parseIsoDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsedDate = new Date(`${value}T00:00:00Z`)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS)
}

function isBusinessDay(date: Date) {
  const dayOfWeek = date.getUTCDay()

  return dayOfWeek !== 0 && dayOfWeek !== 6
}

function getDaysInYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function addMonthsClamped(date: Date, months: number) {
  const currentDay = date.getUTCDate()
  const provisionalDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const clampedDay = Math.min(
    currentDay,
    getDaysInMonth(provisionalDate.getUTCFullYear(), provisionalDate.getUTCMonth()),
  )

  return new Date(Date.UTC(provisionalDate.getUTCFullYear(), provisionalDate.getUTCMonth(), clampedDay))
}

function isSameCurveCoordinate(left: number, right: number) {
  return Math.abs(left - right) <= CURVE_COORDINATE_EPSILON
}

function normalizeCurveCoordinate(value: number) {
  return Number(value.toFixed(9))
}

function createInterpolatedTenorLabel(months: number) {
  return months % 12 === 0 ? `${months / 12}Y` : `${months}M`
}

function compareByCurveCoordinate(left: { yearFraction: number }, right: { yearFraction: number }) {
  return left.yearFraction - right.yearFraction
}

function findBracketingAnchors(yearFraction: number, anchors: DiscountFactorAnchor[]) {
  let leftAnchor: DiscountFactorAnchor | null = null
  let rightAnchor: DiscountFactorAnchor | null = null

  for (const anchor of anchors) {
    if (isSameCurveCoordinate(anchor.yearFraction, yearFraction)) {
      return {
        leftAnchor: anchor,
        rightAnchor: anchor,
      }
    }

    if (anchor.yearFraction < yearFraction) {
      leftAnchor = anchor
      continue
    }

    rightAnchor = anchor
    break
  }

  return { leftAnchor, rightAnchor }
}

function interpolateDiscountFactor(yearFraction: number, anchors: DiscountFactorAnchor[]) {
  const { leftAnchor, rightAnchor } = findBracketingAnchors(yearFraction, anchors)

  if (!leftAnchor || !rightAnchor) {
    return null
  }

  if (isSameCurveCoordinate(leftAnchor.yearFraction, rightAnchor.yearFraction)) {
    return leftAnchor.discountFactor
  }

  const weight = (yearFraction - leftAnchor.yearFraction) / (rightAnchor.yearFraction - leftAnchor.yearFraction)

  return leftAnchor.discountFactor + (rightAnchor.discountFactor - leftAnchor.discountFactor) * weight
}

function createBillAnchorNode(instrument: TreasuryDiscountCurveInstrument) {
  if (instrument.cleanPrice === null || instrument.cleanPrice <= 0 || instrument.yearFractionToMaturity === null) {
    return null
  }

  return {
    id: instrument.id,
    nodeType: 'anchor' as const,
    tenorLabel: instrument.tenor.label,
    instrumentLabel: instrument.label,
    yearFraction: normalizeCurveCoordinate(instrument.yearFractionToMaturity),
    cleanPrice: instrument.cleanPrice,
    discountFactor: normalizeCurveCoordinate(instrument.cleanPrice / 100),
    sourceLabel: instrument.label,
    methodLabel: 'Bill price / 100',
  }
}

function createCouponAnchorNode(instrument: TreasuryDiscountCurveInstrument, anchors: DiscountFactorAnchor[]) {
  if (
    instrument.dirtyPrice === null ||
    instrument.dirtyPrice <= 0 ||
    instrument.couponRate === null ||
    !instrument.couponFrequencyPerYear ||
    !instrument.maturityDate ||
    !instrument.settlementDate
  ) {
    return null
  }

  const maturityYearFraction = instrument.yearFractionToMaturity ?? calculateActualActualYearFraction(instrument.settlementDate, instrument.maturityDate)

  if (maturityYearFraction <= 0 || anchors.length === 0) {
    return null
  }

  const previousAnchor = [...anchors].sort(compareByCurveCoordinate).at(-1)

  if (!previousAnchor || previousAnchor.yearFraction >= maturityYearFraction) {
    return null
  }

  const schedule = buildTreasuryCouponSchedule(instrument.settlementDate, instrument.maturityDate)

  if (schedule.paymentDates.length === 0) {
    return null
  }

  const couponCashFlow = instrument.couponRate / instrument.couponFrequencyPerYear
  const finalPaymentDate = schedule.paymentDates[schedule.paymentDates.length - 1]
  let knownContribution = 0
  let unknownCoefficient = 0

  for (const paymentDate of schedule.paymentDates) {
    const paymentYearFraction = calculateActualActualYearFraction(instrument.settlementDate, paymentDate)
    const normalizedPaymentYearFraction = normalizeCurveCoordinate(paymentYearFraction)
    const cashFlow = paymentDate === finalPaymentDate ? 100 + couponCashFlow : couponCashFlow

    if (isSameCurveCoordinate(normalizedPaymentYearFraction, maturityYearFraction)) {
      unknownCoefficient += cashFlow
      continue
    }

    if (normalizedPaymentYearFraction <= previousAnchor.yearFraction || isSameCurveCoordinate(normalizedPaymentYearFraction, previousAnchor.yearFraction)) {
      const interpolatedDiscountFactor = interpolateDiscountFactor(normalizedPaymentYearFraction, anchors)

      if (interpolatedDiscountFactor === null) {
        return null
      }

      knownContribution += cashFlow * interpolatedDiscountFactor
      continue
    }

    const intervalWeight =
      (normalizedPaymentYearFraction - previousAnchor.yearFraction) / (maturityYearFraction - previousAnchor.yearFraction)

    knownContribution += cashFlow * previousAnchor.discountFactor * (1 - intervalWeight)
    unknownCoefficient += cashFlow * intervalWeight
  }

  if (unknownCoefficient <= 0) {
    return null
  }

  const discountFactor = (instrument.dirtyPrice - knownContribution) / unknownCoefficient

  if (!Number.isFinite(discountFactor) || discountFactor <= 0) {
    return null
  }

  return {
    id: instrument.id,
    nodeType: 'anchor' as const,
    tenorLabel: instrument.tenor.label,
    instrumentLabel: instrument.label,
    yearFraction: normalizeCurveCoordinate(maturityYearFraction),
    cleanPrice: instrument.cleanPrice,
    discountFactor: normalizeCurveCoordinate(discountFactor),
    sourceLabel: instrument.label,
    methodLabel: 'Coupon bootstrap solve',
  }
}

function bootstrapDiscountFactorAnchors(instruments: TreasuryDiscountCurveInstrument[]) {
  const sortedInstruments = [...instruments]
    .filter((instrument) => instrument.yearFractionToMaturity !== null && instrument.yearFractionToMaturity > 0)
    .sort((left, right) => (left.yearFractionToMaturity ?? Number.MAX_SAFE_INTEGER) - (right.yearFractionToMaturity ?? Number.MAX_SAFE_INTEGER))

  const anchors: DiscountFactorAnchor[] = []

  for (const instrument of sortedInstruments) {
    const nextAnchor =
      instrument.instrumentType === 'bill' ? createBillAnchorNode(instrument) : createCouponAnchorNode(instrument, anchors)

    if (!nextAnchor) {
      continue
    }

    anchors.push(nextAnchor)
    anchors.sort(compareByCurveCoordinate)
  }

  return anchors
}

function createInterpolatedDisplayNodes(anchors: DiscountFactorAnchor[], intervalMonths: number) {
  if (anchors.length < 2 || intervalMonths <= 0) {
    return []
  }

  const sortedAnchors = [...anchors].sort(compareByCurveCoordinate)
  const firstAnchor = sortedAnchors[0]
  const lastAnchor = sortedAnchors[sortedAnchors.length - 1]
  const interpolationNodes: TreasuryDerivedCurveNode[] = []
  const existingAnchorCoordinates = new Set(sortedAnchors.map((anchor) => normalizeCurveCoordinate(anchor.yearFraction).toString()))
  const lastMonth = Math.floor(lastAnchor.yearFraction * 12)

  for (let month = intervalMonths; month <= lastMonth; month += intervalMonths) {
    const yearFraction = normalizeCurveCoordinate(month / 12)

    if (yearFraction <= firstAnchor.yearFraction || yearFraction >= lastAnchor.yearFraction) {
      continue
    }

    if (existingAnchorCoordinates.has(yearFraction.toString())) {
      continue
    }

    const discountFactor = interpolateDiscountFactor(yearFraction, sortedAnchors)
    const { leftAnchor, rightAnchor } = findBracketingAnchors(yearFraction, sortedAnchors)

    if (discountFactor === null || !leftAnchor || !rightAnchor) {
      continue
    }

    interpolationNodes.push({
      id: `interpolated:${month}`,
      nodeType: 'interpolated',
      tenorLabel: createInterpolatedTenorLabel(month),
      instrumentLabel: null,
      yearFraction,
      cleanPrice: null,
      discountFactor: normalizeCurveCoordinate(discountFactor),
      sourceLabel: `${leftAnchor.tenorLabel} -> ${rightAnchor.tenorLabel}`,
      methodLabel: 'Linear DF interpolation',
    })
  }

  return interpolationNodes
}

export function addBusinessDays(dateText: string | null, businessDays: number) {
  const startDate = parseIsoDate(dateText)

  if (!startDate) {
    return null
  }

  let currentDate = startDate
  let remainingDays = businessDays

  while (remainingDays > 0) {
    currentDate = addDays(currentDate, 1)

    if (isBusinessDay(currentDate)) {
      remainingDays -= 1
    }
  }

  return formatIsoDate(currentDate)
}

export function getDayDifference(startDateText: string | null, endDateText: string | null) {
  const startDate = parseIsoDate(startDateText)
  const endDate = parseIsoDate(endDateText)

  if (!startDate || !endDate) {
    return null
  }

  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / DAY_IN_MS))
}

export function calculateActualActualYearFraction(startDateText: string | null, endDateText: string | null) {
  const startDate = parseIsoDate(startDateText)
  const endDate = parseIsoDate(endDateText)

  if (!startDate || !endDate || endDate <= startDate) {
    return 0
  }

  let total = 0
  let currentDate = startDate

  while (currentDate < endDate) {
    const yearEnd = new Date(Date.UTC(currentDate.getUTCFullYear() + 1, 0, 1))
    const segmentEnd = yearEnd < endDate ? yearEnd : endDate
    const segmentDays = Math.round((segmentEnd.getTime() - currentDate.getTime()) / DAY_IN_MS)

    total += segmentDays / getDaysInYear(currentDate.getUTCFullYear())
    currentDate = segmentEnd
  }

  return total
}

export function calculateYearFraction(startDateText: string | null, endDateText: string | null, dayCount: TreasuryDayCount | null) {
  const actualDays = getDayDifference(startDateText, endDateText)

  if (actualDays === null) {
    return null
  }

  switch (dayCount) {
    case 'ACT/360':
      return actualDays / 360
    case 'ACT/ACT':
      return calculateActualActualYearFraction(startDateText, endDateText)
    default:
      return null
  }
}

export function buildTreasuryCouponSchedule(settlementDateText: string | null, maturityDateText: string | null): TreasuryCouponSchedule {
  const settlementDate = parseIsoDate(settlementDateText)
  const maturityDate = parseIsoDate(maturityDateText)

  if (!settlementDate || !maturityDate || maturityDate <= settlementDate) {
    return {
      paymentDates: [],
      previousCouponDate: null,
      nextCouponDate: null,
      remainingCouponCount: null,
    }
  }

  const paymentDates: Date[] = []
  let currentCouponDate = maturityDate

  while (currentCouponDate > settlementDate) {
    paymentDates.push(currentCouponDate)
    currentCouponDate = addMonthsClamped(currentCouponDate, -6)
  }

  const orderedPaymentDates = paymentDates.reverse().map((date) => formatIsoDate(date))

  return {
    paymentDates: orderedPaymentDates,
    previousCouponDate: formatIsoDate(currentCouponDate),
    nextCouponDate: orderedPaymentDates[0] ?? null,
    remainingCouponCount: orderedPaymentDates.length,
  }
}

export function calculateAccruedInterest(
  couponRate: number,
  settlementDateText: string | null,
  previousCouponDateText: string | null,
  nextCouponDateText: string | null,
) {
  const daysInPeriod = getDayDifference(previousCouponDateText, nextCouponDateText)
  const daysAccrued = getDayDifference(previousCouponDateText, settlementDateText)

  if (daysInPeriod === null || daysInPeriod === 0 || daysAccrued === null) {
    return 0
  }

  const couponCashFlow = couponRate / 2

  return couponCashFlow * (daysAccrued / daysInPeriod)
}

export function priceTreasuryCouponBond(
  couponRate: number,
  benchmarkYield: number,
  settlementDateText: string | null,
  schedule: TreasuryCouponSchedule,
): TreasuryBondPricing {
  if (schedule.paymentDates.length === 0) {
    return {
      cleanPrice: null,
      dirtyPrice: null,
      accruedInterest: null,
    }
  }

  const couponCashFlow = couponRate / 2
  const yieldPerPeriod = benchmarkYield / 100 / 2
  const lastPaymentDate = schedule.paymentDates[schedule.paymentDates.length - 1]
  let dirtyPrice = 0

  for (const paymentDate of schedule.paymentDates) {
    const yearFraction = calculateActualActualYearFraction(settlementDateText, paymentDate)
    const discountFactor = Math.pow(1 + yieldPerPeriod, 2 * yearFraction)
    const cashFlow = paymentDate === lastPaymentDate ? 100 + couponCashFlow : couponCashFlow

    dirtyPrice += cashFlow / discountFactor
  }

  const accruedInterest = calculateAccruedInterest(
    couponRate,
    settlementDateText,
    schedule.previousCouponDate,
    schedule.nextCouponDate,
  )

  return {
    cleanPrice: dirtyPrice - accruedInterest,
    dirtyPrice,
    accruedInterest,
  }
}

export function deriveBillPrice(
  discountRate: number | null,
  investmentYield: number | null,
  daysToMaturity: number,
): TreasuryBillPricing | null {
  if (discountRate !== null) {
    return {
      cleanPrice: 100 * (1 - (discountRate / 100) * (daysToMaturity / 360)),
      quoteType: 'bill_discount_rate',
      quoteValue: discountRate,
    }
  }

  if (investmentYield !== null) {
    return {
      cleanPrice: 100 / (1 + (investmentYield / 100) * (daysToMaturity / 365)),
      quoteType: 'bill_investment_yield',
      quoteValue: investmentYield,
    }
  }

  return null
}

export function deriveCurrentYield(couponRate: number | null, cleanPrice: number | null) {
  if (couponRate === null || cleanPrice === null || cleanPrice <= 0) {
    return null
  }

  return (couponRate / cleanPrice) * 100
}

export function deriveBillYieldToMaturityFromPrice(cleanPrice: number | null, daysToMaturity: number | null) {
  if (cleanPrice === null || daysToMaturity === null || daysToMaturity <= 0 || cleanPrice <= 0) {
    return null
  }

  return ((100 / cleanPrice) - 1) * (365 / daysToMaturity) * 100
}

export function buildTreasuryDerivedCurveNodes(
  instruments: TreasuryDiscountCurveInstrument[],
  options?: { interpolationIntervalMonths?: number },
) {
  const anchors = bootstrapDiscountFactorAnchors(instruments)
  const interpolationIntervalMonths = options?.interpolationIntervalMonths ?? 1
  const interpolatedNodes = createInterpolatedDisplayNodes(anchors, interpolationIntervalMonths)

  return [...anchors, ...interpolatedNodes].sort((left, right) => {
    const yearFractionDifference = left.yearFraction - right.yearFraction

    if (yearFractionDifference !== 0) {
      return yearFractionDifference
    }

    if (left.nodeType === right.nodeType) {
      return left.tenorLabel.localeCompare(right.tenorLabel)
    }

    return left.nodeType === 'anchor' ? -1 : 1
  })
}
