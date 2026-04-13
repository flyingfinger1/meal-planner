import { useState } from 'react';
import type { User } from '../types';
import { createGroup, joinGroup, getGroupByInviteCode } from '../api';

interface GroupOnboardingProps {
  user: User;
  onGroupReady: (groupId: number) => void;
  onLogout: () => void;
}

function extractInviteCode(input: string): string {
  // If it looks like a URL, extract the code after /invite/
  const match = input.match(/\/invite\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Otherwise treat the whole trimmed input as the code
  return input.trim();
}

export default function GroupOnboarding({ user, onGroupReady, onLogout }: GroupOnboardingProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [groupName, setGroupName] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewGroup, setPreviewGroup] = useState<{ id: number; name: string; memberCount: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const group = await createGroup(groupName.trim());
      onGroupReady(group.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erstellen fehlgeschlagen');
    }
    setLoading(false);
  };

  const handleInviteChange = async (value: string) => {
    setInviteInput(value);
    setPreviewGroup(null);
    setError('');
    const code = extractInviteCode(value);
    if (code.length < 4) return;
    setPreviewLoading(true);
    try {
      const info = await getGroupByInviteCode(code);
      setPreviewGroup(info);
    } catch {
      // not a valid code yet, ignore silently
    }
    setPreviewLoading(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractInviteCode(inviteInput);
    if (!code) return;
    setError('');
    setLoading(true);
    try {
      const result = await joinGroup(code);
      onGroupReady(result.groupId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Beitreten fehlgeschlagen');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">Willkommen, {user.name}!</h1>
          <button
            onClick={onLogout}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Abmelden
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Um loszulegen, erstelle einen Haushalt oder tritt einem bestehenden bei.
        </p>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800"
            >
              Haushalt erstellen
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 active:bg-gray-100"
            >
              Einladungslink eingeben
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-3">
            <button
              type="button"
              onClick={() => { setMode('choose'); setError(''); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1"
            >
              <span>&larr;</span> Zurück
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name des Haushalts
              </label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="z.B. Familie Müller"
                autoFocus
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !groupName.trim()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              {loading ? 'Erstellt...' : 'Haushalt erstellen'}
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-3">
            <button
              type="button"
              onClick={() => { setMode('choose'); setError(''); setPreviewGroup(null); setInviteInput(''); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1"
            >
              <span>&larr;</span> Zurück
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Einladungslink oder -code
              </label>
              <input
                type="text"
                value={inviteInput}
                onChange={e => handleInviteChange(e.target.value)}
                placeholder="https://…/invite/abc123 oder abc123"
                autoFocus
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {previewLoading && (
              <p className="text-sm text-gray-400">Gruppe wird gesucht…</p>
            )}
            {previewGroup && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
                <p className="font-medium text-blue-800">{previewGroup.name}</p>
                <p className="text-blue-600">{previewGroup.memberCount} Mitglied{previewGroup.memberCount !== 1 ? 'er' : ''}</p>
              </div>
            )}
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !inviteInput.trim()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              {loading ? 'Beitreten...' : 'Haushalt beitreten'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
