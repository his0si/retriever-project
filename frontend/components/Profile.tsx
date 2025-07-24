import { useSession, signOut } from 'next-auth/react'
import { ArrowLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useState, useRef, useEffect } from 'react'
import { useDarkMode } from '../app/providers'
import ToggleSwitch from './ToggleSwitch'

export default function Profile({ setSidebarOpen }: { sidebarOpen: boolean, setSidebarOpen: (open: boolean) => void }) {
  const { data: session } = useSession()
  const [showSettings, setShowSettings] = useState(false)
  const { darkMode, setDarkMode } = useDarkMode();
  const settingsRef = useRef<HTMLDivElement>(null)

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false)
      }
    }
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings])

  if (!session?.user) return null
  const name = session.user.name || ''
  const initial = name[0] || '?'

  return (
    <div className="relative flex flex-col items-center bg-transparent p-4 pt-6 mb-4 transition-colors duration-200">
      {/* 뒤로가기 아이콘 */}
      <button className="absolute left-3 top-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200" onClick={() => setSidebarOpen(false)}>
        <ArrowLeftIcon className="w-5 h-5 text-gray-400 dark:text-gray-200" />
      </button>
      {/* 환경설정(톱니바퀴) 아이콘 - 오른쪽 위 (모바일에서는 숨김) */}
      <div className="absolute top-3 right-3">
        <button
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none hidden sm:inline-flex transition-colors duration-200"
          onClick={() => setShowSettings((prev) => !prev)}
          aria-label="환경설정"
        >
          <Cog6ToothIcon className="w-5 h-5 text-gray-500 dark:text-gray-200 transition-colors duration-200" />
        </button>
        {/* 환경설정 드롭다운 */}
        {showSettings && (
          <div ref={settingsRef} className="absolute mt-2 -right-50 z-50 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 flex flex-col items-stretch transition-all duration-200">
            <button
              className="px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 transition-colors duration-200"
              onClick={() => { signOut({ callbackUrl: '/landing' }) }}
            >
              로그아웃
            </button>
            <div className="px-4 py-2 flex items-center gap-3 justify-between select-none">
              <span className="text-gray-800 dark:text-gray-100 transition-colors duration-200">다크 모드</span>
              <ToggleSwitch enabled={darkMode} onChange={setDarkMode} />
            </div>
          </div>
        )}
      </div>
      {/* 프로필 원형 */}
      {session.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={session.user.image} alt="프로필" className="w-14 h-14 rounded-full border mb-2" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xl font-bold mb-2">
          {initial}
        </div>
      )}
      {/* 닉네임 */}
      <div className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1 transition-colors duration-200">{name}</div>
      <div className="text-xs text-gray-500 dark:text-gray-300 transition-colors duration-200">{session.user.email}</div>
    </div>
  )
} 