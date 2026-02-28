import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, AlertTriangle, Brain,
  ShieldAlert, MessageSquare, Settings, LogOut, Activity,
} from 'lucide-react';

const NAV = [
  { to: '/dashboard',      label: 'Dashboard',      Icon: LayoutDashboard },
  { to: '/atm-map',        label: 'ATM Network',    Icon: Map             },
  { to: '/incidents',      label: 'Incidents',      Icon: AlertTriangle   },
  { to: '/ai-analysis',    label: 'AI Analysis',    Icon: Brain           },
  { to: '/anomaly',        label: 'Anomaly',        Icon: ShieldAlert     },
  { to: '/communications', label: 'Communications', Icon: MessageSquare   },
  { to: '/settings',       label: 'Settings',       Icon: Settings        },
];

export default function Layout() {
  const navigate = useNavigate();
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  if (!token) return null;

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen" style={{ background: '#0b0b0f', zoom: 1.1 }}>
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 w-60 flex flex-col z-40"
        style={{
          background: 'rgba(255,255,255,0.025)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(40px) saturate(180%)',
        }}
      >
        {/* Logo */}
        <div
          className="px-6 py-5 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.06))',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <Activity size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white leading-none">PULSE</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'pulse 2s infinite' }} />
              <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="px-6 pt-5 pb-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Navigation
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/80'
                }`
              }
              style={({ isActive }) => ({
                background: isActive
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(255,255,255,0.1)'
                  : '1px solid transparent',
                boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
              })}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {/* User pill */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-none">Admin</p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Operations
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-white/40 hover:text-white/80 hover:bg-white/5"
            style={{ border: '1px solid transparent' }}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 min-h-screen" style={{ background: '#0b0b0f' }}>
        <Outlet />
      </main>
    </div>
  );
}
