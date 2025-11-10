'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import InquiriesInterface from '@/components/InquiriesInterface'
import Sidebar from '@/components/Sidebar'
import dynamic from 'next/dynamic';

// 세션 타입 확장
interface ExtendedSession {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  }
}

export default function InquiriesPage() {
  const { data: session, status } = useSession()
  const extendedSession = session as ExtendedSession | null
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // 모바일에서는 사이드바를 기본적으로 닫힘 상태로
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setSidebarOpen(false);
    }
  }, [])

  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (!session) redirect('/landing') // Not logged in
    // 관리자가 아니면 chat 페이지로 리다이렉트
    if (extendedSession?.user?.role !== 'admin') {
      redirect('/chat')
    }
  }, [session, status, extendedSession])

  // 새 채팅 버튼 누르면 챗봇 페이지로 이동
  const handleSelectSession = (id: string | null) => {
    if (id === null || id === '' || id === 'NEW') {
      router.push('/chat');
    } else {
      setSelectedSessionId(id);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩중...</div>
      </div>
    )
  }

  if (!session || extendedSession?.user?.role !== 'admin') {
    return null
  }

  const MobileChatHeader = dynamic(() => import('@/components/MobileChatHeader'), { ssr: false });

  return (
    <main className="h-screen w-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex h-full w-full flex-row sm:flex-row flex-col">
        <div className={`hidden sm:block transition-all duration-300 h-full ${sidebarOpen ? 'w-80' : 'w-16'}`}>
          <Sidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            selectedSessionId={selectedSessionId}
            setSelectedSessionId={handleSelectSession}
          />
        </div>
        {/* 모바일 헤더 */}
        <div className="sm:hidden w-full">
          <MobileChatHeader showNewChatButton={false} onHamburgerClick={() => setMobileSidebarOpen(true)} onNewChat={() => {}} onSettingsClick={() => {}} />
        </div>
        {/* 모바일 오버레이 사이드바 */}
        {typeof window !== 'undefined' && window.innerWidth < 640 && (
          <Sidebar
            sidebarOpen={true}
            setSidebarOpen={() => {}}
            selectedSessionId={selectedSessionId}
            setSelectedSessionId={handleSelectSession}
            mobileSidebarOpen={mobileSidebarOpen}
            setMobileSidebarOpen={setMobileSidebarOpen}
            isMobile
          />
        )}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="w-full h-full py-4 pb-20 flex-1 min-h-0 overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent" style={{ minHeight: 0 }}>
            <style jsx>{`
              div::-webkit-scrollbar {
                width: 6px;
                background: transparent;
              }
              div::-webkit-scrollbar-thumb {
                background: #e5e7eb;
                border-radius: 4px;
              }
            `}</style>
            <div className="w-full max-w-4xl mx-auto px-2 sm:px-8 pt-2 sm:pt-2">
              <InquiriesInterface />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
