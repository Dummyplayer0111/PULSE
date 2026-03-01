import React, { useState } from 'react';
import { Send, Plus, MessageSquare, AlertCircle } from 'lucide-react';
import {
  useGetNotificationsQuery,
  useSendNotificationMutation,
  useGetTemplatesQuery,
  useCreateTemplateMutation,
} from '../services/pulseApi';
import Modal from '../components/common/Modal';
import { formatDate } from '../utils';

const EMPTY_NOTIFY = { recipientId: '', channel: 'SMS', message: '' };
const EMPTY_TMPL   = { name: '', language: 'en', body: '' };

const CHANNELS   = ['SMS', 'EMAIL', 'PUSH', 'WHATSAPP'];
const LANGUAGES  = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi'   },
  { code: 'ta', label: 'Tamil'   },
  { code: 'te', label: 'Telugu'  },
  { code: 'bn', label: 'Bengali' },
];

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
                    {['Recipient', 'Channel', 'Message', 'Status', 'Sent'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(notifications as any[]).map((n: any) => {
                    const st = staStyle(n.status || 'SENT');
                    return (
                      <tr key={n.id} className="transition-colors" style={{ borderBottom: '1px solid var(--p-card-border)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--p-card-hover)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                      >
                        <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {n.recipientId || n.recipient || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{n.channel || '—'}</td>
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
