import { configureStore } from '@reduxjs/toolkit';
import { pulseApi } from '../services/pulseApi';
import uiReducer from './uiSlice';
import pipelineReducer from './pipelineSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    [pulseApi.reducerPath]: pulseApi.reducer,
    ui: uiReducer,
    pipeline: pipelineReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(pulseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
