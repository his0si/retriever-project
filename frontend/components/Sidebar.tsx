import Profile from './Profile';
import ChatHistory from './ChatHistory';
import Image from 'next/image';

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  selectedSessionId,
  setSelectedSessionId
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
}) {
  return (
    <div
      className={`fixed top-0 left-0 h-full z-30 bg-gray-50 shadow-lg transition-all duration-300 flex flex-col items-center ${sidebarOpen ? 'w-64' : 'w-16'}`}
    >
      {/* 닫힌 상태: 로고만 */}
      {!sidebarOpen && (
        <button
          className="mt-4 mb-2 p-0 bg-transparent border-none focus:outline-none"
          onClick={() => setSidebarOpen(true)}
          aria-label="사이드바 열기"
        >
          <Image
            src="/images/logo_black.png"
            alt="Logo"
            width={32}
            height={32}
            className="transition-all duration-300"
          />
        </button>
      )}
      {/* 열린 상태: 기존 요소만 */}
      {sidebarOpen && (
        <div className="flex flex-col gap-0 w-full px-4 mt-4">
          {/* 프로필 - 그림자, 배경 제거 */}
          <div className="bg-transparent shadow-none p-0">
            <Profile sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          </div>
          {/* 구분선 */}
          <div className="w-full h-px bg-gray-200 my-2" />
          {/* 채팅 히스토리 - 그림자, 배경 제거 */}
          <div className="bg-transparent shadow-none p-0">
            <ChatHistory
              onSelectSession={(id) => id !== null ? setSelectedSessionId(id) : setSelectedSessionId('')}
              selectedSessionId={selectedSessionId}
            />
          </div>
        </div>
      )}
    </div>
  );
} 