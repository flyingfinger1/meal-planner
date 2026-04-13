import { useState, useEffect } from 'react';
import type { User } from '../types';
import { getGroupByInviteCode, joinGroup, switchGroup, login, register } from '../api';

interface InviteHandlerProps {
  currentUser: User | null;
  onJoined: (groupId: number) => void;
  onLogin: (user: User, groupId: number | null) => void;
}

type GroupInfo = { id: number; name: string; memberCount: number };
type AuthTab = 'login' | 'register';

function extractCode(): string {
  const match = window.location.pathname.match(/\/invite\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

export default function InviteHandler({ currentUser, onJoined, onLogin }: InviteHandlerProps) {
  const [code] = useState(extractCode);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Auth form state
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!code) {
      setLoadError('Ungültiger Einladungslink.');
      return;
    }
    getGroupByInviteCode(code)
      .then(info => setGroupInfo(info))
      .catch(() => setLoadError('Einladungslink ungültig oder abgelaufen.'));
  }, [code]);

  const handleJoin = async () => {
    if (!groupInfo) return;
    setJoining(true);
    setJoinError('');
    try {
      const result = await joinGroup(code);
      await switchGroup(result.groupId);
      window.history.replaceState({}, '', '/');
      onJoined(result.groupId);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Beitreten fehlgeschlagen');
    }
    setJoining(false);
  };

  const handleAuthAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      let user: User;
      let groupId: number | null;

      if (authTab === 'login') {
        const data = await login(email, password);
        user = data.user;
        groupId = data.groupId;
      } else {
        const data = await register(email, name, password);
        user = data.user;
        groupId = data.groupId ?? null;
      }

      // Now join the group
      const result = await joinGroup(code);
      await switchGroup(result.groupId);
      window.history.replaceState({}, '', '/');
      // Pass the joined groupId so the app lands directly in the group
      onLogin(user, result.groupId);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Fehler beim Anmelden');
    }
    setAuthLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden">
        {/* Banner */}
        <div className="bg-blue-600 text-white px-6 py-5">
          <p className="text-xs uppercase tracking-wider mb-1 opacity-80">Einladung</p>
          {loadError ? (
            <p className="font-semibold">{loadError}</p>
          ) : groupInfo ? (
            <>
              <h2 className="text-lg font-bold">{groupInfo.name}</h2>
              <p className="text-sm opacity-80 mt-0.5">
                {groupInfo.memberCount} Mitglied{groupInfo.memberCount !== 1 ? 'er' : ''} · Haushalt beitreten
              </p>
            </>
          ) : (
            <p className="opacity-80 text-sm">Einladung wird geladen…</p>
          )}
        </div>

        <div className="p-6">
          {groupInfo && currentUser ? (
            // Logged in: just show join button
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Angemeldet als <strong>{currentUser.name}</strong>
              </p>
              {joinError && <p className="text-red-500 text-sm">{joinError}</p>}
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
              >
                {joining ? 'Beitreten...' : `${groupInfo.name} beitreten`}
              </button>
            </div>
          ) : groupInfo ? (
            // Not logged in: show auth form
            <>
              <p className="text-sm text-gray-600 mb-4">
                Melde dich an oder registriere dich, um beizutreten.
              </p>

              {/* Auth Tabs */}
              <div className="flex rounded-lg border border-gray-200 mb-4 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setAuthError(''); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    authTab === 'login'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Anmelden
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('register'); setAuthError(''); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    authTab === 'register'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Registrieren
                </button>
              </div>

              <form onSubmit={handleAuthAndJoin} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="E-Mail-Adresse"
                  required
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {authTab === 'register' && (
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Name"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Passwort"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
                >
                  {authLoading
                    ? 'Bitte warten...'
                    : authTab === 'login'
                    ? 'Anmelden & beitreten'
                    : 'Registrieren & beitreten'}
                </button>
              </form>
            </>
          ) : !loadError ? (
            <p className="text-sm text-gray-400 text-center">Laden…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
