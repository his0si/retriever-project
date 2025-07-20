'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'
import CrawlInterface from '@/components/CrawlInterface'

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

  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (!session) redirect('/landing') // Not logged in
    
    // 관리자가 아니면 chat 페이지로 리다이렉트
    if (extendedSession?.user?.role !== 'admin') {
      redirect('/chat')
    }
  }, [session, status, extendedSession])

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
        
        {/* Navigation */}
        <div className="flex mb-6 border-b">
          <a
            href="/chat"
            className="px-4 py-2 font-medium text-gray-600 hover:text-gray-800 border-b-2 border-transparent hover:border-gray-300"
          >
            챗봇
          </a>
          <a
            href="/crawl"
            className="px-4 py-2 font-medium border-b-2 border-blue-500 text-blue-600"
          >
            크롤링
          </a>
        </div>

        {/* Crawl Content */}
        <CrawlInterface />
      </div>
    </main>
  )
} 