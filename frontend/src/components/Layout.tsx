import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { clearAuth } from '../store/authSlice';
import {
  LayoutDashboard, Map, AlertTriangle, Brain,
  ShieldAlert, MessageSquare, Settings, LogOut, Activity, ScrollText,
  Sun, Moon, Wrench,
} from 'lucide-react';

const ADMIN_NAV = [
  { to: '/dashboard',      label: 'Dashboard',      Icon: LayoutDashboard },
  { to: '/atm-map',        label: 'ATM Network',    Icon: Map             },
  { to: '/logs',           label: 'Logs',           Icon: ScrollText      },
  { to: '/incidents',      label: 'Incidents',      Icon: AlertTriangle   },
  { to: '/ai-analysis',    label: 'AI Analysis',    Icon: Brain           },
  { to: '/anomaly',        label: 'Anomaly',        Icon: ShieldAlert     },
  { to: '/communications', label: 'Communications', Icon: MessageSquare   },
  { to: '/settings',       label: 'Settings',       Icon: Settings        },
];

const ENGINEER_NAV = [
  { to: '/engineer', label: 'My Incidents', Icon: Wrench },
];

function getInitialTheme(): 'dark' | 'light' {
  const stored = localStorage.getItem('payguard-theme') as 'dark' | 'light' | null;
  if (stored === 'dark' || stored === 'light') return stored;
  return 'dark';
}

export default function Layout() {
  const navigate   = useNavigate();
  const dispatch   = useDispatch();
  const auth       = useSelector((s: RootState) => s.auth);
  const token      = localStorage.getItem('access_token');
  const isEngineer = auth.role === 'ENGINEER';
  const NAV        = isEngineer ? ENGINEER_NAV : ADMIN_NAV;

  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('payguard-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  if (!token) return null;

  const toggle = () => setTheme(t => {
    const next = t === 'dark' ? 'light' : 'dark';
    window.dispatchEvent(new CustomEvent('payguard-theme-change', { detail: next }));
    return next;
  });

  const handleLogout = () => {
    dispatch(clearAuth());
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--p-page)', transition: 'background 0.3s ease' }}>
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 w-60 flex flex-col z-40"
        style={{
          background: 'var(--p-sidebar)',
          borderRight: '1px solid var(--p-sidebar-border)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          boxShadow: 'inset -1px 0 0 rgba(196,151,70,0.06), 6px 0 40px rgba(0,0,0,0.7)',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}
      >
        {/* ── Liquid gold specular highlights ── */}
        <div aria-hidden style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent 5%, rgba(196,151,70,0.18) 50%, transparent 95%)',
          pointerEvents: 'none', zIndex: 10,
        }} />
        <div aria-hidden style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
          background: 'linear-gradient(180deg, rgba(196,151,70,0.14) 0%, rgba(196,151,70,0.05) 40%, transparent 100%)',
          pointerEvents: 'none', zIndex: 10,
        }} />

        {/* Logo */}
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--p-sidebar-border)' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--p-logo-bg1), var(--p-logo-bg2))',
              border: '1px solid var(--p-logo-border)',
              boxShadow: 'inset 0 1px 0 rgba(196,151,70,0.20), 0 0 12px rgba(196,151,70,0.08)',
            }}
          >
            <Activity size={15} style={{ color: '#e8af48' }} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight leading-none" style={{ color: '#feeaa5', textShadow: '0 0 12px rgba(196,151,70,0.4)' }}>PayGuard</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'pulse 2s infinite' }} />
              <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: 'var(--p-sidebar-label)' }}>
                Live
              </span>
            </div>
          </div>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              marginLeft: 'auto',
              background: 'var(--p-toggle-bg)',
              border: '1px solid var(--p-toggle-border)',
              borderRadius: '8px',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#e8af48',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>

        {/* Section label */}
        <div className="px-6 pt-5 pb-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--p-sidebar-label)' }}>
            Navigation
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
              style={({ isActive }) => ({
                color: isActive ? '#feeaa5' : 'var(--p-nav-inactive)',
                background: isActive
                  ? `linear-gradient(135deg, var(--p-nav-active-bg), var(--p-nav-active-bg2))`
                  : 'transparent',
                border: isActive
                  ? '1px solid var(--p-nav-active-bdr)'
                  : '1px solid transparent',
                boxShadow: isActive
                  ? 'inset 0 1px 0 rgba(196,151,70,0.16), 0 0 12px rgba(196,151,70,0.06)'
                  : 'none',
                textShadow: isActive ? '0 0 10px rgba(196,151,70,0.35)' : 'none',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                if (el.getAttribute('aria-current') !== 'page') {
                  el.style.color = '#feeaa5';
                  el.style.background = 'rgba(196,151,70,0.07)';
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                if (el.getAttribute('aria-current') !== 'page') {
                  el.style.color = 'var(--p-nav-inactive)';
                  el.style.background = 'transparent';
                }
              }}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid var(--p-sidebar-border)' }}>
          {/* User pill */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
            style={{
              background: 'var(--p-user-pill)',
              border: '1px solid var(--p-user-pill-border)',
              boxShadow: 'inset 0 1px 0 rgba(196,151,70,0.08)',
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
              style={{
                color: '#feeaa5',
                background: 'linear-gradient(135deg, var(--p-logo-bg1), var(--p-logo-bg2))',
                border: '1px solid var(--p-logo-border)',
              }}
            >
              {(auth.username || 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-none" style={{ color: '#feeaa5' }}>
                {auth.username || 'User'}
              </p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--p-sidebar-label)' }}>
                {auth.role || 'Operations'}
              </p>
            </div>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}
            >
              Online
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
            style={{ border: '1px solid transparent', color: 'var(--p-nav-inactive)', background: 'transparent' }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#feeaa5';
              e.currentTarget.style.background = 'rgba(196,151,70,0.08)';
              e.currentTarget.style.borderColor = 'rgba(196,151,70,0.18)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--p-nav-inactive)';
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main id="payguard-main" className="ml-60 flex-1 min-h-screen" style={{ background: 'var(--p-page)', transition: 'background 0.3s ease' }}>
        <Outlet />
      </main>
    </div>
  );
}
