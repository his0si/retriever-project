'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSession } from 'next-auth/react'
import { supabase } from '@/lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import DepartmentSelector from './DepartmentSelector'
import {
  getUserPreferences,
  createUserPreferences,
  updateUserPreferences,
  Department
} from '@/lib/userPreferencesApi'

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
  sidebarOpen?: boolean
}
// 세션 타입 확장
interface ExtendedSessionUser {
  id: string // uuid
  name?: string | null
  email?: string | null
  image?: string | null
}

export default function ChatInterface({ isGuestMode = false, selectedSessionId, onSessionCreated, sidebarOpen }: ChatInterfaceProps) {
  const { data: session } = useSession()
  const user = session?.user as ExtendedSessionUser | undefined
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [centerInput, setCenterInput] = useState('') // 중앙 입력란용 별도 상태
  const [isLoading, setIsLoading] = useState(false)
  const [openTooltip, setOpenTooltip] = useState<'search' | 'major' | null>(null) // 툴팁 상태 통합 관리
  const [aiSearchMode, setAiSearchMode] = useState<'filter' | 'expand'>('filter')
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentSearchEnabled, setDepartmentSearchEnabled] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [tooltipPlacement, setTooltipPlacement] = useState<'center' | 'pushRight' | 'pushLeft'>('center')
  const [tooltipOffsetPx, setTooltipOffsetPx] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const bottomBarRef = useRef<HTMLDivElement>(null)
  const [inputBarHeight, setInputBarHeight] = useState(0)
  const sessionIdRef = useRef<string>(selectedSessionId ? selectedSessionId : '')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const centerInputRef = useRef<HTMLInputElement>(null);
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

  // 사용자 설정 불러오기
  useEffect(() => {
    if (!user?.email) return

    async function loadPreferences() {
      try {
        console.log('[ChatInterface] Loading preferences for user:', user!.email)
        const prefs = await getUserPreferences(user!.email!)
        console.log('[ChatInterface] Loaded preferences:', prefs)
        if (prefs) {
          setDepartments(prefs.preferred_departments)
          setDepartmentSearchEnabled(prefs.department_search_enabled)
          setAiSearchMode(prefs.search_mode)
          console.log('[ChatInterface] Applied preferences - departments:', prefs.preferred_departments.length)
        } else {
          console.log('[ChatInterface] No preferences found, using defaults')
        }
        setPreferencesLoaded(true)
      } catch (error) {
        console.error('[ChatInterface] Failed to load user preferences:', error)
        setPreferencesLoaded(true)
      }
    }

    loadPreferences()
  }, [user])


  // 입력창에서 Enter로 전송
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 중앙 입력란용 전송 함수
  const handleCenterSend = async () => {
    if (!centerInput.trim() || isLoading) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: centerInput.trim()
    };
    setMessages(prev => [...prev, userMessage]);
    setCenterInput('');
    setIsLoading(true);
    await processMessage(userMessage);
    // 메시지 전송 후 하단 입력란으로 포커스 이동
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // 사용자 설정 저장 함수
  const saveUserPreferences = async (updates: {
    preferred_departments?: Department[]
    department_search_enabled?: boolean
    search_mode?: 'filter' | 'expand'
  }) => {
    if (!user?.email) {
      console.warn('[ChatInterface] Cannot save preferences: no user email')
      return
    }

    if (!preferencesLoaded) {
      console.warn('[ChatInterface] Cannot save preferences: not loaded yet')
      return
    }

    try {
      console.log('[ChatInterface] Saving preferences:', updates)
      const prefs = await getUserPreferences(user.email)
      if (prefs) {
        console.log('[ChatInterface] Updating existing preferences')
        await updateUserPreferences(user.email, updates)
      } else {
        console.log('[ChatInterface] Creating new preferences')
        // 현재 상태와 업데이트를 합침
        const finalDepartments = updates.preferred_departments !== undefined
          ? updates.preferred_departments
          : departments
        const finalEnabled = updates.department_search_enabled !== undefined
          ? updates.department_search_enabled
          : departmentSearchEnabled
        const finalMode = updates.search_mode !== undefined
          ? updates.search_mode
          : aiSearchMode

        await createUserPreferences(
          user.email,
          finalDepartments,
          finalEnabled,
          finalMode
        )
      }
      console.log('[ChatInterface] Preferences saved successfully')
    } catch (error) {
      console.error('[ChatInterface] Failed to save user preferences:', error)
    }
  }

  // 전공 변경 핸들러
  const handleDepartmentsChange = (newDepartments: Department[]) => {
    setDepartments(newDepartments)
    saveUserPreferences({ preferred_departments: newDepartments })
  }

  // 전공 검색 활성화 토글
  const handleDepartmentSearchEnabledChange = (enabled: boolean) => {
    setDepartmentSearchEnabled(enabled)
    saveUserPreferences({ department_search_enabled: enabled })
  }

  // 검색 모드 변경 핸들러
  const handleSearchModeChange = (mode: 'filter' | 'expand') => {
    setAiSearchMode(mode)
    saveUserPreferences({ search_mode: mode })
  }

  // 메시지 처리 함수 (공통 로직)
  const processMessage = async (userMessage: Message) => {
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
        {
          question: userMessage.content,
          mode: aiSearchMode,
          user_id: user?.email || 'anonymous'
        }
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
    } catch (error: any) {
      console.error('Chat error:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
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
    await processMessage(userMessage);
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
  const handleToggleTooltip = (type: 'search' | 'major', e: React.MouseEvent<HTMLDivElement>) => {
    // Edge-aware placement using trigger center to avoid clipping
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const edgeThreshold = 200; // px, generous for mobile
    if (centerX < edgeThreshold) {
      setTooltipPlacement('pushRight');
      // Align globe tooltip's left edge to magnifier's left edge
      const group = e.currentTarget.parentElement as HTMLElement | null;
      const searchEl = group?.querySelector('[data-search-tooltip-trigger]') as HTMLDivElement | null;
      if (type === 'major' && searchEl) {
        const searchRect = searchEl.getBoundingClientRect();
        setTooltipOffsetPx(searchRect.left - rect.left);
      } else {
        setTooltipOffsetPx(0);
      }
    } else if (window.innerWidth - centerX < edgeThreshold) {
      setTooltipPlacement('pushLeft');
      setTooltipOffsetPx(0);
    } else {
      setTooltipPlacement('center');
      setTooltipOffsetPx(0);
    }
    setOpenTooltip(openTooltip === type ? null : type);
  };

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
    function updateIsMobile() {
      setIsMobile(window.innerWidth < 640);
    }
    window.addEventListener('resize', updatePad);
    window.addEventListener('resize', updateIsMobile);
    updatePad();
    updateIsMobile();
    const measure = () => {
      const h = bottomBarRef.current?.offsetHeight || 0;
      setInputBarHeight(h);
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (bottomBarRef.current && ro) ro.observe(bottomBarRef.current);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      window.removeEventListener('resize', updatePad);
      window.removeEventListener('resize', updateIsMobile);
      window.removeEventListener('resize', measure);
      if (bottomBarRef.current && ro) ro.disconnect();
    };
  }, []);

  // 툴팁 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openTooltip) {
        const target = event.target as Element;
        if (!target.closest('[data-tooltip-trigger]') &&
            !target.closest('[data-search-tooltip-trigger]') &&
            !target.closest('[data-tooltip-content]')) {
          setOpenTooltip(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openTooltip]);


  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-visible bg-sky-50 dark:bg-sky-50">
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
      <div
        className="flex-1 min-h-0 overflow-y-auto px-8 pt-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent bg-white dark:bg-gray-900"
        style={{
          paddingBottom: messages.length > 0 && inputBarHeight > 0 ? `${inputBarHeight + 16}px` : '16px'
        }}
      >
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
          <div className="flex flex-col items-center justify-center h-full">
            {/* 로고 영역 (모바일 숨김) */}
            <div className="hidden sm:flex flex-col items-center mb-8">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-200">Retriever Project</h1>
                <div className="px-2.5 sm:px-3 py-0.5 sm:py-1 bg-sky-100 dark:bg-sky-900/30 rounded-full border border-sky-300 dark:border-sky-600">
                  <span className="text-xs sm:text-sm font-medium text-sky-600 dark:text-sky-400">Ewha Univ.</span>
                </div>
              </div>
            </div>

            {/* 게스트 모드 알림 (모바일 숨김) */}
            {isGuestMode && (
              <div className="hidden sm:flex flex-col items-center mb-8">
                <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-lg border border-orange-200 dark:border-orange-400 max-w-md w-full text-center flex flex-col items-center">
                  <div className="text-base font-bold text-orange-600 dark:text-orange-200 mb-1">⚠️ 게스트 모드</div>
                  <div className="text-sm text-orange-500 dark:text-orange-200 mb-2">
                    비회원으로 이용할 경우,<br />
                    채팅 기록 저장 및 전공 맞춤형 검색 모드 등의<br />
                    일부 기능이 제한됩니다.
                  </div>
                  <span
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer mt-2 text-sm font-semibold transition-colors duration-200"
                    onClick={() => router.push('/auth/signin')}
                  >
                    회원가입하러 가기
                  </span>
                </div>
              </div>
            )}

            {/* 모바일 전용 인트로 메시지 */}
            <div className="sm:hidden flex flex-1 items-center justify-center px-6 w-full">
              <div className="text-xl font-semibold text-gray-800 dark:text-gray-100 text-center leading-snug">
                리트리버가 기다리고 있어요.
                <br />
                무엇이든 물어보세요!
              </div>
            </div>

            {/* 중앙 입력란 (모바일 숨김) */}
            <div className="hidden sm:block w-full max-w-2xl mx-auto px-4">
              <div className="relative">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-3 sm:p-4 min-h-[56px] sm:min-h-[60px] flex items-center">
                  <div className="flex items-center gap-3 flex-1">
                    {/* 왼쪽 아이콘들 */}
                    <div className="flex items-center gap-2">
                      <div 
                        className="relative p-2 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-pointer"
                        onClick={(e) => handleToggleTooltip('search', e)}
                        data-search-tooltip-trigger
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>

                        {openTooltip === 'search' && (
                          <div
                            data-tooltip-content
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`absolute top-full mt-2 w-[90vw] max-w-[22rem] bg-sky-50 dark:bg-sky-900/20 rounded-lg shadow-lg border border-sky-300 dark:border-sky-700 z-50 ${tooltipPlacement === 'center' ? 'left-1/2 -translate-x-1/2' : tooltipPlacement === 'pushRight' ? 'left-0' : 'right-0'}`}
                          >
                            <div className="p-4">
                              <div className="text-gray-900 dark:text-gray-100 font-semibold mb-2">AI 검색 모드 전환</div>
                              <div className="text-sky-700 dark:text-sky-300 text-sm leading-relaxed mb-3">
                                <span className="font-semibold">필터 모드</span>에서는 데이터베이스 기준으로 일치 항목만 표시하며, <span className="font-semibold">확장 모드</span>에서는 AI가 의미적 유사도를 분석해 관련 결과를 함께 제공합니다.
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className={`px-3 py-1.5 text-sm rounded-md border ${aiSearchMode === 'filter' ? 'bg-sky-600 text-sky-100 dark:text-sky-100 border-sky-600' : 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSearchModeChange('filter');
                                  }}
                                >
                                  필터 모드
                                </button>
                                <button
                                  type="button"
                                  className={`px-3 py-1.5 text-sm rounded-md border ${aiSearchMode === 'expand' ? 'bg-sky-600 text-sky-100 dark:text-sky-100 border-sky-600' : 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSearchModeChange('expand');
                                  }}
                                >
                                  확장 모드
                                </button>
                              </div>
                            </div>
                            <div className={`absolute -top-2 w-4 h-4 bg-sky-50 dark:bg-sky-900/20 border-l border-t border-sky-300 dark:border-sky-700 rotate-45 ${tooltipPlacement === 'center' ? 'left-1/2 -translate-x-1/2' : tooltipPlacement === 'pushRight' ? 'left-4' : 'right-4'}`}></div>
                          </div>
                        )}
                      </div>
                      {!isGuestMode && (
                        <div
                          className="relative p-2 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                          onClick={(e) => handleToggleTooltip('major', e)}
                          data-tooltip-trigger
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>

                          {/* 전공 맞춤형 검색 툴팁 */}
                          {openTooltip === 'major' && (
                            <div
                              data-tooltip-content
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className={`absolute top-full mt-2 w-[90vw] max-w-[24rem] bg-sky-50 dark:bg-sky-900/20 rounded-lg shadow-lg border border-sky-300 dark:border-sky-700 z-50 ${tooltipPlacement === 'center' ? 'left-1/2 -translate-x-1/2' : tooltipPlacement === 'pushRight' ? 'left-0' : 'right-0'}`}
                              style={{ left: tooltipPlacement === 'pushRight' ? `${tooltipOffsetPx}px` as any : undefined }}
                            >
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-gray-900 dark:text-gray-100 font-semibold">전공 맞춤형 검색 결과 제공</span>
                                </div>
                                <div className="text-sky-700 dark:text-sky-300 text-sm leading-relaxed mb-4">
                                  선택한 전공에 관련된 콘텐츠를 자동으로 우선 검색합니다.
                                </div>
                                <DepartmentSelector
                                  departments={departments}
                                  enabled={departmentSearchEnabled}
                                  onDepartmentsChange={handleDepartmentsChange}
                                  onEnabledChange={handleDepartmentSearchEnabledChange}
                                />
                              </div>
                              {/* 툴팁 화살표 */}
                              <div className={`absolute -top-2 w-4 h-4 bg-sky-50 dark:bg-sky-900/20 border-l border-t border-sky-300 dark:border-sky-700 rotate-45 ${tooltipPlacement === 'center' ? 'left-1/2 -translate-x-1/2' : tooltipPlacement === 'pushRight' ? 'left-4' : 'right-4'}`}></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 입력 필드 */}
                    <div className="flex-1 mx-2 sm:mx-4">
                      <input
                        type="text"
                        className="w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-base sm:text-lg"
                        placeholder="리트리버에게 물어보기"
                        value={centerInput}
                        onChange={(e) => setCenterInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCenterSend();
                          }
                        }}
                        ref={centerInputRef}
                        disabled={isLoading}
                      />
                    </div>

                    {/* 전송 버튼 */}
                    <button
                      type="button"
                      className="p-1.5 sm:p-2 rounded-lg bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-800/50 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleCenterSend}
                      disabled={isLoading || !centerInput.trim()}
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-5 py-3 text-base break-words ${message.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}
              >
                {message.type === 'user' ? (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="prose prose-sm dark:prose-invert max-w-none break-words"
                    components={{
                      table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-2">
                          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600" {...props} />
                        </div>
                      ),
                      th: ({node, ...props}) => (
                        <th className="px-3 py-2 text-left text-xs font-semibold bg-gray-50 dark:bg-gray-700" {...props} />
                      ),
                      td: ({node, ...props}) => (
                        <td className="px-3 py-2 text-sm border-t border-gray-200 dark:border-gray-600" {...props} />
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
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

      {/* 통합된 하단 입력란 - 대화 시작 후에는 모든 화면에 표시 */}
      <div
        ref={bottomBarRef}
        className={`fixed bottom-0 z-40 px-4 pb-2 bg-white dark:bg-gray-900 transition-all duration-300 ${messages.length === 0 ? 'sm:hidden' : ''}`}
        style={{
          paddingBottom: `max(${bottomPad}px, env(safe-area-inset-bottom))`,
          left: isMobile ? 0 : (sidebarOpen === true ? '320px' : sidebarOpen === false ? '64px' : 0),
          right: 0
        }}
      >
        <div className="sm:max-w-4xl sm:mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/50 sm:shadow-sm p-3 min-h-[56px] flex items-center">
            <div className="flex items-center gap-3 flex-1">
              {/* 왼쪽 아이콘들 */}
              <div className="flex items-center gap-2">
                <div 
                  className="relative p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-pointer"
                  onClick={(e) => handleToggleTooltip('search', e)}
                  data-search-tooltip-trigger
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>

                  {openTooltip === 'search' && (
                    <div
                      data-tooltip-content
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`absolute bottom-full mb-2 w-[90vw] max-w-[22rem] bg-sky-50 dark:bg-sky-900/20 rounded-lg shadow-lg border border-sky-300 dark:border-sky-700 z-50 ${tooltipPlacement === 'center' ? 'left-1/2 -translate-x-1/2' : tooltipPlacement === 'pushRight' ? 'left-0' : 'right-0'}`}
                    >
                      <div className="p-4">
                        <div className="text-gray-900 dark:text-gray-100 font-semibold mb-2">AI 검색 모드 전환</div>
                        <div className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed mb-3">
                          <span className="font-semibold">필터 모드</span>에서는 데이터베이스 기준으로 일치 항목만 표시하며, <span className="font-semibold">확장 모드</span>에서는 AI가 의미적 유사도를 분석해 관련 결과를 함께 제공합니다.
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`px-3 py-1.5 text-sm rounded-md border ${aiSearchMode === 'filter' ? 'bg-sky-600 text-sky-100 dark:text-sky-100 border-sky-600' : 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSearchModeChange('filter');
                            }}
                          >
                            필터 모드
                          </button>
                          <button
                            type="button"
                            className={`px-3 py-1.5 text-sm rounded-md border ${aiSearchMode === 'expand' ? 'bg-sky-600 text-sky-100 dark:text-sky-100 border-sky-600' : 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSearchModeChange('expand');
                            }}
                          >
                            확장 모드
                          </button>
                        </div>
                      </div>
                      <div className={`absolute -bottom-2 w-4 h-4 bg-sky-50 dark:bg-sky-900/20 border-r border-b border-sky-300 dark:border-sky-700 rotate-45 ${tooltipPlacement === 'center' ? 'left-1/2 -translate-x-1/2' : tooltipPlacement === 'pushRight' ? 'left-4' : 'right-4'}`}></div>
                    </div>
                  )}
                </div>
                {!isGuestMode && (
                  <div
                    className="relative p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                    onClick={(e) => handleToggleTooltip('major', e)}
                    data-tooltip-trigger
                  >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>

                    {/* 전공 맞춤형 검색 툴팁 */}
                    {openTooltip === 'major' && (
                      <div
                        data-tooltip-content
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`absolute bottom-full mb-2 w-[90vw] max-w-[24rem] bg-sky-50 dark:bg-sky-900/20 rounded-lg shadow-lg border border-sky-300 dark:border-sky-700 z-50 ${tooltipPlacement === 'center' ? 'left-1/2 -translate-x-1/2' : tooltipPlacement === 'pushRight' ? 'left-0' : 'right-0'}`}
                        style={{ left: tooltipPlacement === 'pushRight' ? `${tooltipOffsetPx}px` as any : undefined }}
                      >
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-gray-900 dark:text-gray-100 font-semibold">전공 맞춤형 검색 결과 제공</span>
                          </div>
                          <div className="text-sky-700 dark:text-sky-300 text-sm leading-relaxed mb-4">
                            선택한 전공에 관련된 콘텐츠를 자동으로 우선 검색합니다.
                          </div>
                          <DepartmentSelector
                            departments={departments}
                            enabled={departmentSearchEnabled}
                            onDepartmentsChange={handleDepartmentsChange}
                            onEnabledChange={handleDepartmentSearchEnabledChange}
                          />
                        </div>
                        {/* 툴팁 화살표 */}
                        <div className={`absolute -bottom-2 w-4 h-4 bg-sky-50 dark:bg-sky-900/20 border-r border-b border-sky-300 dark:border-sky-700 rotate-45 ${tooltipPlacement === 'center' ? 'left-1/2 -translate-x-1/2' : tooltipPlacement === 'pushRight' ? 'left-4' : 'right-4'}`}></div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 입력 필드 */}
              <div className="flex-1 mx-2 sm:mx-4">
                <input
                  type="text"
                  className="w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-base"
                  placeholder="리트리버에게 물어보기"
                  value={messages.length === 0 ? centerInput : input}
                  onChange={(e) => messages.length === 0 ? setCenterInput(e.target.value) : setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      messages.length === 0 ? handleCenterSend() : handleSend();
                    }
                  }}
                  ref={messages.length === 0 ? centerInputRef : inputRef}
                  disabled={isLoading}
                />
              </div>

              {/* 전송 버튼 */}
              <button
                type="button"
                className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-800/50 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={messages.length === 0 ? handleCenterSend : handleSend}
                disabled={isLoading || (messages.length === 0 ? !centerInput.trim() : !input.trim())}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}