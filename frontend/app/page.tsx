'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import CrawlInterface from '@/components/CrawlInterface'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'crawl'>('chat')

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">retriever project</h1>
        
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

        {activeTab === 'chat' ? <ChatInterface /> : <CrawlInterface />}
      </div>
    </main>
  )
}