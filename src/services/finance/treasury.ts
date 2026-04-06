export type TreasuryDayCount = 'ACT/ACT' | 'ACT/360'
export type TreasuryBillQuoteType = 'bill_discount_rate' | 'bill_investment_yield'
export type TreasuryInterpolationMethod = 'linear_discount_factor' | 'log_linear_discount_factor'
export type TreasuryForwardSmoothingMethod =
  | 'raw'
  | 'monotone_convex'
  | 'pchip_log_discount_factor'
  | 'nelson_siegel_svensson'

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

export type TreasurySpotRateConvention = 'semiannual_bond_equivalent'

export type TreasurySpotCurveNode = TreasuryDerivedCurveNode & {
  spotRate: number
  spotRateConvention: TreasurySpotRateConvention
}

export type TreasuryForwardCurveNode = TreasurySpotCurveNode & {
  forwardRate: number | null
  forwardStartYearFraction: number | null
  forwardIntervalYears: number | null
}

type DiscountFactorAnchor = TreasuryDerivedCurveNode

type TreasuryCouponCashFlow = {
  yearFraction: number
  cashFlow: number
}

type DiscountFactorPoint = {
  yearFraction: number
  discountFactor: number
}

type MonotoneConvexForwardCurve = {
  points: DiscountFactorPoint[]
  intervalYears: number[]
  intervalForwards: number[]
  nodeForwards: number[]
}

type PchipLogDiscountFactorCurve = {
  points: DiscountFactorPoint[]
  logDiscountFactors: number[]
  slopes: number[]
}

type NelsonSiegelSvenssonFit = {
  beta0: number
  beta1: number
  beta2: number
  beta3: number
  tau1: number
  tau2: number
}

const DAY_IN_MS = 24 * 60 * 60 * 1000
const CURVE_COORDINATE_EPSILON = 1e-8
const LINEAR_SYSTEM_EPSILON = 1e-12
const nelsonSiegelSvenssonTauGrid = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30]

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

