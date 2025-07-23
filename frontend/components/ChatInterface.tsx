'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { useSession } from 'next-auth/react'
import { supabase } from '@/lib/supabaseClient'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { StarIcon as StarOutline } from '@heroicons/react/24/outline'
import { v4 as uuidv4 } from 'uuid';
import { PlusIcon, Cog6ToothIcon, MicrophoneIcon, Bars3BottomLeftIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

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
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [bottomPad, setBottomPad] = useState(8); // 기본 8px
  const [viewportHeight, setViewportHeight] = useState('100vh');

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
      // 1. 세션이 없거나 selectedSessionId가 'NEW'면 chat_sessions에 insert (title=첫 질문)
      if ((!sessionIdRef.current || selectedSessionId === 'NEW') && user?.email) {
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
          { id: uuidv4(), user_id: user.email, session_id: sessionIdRef.current, message: assistantMessage.content, role: 'assistant', created_at: now, sources: assistantMessage.sources }
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

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleFocus = () => {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        window.scrollTo(0, document.body.scrollHeight);
      }, 200); // 키보드/소프트키 올라오는 시간 고려
    };
    input.addEventListener('focus', handleFocus);
    return () => {
      input.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    function updatePad() {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const wh = window.innerHeight;
      if (vh < wh) {
        setBottomPad(24); // 소프트키/키보드가 올라온 상태
      } else {
        setBottomPad(8); // 소프트키/키보드가 없는 상태
      }
    }
    window.addEventListener('resize', updatePad);
    updatePad();
    return () => window.removeEventListener('resize', updatePad);
  }, []);

  useEffect(() => {
    function updateHeight() {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height + 'px');
      } else {
        setViewportHeight(window.innerHeight + 'px');
      }
    }
    window.addEventListener('resize', updateHeight);
    updateHeight();
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return (
    <div style={{ height: viewportHeight }} className="flex flex-col min-h-0 overflow-hidden">
      {/* 게스트 모드일 때만 좌측 상단 뒤로가기 버튼 */}
      {isGuestMode && (
        <button
          className="absolute left-4 top-4 bg-transparent p-0 m-0 z-50"
          onClick={() => router.push('/landing')}
          aria-label="뒤로가기"
          style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}
        >
          <ArrowLeftIcon className="w-6 h-6 text-gray-500" />
        </button>
      )}
      {/* 대화 영역 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-24 pt-12 sm:pt-8 space-y-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent" style={{ minHeight: 0 }}>
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
        {messages.length === 0 ? (
          <div className="flex flex-col items-center mt-2 text-lg">
            {isGuestMode && (
              <div className="flex flex-col items-center">
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 mb-4 max-w-md w-full text-center flex flex-col items-center">
                  <div className="text-base font-bold text-orange-600 mb-1">⚠️ 게스트 모드</div>
                  <div className="text-sm text-orange-500 mb-2">비회원 이용 시 채팅 기록 등 일부 기능이 제한됩니다.</div>
                  <span
                    className="text-blue-600 hover:underline cursor-pointer mt-2 text-sm font-semibold"
                    onClick={() => router.push('/auth/signin')}
                  >
                    회원가입하러 가기
                  </span>
                </div>
              </div>
            )}
            <div className="text-gray-400">리트리버가 기다리고 있어요. 무엇이든 물어보세요!</div>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-5 py-3 text-base break-words whitespace-pre-line ${message.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}
              >
                <ReactMarkdown className="prose prose-sm max-w-none break-words whitespace-pre-line">
                  {message.content}
                </ReactMarkdown>
                {/* 출처 링크 표시 */}
                {message.type === 'assistant' && message.sources && message.sources.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    {message.sources.map((src, idx) => (
                      <div key={idx}>
                        출처: <a href={src} target="_blank" rel="noopener noreferrer" className="underline">{src}</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-5 py-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="fixed bottom-0 left-0 right-0 z-50 w-full flex justify-center items-center px-2 sm:px-8 py-3 sm:py-4 bg-white"
        style={{ paddingBottom: `env(safe-area-inset-bottom, 0px)` }}
      >
        <div className="flex items-center w-full max-w-lg sm:max-w-2xl bg-white border border-gray-200 rounded-full px-2 sm:px-4 py-1.5 sm:py-2">
          <button type="button" className="p-1 mr-1 sm:mr-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <PlusIcon className="w-6 h-6" />
          </button>
          <button type="button" className="p-1 mr-1 sm:mr-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Cog6ToothIcon className="w-6 h-6" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예: 등록금 납부일 알려줘"
            className="flex-1 bg-transparent outline-none px-1 sm:px-2 text-sm sm:text-base"
            disabled={isLoading}
          />
          <button type="button" className="p-1 ml-1 sm:ml-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <MicrophoneIcon className="w-6 h-6" />
          </button>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-1 ml-1 sm:ml-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-6 h-6 rotate-90" />
          </button>
        </div>
      </form>
    </div>
  )
}