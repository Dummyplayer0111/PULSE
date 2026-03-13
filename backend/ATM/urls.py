from django.urls import path
from . import views
from . import customer_views

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
    path('anomaly/flags/',                    views.anomaly_flags),
    path('anomaly/flags/<int:id>/',           views.update_anomaly_flag),
    path('anomaly/flags/<int:id>/confirm/',   views.confirm_anomaly_flag),

    # NOTIFICATIONS
    path('notifications/',            views.notification_list),
    path('notifications/send/',       views.send_notification),
    path('notifications/templates/',  views.template_list),

    # SIMULATOR CONTROL
    path('simulator/start/',   views.simulator_start),
    path('simulator/stop/',    views.simulator_stop),
    path('simulator/status/',  views.simulator_status),
    path('simulator/demo-reset/', views.demo_reset),

    # PIPELINE FEED (REST fallback for live feed)
    path('pipeline/events/',   views.recent_pipeline_events),

    # TRANSACTIONS
    path('transactions/',        views.transaction_list),
    path('transactions/ingest/', views.transaction_ingest),

    # USERS
    path('users/engineers/',   views.list_engineers),

    # CUSTOMER PORTAL
    path('customer/request-otp/',              customer_views.request_otp),
    path('customer/verify-otp/',               customer_views.verify_otp),
    path('customer/session-check/',            customer_views.session_check),
    path('customer/logout/',                   customer_views.customer_logout),
    path('customer/transactions/',             customer_views.customer_transactions),
    path('customer/transactions/<str:ref>/',   customer_views.customer_transaction_detail),
    path('customer/status/<str:token>/',       customer_views.status_by_token),
]