function formatInterpolationMethodLabel(method: TreasuryInterpolationMethod) {
  return method === 'log_linear_discount_factor' ? 'Log-Linear DF' : 'Linear DF'
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

function interpolateDiscountFactorBetweenAnchors(
  yearFraction: number,
  leftAnchor: DiscountFactorAnchor,
  rightAnchor: DiscountFactorAnchor,
  interpolationMethod: TreasuryInterpolationMethod,
) {
  if (isSameCurveCoordinate(leftAnchor.yearFraction, rightAnchor.yearFraction)) {
    return leftAnchor.discountFactor
  }

  const weight = (yearFraction - leftAnchor.yearFraction) / (rightAnchor.yearFraction - leftAnchor.yearFraction)

  if (interpolationMethod === 'log_linear_discount_factor') {
    if (leftAnchor.discountFactor <= 0 || rightAnchor.discountFactor <= 0) {
      return null
    }

    return Math.exp(
      Math.log(leftAnchor.discountFactor) + (Math.log(rightAnchor.discountFactor) - Math.log(leftAnchor.discountFactor)) * weight,
    )
  }

  return leftAnchor.discountFactor + (rightAnchor.discountFactor - leftAnchor.discountFactor) * weight
}

function interpolateDiscountFactor(
  yearFraction: number,
  anchors: DiscountFactorAnchor[],
  interpolationMethod: TreasuryInterpolationMethod,
) {
  const { leftAnchor, rightAnchor } = findBracketingAnchors(yearFraction, anchors)

  if (!leftAnchor || !rightAnchor) {
    return null
  }

  return interpolateDiscountFactorBetweenAnchors(yearFraction, leftAnchor, rightAnchor, interpolationMethod)
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

function buildCouponCashFlows(
  settlementDateText: string,
  schedule: TreasuryCouponSchedule,
  couponRate: number,
  couponFrequencyPerYear: number,
): TreasuryCouponCashFlow[] {
  const couponCashFlow = couponRate / couponFrequencyPerYear
  const finalPaymentDate = schedule.paymentDates[schedule.paymentDates.length - 1]

  return schedule.paymentDates.map((paymentDate) => ({
    yearFraction: normalizeCurveCoordinate(calculateActualActualYearFraction(settlementDateText, paymentDate)),
    cashFlow: paymentDate === finalPaymentDate ? 100 + couponCashFlow : couponCashFlow,
  }))
}

function createCandidateAnchor(
  instrument: TreasuryDiscountCurveInstrument,
  maturityYearFraction: number,
  discountFactor: number,
): DiscountFactorAnchor {
  return {
    id: `${instrument.id}:candidate`,
    nodeType: 'anchor',
    tenorLabel: instrument.tenor.label,
    instrumentLabel: instrument.label,
    yearFraction: normalizeCurveCoordinate(maturityYearFraction),
    cleanPrice: instrument.cleanPrice,
    discountFactor: normalizeCurveCoordinate(discountFactor),
    sourceLabel: instrument.label,
    methodLabel: 'Candidate solve',
  }
}

function priceCouponCashFlowsFromCurve(
  cashFlows: TreasuryCouponCashFlow[],
  anchors: DiscountFactorAnchor[],
  candidateAnchor: DiscountFactorAnchor,
  interpolationMethod: TreasuryInterpolationMethod,
) {
  const pricingAnchors = [...anchors, candidateAnchor].sort(compareByCurveCoordinate)
  let dirtyPrice = 0

  for (const cashFlow of cashFlows) {
    const discountFactor = interpolateDiscountFactor(cashFlow.yearFraction, pricingAnchors, interpolationMethod)

    if (discountFactor === null) {
      return null
    }

    dirtyPrice += cashFlow.cashFlow * discountFactor
  }

  return dirtyPrice
}

function solveCouponAnchorDiscountFactor(
  instrument: TreasuryDiscountCurveInstrument,
  maturityYearFraction: number,
  cashFlows: TreasuryCouponCashFlow[],
  anchors: DiscountFactorAnchor[],
  interpolationMethod: TreasuryInterpolationMethod,
) {
  if (instrument.dirtyPrice === null || instrument.dirtyPrice <= 0) {
    return null
  }

  const previousAnchor = [...anchors].sort(compareByCurveCoordinate).at(-1)

  if (!previousAnchor || previousAnchor.yearFraction >= maturityYearFraction) {
    return null
  }

  const lowerBound = 0.000001
  let upperBound = Math.max(previousAnchor.discountFactor, 1)
  let upperBoundPrice = priceCouponCashFlowsFromCurve(
    cashFlows,
    anchors,
    createCandidateAnchor(instrument, maturityYearFraction, upperBound),
    interpolationMethod,
  )
  let expansionCount = 0

  while (upperBoundPrice !== null && upperBoundPrice < instrument.dirtyPrice && expansionCount < 12) {
    upperBound *= 2
    upperBoundPrice = priceCouponCashFlowsFromCurve(
      cashFlows,
      anchors,
      createCandidateAnchor(instrument, maturityYearFraction, upperBound),
      interpolationMethod,
    )
    expansionCount += 1
  }

  const lowerBoundPrice = priceCouponCashFlowsFromCurve(
    cashFlows,
    anchors,
    createCandidateAnchor(instrument, maturityYearFraction, lowerBound),
    interpolationMethod,
  )

  if (lowerBoundPrice === null || upperBoundPrice === null) {
    return null
  }

  if (lowerBoundPrice > instrument.dirtyPrice || upperBoundPrice < instrument.dirtyPrice) {
    return null
  }

  let low = lowerBound
  let high = upperBound

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midpoint = (low + high) / 2
    const midpointPrice = priceCouponCashFlowsFromCurve(
      cashFlows,
      anchors,
      createCandidateAnchor(instrument, maturityYearFraction, midpoint),
      interpolationMethod,
    )

    if (midpointPrice === null) {
      return null
    }

    if (Math.abs(midpointPrice - instrument.dirtyPrice) <= 1e-9) {
      return midpoint
    }

    if (midpointPrice < instrument.dirtyPrice) {
      low = midpoint
    } else {
      high = midpoint
    }
  }

  return (low + high) / 2
}

function createCouponAnchorNode(
  instrument: TreasuryDiscountCurveInstrument,
  anchors: DiscountFactorAnchor[],
  interpolationMethod: TreasuryInterpolationMethod,
) {
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

  const cashFlows = buildCouponCashFlows(
    instrument.settlementDate,
    schedule,
    instrument.couponRate,
    instrument.couponFrequencyPerYear,
  )
  const discountFactor = solveCouponAnchorDiscountFactor(
    instrument,
    maturityYearFraction,
    cashFlows,
    anchors,
    interpolationMethod,
  )

  if (discountFactor === null || !Number.isFinite(discountFactor) || discountFactor <= 0) {
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
    methodLabel: `Coupon bootstrap solve (${formatInterpolationMethodLabel(interpolationMethod)})`,
  }
}

function bootstrapDiscountFactorAnchors(
  instruments: TreasuryDiscountCurveInstrument[],
  interpolationMethod: TreasuryInterpolationMethod,
) {
  const sortedInstruments = [...instruments]
    .filter((instrument) => instrument.yearFractionToMaturity !== null && instrument.yearFractionToMaturity > 0)
    .sort((left, right) => (left.yearFractionToMaturity ?? Number.MAX_SAFE_INTEGER) - (right.yearFractionToMaturity ?? Number.MAX_SAFE_INTEGER))

  const anchors: DiscountFactorAnchor[] = []

  for (const instrument of sortedInstruments) {
    const nextAnchor =
      instrument.instrumentType === 'bill'
        ? createBillAnchorNode(instrument)
        : createCouponAnchorNode(instrument, anchors, interpolationMethod)

    if (!nextAnchor) {
      continue
    }

    anchors.push(nextAnchor)
    anchors.sort(compareByCurveCoordinate)
  }

  return anchors
}

function createInterpolatedDisplayNodes(
  anchors: DiscountFactorAnchor[],
  intervalMonths: number,
  interpolationMethod: TreasuryInterpolationMethod,
) {
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

    const discountFactor = interpolateDiscountFactor(yearFraction, sortedAnchors, interpolationMethod)
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
      methodLabel: `${formatInterpolationMethodLabel(interpolationMethod)} interpolation`,
    })
  }

  return interpolationNodes
}

