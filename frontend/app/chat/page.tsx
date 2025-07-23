'use client'

import { useState } from 'react'
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

  return (
    <main className="h-screen w-screen bg-white">
      <div className="flex h-full w-full flex-row">
        {isLoggedIn && (
          <div className={`transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-16'}`}>
            <Sidebar
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              selectedSessionId={selectedSessionId}
              setSelectedSessionId={setSelectedSessionId}
            />
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatInterface
            selectedSessionId={selectedSessionId}
            isGuestMode={!isLoggedIn}
          />
        </div>
      </div>
    </main>
  )
} 