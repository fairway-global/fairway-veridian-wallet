import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface FaydaVerifiedState {
  verified: boolean;
}

const initialState: FaydaVerifiedState = {
  verified: false,
};

export const faydaVerifiedCacheSlice = createSlice({
  name: "faydaVerifiedCache",
  initialState,
  reducers: {
    setFaydaVerified(state, action: PayloadAction<boolean>) {
      state.verified = action.payload;
    },
  },
});

export const { setFaydaVerified } = faydaVerifiedCacheSlice.actions;

// Selector example (use in components):
// import { RootState } from '../index';
// export const selectFaydaVerified = (state: RootState) => state.faydaVerifiedCache.verified;
export default faydaVerifiedCacheSlice.reducer;
