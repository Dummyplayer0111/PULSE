import { configureStore } from '@reduxjs/toolkit';
import { payguardApi } from '../services/payguardApi';
import uiReducer from './uiSlice';
import pipelineReducer from './pipelineSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    [payguardApi.reducerPath]: payguardApi.reducer,
    ui: uiReducer,
    pipeline: pipelineReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(payguardApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
