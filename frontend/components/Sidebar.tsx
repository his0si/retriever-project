import Profile from './Profile';
import ChatHistory from './ChatHistory';
import Image from 'next/image';
import { useDarkMode } from '../app/providers';

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  selectedSessionId,
  setSelectedSessionId,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  isMobile
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
  mobileSidebarOpen?: boolean;
  setMobileSidebarOpen?: (open: boolean) => void;
  isMobile?: boolean;
}) {
  const { darkMode } = useDarkMode();
  return (
    <>
      {/* PC/Tablet Sidebar */}
      <div
        className={`hidden sm:fixed sm:top-0 sm:left-0 sm:h-full sm:z-30 sm:bg-gray-50 dark:sm:bg-gray-800 sm:shadow-lg sm:transition-all sm:duration-200 sm:flex sm:flex-col sm:items-center ${sidebarOpen ? 'sm:w-64' : 'sm:w-16'}`}
      >
        {/* 닫힌 상태: 로고만 */}
        {!sidebarOpen && (
          <button
            className="mt-4 mb-2 p-0 bg-transparent border-none focus:outline-none"
            onClick={() => setSidebarOpen(true)}
            aria-label="사이드바 열기"
          >
            <Image
              src={darkMode ? "/images/logo.png" : "/images/logo_black.png"}
              alt="Logo"
              width={32}
              height={32}
              className="transition-all duration-200"
            />
          </button>
        )}
        {/* 열린 상태: 기존 요소 */}
        {sidebarOpen && (
          <div className="flex flex-col gap-0 w-full mt-4 h-full overflow-visible">
            <div className="bg-transparent shadow-none p-0 flex-shrink-0 transition-colors duration-200">
              <Profile sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
            </div>
            <div className="w-full h-px bg-gray-200 dark:bg-gray-600 my-2 flex-shrink-0 transition-colors duration-200" />
            <div className="bg-white dark:bg-gray-800 shadow-none p-0 flex-1 min-h-0 overflow-y-auto custom-scrollbar transition-colors duration-200">
              <ChatHistory
                onSelectSession={(id) => id !== null ? setSelectedSessionId(id) : setSelectedSessionId('')}
                selectedSessionId={selectedSessionId}
              />
            </div>
          </div>
        )}
      </div>
      {/* Mobile Sidebar Drawer (상위에서 제어) */}
      {isMobile && mobileSidebarOpen && setMobileSidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/60 flex transition-opacity duration-200">
          <div className="w-64 bg-white dark:bg-gray-800 h-full shadow-lg flex flex-col items-center relative animate-slide-in-left transition-colors duration-200">
            {/* 닫기 버튼은 Profile 내부의 화살표만 사용, 상단 오른쪽 버튼 제거 */}
            <div className="w-full px-4 mt-8 flex flex-col gap-0 h-full overflow-visible">
              <div className="bg-transparent shadow-none p-0 flex-shrink-0 transition-colors duration-200">
                <Profile sidebarOpen={true} setSidebarOpen={() => setMobileSidebarOpen(false)} />
              </div>
              <div className="w-full h-px bg-gray-200 dark:bg-gray-600 my-2 flex-shrink-0 transition-colors duration-200" />
              <div className="bg-white dark:bg-gray-800 shadow-none p-0 flex-1 min-h-0 overflow-y-auto custom-scrollbar transition-colors duration-200">
                <ChatHistory
                  onSelectSession={(id) => {
                    setSelectedSessionId(id !== null ? id : '');
                    setMobileSidebarOpen(false);
                  }}
                  selectedSessionId={selectedSessionId}
                />
              </div>
            </div>
          </div>
          {/* 오버레이 클릭 시 닫기 */}
          <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}
    </>
  );
} 