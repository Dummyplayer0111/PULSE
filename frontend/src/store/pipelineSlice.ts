import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PipelineEvent } from '../hooks/usePipelineSocket';

interface PipelineState {
  events: PipelineEvent[];
}

const initialState: PipelineState = { events: [] };

const pipelineSlice = createSlice({
  name: 'pipeline',
  initialState,
  reducers: {
    addEvent(state, action: PayloadAction<PipelineEvent>) {
      // Prepend newest event; keep max 100
      state.events = [action.payload, ...state.events].slice(0, 100);
    },
    clearEvents(state) {
      state.events = [];
    },
  },
});

export const { addEvent, clearEvents } = pipelineSlice.actions;
export default pipelineSlice.reducer;
