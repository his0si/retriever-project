'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { useSession } from 'next-auth/react'
import { supabase } from '@/lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
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
      .then(({ data }: { data: any }) => {
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
      .then(({ data }: { data: any }) => {
        if (data) setFavoriteIds(data.map((f: any) => f.message_id))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])


  // 입력창에서 Enter로 전송
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 버튼 클릭용 전송 함수
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    try {
      if ((!sessionIdRef.current || selectedSessionId === 'NEW') && user?.email) {
        const { data: sessionData, error: sessionError } = await supabase.from('chat_sessions').insert([
          { user_id: user.email, title: userMessage.content, created_at: new Date().toISOString() }
        ]).select();
        if (sessionError || !sessionData || !sessionData[0]?.id) {
          throw new Error('세션 생성 실패');
        }
        sessionIdRef.current = sessionData[0].id;
        if (onSessionCreated) onSessionCreated(sessionIdRef.current);
      }
      const response = await axios.post(
        '/api/chat',
        { question: userMessage.content }
      );
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.data.answer,
        sources: response.data.sources
      };
      setMessages(prev => [...prev, assistantMessage]);
      if (user?.email && sessionIdRef.current) {
        const now = new Date().toISOString();
        const { error } = await supabase.from('chat_history').insert([
          { id: uuidv4(), user_id: user.email, session_id: sessionIdRef.current, message: userMessage.content, role: 'user', created_at: now },
          { id: uuidv4(), user_id: user.email, session_id: sessionIdRef.current, message: assistantMessage.content, role: 'assistant', created_at: now, sources: assistantMessage.sources }
        ]);
        if (error) {
          console.error('chat_history insert error:', error);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

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


  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-gray-900">
      {/* 게스트 모드일 때만 좌측 상단 뒤로가기 버튼 */}
      {isGuestMode && (
        <button
          className="absolute left-4 top-4 bg-transparent p-0 m-0 z-50 hidden sm:block"
          onClick={() => router.push('/landing')}
          aria-label="뒤로가기"
          style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}
        >
          <ArrowLeftIcon className="w-6 h-6 text-gray-500" />
        </button>
      )}
      {/* 대화 영역 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-4 pt-12 sm:pt-8 space-y-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent bg-white dark:bg-gray-900" style={{ minHeight: 0 }}>
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
                <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-lg border border-orange-200 dark:border-orange-400 mb-4 max-w-md w-full text-center flex flex-col items-center">
                  <div className="text-base font-bold text-orange-600 dark:text-orange-200 mb-1">⚠️ 게스트 모드</div>
                  <div className="text-sm text-orange-500 dark:text-orange-200 mb-2">비회원 이용 시 채팅 기록 등 일부 기능이 제한됩니다.</div>
                  <span
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer mt-2 text-sm font-semibold transition-colors duration-200"
                    onClick={() => router.push('/auth/signin')}
                  >
                    회원가입하러 가기
                  </span>
                </div>
              </div>
            )}
            <div className="text-gray-400 dark:text-gray-300">리트리버가 기다리고 있어요. 무엇이든 물어보세요!</div>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-5 py-3 text-base break-words whitespace-pre-line ${message.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}
              >
                <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-line">
                  {message.content}
                </ReactMarkdown>
                {/* 출처 링크 표시 */}
                {message.type === 'assistant' && message.sources && message.sources.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-5 py-3 transition-colors duration-200">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 입력란 */}
      <div className="w-full px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2" style={{ paddingBottom: `${bottomPad}px` }}>
        <input
          type="text"
          className="flex-1 min-w-0 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 등록금 납부일 알려줘"
          onKeyDown={handleInputKeyDown}
          ref={inputRef}
          disabled={isLoading}
        />
        {/* 데스크톱에서만 전송 버튼 표시 */}
        <button
          type="button"
          className="hidden sm:block px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
        >
          전송
        </button>
      </div>
    </div>
  )
}