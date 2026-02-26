import React from 'react';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en',    label: 'English'  },
  { code: 'hi',    label: 'हिन्दी'   },
  { code: 'ta',    label: 'தமிழ்'    },
  { code: 'te',    label: 'తెలుగు'   },
  { code: 'kn',    label: 'ಕನ್ನಡ'   },
  { code: 'ml',    label: 'മലയാളം'  },
  { code: 'mr',    label: 'मराठी'    },
  { code: 'bn',    label: 'বাংলা'   },
];

interface LanguagePickerProps {
  value: string;
  onChange: (code: string) => void;
}

export default function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <Globe size={14} className="text-gray-400 shrink-0" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>
    </div>
  );
}
