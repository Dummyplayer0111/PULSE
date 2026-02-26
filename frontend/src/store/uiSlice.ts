import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  selectedATMId: string | number | null;
  isSidePanelOpen: boolean;
}

const initialState: UIState = {
  selectedATMId: null,
  isSidePanelOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectATM(state, action: PayloadAction<string | number | null>) {
      state.selectedATMId = action.payload;
      state.isSidePanelOpen = action.payload !== null;
    },
    closeSidePanel(state) {
      state.selectedATMId = null;
      state.isSidePanelOpen = false;
    },
  },
});

export const { selectATM, closeSidePanel } = uiSlice.actions;
export default uiSlice.reducer;
