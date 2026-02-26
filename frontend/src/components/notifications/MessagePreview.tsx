import React from 'react';
import { MessageSquare } from 'lucide-react';

interface MessagePreviewProps {
  template: string;
  variables?: Record<string, string>;
  language?: string;
}

/** Replaces {{var}} placeholders with provided variable values */
function interpolate(template: string, variables: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `[${key}]`);
}

export default function MessagePreview({ template, variables = {}, language = 'en' }: MessagePreviewProps) {
  const rendered = interpolate(template, variables);

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
        <MessageSquare size={12} />
        Message Preview
        {language && (
          <span className="ml-auto bg-gray-200 text-gray-600 rounded px-1.5 py-0.5 uppercase text-[10px]">
            {language}
          </span>
        )}
      </div>
      <div className="bg-white rounded-lg p-3 border border-gray-100">
        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
          {rendered || <span className="text-gray-300 italic">No message content yet...</span>}
        </p>
      </div>
      {Object.keys(variables).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(variables).map(([k, v]) => (
            <span key={k} className="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 font-mono">
              {`{{${k}}}`} = {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
