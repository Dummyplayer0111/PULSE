import React, { useState } from 'react';
import { Send, Plus } from 'lucide-react';
import {
  useGetNotificationsQuery,
  useSendNotificationMutation,
  useGetTemplatesQuery,
  useCreateTemplateMutation,
} from '../services/pulseApi';
import Badge from '../components/common/Badge';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import LanguagePicker from '../components/notifications/LanguagePicker';
import MessagePreview from '../components/notifications/MessagePreview';
import { formatDate } from '../utils';

const EMPTY_NOTIFY = { recipientId: '', channel: 'SMS', message: '' };
const EMPTY_TMPL   = { name: '', language: 'en', body: '' };

export default function Communications() {
  const [tab, setTab] = useState<'notifications' | 'templates'>('notifications');

  // Notifications
  const { data: notifications = [], isLoading: notifLoading } = useGetNotificationsQuery();
  const [sendNotification, { isLoading: sending }] = useSendNotificationMutation();
  const [notifForm, setNotifForm] = useState(EMPTY_NOTIFY);
  const [notifMsg,  setNotifMsg]  = useState('');
  const [notifLang, setNotifLang] = useState('en');

  // Templates
  const { data: templates = [], isLoading: tmplLoading } = useGetTemplatesQuery();
  const [createTemplate, { isLoading: creating }] = useCreateTemplateMutation();
  const [showTmpl, setShowTmpl] = useState(false);
  const [tmplForm, setTmplForm] = useState(EMPTY_TMPL);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await sendNotification({ ...notifForm, language: notifLang }) as any;
    setNotifMsg(res.error ? 'Failed to send.' : 'Notification sent successfully.');
    if (!res.error) setNotifForm(EMPTY_NOTIFY);
  };

  const handleCreateTemplate = async () => {
    await createTemplate(tmplForm);
    setShowTmpl(false);
    setTmplForm(EMPTY_TMPL);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="text-sm text-gray-500 mt-1">Send customer notifications and manage message templates</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-100">
        {(['notifications', 'templates'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'notifications' && (
        <div className="space-y-6">
          {/* Send form */}
          <Card title="Send Notification">
            <form onSubmit={handleSend} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient ID</label>
                  <input
                    type="text"
                    value={notifForm.recipientId}
                    onChange={e => setNotifForm(f => ({ ...f, recipientId: e.target.value }))}
                    placeholder="Customer UUID or phone number"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</label>
                  <select
                    value={notifForm.channel}
                    onChange={e => setNotifForm(f => ({ ...f, channel: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {['SMS', 'EMAIL', 'PUSH', 'WHATSAPP'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Message</label>
                  <LanguagePicker value={notifLang} onChange={setNotifLang} />
                </div>
                <textarea
                  value={notifForm.message}
                  onChange={e => setNotifForm(f => ({ ...f, message: e.target.value }))}
                  rows={3}
                  placeholder="Enter the notification message…"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {notifForm.message && (
                <MessagePreview template={notifForm.message} language={notifLang} />
              )}

              <div className="flex items-center gap-4">
                <Button type="submit" loading={sending} icon={<Send size={14} />}>
                  Send Notification
                </Button>
                {notifMsg && (
                  <span className={`text-sm ${notifMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
                    {notifMsg}
                  </span>
                )}
              </div>
            </form>
          </Card>

          {/* Notification history */}
          <Card title="Sent Notifications" padding={false}>
            {notifLoading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
            ) : (notifications as any[]).length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">No notifications sent yet.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Recipient', 'Channel', 'Message', 'Status', 'Sent'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(notifications as any[]).map((n: any) => (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{n.recipientId || n.recipient || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{n.channel || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{n.message || '—'}</td>
                      <td className="px-4 py-3"><Badge label={n.status || 'SENT'} variant="status" /></td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(n.createdAt || n.sentAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus size={14} />} onClick={() => setShowTmpl(true)}>
              New Template
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {tmplLoading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
            ) : (templates as any[]).length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">No templates yet.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'Language', 'Body', 'Created'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(templates as any[]).map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 uppercase">{t.language || 'en'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{t.body || t.content || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(t.createdAt)}</td>
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
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Template Name</label>
                  <input
                    type="text"
                    value={tmplForm.name}
                    onChange={e => setTmplForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. ATM_OFFLINE_ALERT"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Language</label>
                  <LanguagePicker value={tmplForm.language} onChange={lang => setTmplForm(f => ({ ...f, language: lang }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message Body <span className="normal-case text-gray-400">(use {'{{variable}}'} for placeholders)</span>
                </label>
                <textarea
                  value={tmplForm.body}
                  onChange={e => setTmplForm(f => ({ ...f, body: e.target.value }))}
                  rows={4}
                  placeholder="Dear {{name}}, ATM {{atm_id}} at {{location}} is currently offline…"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {tmplForm.body && (
                <MessagePreview template={tmplForm.body} language={tmplForm.language} />
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowTmpl(false)}>Cancel</Button>
                <Button loading={creating} onClick={handleCreateTemplate} disabled={!tmplForm.name || !tmplForm.body}>
                  Create
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}
