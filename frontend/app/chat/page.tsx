'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import ChatInterface from '@/components/ChatInterface'
import { useSession, signOut } from 'next-auth/react'
import Sidebar from '@/components/Sidebar';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
const MobileChatHeader = dynamic(() => import('@/components/MobileChatHeader'), { ssr: false });

function ChatPageContent() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user;
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [newChatLoading] = useState(false);
  const searchParams = useSearchParams();
  const isGuestParam = searchParams?.get('guest') === '1';
  const isGuestMode = isGuestParam || !isLoggedIn;
  // 모바일에서는 사이드바를 기본적으로 닫힘 상태로
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setSidebarOpen(false);
    }
  }, []);

  // 모바일 헤더에서 새 채팅 생성
  const handleMobileNewChat = async () => {
    setSelectedSessionId('NEW');
  };

  // 모바일 환경설정 팝업 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowMobileSettings(false);
      }
    }
    if (showMobileSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMobileSettings]);

  return (
    <main className="h-screen w-screen bg-white dark:bg-gray-900">
      <div className="flex flex-col h-full w-full">
        {/* 모바일 전용 헤더 */}
        <div className="sm:hidden">
          <MobileChatHeader
            onHamburgerClick={() => setMobileSidebarOpen(true)}
            onNewChat={handleMobileNewChat}
            onSettingsClick={() => setShowMobileSettings((v) => !v)}
            newChatLoading={newChatLoading}
            isGuestMode={isGuestMode}
            onHomeClick={() => { window.location.href = '/landing'; }}
          />
          {/* 모바일 환경설정 팝업 */}
          {showMobileSettings && !isGuestMode && (
            <div ref={settingsRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-lg shadow-lg w-80 max-w-xs p-6 relative">
                {/* Profile의 환경설정 드롭다운과 동일한 내용 */}
                <button
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowMobileSettings(false)}
                  aria-label="닫기"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex flex-col gap-4">
                  <button
                    className="w-full px-4 py-2 text-left rounded hover:bg-gray-100 text-gray-800"
                    onClick={() => { signOut({ callbackUrl: '/landing' }) }}
                  >
                    로그아웃
                  </button>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-gray-800">다크 모드</span>
                    {/* 다크 모드 토글은 실제로 구현하려면 상태/컨텍스트 필요, 임시 스위치 */}
                    <input type="checkbox" className="toggle toggle-sm" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-row sm:flex-row flex-col min-h-0">
          {isLoggedIn && !isGuestMode && (
            <>
              {/* PC용 사이드바 */}
              <div className={`hidden sm:block transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-16'}`}>
                <Sidebar
                  sidebarOpen={sidebarOpen}
                  setSidebarOpen={setSidebarOpen}
                  selectedSessionId={selectedSessionId}
                  setSelectedSessionId={setSelectedSessionId}
                />
              </div>
              {/* 모바일 오버레이 사이드바 */}
              {typeof window !== 'undefined' && window.innerWidth < 640 && (
                <Sidebar
                  sidebarOpen={true}
                  setSidebarOpen={() => {}}
                  selectedSessionId={selectedSessionId}
                  setSelectedSessionId={setSelectedSessionId}
                  mobileSidebarOpen={mobileSidebarOpen}
                  setMobileSidebarOpen={setMobileSidebarOpen}
                  isMobile
                />
              )}
            </>
          )}
          <div className="flex-1 flex flex-col min-h-0">
            <ChatInterface
              selectedSessionId={selectedSessionId}
              isGuestMode={isGuestMode}
              sidebarOpen={isLoggedIn && !isGuestMode ? sidebarOpen : undefined}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  )
} 