import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const pulseApi = createApi({
  reducerPath: 'pulseApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'http://localhost:8000/api/',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('access_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Incidents', 'Logs', 'Anomalies', 'SelfHealActions', 'Notifications', 'Templates'],
  endpoints: (builder) => ({

    // ── AUTH ──────────────────────────────────────────────────
    // POST /api/auth/login/    → handled outside RTK Query (LandingPage / LoginPage)
    // POST /api/auth/refresh/  → handled outside RTK Query

    // ── DASHBOARD ─────────────────────────────────────────────
    getDashboardSummary: builder.query<any, void>({ query: () => 'dashboard/summary/' }),
    getHealthOverview:   builder.query<any, void>({ query: () => 'dashboard/health-overview/' }),

    // ── ATMs ──────────────────────────────────────────────────
    getATMs:             builder.query<any[], void>({            query: ()   => 'atms/' }),
    getATM:              builder.query<any, string | number>({   query: (id) => `atms/${id}/` }),
    getATMLogs:          builder.query<any[], string | number>({ query: (id) => `atms/${id}/logs/` }),
    getATMIncidents:     builder.query<any[], string | number>({ query: (id) => `atms/${id}/incidents/` }),
    getATMHealthHistory: builder.query<any[], string | number>({ query: (id) => `atms/${id}/health-history/` }),

    // ── PAYMENT CHANNELS ──────────────────────────────────────
    getChannels: builder.query<any[], void>({          query: ()   => 'channels/' }),
    getChannel:  builder.query<any, string | number>({ query: (id) => `channels/${id}/` }),

    // ── LOGS ──────────────────────────────────────────────────
    // GET /api/logs/?source=&level=&from=&to=
    getLogs: builder.query<any[], { source?: string; level?: string; from?: string; to?: string } | void>({
      query: (params) => {
        if (!params) return 'logs/';
        const p = new URLSearchParams();
        if (params.source) p.set('source', params.source);
        if (params.level)  p.set('level',  params.level);
        if (params.from)   p.set('from',   params.from);
        if (params.to)     p.set('to',     params.to);
        const qs = p.toString();
        return qs ? `logs/?${qs}` : 'logs/';
      },
      providesTags: ['Logs'],
    }),
    ingestLog: builder.mutation<any, object>({
      query:  (body) => ({ url: 'logs/ingest/', method: 'POST', body }),
      invalidatesTags: ['Logs'],
    }),

    // ── INCIDENTS ─────────────────────────────────────────────
    getIncidents: builder.query<any[], void>({
      query: () => 'incidents/',
      providesTags: ['Incidents'],
    }),
    getIncident: builder.query<any, string | number>({ query: (id) => `incidents/${id}/` }),
    updateIncident: builder.mutation<any, { id: string | number; body: object }>({
      query: ({ id, body }) => ({ url: `incidents/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['Incidents'],
    }),
    assignIncident: builder.mutation<any, { id: string | number; body: object }>({
      query: ({ id, body }) => ({ url: `incidents/${id}/assign/`, method: 'POST', body }),
      invalidatesTags: ['Incidents'],
    }),
    resolveIncident: builder.mutation<any, string | number>({
      query: (id) => ({ url: `incidents/${id}/resolve/`, method: 'POST' }),
      invalidatesTags: ['Incidents'],
    }),

    // ── AI ENGINE ─────────────────────────────────────────────
    analyzeLog:       builder.mutation<any, object>({ query: (body) => ({ url: 'ai/analyze-log/', method: 'POST', body }) }),
    getAIPredictions: builder.query<any, void>({ query: () => 'ai/predictions/' }),
    getRootCauseStats: builder.query<any, void>({ query: () => 'ai/root-cause-stats/' }),

    // ── SELF-HEAL ─────────────────────────────────────────────
    getSelfHealActions: builder.query<any[], void>({
      query: () => 'self-heal/actions/',
      providesTags: ['SelfHealActions'],
    }),
    triggerSelfHeal: builder.mutation<any, object>({
      query: (body) => ({ url: 'self-heal/trigger/', method: 'POST', body }),
      invalidatesTags: ['SelfHealActions'],
    }),

    // ── ANOMALY ───────────────────────────────────────────────
    getAnomalyFlags: builder.query<any[], void>({
      query: () => 'anomaly/flags/',
      providesTags: ['Anomalies'],
    }),
    updateAnomalyFlag: builder.mutation<any, { id: string | number; body: object }>({
      query: ({ id, body }) => ({ url: `anomaly/flags/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['Anomalies'],
    }),

    // ── NOTIFICATIONS ─────────────────────────────────────────
    getNotifications: builder.query<any[], void>({
      query: () => 'notifications/',
      providesTags: ['Notifications'],
    }),
    sendNotification: builder.mutation<any, object>({
      query: (body) => ({ url: 'notifications/send/', method: 'POST', body }),
      invalidatesTags: ['Notifications'],
    }),
    getTemplates: builder.query<any[], void>({
      query: () => 'notifications/templates/',
      providesTags: ['Templates'],
    }),
    createTemplate: builder.mutation<any, object>({
      query: (body) => ({ url: 'notifications/templates/', method: 'POST', body }),
      invalidatesTags: ['Templates'],
    }),

  }),
});

export const {
  useGetDashboardSummaryQuery,
  useGetHealthOverviewQuery,
  useGetATMsQuery,
  useGetATMQuery,
  useGetATMLogsQuery,
  useGetATMIncidentsQuery,
  useGetATMHealthHistoryQuery,
  useGetChannelsQuery,
  useGetChannelQuery,
  useGetLogsQuery,
  useIngestLogMutation,
  useGetIncidentsQuery,
  useGetIncidentQuery,
  useUpdateIncidentMutation,
  useAssignIncidentMutation,
  useResolveIncidentMutation,
  useAnalyzeLogMutation,
  useGetAIPredictionsQuery,
  useGetRootCauseStatsQuery,
  useGetSelfHealActionsQuery,
  useTriggerSelfHealMutation,
  useGetAnomalyFlagsQuery,
  useUpdateAnomalyFlagMutation,
  useGetNotificationsQuery,
  useSendNotificationMutation,
  useGetTemplatesQuery,
  useCreateTemplateMutation,
} = pulseApi;
