import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { RootState } from '@/app/store'
import { curveSources } from '@/services/api/curves.ts'

type CurveSelectionState = {
  selectedCurve: string
}

const initialState: CurveSelectionState = {
  selectedCurve: curveSources[0]?.key ?? '',
}

function isKnownCurve(curveKey: string) {
  return curveSources.some((curve) => curve.key === curveKey)
}

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
})

export const { setSelectedCurve } = curveSelectionSlice.actions
export const curveSelectionReducer = curveSelectionSlice.reducer

export const selectSelectedCurve = (state: RootState) => state.curveSelection.selectedCurve

export const selectActiveCurve = (state: RootState) =>
  curveSources.find((curve) => curve.key === selectSelectedCurve(state)) ?? null
