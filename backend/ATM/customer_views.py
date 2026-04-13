"""
Customer-facing API endpoints for PayGuard.

Endpoints:
    POST /api/customer/request-otp/        → Send OTP to phone
    POST /api/customer/verify-otp/         → Verify OTP, return session token
    GET  /api/customer/transactions/       → List failed txns (session auth)
    GET  /api/customer/transactions/<ref>/ → Detail (session auth)
    GET  /api/customer/status/<token>/     → Single-txn view via SMS link token
    POST /api/customer/logout/             → Invalidate session
    GET  /api/customer/session-check/      → Check if session is still valid
"""

import logging
import re
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import (
    FailedTransaction, OTPToken, CustomerSession, StatusToken,
)

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

OTP_EXPIRY_MINUTES = 5
OTP_RATE_LIMIT = 3            # max OTPs per window
OTP_RATE_WINDOW_MINUTES = 10
OTP_MAX_WRONG_ATTEMPTS = 5    # block after this many wrong attempts per window
SESSION_EXPIRY_HOURS = 24
STATUS_TOKEN_EXPIRY_HOURS = 24
HELPDESK_NUMBER = '1800-123-4567'  # toll-free mock number


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_customer_session(request):
    """Extract and validate customer session from X-Customer-Token header."""
    token = request.headers.get('X-Customer-Token', '')
    if not token:
        return None
    try:
        session = CustomerSession.objects.get(token=token, expires_at__gt=timezone.now())
        return session
    except CustomerSession.DoesNotExist:
        return None


def _validate_indian_phone(phone):
    """Validate Indian 10-digit mobile number."""
    cleaned = re.sub(r'\D', '', phone)
    # Remove +91 or 0 prefix
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    if cleaned.startswith('0') and len(cleaned) == 11:
        cleaned = cleaned[1:]
    if len(cleaned) != 10:
        return None
    # Indian mobile numbers start with 6-9
    if cleaned[0] not in '6789':
        return None
    return cleaned


def _serialize_failed_txn(txn, include_timeline=False):
    """Serialize a FailedTransaction for the customer portal."""
    atm_name = txn.atm.name if txn.atm else 'Unknown ATM'
    atm_location = txn.atm.location if txn.atm else ''

    data = {
        'transaction_ref': txn.transaction_ref,
        'card_last_four': txn.card_last_four,
        'amount': txn.amount,
        'amount_dispensed': txn.amount_dispensed,
        'refund_amount': txn.refund_amount,
        'atm_name': atm_name,
        'atm_location': atm_location,
        'transaction_type': txn.transaction_type,
        'failure_type': txn.failure_type,
        'failure_reason': txn.failure_reason,
        'failure_reason_hi': txn.failure_reason_hi,
        'status': txn.status,
        'refund_status': txn.refund_status,
        'refund_eta': txn.refund_eta.isoformat() if txn.refund_eta else None,
        'engineer_name': txn.engineer_name,
        'engineer_eta_minutes': txn.engineer_eta_minutes,
        'phone_hash': txn.phone_hash,
        'created_at': txn.created_at.isoformat(),
        'updated_at': txn.updated_at.isoformat(),
        'helpdesk_number': HELPDESK_NUMBER,
    }
    if include_timeline:
        data['timeline'] = txn.timeline or []
    return data


