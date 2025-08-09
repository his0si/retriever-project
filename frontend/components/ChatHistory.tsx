import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSession } from 'next-auth/react'
import { StarIcon as StarOutline, TrashIcon, ClockIcon, PencilSquareIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { useRouter } from 'next/navigation'

interface SessionItem {
  id: string
  title: string
  created_at: string
}

// 날짜 포맷 함수
function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // UTC 시간을 한국 시간으로 변환 (UTC+9)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const min = String(kst.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

export default function ChatHistory({
  onSelectSession,
  selectedSessionId
}: {
  onSelectSession: (sessionId: string | null) => void
  selectedSessionId: string | null
}) {
  const { data: session } = useSession()
  const user = session?.user as { email?: string; role?: string } | undefined
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [tab, setTab] = useState<'history' | 'favorites'>('history')
  const [favoriteSessionIds, setFavoriteSessionIds] = useState<string[]>([])
  const router = useRouter();

  // 즐겨찾기 세션 동기화
  useEffect(() => {
    if (!user?.email) return;
    supabase
      .from('favorites')
      .select('session_id')
      .eq('user_id', user.email)
      .is('message_id', null)
      .then(({ data }: { data: any }) => {
        if (data) setFavoriteSessionIds(data.map((f: any) => f.session_id));
      });
  }, [user]);

  // 세션 즐겨찾기 토글
  const handleFavoriteSession = async (sessionId: string) => {
    if (!user?.email) return
    if (favoriteSessionIds.includes(sessionId)) {
      // 즐겨찾기 해제
      await supabase.from('favorites').delete().eq('user_id', user.email).eq('session_id', sessionId)
      setFavoriteSessionIds(favoriteSessionIds.filter(id => id !== sessionId))
    } else {
      // 즐겨찾기 추가
      await supabase.from('favorites').insert([
        { user_id: user.email, session_id: sessionId }
      ])
      setFavoriteSessionIds([...favoriteSessionIds, sessionId])
    }
  }

  // 세션 삭제 함수
  const handleDeleteSession = async (sessionId: string) => {
    // chat_history 먼저 삭제
    await supabase.from('chat_history').delete().eq('session_id', sessionId);
    // chat_sessions 삭제
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
    // 상태에서 제거
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    // 즐겨찾기에서도 제거
    setFavoriteSessionIds(prev => prev.filter(id => id !== sessionId));
  };

  useEffect(() => {
    if (!user?.email) return
    supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.email)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: any }) => {
        if (data) setSessions(data as SessionItem[])
      })
  }, [user])

  // 실제로 존재하는 세션 중 즐겨찾기된 세션만 카운트
  const validFavoriteCount = sessions.filter(session => favoriteSessionIds.includes(session.id)).length;

  // 관리자 여부 판별
  const isAdmin = user?.email === 'admin@retriever.com' || user?.role === 'admin';


  return (
    <div className="w-full max-w-xs bg-transparent p-0 h-full flex flex-col">
      {/* 탭 + 즐겨찾기 숫자 뱃지 */}
      <div className="flex items-center px-5 pt-4 pb-2 flex-shrink-0">
        <button
          className={`flex-1 pb-2 font-bold text-base transition-all duration-200 border-b-2 ${tab === 'history' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
          onClick={() => setTab('history')}
        >
          최근 채팅
        </button>
        <button
          className={`flex-1 pb-2 font-bold text-base flex items-center justify-center gap-1 transition-all duration-200 border-b-2 ${tab === 'favorites' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
          onClick={() => setTab('favorites')}
        >
          즐겨찾기
          <span className="ml-1 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-200 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors duration-200">{validFavoriteCount}</span>
        </button>
      </div>
      {/* 새 채팅 버튼 */}
      <button
        className="w-[90%] mx-auto mb-2 py-2 flex items-center gap-2 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-black dark:text-gray-100 font-semibold rounded transition-colors duration-200 block flex-shrink-0 justify-start px-3"
        onClick={() => onSelectSession('NEW')}
      >
        <PencilSquareIcon className="w-5 h-5 mr-1 text-black dark:text-white transition-colors duration-200" />
        <span>새 채팅</span>
      </button>
      {/* 관리자 전용 크롤링 버튼 */}
      {isAdmin && (
        <button
          className="w-[90%] mx-auto mb-2 py-2 flex items-center gap-2 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-black dark:text-gray-100 font-semibold text-base rounded transition-colors duration-200 block flex-shrink-0 justify-start px-3"
          onClick={() => router.push('/crawl')}
        >
          <GlobeAltIcon className="w-5 h-5 mr-1 text-black dark:text-white transition-colors duration-200" />
          <span>크롤링</span>
        </button>
      )}
      {/* 파일/대화 리스트 */}
      <div className="flex-1 px-2 pb-10 overflow-y-auto min-h-0 scrollbar-thin">
        {tab === 'history' && (
          <ul className="space-y-1">
            {sessions.map((item) => (
              <li
                key={item.id}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors duration-200
                  ${item.id === selectedSessionId
                    ? 'bg-blue-50 dark:bg-blue-900/50 text-gray-900 dark:text-gray-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}
                `}
                onClick={() => onSelectSession(item.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-gray-900 dark:text-gray-100 text-sm">{item.title}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-300">{formatDate(item.created_at)}</div>
                </div>
                <button
                  className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded transition-colors duration-200"
                  onClick={(e) => { e.stopPropagation(); handleFavoriteSession(item.id); }}
                  aria-label="즐겨찾기"
                >
                  {favoriteSessionIds.includes(item.id) ? (
                    <StarSolid className="w-5 h-5 text-yellow-400 transition-colors duration-200" />
                  ) : (
                    <StarOutline className="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors duration-200" />
                  )}
                </button>
                <button
                  className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded transition-colors duration-200"
                  onClick={(e) => { e.stopPropagation(); handleDeleteSession(item.id); }}
                  aria-label="삭제"
                >
                  <TrashIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {tab === 'favorites' && (
          <ul>
            {sessions.filter(session => favoriteSessionIds.includes(session.id)).map(session => (
              <li
                key={session.id}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors duration-200
                  ${selectedSessionId === session.id
                    ? 'bg-blue-50 dark:bg-blue-900/50 text-gray-900 dark:text-gray-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}
                `}
              >
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="truncate font-medium text-gray-800 dark:text-gray-100 text-sm">{session.title.slice(0, 30)}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    {session.created_at && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {(() => {
                          const utc = new Date(session.created_at);
                          const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
                          return `${kst.getFullYear()}. ${kst.getMonth() + 1}. ${kst.getDate()}. ${kst.getHours().toString().padStart(2, '0')}:${kst.getMinutes().toString().padStart(2, '0')}`;
                        })()}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  className="ml-1"
                  onClick={() => handleFavoriteSession(session.id)}
                  aria-label="즐겨찾기"
                >
                  <StarSolid className="w-5 h-5 text-yellow-400" />
                </button>
                <button
                  className="ml-1 opacity-60 hover:opacity-100"
                  aria-label="삭제"
                  onClick={() => handleDeleteSession(session.id)}
                >
                  <TrashIcon className="w-5 h-5 text-gray-300" />
                </button>
              </li>
            ))}
            {sessions.filter(session => favoriteSessionIds.includes(session.id)).length === 0 && (
              <li className="text-gray-400 text-center py-4">즐겨찾기한 파일이 없습니다.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
} 