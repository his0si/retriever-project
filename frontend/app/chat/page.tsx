'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'
import ChatInterface from '@/components/ChatInterface'
import CrawlInterface from '@/components/CrawlInterface'

export default function ChatPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<'chat' | 'crawl'>('chat')

  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (!session) redirect('/landing') // Not logged in
  }, [session, status])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩중...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with user info and logout */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Retriever Project</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              안녕하세요, {session.user?.name}님!
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/landing' })}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex mb-6 border-b">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'chat'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('chat')}
          >
            챗봇
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'crawl'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('crawl')}
          >
            크롤링
          </button>
        </div>

        {/* Content */}
        {activeTab === 'chat' ? <ChatInterface /> : <CrawlInterface />}
      </div>
    </main>
  )
} 