import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'

import { createTreasuryPublicBootstrapInstruments, type BootstrapInstrument } from '@/app/curveData'
import type { RootState } from '@/app/store'
import { selectableCurveSources, type CurveSource } from '@/services/api/curves.ts'

type CurveCacheStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

type CachedCurveData = {
  status: CurveCacheStatus
  bootstrapInstruments: BootstrapInstrument[] | null
  error: string | null
  fetchedAt: string | null
}

type CurveSelectionState = {
  selectedCurve: string
  curveData: Record<string, CachedCurveData>
}

const initialState: CurveSelectionState = {
  selectedCurve: selectableCurveSources[0]?.key ?? '',
  curveData: {},
}

function getCurve(curveKey: string): CurveSource | null {
  return selectableCurveSources.find((curve) => curve.key === curveKey) ?? null
}

function createEmptyCurveCacheEntry(): CachedCurveData {
  return {
    status: 'idle',
    bootstrapInstruments: null,
    error: null,
    fetchedAt: null,
  }
}

export const cacheCurveData = createAsyncThunk<
  {
    curveKey: string
    bootstrapInstruments: BootstrapInstrument[]
    fetchedAt: string
  },
  string,
  { state: RootState; rejectValue: string }
>(
  'curveSelection/cacheCurveData',
  async (curveKey, { rejectWithValue, signal }) => {
    const curve = getCurve(curveKey)

    if (!curve) {
      return rejectWithValue('Unknown curve source')
    }

    try {
      const sourceBodies = await Promise.all(
        curve.sourceComponents.map(async (component) => {
          const response = await fetch(component.url, { signal })

          if (!response.ok) {
            throw new Error(`${component.title} request failed with status ${response.status}`)
          }

          return {
            key: component.key,
            body: await response.text(),
          }
        }),
      )

      const billRatesBody = sourceBodies.find((source) => source.key === 'ust_bill_rates')?.body
      const parYieldBody = sourceBodies.find((source) => source.key === 'ust_par_nominal')?.body
      const auctionBody = sourceBodies.find((source) => source.key === 'ust_auctions')?.body

      if (!billRatesBody || !parYieldBody || !auctionBody) {
        return rejectWithValue('Unable to assemble the public Treasury bootstrap dataset')
      }

      return {
        curveKey,
        bootstrapInstruments: createTreasuryPublicBootstrapInstruments({
          billRatesBody,
          parYieldBody,
          auctionBody,
        }),
        fetchedAt: new Date().toISOString(),
      }
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message)
      }

      return rejectWithValue('Unable to fetch curve data')
    }
  },
  {
    condition: (curveKey, { getState }) => {
      const cachedCurve = (getState() as RootState).curveSelection.curveData[curveKey]

      return cachedCurve?.status !== 'loading' && cachedCurve?.status !== 'succeeded'
    },
  },
)

const curveSelectionSlice = createSlice({
  name: 'curveSelection',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(cacheCurveData.pending, (state, action) => {
        const existingCurveData = state.curveData[action.meta.arg] ?? createEmptyCurveCacheEntry()

        state.curveData[action.meta.arg] = {
          ...existingCurveData,
          status: 'loading',
          error: null,
        }
      })
      .addCase(cacheCurveData.fulfilled, (state, action) => {
        state.curveData[action.payload.curveKey] = {
          status: 'succeeded',
          bootstrapInstruments: action.payload.bootstrapInstruments,
          error: null,
          fetchedAt: action.payload.fetchedAt,
        }
      })
      .addCase(cacheCurveData.rejected, (state, action) => {
        const existingCurveData = state.curveData[action.meta.arg] ?? createEmptyCurveCacheEntry()

        state.curveData[action.meta.arg] = {
          ...existingCurveData,
          status: 'failed',
          error: action.payload ?? action.error.message ?? 'Unable to fetch curve data',
        }
      })
  },
})

export const curveSelectionReducer = curveSelectionSlice.reducer

export const selectSelectedCurve = (state: RootState) => state.curveSelection.selectedCurve
export const selectCurveData = (state: RootState) => state.curveSelection.curveData

function getLatestQuoteDate(instruments: BootstrapInstrument[]) {
  let latestQuoteDate: string | null = null

  for (const instrument of instruments) {
    if (instrument.quoteDate && (!latestQuoteDate || instrument.quoteDate > latestQuoteDate)) {
      latestQuoteDate = instrument.quoteDate
    }
  }

  return latestQuoteDate
}

export const selectSelectedCurveData = createSelector(
  [selectCurveData, selectSelectedCurve],
  (curveData, selectedCurve) => curveData[selectedCurve] ?? null,
)

export const selectSelectedCurveBootstrapInstruments = createSelector(
  [selectSelectedCurveData],
  (selectedCurveData) => selectedCurveData?.bootstrapInstruments ?? [],
)

export const selectSelectedCurveLatestQuoteDate = createSelector(
  [selectSelectedCurveBootstrapInstruments],
  (bootstrapInstruments) => getLatestQuoteDate(bootstrapInstruments),
)

export const selectSelectedCurveLatestBootstrapInstruments = createSelector(
  [selectSelectedCurveBootstrapInstruments, selectSelectedCurveLatestQuoteDate],
  (bootstrapInstruments, latestQuoteDate) =>
    latestQuoteDate ? bootstrapInstruments.filter((instrument) => instrument.quoteDate === latestQuoteDate) : bootstrapInstruments,
)

export const selectActiveCurve = (state: RootState) => getCurve(selectSelectedCurve(state))
