'use client'

import { useState, useEffect } from 'react'
import ChatHistory from '@/components/ChatHistory'
import ChatInterface from '@/components/ChatInterface'
import Profile from '@/components/Profile'
import { useSession, signOut } from 'next-auth/react'
import { supabase } from '@/lib/supabaseClient'
import Sidebar from '@/components/Sidebar';

export default function ChatPage() {
  const { data: session } = useSession()
  const user = session?.user as { email?: string } | undefined
  const isLoggedIn = !!session?.user;
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // 모바일에서는 사이드바를 기본적으로 닫힘 상태로
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <main className="h-screen w-screen bg-white">
      <div className="flex h-full w-full flex-row sm:flex-row flex-col">
        {isLoggedIn && (
          <>
            {/* 모바일 햄버거 버튼 */}
            <button
              className="sm:hidden fixed top-4 left-4 z-40 p-0 m-0 bg-transparent border-none shadow-none"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="모바일 사이드바 열기"
            >
              <svg className="w-7 h-7 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className={`hidden sm:block transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-16'}`}>
              <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                selectedSessionId={selectedSessionId}
                setSelectedSessionId={setSelectedSessionId}
              />
            </div>
            {/* 모바일 오버레이 사이드바 */}
            <Sidebar
              sidebarOpen={true}
              setSidebarOpen={() => {}}
              selectedSessionId={selectedSessionId}
              setSelectedSessionId={setSelectedSessionId}
              mobileSidebarOpen={mobileSidebarOpen}
              setMobileSidebarOpen={setMobileSidebarOpen}
              isMobile
            />
          </>
        )}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatInterface
            selectedSessionId={selectedSessionId}
            isGuestMode={!isLoggedIn}
          />
        </div>
      </div>
    </main>
  )
} 