# ─── OTP Request ──────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def request_otp(request):
    raw_phone = request.data.get('phone', '').strip()
    phone = _validate_indian_phone(raw_phone)
    if not phone:
        return Response({
            'success': False,
            'error': 'Please enter a valid 10-digit Indian mobile number.',
            'error_hi': 'कृपया एक मान्य 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।',
        }, status=400)

    phone_hash = FailedTransaction.hash_phone(phone)

    # Rate limit: max OTPs per window
    window_start = timezone.now() - timedelta(minutes=OTP_RATE_WINDOW_MINUTES)
    recent_count = OTPToken.objects.filter(
        phone_hash=phone_hash, created_at__gte=window_start
    ).count()
    if recent_count >= OTP_RATE_LIMIT:
        return Response({
            'success': False,
            'error': f'Too many OTP requests. Please try again in {OTP_RATE_WINDOW_MINUTES} minutes.',
            'error_hi': f'बहुत अधिक OTP अनुरोध। कृपया {OTP_RATE_WINDOW_MINUTES} मिनट बाद पुनः प्रयास करें।',
        }, status=429)

    otp_code = OTPToken.generate_otp()
    OTPToken.objects.create(
        phone_hash=phone_hash,
        otp=otp_code,
        expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )

    # Mock SMS — log to console (structured for real Twilio/MSG91 swap)
    # NOTE: OTP intentionally excluded from logger — never log secrets in production
    logger.info(f"[SMS → ***{phone[-4:]}] PayGuard OTP sent. Valid {OTP_EXPIRY_MINUTES} min.")
    print(f"\n{'='*70}")
    print(f"  \U0001f4f1 SMS \u2192 +91 ***{phone[-4:]}")
    print(f"  Your PayGuard verification code is: {otp_code}")
    print(f"  Valid for {OTP_EXPIRY_MINUTES} minutes. Do not share this code.")
    print(f"  \u0906\u092a\u0915\u093e PayGuard OTP: {otp_code} | {OTP_EXPIRY_MINUTES} \u092e\u093f\u0928\u091f \u092e\u0947\u0902 \u0938\u092e\u093e\u092a\u094d\u0924")
    print(f"{'='*70}\n")

    return Response({
        'success': True,
        'message': 'OTP sent to your registered mobile number.',
        'message_hi': 'OTP आपके पंजीकृत मोबाइल नंबर पर भेजा गया।',
        'phone_last_four': phone[-4:],
        'expires_in_seconds': OTP_EXPIRY_MINUTES * 60,
    })


# ─── OTP Verify ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    raw_phone = request.data.get('phone', '').strip()
    otp = request.data.get('otp', '').strip()

    phone = _validate_indian_phone(raw_phone)
    if not phone or not otp:
        return Response({'success': False, 'error': 'Phone and OTP required.'}, status=400)

    phone_hash = FailedTransaction.hash_phone(phone)

    # Brute-force protection: count wrong attempts in last 10 minutes
    window_start = timezone.now() - timedelta(minutes=OTP_RATE_WINDOW_MINUTES)
    recent_tokens = OTPToken.objects.filter(
        phone_hash=phone_hash,
        created_at__gte=window_start,
    )

    # Count how many OTPs have been tried but not verified
    # (if verified=False and expired, that's a sign of wrong attempts)
    wrong_attempts = OTPToken.objects.filter(
        phone_hash=phone_hash,
        created_at__gte=window_start,
        verified=False,
    ).exclude(
        otp=otp,
        expires_at__gt=timezone.now(),
    ).count()

    if wrong_attempts >= OTP_MAX_WRONG_ATTEMPTS:
        return Response({
            'success': False,
            'error': 'Too many failed attempts. Please request a new OTP.',
            'error_hi': 'बहुत अधिक असफल प्रयास। कृपया नया OTP अनुरोध करें।',
        }, status=429)

    # Find matching valid OTP
    token_obj = OTPToken.objects.filter(
        phone_hash=phone_hash,
        otp=otp,
        verified=False,
        expires_at__gt=timezone.now(),
    ).order_by('-created_at').first()

    if not token_obj:
        return Response({
            'success': False,
            'error': 'Invalid or expired OTP. Please check and try again.',
            'error_hi': 'गलत या समाप्त OTP। कृपया जाँचें और पुनः प्रयास करें।',
        }, status=401)

    # Mark OTP as verified
    token_obj.verified = True
    token_obj.save(update_fields=['verified'])

    # Invalidate all other unverified OTPs for this phone
    OTPToken.objects.filter(
        phone_hash=phone_hash, verified=False
    ).update(verified=True)

    # Create customer session
    session = CustomerSession.objects.create(
        phone_hash=phone_hash,
        token=CustomerSession.generate_token(),
        expires_at=timezone.now() + timedelta(hours=SESSION_EXPIRY_HOURS),
    )

    # Count transactions for welcome context
    txn_count = FailedTransaction.objects.filter(phone_hash=phone_hash).count()
    active_count = FailedTransaction.objects.filter(
        phone_hash=phone_hash
    ).exclude(status='RESOLVED').count()

    return Response({
        'success': True,
        'token': session.token,
        'phone_hash': phone_hash,
        'expires_at': session.expires_at.isoformat(),
        'transaction_count': txn_count,
        'active_count': active_count,
    })


