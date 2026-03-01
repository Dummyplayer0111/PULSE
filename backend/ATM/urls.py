from django.urls import path
from . import views

urlpatterns = [

    # DASHBOARD
    path('dashboard/summary/',      views.dashboard_summary),
    path('dashboard/health-overview/', views.health_overview),

    # ATMs
    path('atms/',                          views.atm_list),
    path('atms/<int:id>/',                 views.atm_detail),
    path('atms/<int:id>/logs/',            views.atm_logs),
    path('atms/<int:id>/incidents/',       views.atm_incidents),
    path('atms/<int:id>/health-history/',  views.atm_health_history),
    path('atms/<int:id>/reset-health/',         views.atm_reset_health),
    path('atms/<int:id>/transaction-volume/',   views.atm_transaction_volume),

    # CHANNELS
    path('channels/',           views.channel_list),
    path('channels/<int:id>/',  views.channel_detail),

    # LOGS
    path('logs/ingest/',  views.log_ingest),
    path('logs/',         views.log_list),

    # INCIDENTS
    path('incidents/',                      views.incident_list),
    path('incidents/<int:id>/',             views.incident_detail),
    path('incidents/<int:id>/assign/',      views.assign_incident),
    path('incidents/<int:id>/resolve/',     views.resolve_incident),

    # AI ENGINE
    path('ai/analyze-log/',       views.ai_analyze_log),
    path('ai/predictions/',       views.ai_predictions),
    path('ai/root-cause-stats/',  views.ai_root_cause_stats),
    path('ai/failure-trend/',     views.ai_failure_trend),

    # SELF HEAL
    path('self-heal/actions/',  views.self_heal_actions),
    path('self-heal/trigger/',  views.self_heal_trigger),

    # ANOMALY
    path('anomaly/flags/',          views.anomaly_flags),
    path('anomaly/flags/<int:id>/', views.update_anomaly_flag),

    # NOTIFICATIONS
    path('notifications/',            views.notification_list),
    path('notifications/send/',       views.send_notification),
    path('notifications/templates/',  views.template_list),

    # SIMULATOR CONTROL
    path('simulator/start/',   views.simulator_start),
    path('simulator/stop/',    views.simulator_stop),
    path('simulator/status/',  views.simulator_status),

    # PIPELINE FEED (REST fallback for live feed)
    path('pipeline/events/',   views.recent_pipeline_events),
]