function deriveSpotRateFromDiscountFactor(
  discountFactor: number,
  yearFraction: number,
  spotRateConvention: TreasurySpotRateConvention,
) {
  if (discountFactor <= 0 || yearFraction <= 0) {
    return null
  }

  switch (spotRateConvention) {
    case 'semiannual_bond_equivalent': {
      const spotRate = 2 * (Math.pow(discountFactor, -1 / (2 * yearFraction)) - 1)

      return Number.isFinite(spotRate) ? spotRate * 100 : null
    }
    default:
      return null
  }
}

function deriveForwardRateFromDiscountFactors(
  startDiscountFactor: number,
  endDiscountFactor: number,
  intervalYears: number,
) {
  if (startDiscountFactor <= 0 || endDiscountFactor <= 0 || intervalYears <= 0) {
    return null
  }

  const forwardRate = ((Math.log(startDiscountFactor) - Math.log(endDiscountFactor)) / intervalYears) * 100

  return Number.isFinite(forwardRate) ? forwardRate : null
}

function buildRawForwardRates(points: DiscountFactorPoint[]) {
  return points.map<number | null>((point, index) => {
    if (index === 0) {
      return null
    }

    const previousPoint = points[index - 1]
    const intervalYears = point.yearFraction - previousPoint.yearFraction
    const forwardRate = deriveForwardRateFromDiscountFactors(previousPoint.discountFactor, point.discountFactor, intervalYears)

    return forwardRate === null ? null : normalizeCurveCoordinate(forwardRate)
  })
}

function clampMonotoneConvexForwardControl(control: number, leftForward: number, rightForward: number) {
  if (leftForward * rightForward <= 0) {
    return 0
  }

  const boundedMagnitude = Math.min(Math.abs(control), 2 * Math.abs(leftForward), 2 * Math.abs(rightForward))

  return Math.sign(control) * boundedMagnitude
}

