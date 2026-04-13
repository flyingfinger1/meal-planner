import { useState, useEffect } from 'react';
import { getCalendarSettings, saveCalendarSettings } from '../api';

interface CalendarSettingsProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function CalendarSettings({ onClose, onSaved }: CalendarSettingsProps) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('Kinder zu Besuch');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getCalendarSettings().then(s => {
      setUrl(s.ical_url);
      setLabel(s.ical_label);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveCalendarSettings({ ical_url: url, ical_label: label });
    setSaving(false);
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-[28rem] sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">Kalender-Einstellungen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              iCal-URL (Google Calendar)
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/...basic.ics"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Google Calendar &rarr; Einstellungen &rarr; Kalender &rarr; Geheime Adresse im iCal-Format
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bezeichnung
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="z.B. Kinder zu Besuch"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
          >
            {saved ? 'Gespeichert!' : saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-300 text-right">{import.meta.env.VITE_APP_VERSION ?? 'dev'}</p>
        </div>
      </div>
    </div>
  );
}
