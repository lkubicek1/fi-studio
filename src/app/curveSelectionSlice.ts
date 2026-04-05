import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { RootState } from '@/app/store'
import { selectableCurveSources, type CurveSource } from '@/services/api/curves.ts'

type CurveCacheStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

type CachedCurveData = {
  status: CurveCacheStatus
  body: string | null
  contentType: string | null
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

function isKnownCurve(curveKey: string) {
  return getCurve(curveKey) !== null
}

function createEmptyCurveCacheEntry(): CachedCurveData {
  return {
    status: 'idle',
    body: null,
    contentType: null,
    error: null,
    fetchedAt: null,
  }
}

export const cacheCurveData = createAsyncThunk<
  {
    curveKey: string
    body: string
    contentType: string | null
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
      const response = await fetch(curve.url, { signal })

      if (!response.ok) {
        return rejectWithValue(`Request failed with status ${response.status}`)
      }

      return {
        curveKey,
        body: await response.text(),
        contentType: response.headers.get('content-type'),
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
  reducers: {
    setSelectedCurve: (state, action: PayloadAction<string>) => {
      if (isKnownCurve(action.payload)) {
        state.selectedCurve = action.payload
      }
    },
  },
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
          body: action.payload.body,
          contentType: action.payload.contentType,
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

export const { setSelectedCurve } = curveSelectionSlice.actions
export const curveSelectionReducer = curveSelectionSlice.reducer

export const selectSelectedCurve = (state: RootState) => state.curveSelection.selectedCurve
export const selectCurveData = (state: RootState) => state.curveSelection.curveData
export const selectCachedCurveData = (state: RootState, curveKey: string) =>
  state.curveSelection.curveData[curveKey] ?? null

export const selectSelectedCurveData = (state: RootState) =>
  selectCachedCurveData(state, selectSelectedCurve(state))

export const selectActiveCurve = (state: RootState) =>
  getCurve(selectSelectedCurve(state))