function buildMonotoneConvexForwardCurve(points: DiscountFactorPoint[]): MonotoneConvexForwardCurve | null {
  if (points.length < 2) {
    return null
  }

  const intervalYears: number[] = []
  const intervalForwards: number[] = []

  for (let index = 1; index < points.length; index += 1) {
    const intervalYearFraction = points[index].yearFraction - points[index - 1].yearFraction
    const intervalForwardRate = deriveForwardRateFromDiscountFactors(
      points[index - 1].discountFactor,
      points[index].discountFactor,
      intervalYearFraction,
    )

    if (intervalYearFraction <= 0 || intervalForwardRate === null) {
      return null
    }

    intervalYears.push(intervalYearFraction)
    intervalForwards.push(intervalForwardRate)
  }

  if (intervalForwards.length === 1) {
    return {
      points,
      intervalYears,
      intervalForwards,
      nodeForwards: [intervalForwards[0], intervalForwards[0]],
    }
  }

  const nodeForwards = new Array<number>(points.length).fill(0)

  for (let index = 1; index < points.length - 1; index += 1) {
    const leftIntervalYears = intervalYears[index - 1]
    const rightIntervalYears = intervalYears[index]
    const leftForward = intervalForwards[index - 1]
    const rightForward = intervalForwards[index]
    const rawControl =
      (leftIntervalYears / (leftIntervalYears + rightIntervalYears)) * rightForward +
      (rightIntervalYears / (leftIntervalYears + rightIntervalYears)) * leftForward

    nodeForwards[index] = clampMonotoneConvexForwardControl(rawControl, leftForward, rightForward)
  }

  nodeForwards[0] = clampMonotoneConvexForwardControl(1.5 * intervalForwards[0] - 0.5 * nodeForwards[1], intervalForwards[0], intervalForwards[0])
  nodeForwards[points.length - 1] = clampMonotoneConvexForwardControl(
    1.5 * intervalForwards[intervalForwards.length - 1] - 0.5 * nodeForwards[points.length - 2],
    intervalForwards[intervalForwards.length - 1],
    intervalForwards[intervalForwards.length - 1],
  )

  return {
    points,
    intervalYears,
    intervalForwards,
    nodeForwards,
  }
}

function evaluateMonotoneConvexDeviation(x: number, g0: number, g1: number) {
  if (Math.abs(g0) <= CURVE_COORDINATE_EPSILON && Math.abs(g1) <= CURVE_COORDINATE_EPSILON) {
    return 0
  }

  const combinedLeft = g1 + 2 * g0
  const combinedRight = g0 + 2 * g1

  if (
    (combinedLeft < -CURVE_COORDINATE_EPSILON && combinedRight >= -CURVE_COORDINATE_EPSILON) ||
    (combinedLeft > CURVE_COORDINATE_EPSILON && combinedRight <= CURVE_COORDINATE_EPSILON)
  ) {
    return g0 - 2 * (g1 + 2 * g0) * x + 3 * (g0 + g1) * x * x
  }

  if (
    (g0 < -CURVE_COORDINATE_EPSILON && combinedLeft >= -CURVE_COORDINATE_EPSILON) ||
    (g0 > CURVE_COORDINATE_EPSILON && combinedLeft <= CURVE_COORDINATE_EPSILON)
  ) {
    const denominator = g1 - g0

    if (Math.abs(denominator) <= CURVE_COORDINATE_EPSILON) {
      return 0
    }

    const eta = (g1 + 2 * g0) / denominator

    if (x <= eta) {
      return g0
    }

    const scaledX = (x - eta) / (1 - eta)

    return g0 + (g1 - g0) * scaledX * scaledX
  }

  if (
    (g1 <= CURVE_COORDINATE_EPSILON && combinedRight > CURVE_COORDINATE_EPSILON) ||
    (g1 >= -CURVE_COORDINATE_EPSILON && combinedRight < -CURVE_COORDINATE_EPSILON)
  ) {
    const denominator = g1 - g0

    if (Math.abs(denominator) <= CURVE_COORDINATE_EPSILON) {
      return 0
    }

    const eta = (3 * g1) / denominator

    if (x < eta) {
      const scaledX = (eta - x) / eta

      return g1 + (g0 - g1) * scaledX * scaledX
    }

    return g1
  }

  if (
    (g0 >= -CURVE_COORDINATE_EPSILON && g1 > CURVE_COORDINATE_EPSILON) ||
    (g0 <= CURVE_COORDINATE_EPSILON && g1 < -CURVE_COORDINATE_EPSILON)
  ) {
    const denominator = g0 + g1

    if (Math.abs(denominator) <= CURVE_COORDINATE_EPSILON) {
      return 0
    }

    const eta = g1 / denominator
    const blend = -0.5 * (eta * g0 + (1 - eta) * g1)

    if (x <= eta) {
      const scaledX = (eta - x) / eta

      return blend + (g0 - blend) * scaledX * scaledX
    }

    const scaledX = (x - eta) / (1 - eta)

    return blend + (g1 - blend) * scaledX * scaledX
  }

  return 0
}