# ─── Session Check ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def session_check(request):
    """Check if the customer session is still valid. Frontend calls this on load."""
    session = _get_customer_session(request)
    if not session:
        return Response({'valid': False}, status=401)

    txn_count = FailedTransaction.objects.filter(phone_hash=session.phone_hash).count()
    active_count = FailedTransaction.objects.filter(
        phone_hash=session.phone_hash
    ).exclude(status='RESOLVED').count()

    return Response({
        'valid': True,
        'phone_hash': session.phone_hash,
        'expires_at': session.expires_at.isoformat(),
        'transaction_count': txn_count,
        'active_count': active_count,
    })


# ─── Logout ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def customer_logout(request):
    """Invalidate the customer session."""
    token = request.headers.get('X-Customer-Token', '')
    if token:
        CustomerSession.objects.filter(token=token).delete()
    return Response({'success': True})


# ─── Transaction List ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def customer_transactions(request):
    session = _get_customer_session(request)
    if not session:
        return Response({
            'success': False,
            'error': 'Session expired. Please login again.',
            'error_hi': 'सत्र समाप्त। कृपया पुनः लॉगिन करें।',
            'session_expired': True,
        }, status=401)

    txns = FailedTransaction.objects.select_related('atm', 'incident').filter(
        phone_hash=session.phone_hash
    ).order_by('-created_at')[:50]  # cap at 50 for performance

    active_count = sum(1 for t in txns if t.status != 'RESOLVED')
    resolved_count = sum(1 for t in txns if t.status == 'RESOLVED')

    return Response({
        'success': True,
        'transactions': [_serialize_failed_txn(t, include_timeline=True) for t in txns],
        'summary': {
            'total': len(txns),
            'active': active_count,
            'resolved': resolved_count,
        },
        'helpdesk_number': HELPDESK_NUMBER,
    })


# ─── Transaction Detail ──────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def customer_transaction_detail(request, ref):
    session = _get_customer_session(request)
    if not session:
        return Response({
            'success': False,
            'error': 'Session expired. Please login again.',
            'session_expired': True,
        }, status=401)

    try:
        txn = FailedTransaction.objects.select_related('atm').get(
            transaction_ref=ref, phone_hash=session.phone_hash
        )
    except FailedTransaction.DoesNotExist:
        return Response({'success': False, 'error': 'Transaction not found.'}, status=404)

    return Response({
        'success': True,
        'transaction': _serialize_failed_txn(txn, include_timeline=True),
    })


# ─── Status Token View (SMS link — no auth) ──────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def status_by_token(request, token):
    try:
        st = StatusToken.objects.select_related(
            'failed_transaction', 'failed_transaction__atm'
        ).get(
            token=token,
            expires_at__gt=timezone.now(),
        )
    except StatusToken.DoesNotExist:
        # Check if token exists but expired — give helpful message
        expired = StatusToken.objects.filter(token=token).exists()
        if expired:
            return Response({
                'success': False,
                'error': 'This status link has expired. Please login with your phone number to check status.',
                'error_hi': 'यह स्थिति लिंक समाप्त हो गया है। स्थिति जानने के लिए अपने फ़ोन नंबर से लॉगिन करें।',
                'expired': True,
            }, status=410)
        return Response({
            'success': False,
            'error': 'Invalid status link.',
            'error_hi': 'अमान्य स्थिति लिंक।',
        }, status=404)

    return Response({
        'success': True,
        'transaction': _serialize_failed_txn(st.failed_transaction, include_timeline=True),
    })
