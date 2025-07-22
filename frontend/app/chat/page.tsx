'use client'

import { useState } from 'react'
import ChatHistory from '@/components/ChatHistory'
import ChatInterface from '@/components/ChatInterface'
import Profile from '@/components/Profile'
import { useSession, signOut } from 'next-auth/react'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

export default function ChatPage() {
  const { data: session } = useSession()
  const user = session?.user as { email?: string } | undefined
  const isLoggedIn = !!session?.user?.email;
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <main className="min-h-screen p-8">
      <Header />
      {!sidebarOpen && isLoggedIn && (
        <button
          className="fixed top-8 left-4 z-50 bg-white border shadow rounded-full p-2 hover:bg-blue-50 transition"
          onClick={() => setSidebarOpen(true)}
          aria-label="사이드바 열기"
        >
          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      <div className="max-w-4xl mx-auto flex gap-8">
        {/* 왼쪽: 사이드바 (로그인한 경우만) */}
        {isLoggedIn && (
          <Sidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            selectedSessionId={selectedSessionId}
            setSelectedSessionId={setSelectedSessionId}
          />
        )}
        {/* 오른쪽: 챗봇 */}
        <div className="flex-1">
          <ChatInterface
            selectedSessionId={selectedSessionId}
            isGuestMode={!isLoggedIn}
          />
        </div>
      </div>
    </main>
  )
} 