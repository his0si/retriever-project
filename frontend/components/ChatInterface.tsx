'use client'

import { useState, useRef } from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { StarIcon as StarOutline } from '@heroicons/react/24/outline'
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  sources?: string[]
}

interface ChatInterfaceProps {
  isGuestMode?: boolean
  selectedSessionId?: string
  onSessionCreated?: (sessionId: string) => void
}
// 세션 타입 확장
interface ExtendedSessionUser {
  id: string // uuid
  name?: string | null
  email?: string | null
  image?: string | null
}

export default function ChatInterface({ isGuestMode = false, selectedSessionId, onSessionCreated }: ChatInterfaceProps) {
  const { data: session } = useSession()
  const user = session?.user as ExtendedSessionUser | undefined
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const sessionIdRef = useRef<string>(selectedSessionId ? selectedSessionId : '')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  // 대화 내역/즐겨찾기 클릭 시 해당 대화 불러오기
  useEffect(() => {
    if (!user?.email || !selectedSessionId) {
      setMessages([]);
      sessionIdRef.current = '';
      return;
    }
    const sessionId = String(selectedSessionId);
    supabase
      .from('chat_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(data.map((msg: any) => ({
            id: msg.id,
            type: msg.role,
            content: msg.message,
            sources: msg.sources
          })))
        } else {
          setMessages([])
        }
      })
  }, [selectedSessionId, user]);

  // 즐겨찾기 불러오기
  useEffect(() => {
    if (!user?.email || typeof sessionIdRef.current !== 'string' || sessionIdRef.current === '') return;
    const sessionId: string = sessionIdRef.current;
    supabase
      .from('favorites')
      .select('message_id')
      .eq('user_id', user.email)
      .eq('session_id', sessionId)
      .then(({ data }) => {
        if (data) setFavoriteIds(data.map((f: any) => f.message_id))
      })
  }, [user, sessionIdRef.current])

  const handleToggleFavorite = async (messageId: string) => {
    if (!user?.email || !sessionIdRef.current) return
    if (favoriteIds.includes(messageId)) {
      // 즐겨찾기 해제
      await supabase.from('favorites').delete().eq('user_id', user.email).eq('session_id', sessionIdRef.current).eq('message_id', messageId)
      setFavoriteIds(favoriteIds.filter(id => id !== messageId))
    } else {
      // 즐겨찾기 추가
      await supabase.from('favorites').insert([
        { user_id: user.email, session_id: sessionIdRef.current, message_id: messageId }
      ])
      setFavoriteIds([...favoriteIds, messageId])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // 1. 세션이 없으면 chat_sessions에 insert (title=첫 질문)
      if (!sessionIdRef.current && user?.email) {
        const { data: sessionData, error: sessionError } = await supabase.from('chat_sessions').insert([
          { user_id: user.email, title: userMessage.content, created_at: new Date().toISOString() }
        ]).select()
        if (sessionError || !sessionData || !sessionData[0]?.id) {
          throw new Error('세션 생성 실패')
        }
        sessionIdRef.current = sessionData[0].id
        if (onSessionCreated) onSessionCreated(sessionIdRef.current)
      }

      // 2. 챗봇 응답 받기
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/chat`,
        { question: userMessage.content }
      )

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.data.answer,
        sources: response.data.sources
      }

      setMessages(prev => [...prev, assistantMessage])

      // 3. chat_history에 session_id로 메시지 저장
      if (user?.email && sessionIdRef.current) {
        const now = new Date().toISOString();
        const { error } = await supabase.from('chat_history').insert([
          { id: uuidv4(), user_id: user.email, session_id: sessionIdRef.current, message: userMessage.content, role: 'user', created_at: now },
          { id: uuidv4(), user_id: user.email, session_id: sessionIdRef.current, message: assistantMessage.content, role: 'assistant', created_at: now }
        ])
        if (error) {
          console.error('chat_history insert error:', error)
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-lg">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-2">
            {isGuestMode && (
              <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg border border-orange-200 mb-4">
                <p className="font-medium mb-1">⚠️ 게스트 모드</p>
                <p>비회원 이용 시 채팅 기록 등 일부 기능이 제한됩니다.</p>
              </div>
            )}
            <div>
              학교에 대해 궁금한 점을 물어보세요!
            </div>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <ReactMarkdown className="prose prose-sm max-w-none">
                  {message.content}
                </ReactMarkdown>
                
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-medium mb-1">관련 출처:</p>
                    <ul className="text-sm space-y-1">
                      {message.sources.map((source, idx) => (
                        <li key={idx}>
                          <a
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {source}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  )
}