function evaluateMonotoneConvexForwardRate(
  queryYearFraction: number,
  monotoneConvexForwardCurve: MonotoneConvexForwardCurve,
) {
  const { points, intervalYears, intervalForwards, nodeForwards } = monotoneConvexForwardCurve

  if (
    queryYearFraction < points[0].yearFraction - CURVE_COORDINATE_EPSILON ||
    queryYearFraction > points[points.length - 1].yearFraction + CURVE_COORDINATE_EPSILON
  ) {
    return null
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const leftPoint = points[index]
    const rightPoint = points[index + 1]

    if (queryYearFraction > rightPoint.yearFraction + CURVE_COORDINATE_EPSILON) {
      continue
    }

    const intervalYearFraction = intervalYears[index]
    const x = Math.max(0, Math.min(1, (queryYearFraction - leftPoint.yearFraction) / intervalYearFraction))
    const baseForward = intervalForwards[index]
    const deviationStart = nodeForwards[index] - baseForward
    const deviationEnd = nodeForwards[index + 1] - baseForward

    return baseForward + evaluateMonotoneConvexDeviation(x, deviationStart, deviationEnd)
  }

  return nodeForwards[nodeForwards.length - 1]
}

function calculatePchipEndpointSlope(firstIntervalYears: number, secondIntervalYears: number, firstDelta: number, secondDelta: number) {
  const endpointSlope =
    ((2 * firstIntervalYears + secondIntervalYears) * firstDelta - firstIntervalYears * secondDelta) /
    (firstIntervalYears + secondIntervalYears)

  if (Math.sign(endpointSlope) !== Math.sign(firstDelta)) {
    return 0
  }

  if (Math.sign(firstDelta) !== Math.sign(secondDelta) && Math.abs(endpointSlope) > 3 * Math.abs(firstDelta)) {
    return 3 * firstDelta
  }

  return endpointSlope
}

function buildPchipLogDiscountFactorCurve(points: DiscountFactorPoint[]): PchipLogDiscountFactorCurve | null {
  if (points.length < 2) {
    return null
  }

  const logDiscountFactors = points.map((point) => Math.log(point.discountFactor))
  const intervalYears: number[] = []
  const deltas: number[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const intervalYearFraction = points[index + 1].yearFraction - points[index].yearFraction

    if (intervalYearFraction <= 0) {
      return null
    }

    intervalYears.push(intervalYearFraction)
    deltas.push((logDiscountFactors[index + 1] - logDiscountFactors[index]) / intervalYearFraction)
  }

  if (deltas.length === 1) {
    return {
      points,
      logDiscountFactors,
      slopes: [deltas[0], deltas[0]],
    }
  }

  const slopes = new Array<number>(points.length).fill(0)

  for (let index = 1; index < points.length - 1; index += 1) {
    const leftDelta = deltas[index - 1]
    const rightDelta = deltas[index]

    if (
      Math.abs(leftDelta) <= CURVE_COORDINATE_EPSILON ||
      Math.abs(rightDelta) <= CURVE_COORDINATE_EPSILON ||
      Math.sign(leftDelta) !== Math.sign(rightDelta)
    ) {
      slopes[index] = 0
      continue
    }

    const leftWeight = 2 * intervalYears[index] + intervalYears[index - 1]
    const rightWeight = intervalYears[index] + 2 * intervalYears[index - 1]

    slopes[index] = (leftWeight + rightWeight) / ((leftWeight / leftDelta) + (rightWeight / rightDelta))
  }

  slopes[0] = calculatePchipEndpointSlope(intervalYears[0], intervalYears[1], deltas[0], deltas[1])
  slopes[points.length - 1] = calculatePchipEndpointSlope(
    intervalYears[intervalYears.length - 1],
    intervalYears[intervalYears.length - 2],
    deltas[deltas.length - 1],
    deltas[deltas.length - 2],
  )

  return {
    points,
    logDiscountFactors,
    slopes,
  }
}

function evaluatePchipLogDiscountFactorForwardRate(
  queryYearFraction: number,
  pchipLogDiscountFactorCurve: PchipLogDiscountFactorCurve,
) {
  const { points, logDiscountFactors, slopes } = pchipLogDiscountFactorCurve

  if (
    queryYearFraction < points[0].yearFraction - CURVE_COORDINATE_EPSILON ||
    queryYearFraction > points[points.length - 1].yearFraction + CURVE_COORDINATE_EPSILON
  ) {
    return null
  }

  if (isSameCurveCoordinate(queryYearFraction, points[points.length - 1].yearFraction)) {
    return -slopes[points.length - 1] * 100
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const leftPoint = points[index]
    const rightPoint = points[index + 1]

    if (queryYearFraction > rightPoint.yearFraction + CURVE_COORDINATE_EPSILON) {
      continue
    }

    const intervalYearFraction = rightPoint.yearFraction - leftPoint.yearFraction
    const normalizedTime = Math.max(0, Math.min(1, (queryYearFraction - leftPoint.yearFraction) / intervalYearFraction))
    const leftLogDiscountFactor = logDiscountFactors[index]
    const rightLogDiscountFactor = logDiscountFactors[index + 1]
    const leftSlope = slopes[index]
    const rightSlope = slopes[index + 1]
    const derivative =
      ((6 * normalizedTime * normalizedTime - 6 * normalizedTime) / intervalYearFraction) * leftLogDiscountFactor +
      (3 * normalizedTime * normalizedTime - 4 * normalizedTime + 1) * leftSlope +
      ((-6 * normalizedTime * normalizedTime + 6 * normalizedTime) / intervalYearFraction) * rightLogDiscountFactor +
      (3 * normalizedTime * normalizedTime - 2 * normalizedTime) * rightSlope

    return -derivative * 100
  }

  return null
}

