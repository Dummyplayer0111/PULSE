import React, { useState } from 'react';
import { Send, Plus, MessageSquare, AlertCircle, Languages } from 'lucide-react';
import {
  useGetNotificationsQuery,
  useSendNotificationMutation,
  useGetTemplatesQuery,
  useCreateTemplateMutation,
  useGetLanguageRoutingQuery,
} from '../services/payguardApi';
import Modal from '../components/common/Modal';
import { formatDate } from '../utils';

const EMPTY_NOTIFY = { recipientId: '', channel: 'SMS', message: '' };
const EMPTY_TMPL   = { name: '', language: 'en', body: '' };

const CHANNELS   = ['SMS', 'EMAIL', 'PUSH', 'WHATSAPP'];

// Feature 11 — all 8 supported languages (en + 7 Indian regional)
const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English'    },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी'      },
  { code: 'ta', label: 'Tamil',    native: 'தமிழ்'      },
  { code: 'te', label: 'Telugu',   native: 'తెలుగు'     },
  { code: 'kn', label: 'Kannada',  native: 'ಕನ್ನಡ'      },
  { code: 'mr', label: 'Marathi',  native: 'मराठी'      },
  { code: 'bn', label: 'Bengali',  native: 'বাংলা'       },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી'     },
];

// Distinct color per language — used for the routing badge
const LANG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  en: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' },
  hi: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.25)'  },
  ta: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.25)' },
  te: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  kn: { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.25)'  },
  mr: { color: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.25)' },
  bn: { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)'  },
  gu: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)'  },
};

function langStyle(code: string) {
  return LANG_COLORS[code] ?? LANG_COLORS.en;
}

function langLabel(code: string) {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}

function staStyle(s: string) {
  const m: any = {
    SENT:    { color: '#4ade80', bg: '#4ade801a' },
    FAILED:  { color: '#ef4444', bg: '#ef44441a' },
    PENDING: { color: '#9ca3af', bg: '#9ca3af1a' },
  };
  return m[s] ?? { color: '#9ca3af', bg: '#9ca3af1a' };
}

const inputStyle: React.CSSProperties = {
  background: 'var(--p-card-strong)',
  border: '1px solid var(--p-card-border)',
  color: 'var(--p-text)',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '13px',
};

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2.5 text-sm font-medium transition-all capitalize"
      style={{
        color: active ? 'var(--p-heading)' : 'var(--p-heading-dim)',
        borderBottom: active ? '2px solid var(--p-heading)' : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );
}

