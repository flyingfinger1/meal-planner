interface HeaderProps {
  onShoppingClick: () => void;
  onQuickListsClick: () => void;
  onSettingsClick: () => void;
  onLogout: () => void;
  onWeekChange: (delta: number) => void;
  weekLabel: string;
}

export default function Header({ onShoppingClick, onQuickListsClick, onSettingsClick, onLogout, onWeekChange, weekLabel }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2">
      {/* Row 1: Title + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">Essensplaner</span>
          <button
            onClick={onSettingsClick}
            className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-400 hover:text-gray-600"
            aria-label="Einstellungen"
            title="Kalender-Einstellungen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
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
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-400 hover:text-gray-600"
            aria-label="Abmelden"
            title="Abmelden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
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