function calculateContinuousZeroRateFromDiscountFactor(discountFactor: number, yearFraction: number) {
  if (discountFactor <= 0 || yearFraction <= 0) {
    return null
  }

  const zeroRate = (-Math.log(discountFactor) / yearFraction) * 100

  return Number.isFinite(zeroRate) ? zeroRate : null
}

function calculateNelsonSiegelSvenssonLevelFactor(yearFraction: number, tau: number) {
  if (tau <= 0 || yearFraction <= 0) {
    return null
  }

  const scaledTime = yearFraction / tau

  if (Math.abs(scaledTime) <= CURVE_COORDINATE_EPSILON) {
    return 1
  }

  return (1 - Math.exp(-scaledTime)) / scaledTime
}

function calculateNelsonSiegelSvenssonCurvatureFactor(yearFraction: number, tau: number) {
  const levelFactor = calculateNelsonSiegelSvenssonLevelFactor(yearFraction, tau)

  if (levelFactor === null) {
    return null
  }

  return levelFactor - Math.exp(-yearFraction / tau)
}

function solveLinearSystem(coefficients: number[][], constants: number[]) {
  const size = coefficients.length
  const augmentedMatrix = coefficients.map((row, index) => [...row, constants[index]])

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let maxRowIndex = pivotIndex

    for (let candidateIndex = pivotIndex + 1; candidateIndex < size; candidateIndex += 1) {
      if (Math.abs(augmentedMatrix[candidateIndex][pivotIndex]) > Math.abs(augmentedMatrix[maxRowIndex][pivotIndex])) {
        maxRowIndex = candidateIndex
      }
    }

    if (Math.abs(augmentedMatrix[maxRowIndex][pivotIndex]) <= LINEAR_SYSTEM_EPSILON) {
      return null
    }

    ;[augmentedMatrix[pivotIndex], augmentedMatrix[maxRowIndex]] = [augmentedMatrix[maxRowIndex], augmentedMatrix[pivotIndex]]

    for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
      const eliminationFactor = augmentedMatrix[rowIndex][pivotIndex] / augmentedMatrix[pivotIndex][pivotIndex]

      for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
        augmentedMatrix[rowIndex][columnIndex] -= eliminationFactor * augmentedMatrix[pivotIndex][columnIndex]
      }
    }
  }

  const solution = new Array<number>(size).fill(0)

  for (let rowIndex = size - 1; rowIndex >= 0; rowIndex -= 1) {
    let accumulator = augmentedMatrix[rowIndex][size]

    for (let columnIndex = rowIndex + 1; columnIndex < size; columnIndex += 1) {
      accumulator -= augmentedMatrix[rowIndex][columnIndex] * solution[columnIndex]
    }

    if (Math.abs(augmentedMatrix[rowIndex][rowIndex]) <= LINEAR_SYSTEM_EPSILON) {
      return null
    }

    solution[rowIndex] = accumulator / augmentedMatrix[rowIndex][rowIndex]
  }

  return solution
}