export default function Communications() {
  const [tab, setTab] = useState<'notifications' | 'templates'>('notifications');

  const { data: notifications = [], isLoading: notifLoading, isError: notifError } = useGetNotificationsQuery();
  const { data: routing } = useGetLanguageRoutingQuery();
  const [sendNotification, { isLoading: sending }] = useSendNotificationMutation();
  const [notifForm, setNotifForm] = useState(EMPTY_NOTIFY);
  const [notifLang, setNotifLang] = useState('en');
  const [notifMsg,  setNotifMsg]  = useState('');

  const { data: templates = [], isLoading: tmplLoading, isError: tmplError } = useGetTemplatesQuery();
  const [createTemplate, { isLoading: creating }] = useCreateTemplateMutation();
  const [showTmpl, setShowTmpl] = useState(false);
  const [tmplForm, setTmplForm] = useState(EMPTY_TMPL);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await sendNotification({ ...notifForm, language: notifLang }) as any;
    setNotifMsg(res.error ? 'Failed to send notification.' : 'Notification sent successfully.');
    if (!res.error) setNotifForm(EMPTY_NOTIFY);
    setTimeout(() => setNotifMsg(''), 4000);
  };

  const handleCreateTemplate = async () => {
    await createTemplate(tmplForm);
    setShowTmpl(false);
    setTmplForm(EMPTY_TMPL);
  };

  return (
    <div className="p-6 space-y-4" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)' }}
        >
          <MessageSquare size={16} style={{ color: '#60a5fa' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Communications</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--p-heading-dim)' }}>
            Send customer notifications and manage message templates
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--p-card-border)' }}>
        <TabBtn label="notifications" active={tab === 'notifications'} onClick={() => setTab('notifications')} />
        <TabBtn label="templates"     active={tab === 'templates'}     onClick={() => setTab('templates')}     />
      </div>

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="space-y-6">

          {/* Feature 11 — Language Routing summary */}
          {routing && (routing as any).total > 0 && (
            <div
              className="rounded-2xl p-6"
              style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Languages size={16} style={{ color: '#a78bfa' }} />
                <h3 className="text-sm font-semibold text-white">Multilingual Auto-Routing</h3>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                  style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)' }}
                >
                  Feature 11
                </span>
                <span className="ml-auto text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {(routing as any).total} ATMs · auto-detected from region
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {((routing as any).distribution || []).map((d: any) => {
                  const st = langStyle(d.code);
                  return (
                    <div
                      key={d.code}
                      className="rounded-xl px-3 py-2.5 flex flex-col"
                      style={{ background: st.bg, border: `1px solid ${st.border}` }}
                      title={`${d.count} ATMs (${d.percent}%)`}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: st.color }}>
                          {d.code}
                        </span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {d.percent}%
                        </span>
                      </div>
                      <div className="text-[13px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {d.count}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {d.name}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Customer SMS alerts are automatically sent in the regional language of the
                affected ATM — no manual routing required.
              </p>
            </div>
          )}

          {/* Send form */}
          <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Send Notification</h3>
            <form onSubmit={handleSend} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Recipient ID
                  </label>
                  <input
                    type="text"
                    value={notifForm.recipientId}
                    onChange={e => setNotifForm(f => ({ ...f, recipientId: e.target.value }))}
                    placeholder="Customer UUID or phone number"
                    className="w-full px-3 py-2.5"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Channel
                  </label>
                  <select
                    value={notifForm.channel}
                    onChange={e => setNotifForm(f => ({ ...f, channel: e.target.value }))}
                    className="w-full px-3 py-2.5"
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {CHANNELS.map(c => <option key={c} value={c} style={{ background: '#1a1a22' }}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Message
                  </label>
                  <select
                    value={notifLang}
                    onChange={e => setNotifLang(e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ ...inputStyle, fontSize: '11px', borderRadius: '8px' }}
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} style={{ background: '#1a1a22' }}>{l.label}</option>)}
                  </select>
                </div>
                <textarea
                  value={notifForm.message}
                  onChange={e => setNotifForm(f => ({ ...f, message: e.target.value }))}
                  rows={3}
                  placeholder="Enter the notification message…"
                  className="w-full px-3 py-2.5 resize-none"
                  style={{ ...inputStyle, fontFamily: 'inherit' }}
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={sending || !notifForm.recipientId || !notifForm.message}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}
                >
                  {sending ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : <Send size={14} />}
                  {sending ? 'Sending…' : 'Send'}
                </button>
                {notifMsg && (
                  <span
                    className="text-sm"
                    style={{ color: notifMsg.includes('success') ? '#4ade80' : '#ef4444' }}
                  >
                    {notifMsg}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Sent history */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--p-card-border)' }}>
              <h3 className="text-sm font-semibold text-white">Sent Notifications</h3>
            </div>
            {notifLoading ? (
              <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
            ) : notifError ? (
              <div className="p-10 text-center space-y-2">
                <AlertCircle size={28} style={{ color: 'rgba(245,158,11,0.6)', margin: '0 auto' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Notification history unavailable — backend model pending.
                </p>
              </div>
            ) : (notifications as any[]).length === 0 ? (
              <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No notifications sent yet.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                    {['Recipient', 'Channel', 'Language', 'Message', 'Status', 'Sent'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(notifications as any[]).map((n: any) => {
                    const st = staStyle(n.status || 'SENT');
                    const lang = (n.language || 'en').toLowerCase();
                    const ls = langStyle(lang);
                    return (
                      <tr key={n.id} className="transition-colors" style={{ borderBottom: '1px solid var(--p-card-border)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                      >
                        <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {n.recipientId || n.recipient || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{n.channel || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider inline-flex items-center gap-1"
                            style={{ color: ls.color, background: ls.bg, border: `1px solid ${ls.border}` }}
                            title={langLabel(lang)}
                          >
                            {lang}
                            <span className="opacity-70 normal-case tracking-normal">{langLabel(lang)}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-white max-w-xs truncate">{n.message || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: st.color, background: st.bg }}>
                            {n.status || 'SENT'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {formatDate(n.createdAt || n.sentAt || n.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Templates tab */}
      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowTmpl(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--p-card-strong)', border: '1px solid var(--p-card-border)', color: 'var(--p-text)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--p-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--p-card-strong)')}
            >
              <Plus size={14} />
              New Template
            </button>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--p-card)', border: '1px solid var(--p-card-border)' }}
          >
            {tmplLoading ? (
              <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
            ) : tmplError ? (
              <div className="p-10 text-center space-y-2">
                <AlertCircle size={28} style={{ color: 'rgba(245,158,11,0.6)', margin: '0 auto' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Templates unavailable — backend model pending.
                </p>
              </div>
            ) : (templates as any[]).length === 0 ? (
              <div className="p-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No templates yet. Create one to get started.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--p-card-border)' }}>
                    {['Name', 'Language', 'Body', 'Created'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(templates as any[]).map((t: any) => (
                    <tr key={t.id} className="transition-colors" style={{ borderBottom: '1px solid var(--p-card-border)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                    >
                      <td className="px-5 py-3.5 text-sm font-semibold text-white">{t.name || '—'}</td>
                      <td className="px-5 py-3.5 text-xs uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.language || 'en'}</td>
                      <td className="px-5 py-3.5 text-sm max-w-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {t.body || t.content || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {formatDate(t.createdAt || t.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Create template modal */}
          <Modal isOpen={showTmpl} onClose={() => setShowTmpl(false)} title="Create Template">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={tmplForm.name}
                    onChange={e => setTmplForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. ATM_OFFLINE_ALERT"
                    className="w-full px-3 py-2.5"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Language
                  </label>
                  <select
                    value={tmplForm.language}
                    onChange={e => setTmplForm(f => ({ ...f, language: e.target.value }))}
                    className="w-full px-3 py-2.5"
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} style={{ background: '#1a1a22' }}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Message Body <span className="normal-case opacity-50">(use {'{{variable}}'} for placeholders)</span>
                </label>
                <textarea
                  value={tmplForm.body}
                  onChange={e => setTmplForm(f => ({ ...f, body: e.target.value }))}
                  rows={4}
                  placeholder="Dear {{name}}, ATM {{atm_id}} at {{location}} is offline…"
                  className="w-full px-3 py-2.5 resize-none"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowTmpl(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--p-card-strong)', border: '1px solid var(--p-card-border)', color: 'rgba(255,255,255,0.7)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={creating || !tmplForm.name || !tmplForm.body}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#0b0b0f' }}
                >
                  {creating ? 'Creating…' : 'Create Template'}
                </button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}
