import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const STORAGE_KEY = 'payguard_user';

interface AuthState {
  username: string;
  role: string;
  email: string;
}

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuthState;
  } catch {}
  return { username: '', role: '', email: '' };
}

const initialState: AuthState = loadFromStorage();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<AuthState>) {
      state.username = action.payload.username;
      state.role     = action.payload.role;
      state.email    = action.payload.email;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload));
    },
    clearAuth(state) {
      state.username = '';
      state.role     = '';
      state.email    = '';
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;
