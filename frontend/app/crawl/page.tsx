'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import CrawlInterface from '@/components/CrawlInterface'
import Sidebar from '@/components/Sidebar'
// 세션 타입 확장
interface ExtendedSession {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  }
}

export default function CrawlPage() {
  const { data: session, status } = useSession()
  const extendedSession = session as ExtendedSession | null
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
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

  return (
    <main className="h-screen w-screen bg-white">
      <div className="flex h-full w-full flex-row">
        <div className={`transition-all duration-300 h-full ${sidebarOpen ? 'w-80' : 'w-16'}`}>
          <Sidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            selectedSessionId={selectedSessionId}
            setSelectedSessionId={handleSelectSession}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0"> {/* h-full 제거, min-h-0 추가 */}
          <div className="w-full max-w-4xl mx-auto px-8 py-8 pb-20 flex-1 min-h-0 overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent" style={{ minHeight: 0 }}>
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
            <CrawlInterface />
          </div>
        </div>
      </div>
    </main>
  )
} 