import { Bars3BottomLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useRef, useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';

// ToggleSwitch 컴포넌트 (Profile에서 복사)
function ToggleSwitch({ enabled, onChange }: { enabled: boolean, onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-all duration-300
        ${enabled ? 'bg-gray-800' : 'bg-gray-100 border border-gray-200'}`}
      style={{ boxShadow: enabled ? '0 2px 8px #2224' : '0 2px 8px #0001' }}
    >
      <span
        className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all duration-300
          ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}

export default function MobileChatHeader({ onHamburgerClick, onNewChat, onSettingsClick, newChatLoading }: { onHamburgerClick: () => void, onNewChat: () => void, onSettingsClick: () => void, newChatLoading?: boolean }) {
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(event.target as Node)
      ) {
        setShowSettings(false);
      }
    }
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  return (
    <header className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white relative">
      <button onClick={onHamburgerClick} className="p-1 mr-2 text-gray-900">
        <Bars3BottomLeftIcon className="w-7 h-7" />
      </button>
      <span className="flex-1 text-lg font-bold text-gray-900 text-left">Retriever Project</span>
      <div className="flex items-center gap-4 relative">
        <button className="p-1 text-gray-500 disabled:opacity-50" onClick={onNewChat} disabled={!!newChatLoading}>
          <PencilSquareIcon className="w-6 h-6" />
        </button>
        <button
          className="p-1 text-gray-500"
          ref={settingsBtnRef}
          onClick={() => setShowSettings((v) => !v)}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {/* 환경설정 드롭다운 */}
        {showSettings && (
          <div
            ref={settingsRef}
            className="absolute right-0 top-full mt-4 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-2 flex flex-col items-stretch"
          >
            <button
              className="px-4 py-2 text-left hover:bg-gray-100 text-gray-800"
              onClick={() => { setShowSettings(false); signOut({ callbackUrl: '/landing' }); }}
            >
              로그아웃
            </button>
            <div className="px-4 py-2 flex items-center gap-3 justify-between select-none">
              <span className="text-gray-800">다크 모드</span>
              <ToggleSwitch enabled={darkMode} onChange={setDarkMode} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 