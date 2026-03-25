import { RootState } from '../index';

export const selectFaydaVerified = (state: RootState) =>
  state.faydaVerifiedCache?.verified ?? false;
