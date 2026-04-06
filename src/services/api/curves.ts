export type CurveSourceComponent = {
  key: string
  title: string
  url: string
  note?: string
}

export type CurveSource = {
  key: string
  title: string
  kind: string
  market: string
  description: string
  sourceComponents: CurveSourceComponent[]
}

export const treasuryBillRatesSource: CurveSourceComponent = {
  key: 'ust_bill_rates',
  title: 'Treasury Bill Rates',
  url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_bill_rates&field_tdr_date_value=2026',
  note: 'Daily Treasury bill quotes with CUSIP and maturity date.',
}

export const treasuryParYieldSource: CurveSourceComponent = {
  key: 'ust_par_nominal',
  title: 'Treasury Par Yield Curve',
  url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=2026',
  note: 'Daily benchmark par yields for standard Treasury tenors.',
}

export const treasuryAuctionSource: CurveSourceComponent = {
  key: 'ust_auctions',
  title: 'Treasury Auction Metadata',
  url: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?sort=-auction_date&page[size]=400',
  note: 'Recent auction history used to identify the active fixed-coupon benchmark issues.',
}

export const curveSources: CurveSource[] = [
  {
    key: 'ust_public_hybrid',
    title: 'US Treasury Data',
    kind: 'bootstrap_dataset',
    market: 'USD',
    description:
      'Single public Treasury dataset assembled in-browser from official bill quotes, benchmark par yields, and auction metadata. Bills carry market quote conventions; coupon bond prices are derived from the benchmark yield using the active issue metadata.',
    sourceComponents: [treasuryBillRatesSource, treasuryParYieldSource, treasuryAuctionSource],
  },
]

export const selectableCurveSources = curveSources
