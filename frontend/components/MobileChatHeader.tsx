import { Bars3BottomLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useRef, useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import ToggleSwitch from './ToggleSwitch';
import { useDarkMode } from '../app/providers';

export default function MobileChatHeader({ onHamburgerClick, onNewChat, newChatLoading, showNewChatButton = true, isGuestMode = false, onHomeClick = () => {} }: { onHamburgerClick: () => void, onNewChat: () => void, onSettingsClick: () => void, newChatLoading?: boolean, showNewChatButton?: boolean, isGuestMode?: boolean, onHomeClick?: () => void }) {
  const [showSettings, setShowSettings] = useState(false);
  const { darkMode, setDarkMode } = useDarkMode();
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
    <header className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white dark:bg-gray-800 dark:border-gray-700 relative transition-colors duration-200">
      {!isGuestMode && (
        <button onClick={onHamburgerClick} className="p-1 mr-2 text-gray-900 dark:text-white focus:outline-none transition-colors duration-200">
          <Bars3BottomLeftIcon className="w-7 h-7 text-gray-900 dark:text-white transition-colors duration-200" />
        </button>
      )}
      <span className="flex-1 text-lg font-bold text-gray-900 dark:text-white text-left transition-colors duration-200">Retriever Project</span>
      <div className="flex items-center gap-4 relative">
        {showNewChatButton && (
          <button className="p-1 text-gray-500 dark:text-white disabled:opacity-50 focus:outline-none transition-colors duration-200" onClick={onNewChat} disabled={!!newChatLoading}>
            <PencilSquareIcon className="w-6 h-6 text-gray-500 dark:text-white transition-colors duration-200" />
          </button>
        )}
        <button
          className="p-1 text-gray-500 dark:text-white focus:outline-none transition-colors duration-200"
          ref={settingsBtnRef}
          onClick={() => setShowSettings((v) => !v)}
        >
          <svg className="w-6 h-6 transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {/* 환경설정 드롭다운 */}
        {showSettings && (
          <div
            ref={settingsRef}
            className="absolute right-0 top-full mt-4 z-50 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 flex flex-col items-stretch transition-all duration-200"
          >
            {isGuestMode ? (
              <button
                className="px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none transition-colors duration-200"
                onClick={() => { setShowSettings(false); onHomeClick(); }}
              >
                홈으로 가기
              </button>
            ) : (
              <button
                className="px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none transition-colors duration-200"
                onClick={() => { setShowSettings(false); signOut({ callbackUrl: '/landing' }); }}
              >
                로그아웃
              </button>
            )}
            <div className="px-4 py-2 flex items-center gap-3 justify-between select-none">
              <span className="text-gray-800 dark:text-gray-100 transition-colors duration-200">
                다크 모드
              </span>
              <ToggleSwitch enabled={darkMode} onChange={setDarkMode} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 