function solveNelsonSiegelSvenssonBetas(points: DiscountFactorPoint[], tau1: number, tau2: number) {
  const gramMatrix = Array.from({ length: 4 }, () => new Array<number>(4).fill(0))
  const rightHandSide = new Array<number>(4).fill(0)

  for (const point of points) {
    const targetZeroRate = calculateContinuousZeroRateFromDiscountFactor(point.discountFactor, point.yearFraction)
    const levelFactor = calculateNelsonSiegelSvenssonLevelFactor(point.yearFraction, tau1)
    const firstCurvatureFactor = calculateNelsonSiegelSvenssonCurvatureFactor(point.yearFraction, tau1)
    const secondCurvatureFactor = calculateNelsonSiegelSvenssonCurvatureFactor(point.yearFraction, tau2)

    if (
      targetZeroRate === null ||
      levelFactor === null ||
      firstCurvatureFactor === null ||
      secondCurvatureFactor === null
    ) {
      return null
    }

    const loadings = [1, levelFactor, firstCurvatureFactor, secondCurvatureFactor]

    for (let rowIndex = 0; rowIndex < loadings.length; rowIndex += 1) {
      rightHandSide[rowIndex] += loadings[rowIndex] * targetZeroRate

      for (let columnIndex = 0; columnIndex < loadings.length; columnIndex += 1) {
        gramMatrix[rowIndex][columnIndex] += loadings[rowIndex] * loadings[columnIndex]
      }
    }
  }

  for (let diagonalIndex = 0; diagonalIndex < gramMatrix.length; diagonalIndex += 1) {
    gramMatrix[diagonalIndex][diagonalIndex] += 1e-10
  }

  const betas = solveLinearSystem(gramMatrix, rightHandSide)

  if (!betas) {
    return null
  }

  return {
    beta0: betas[0],
    beta1: betas[1],
    beta2: betas[2],
    beta3: betas[3],
    tau1,
    tau2,
  }
}

function evaluateNelsonSiegelSvenssonZeroRate(yearFraction: number, fit: NelsonSiegelSvenssonFit) {
  const levelFactor = calculateNelsonSiegelSvenssonLevelFactor(yearFraction, fit.tau1)
  const firstCurvatureFactor = calculateNelsonSiegelSvenssonCurvatureFactor(yearFraction, fit.tau1)
  const secondCurvatureFactor = calculateNelsonSiegelSvenssonCurvatureFactor(yearFraction, fit.tau2)

  if (levelFactor === null || firstCurvatureFactor === null || secondCurvatureFactor === null) {
    return null
  }

  return fit.beta0 + fit.beta1 * levelFactor + fit.beta2 * firstCurvatureFactor + fit.beta3 * secondCurvatureFactor
}

function evaluateNelsonSiegelSvenssonForwardRate(yearFraction: number, fit: NelsonSiegelSvenssonFit) {
  if (yearFraction <= 0) {
    return null
  }

  const firstScaledTime = yearFraction / fit.tau1
  const secondScaledTime = yearFraction / fit.tau2

  return (
    fit.beta0 +
    fit.beta1 * Math.exp(-firstScaledTime) +
    fit.beta2 * firstScaledTime * Math.exp(-firstScaledTime) +
    fit.beta3 * secondScaledTime * Math.exp(-secondScaledTime)
  )
}

function fitNelsonSiegelSvenssonCurve(points: DiscountFactorPoint[]) {
  if (points.length < 4) {
    return null
  }

  let bestFit: (NelsonSiegelSvenssonFit & { error: number }) | null = null

  for (const tau1 of nelsonSiegelSvenssonTauGrid) {
    for (const tau2 of nelsonSiegelSvenssonTauGrid) {
      if (tau2 <= tau1) {
        continue
      }

      const fit = solveNelsonSiegelSvenssonBetas(points, tau1, tau2)

      if (!fit) {
        continue
      }

      let squaredError = 0

      for (const point of points) {
        const observedZeroRate = calculateContinuousZeroRateFromDiscountFactor(point.discountFactor, point.yearFraction)
        const fittedZeroRate = evaluateNelsonSiegelSvenssonZeroRate(point.yearFraction, fit)

        if (observedZeroRate === null || fittedZeroRate === null) {
          squaredError = Number.POSITIVE_INFINITY
          break
        }

        squaredError += (fittedZeroRate - observedZeroRate) ** 2
      }

      if (!Number.isFinite(squaredError)) {
        continue
      }

      if (!bestFit || squaredError < bestFit.error) {
        bestFit = {
          ...fit,
          error: squaredError,
        }
      }
    }
  }

  return bestFit
}

