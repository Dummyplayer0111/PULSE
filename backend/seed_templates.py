import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'PULSE.settings')
django.setup()

from ATM.models import MessageTemplate

templates = [
    # English
    ('cash_jam',        'en', 'Cash Jam - English',        'Dear customer, ATM {atm_id} is temporarily unavailable due to a cash jam. Please use a nearby ATM.'),
    ('card_decline',    'en', 'Card Decline - English',    'Dear customer, your transaction at ATM {atm_id} could not be processed due to a security alert. Your card has been secured. Please contact support.'),
    ('network_failure', 'en', 'Network Failure - English', 'Dear customer, ATM {atm_id} is experiencing network issues. Please try again shortly.'),
    ('upi_timeout',     'en', 'UPI Timeout - English',     'Dear customer, your UPI transaction at ATM {atm_id} timed out. No amount has been debited. Please retry after a few minutes.'),
    ('atm_offline',     'en', 'ATM Offline - English',     'Dear customer, ATM {atm_id} is currently offline due to a technical issue. Please use a nearby ATM.'),
    # Hindi
    ('cash_jam',        'hi', 'Cash Jam - Hindi',          'प्रिय ग्राहक, ATM {atm_id} में कैश जाम के कारण सेवा अस्थायी रूप से बंद है। कृपया नजदीकी ATM का उपयोग करें।'),
    ('card_decline',    'hi', 'Card Decline - Hindi',      'प्रिय ग्राहक, ATM {atm_id} पर सुरक्षा कारणों से लेनदेन नहीं हो सका। आपका कार्ड सुरक्षित कर दिया गया है।'),
    ('network_failure', 'hi', 'Network Failure - Hindi',   'प्रिय ग्राहक, ATM {atm_id} में नेटवर्क समस्या है। कृपया थोड़ी देर बाद पुनः प्रयास करें।'),
    ('upi_timeout',     'hi', 'UPI Timeout - Hindi',       'प्रिय ग्राहक, ATM {atm_id} पर आपका UPI लेनदेन टाइमआउट हो गया। कोई राशि नहीं काटी गई।'),
    ('atm_offline',     'hi', 'ATM Offline - Hindi',       'प्रिय ग्राहक, ATM {atm_id} तकनीकी समस्या के कारण अभी बंद है। कृपया नजदीकी ATM का उपयोग करें।'),
    # Tamil
    ('cash_jam',        'ta', 'Cash Jam - Tamil',          'அன்புள்ள வாடிக்கையாளரே, ATM {atm_id} பணம் சிக்கியதால் தற்காலிகமாக செயலிழந்துள்ளது. அருகிலுள்ள ATM ஐப் பயன்படுத்தவும்.'),
    ('card_decline',    'ta', 'Card Decline - Tamil',      'அன்புள்ள வாடிக்கையாளரே, ATM {atm_id} இல் பாதுகாப்பு காரணங்களால் பரிவர்த்தனை தோல்வியடைந்தது. உங்கள் அட்டை பாதுகாக்கப்பட்டது.'),
    ('network_failure', 'ta', 'Network Failure - Tamil',   'அன்புள்ள வாடிக்கையாளரே, ATM {atm_id} இல் நெட்வொர்க் பிரச்சனை உள்ளது. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.'),
    ('upi_timeout',     'ta', 'UPI Timeout - Tamil',       'அன்புள்ள வாடிக்கையாளரே, ATM {atm_id} இல் UPI பரிவர்த்தனை தாமதமானது. தொகை கழிக்கப்படவில்லை.'),
    ('atm_offline',     'ta', 'ATM Offline - Tamil',       'அன்புள்ள வாடிக்கையாளரே, ATM {atm_id} தொழில்நுட்ப பிரச்சனையால் இப்போது இயங்கவில்லை. அருகிலுள்ள ATM ஐப் பயன்படுத்தவும்.'),
    # Marathi
    ('cash_jam',        'mr', 'Cash Jam - Marathi',        'प्रिय ग्राहक, ATM {atm_id} मध्ये कॅश जाम झाल्यामुळे सेवा तात्पुरती बंद आहे. जवळच्या ATM चा वापर करा.'),
    ('card_decline',    'mr', 'Card Decline - Marathi',    'प्रिय ग्राहक, सुरक्षेच्या कारणास्तव ATM {atm_id} वर व्यवहार होऊ शकला नाही. तुमचे कार्ड सुरक्षित केले आहे.'),
    ('network_failure', 'mr', 'Network Failure - Marathi', 'प्रिय ग्राहक, ATM {atm_id} मध्ये नेटवर्क समस्या आहे. थोड्या वेळाने पुन्हा प्रयत्न करा.'),
    ('upi_timeout',     'mr', 'UPI Timeout - Marathi',     'प्रिय ग्राहक, ATM {atm_id} वर तुमचा UPI व्यवहार टाइमआउट झाला. कोणतीही रक्कम कापली गेली नाही.'),
    ('atm_offline',     'mr', 'ATM Offline - Marathi',     'प्रिय ग्राहक, तांत्रिक समस्येमुळे ATM {atm_id} सध्या बंद आहे. जवळच्या ATM चा वापर करा.'),
    # Bengali
    ('cash_jam',        'bn', 'Cash Jam - Bengali',        'প্রিয় গ্রাহক, ATM {atm_id} ক্যাশ জ্যামের কারণে সাময়িকভাবে বন্ধ আছে। কাছের ATM ব্যবহার করুন।'),
    ('card_decline',    'bn', 'Card Decline - Bengali',    'প্রিয় গ্রাহক, নিরাপত্তার কারণে ATM {atm_id}-এ লেনদেন সম্পন্ন হয়নি। আপনার কার্ড সুরক্ষিত করা হয়েছে।'),
    ('network_failure', 'bn', 'Network Failure - Bengali', 'প্রিয় গ্রাহক, ATM {atm_id}-এ নেটওয়ার্ক সমস্যা হচ্ছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।'),
    ('upi_timeout',     'bn', 'UPI Timeout - Bengali',     'প্রিয় গ্রাহক, ATM {atm_id}-এ আপনার UPI লেনদেন টাইমআউট হয়েছে। কোনো টাকা কাটা হয়নি।'),
    ('atm_offline',     'bn', 'ATM Offline - Bengali',     'প্রিয় গ্রাহক, প্রযুক্তিগত সমস্যার কারণে ATM {atm_id} এখন বন্ধ আছে। কাছের ATM ব্যবহার করুন।'),
    # Kannada
    ('cash_jam',        'kn', 'Cash Jam - Kannada',        'ಆತ್ಮೀಯ ಗ್ರಾಹಕರೇ, ATM {atm_id} ಕ್ಯಾಶ್ ಜಾಮ್ ಕಾರಣ ತಾತ್ಕಾಲಿಕವಾಗಿ ನಿಷ್ಕ್ರಿಯವಾಗಿದೆ. ಹತ್ತಿರದ ATM ಬಳಸಿ.'),
    ('card_decline',    'kn', 'Card Decline - Kannada',    'ಆತ್ಮೀಯ ಗ್ರಾಹಕರೇ, ಭದ್ರತಾ ಕಾರಣಗಳಿಂದ ATM {atm_id} ನಲ್ಲಿ ವಹಿವಾಟು ವಿಫಲವಾಗಿದೆ. ನಿಮ್ಮ ಕಾರ್ಡ್ ಸುರಕ್ಷಿತಪಡಿಸಲಾಗಿದೆ.'),
    ('network_failure', 'kn', 'Network Failure - Kannada', 'ಆತ್ಮೀಯ ಗ್ರಾಹಕರೇ, ATM {atm_id} ನಲ್ಲಿ ನೆಟ್ವರ್ಕ್ ಸಮಸ್ಯೆ ಇದೆ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'),
    ('upi_timeout',     'kn', 'UPI Timeout - Kannada',     'ಆತ್ಮೀಯ ಗ್ರಾಹಕರೇ, ATM {atm_id} ನಲ್ಲಿ UPI ವಹಿವಾಟು ಟೈಮ್ಔಟ್ ಆಗಿದೆ. ಯಾವುದೇ ಮೊತ್ತ ಕಡಿತಗೊಂಡಿಲ್ಲ.'),
    ('atm_offline',     'kn', 'ATM Offline - Kannada',     'ಆತ್ಮೀಯ ಗ್ರಾಹಕರೇ, ತಾಂತ್ರಿಕ ಸಮಸ್ಯೆಯಿಂದ ATM {atm_id} ಇದೀಗ ಸೇವೆಯಲ್ಲಿಲ್ಲ. ಹತ್ತಿರದ ATM ಬಳಸಿ.'),
    # Telugu
    ('cash_jam',        'te', 'Cash Jam - Telugu',         'ప్రియమైన కస్టమర్, ATM {atm_id} క్యాష్ జామ్ కారణంగా తాత్కాలికంగా అందుబాటులో లేదు. దగ్గరలోని ATM ఉపయోగించండి.'),
    ('card_decline',    'te', 'Card Decline - Telugu',     'ప్రియమైన కస్టమర్, భద్రతా కారణాల వల్ల ATM {atm_id} వద్ద లావాదేవీ విఫలమైంది. మీ కార్డు సురక్షితం చేయబడింది.'),
    ('network_failure', 'te', 'Network Failure - Telugu',  'ప్రియమైన కస్టమర్, ATM {atm_id} నెట్వర్క్ సమస్య అనుభవిస్తోంది. కొంత సేపటికి మళ్ళీ ప్రయత్నించండి.'),
    ('upi_timeout',     'te', 'UPI Timeout - Telugu',      'ప్రియమైన కస్టమర్, ATM {atm_id} వద్ద మీ UPI లావాదేవీ టైమ్అవుట్ అయింది. మొత్తం డెబిట్ కాలేదు.'),
    ('atm_offline',     'te', 'ATM Offline - Telugu',      'ప్రియమైన కస్టమర్, సాంకేతిక సమస్య వల్ల ATM {atm_id} ప్రస్తుతం పనిచేయడం లేదు. దగ్గరలోని ATM ఉపయోగించండి.'),
    # Gujarati
    ('cash_jam',        'gu', 'Cash Jam - Gujarati',       'પ્રિય ગ્રાહક, ATM {atm_id} કૅશ જામના કારણે હંગામી ધોરણે બંધ છે. નજીકના ATM નો ઉપયોગ કરો.'),
    ('card_decline',    'gu', 'Card Decline - Gujarati',   'પ્રિય ગ્રાહક, સુરક્ષા કારણોસર ATM {atm_id} પર વ્યવહાર થઈ શક્યો નથી. તમારું કાર્ડ સુરક્ષિત કરવામાં આવ્યું છે.'),
    ('network_failure', 'gu', 'Network Failure - Gujarati','પ્રિય ગ્રાહક, ATM {atm_id} નેટવર્ક સમસ્યા અનુભવી રહ્યું છે. થોડા સમય પછી ફરી પ્રયાસ કરો.'),
    ('upi_timeout',     'gu', 'UPI Timeout - Gujarati',    'પ્રિય ગ્રાહક, ATM {atm_id} પર તમારો UPI વ્યવહાર ટાઈમઆઉટ થયો. કોઈ રકમ કાપવામાં આવી નથી.'),
    ('atm_offline',     'gu', 'ATM Offline - Gujarati',    'પ્રિય ગ્રાહક, તકનીકી સમસ્યાને કારણે ATM {atm_id} હાલ બંધ છે. નજીકના ATM નો ઉપયોગ કરો.'),
]

count = 0
for key, lang, name, body in templates:
    obj, created = MessageTemplate.objects.get_or_create(
        templateKey=key, language=lang, channel='SMS',
        defaults={'name': name, 'body': body}
    )
    if created:
        count += 1

print(f'Created {count} templates. Total now: {MessageTemplate.objects.count()}')
