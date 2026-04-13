import { useState, useEffect } from 'react';
import type { User } from '../types';
import { getGroupByInviteCode, joinGroup, switchGroup, login, register } from '../api';

interface InviteHandlerProps {
  currentUser: User | null;
  googleEnabled: boolean;
  onJoined: (groupId: number) => void;
  onLogin: (user: User, groupId: number | null) => void;
}

type GroupInfo = { id: number; name: string; memberCount: number };
type AuthTab = 'login' | 'register';

function extractCode(): string {
  const match = window.location.pathname.match(/\/invite\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

export default function InviteHandler({ currentUser, googleEnabled, onJoined, onLogin }: InviteHandlerProps) {
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
                {googleEnabled && (
                  <>
                    <div className="relative flex items-center gap-2 my-1">
                      <div className="flex-1 border-t border-gray-200" />
                      <span className="text-xs text-gray-400">oder</span>
                      <div className="flex-1 border-t border-gray-200" />
                    </div>
                    <a
                      href={`/api/auth/google?invite=${code}`}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        <path fill="none" d="M0 0h48v48H0z"/>
                      </svg>
                      Mit Google & beitreten
                    </a>
                  </>
                )}
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