function buildSmoothedForwardRates(
  displayPoints: DiscountFactorPoint[],
  anchorPoints: DiscountFactorPoint[],
  smoothingMethod: TreasuryForwardSmoothingMethod,
) {
  const rawForwardRates = buildRawForwardRates(displayPoints)

  if (smoothingMethod === 'raw' || anchorPoints.length < 2) {
    return rawForwardRates
  }

  const evaluateForwardRate = (() => {
    if (smoothingMethod === 'monotone_convex') {
      const monotoneConvexForwardCurve = buildMonotoneConvexForwardCurve(anchorPoints)

      return monotoneConvexForwardCurve
        ? (yearFraction: number) => evaluateMonotoneConvexForwardRate(yearFraction, monotoneConvexForwardCurve)
        : null
    }

    if (smoothingMethod === 'pchip_log_discount_factor') {
      const pchipLogDiscountFactorCurve = buildPchipLogDiscountFactorCurve(anchorPoints)

      return pchipLogDiscountFactorCurve
        ? (yearFraction: number) => evaluatePchipLogDiscountFactorForwardRate(yearFraction, pchipLogDiscountFactorCurve)
        : null
    }

    const nelsonSiegelSvenssonFit = fitNelsonSiegelSvenssonCurve(anchorPoints)

    return nelsonSiegelSvenssonFit
      ? (yearFraction: number) => evaluateNelsonSiegelSvenssonForwardRate(yearFraction, nelsonSiegelSvenssonFit)
      : null
  })()

  if (!evaluateForwardRate) {
    return rawForwardRates
  }

  return displayPoints.map<number | null>((point, index) => {
    if (index === 0) {
      return null
    }

    const smoothedForwardRate = evaluateForwardRate(point.yearFraction)

    return smoothedForwardRate === null ? rawForwardRates[index] : normalizeCurveCoordinate(smoothedForwardRate)
  })
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
  options?: { interpolationIntervalMonths?: number; interpolationMethod?: TreasuryInterpolationMethod },
) {
  const interpolationMethod = options?.interpolationMethod ?? 'log_linear_discount_factor'
  const anchors = bootstrapDiscountFactorAnchors(instruments, interpolationMethod)
  const interpolationIntervalMonths = options?.interpolationIntervalMonths ?? 6
  const interpolatedNodes = createInterpolatedDisplayNodes(anchors, interpolationIntervalMonths, interpolationMethod)

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

export function buildTreasurySpotCurveNodes(
  instruments: TreasuryDiscountCurveInstrument[],
  options?: {
    interpolationIntervalMonths?: number
    interpolationMethod?: TreasuryInterpolationMethod
    spotRateConvention?: TreasurySpotRateConvention
  },
) {
  const spotRateConvention = options?.spotRateConvention ?? 'semiannual_bond_equivalent'
  const derivedNodes = buildTreasuryDerivedCurveNodes(instruments, {
    interpolationIntervalMonths: options?.interpolationIntervalMonths,
    interpolationMethod: options?.interpolationMethod,
  })

  return derivedNodes.flatMap<TreasurySpotCurveNode>((node) => {
    const spotRate = deriveSpotRateFromDiscountFactor(node.discountFactor, node.yearFraction, spotRateConvention)

    if (spotRate === null) {
      return []
    }

    return [
      {
        ...node,
        spotRate: normalizeCurveCoordinate(spotRate),
        spotRateConvention,
      },
    ]
  })
}

export function buildTreasuryForwardCurveNodes(
  instruments: TreasuryDiscountCurveInstrument[],
  options?: {
    interpolationIntervalMonths?: number
    interpolationMethod?: TreasuryInterpolationMethod
    spotRateConvention?: TreasurySpotRateConvention
    smoothingMethod?: TreasuryForwardSmoothingMethod
  },
) {
  const spotNodes = buildTreasurySpotCurveNodes(instruments, options)
  const displayPoints = spotNodes.map<DiscountFactorPoint>((node) => ({
    yearFraction: node.yearFraction,
    discountFactor: node.discountFactor,
  }))
  const anchorPoints = spotNodes
    .filter((node) => node.nodeType === 'anchor')
    .map<DiscountFactorPoint>((node) => ({
      yearFraction: node.yearFraction,
      discountFactor: node.discountFactor,
    }))
  const forwardRates = buildSmoothedForwardRates(displayPoints, anchorPoints, options?.smoothingMethod ?? 'raw')

  return spotNodes.map<TreasuryForwardCurveNode>((node, index) => {
    const previousNode = index > 0 ? spotNodes[index - 1] : null
    const intervalYears = previousNode ? node.yearFraction - previousNode.yearFraction : null
    const forwardRate = forwardRates[index]

    const forwardNode = {
      ...node,
      forwardRate,
      forwardStartYearFraction: previousNode ? previousNode.yearFraction : null,
      forwardIntervalYears: intervalYears === null ? null : normalizeCurveCoordinate(intervalYears),
    }

    return forwardNode
  })
}
