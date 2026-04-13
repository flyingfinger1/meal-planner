import { useState, useRef, useEffect } from 'react';
import type { User, Group } from '../types';

interface HeaderProps {
  weekLabel: string;
  onWeekChange: (delta: number) => void;
  onShoppingClick: () => void;
  onQuickListsClick: () => void;
  onLogout: () => void;
  user: User;
  groups: (Group & { role: string })[];
  currentGroupId: number;
  smtpEnabled: boolean;
  onGroupSwitch: (groupId: number) => void;
  onGroupSettings: () => void;
}

export default function Header({
  onShoppingClick,
  onQuickListsClick,
  onLogout,
  onWeekChange,
  weekLabel,
  user,
  groups,
  currentGroupId,
  onGroupSwitch,
  onGroupSettings,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const initials = user.name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const currentGroup = groups.find(g => g.id === currentGroupId);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2">
      {/* Row 1: Title + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">Essensplaner</span>
          {/* Group settings */}
          <button
            onClick={onGroupSettings}
            className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-400 hover:text-gray-600"
            aria-label="Gruppen-Einstellungen"
            title={currentGroup ? `Gruppe: ${currentGroup.name}` : 'Gruppen-Einstellungen'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onQuickListsClick}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 active:bg-gray-100"
            title="Einkaufslisten"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          <button
            onClick={onShoppingClick}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 active:bg-green-800"
          >
            Einkauf
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center hover:bg-blue-700 active:bg-blue-800 flex-shrink-0"
              aria-label="Benutzermenü"
              title={user.name}
            >
              {initials}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                {/* User info */}
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-xs text-gray-400">Angemeldet als</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>

                {/* Groups */}
                <div className="py-1 border-b border-gray-100">
                  {groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => {
                        if (g.id !== currentGroupId) {
                          onGroupSwitch(g.id);
                        }
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-50 active:bg-gray-100"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 truncate text-gray-800">{g.name}</span>
                      {g.id === currentGroupId && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 flex-shrink-0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onGroupSettings();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-50 active:bg-gray-100 text-gray-600"
                  >
                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </div>
                    <span>Neue Gruppe erstellen</span>
                  </button>
                </div>

                {/* Logout */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-50 active:bg-gray-100 text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Abmelden
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Week navigation */}
      <div className="flex items-center justify-center gap-1 pt-1">
        <button
          onClick={() => onWeekChange(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-lg"
          aria-label="Vorherige Woche"
        >
          &larr;
        </button>
        <span className="text-sm font-medium min-w-[100px] text-center">{weekLabel}</span>
        <button
          onClick={() => onWeekChange(1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-lg"
          aria-label="Nächste Woche"
        >
          &rarr;
        </button>
      </div>
    </header>
  );
}
