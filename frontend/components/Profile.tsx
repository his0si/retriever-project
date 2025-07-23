import { useSession, signOut } from 'next-auth/react'
import { ArrowLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useState, useRef, useEffect } from 'react'

// ToggleSwitch 컴포넌트 수정 (작게, 색상 변경)
function ToggleSwitch({ enabled, onChange }: { enabled: boolean, onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-all duration-300
        ${enabled ? 'bg-gray-800' : 'bg-gray-100 border border-gray-200'}
      `}
      style={{ boxShadow: enabled ? '0 2px 8px #2224' : '0 2px 8px #0001' }}
    >
      <span
        className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all duration-300
          ${enabled ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

export default function Profile({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean, setSidebarOpen: (open: boolean) => void }) {
  const { data: session } = useSession()
  const [showSettings, setShowSettings] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
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
    <div className="relative flex flex-col items-center bg-transparent p-4 pt-6 mb-4">
      {/* 뒤로가기 아이콘 */}
      <button className="absolute left-3 top-3 p-1 rounded-full hover:bg-gray-100" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <ArrowLeftIcon className="w-5 h-5 text-gray-400" />
      </button>
      {/* 환경설정(톱니바퀴) 아이콘 - 오른쪽 위 (모바일에서는 숨김) */}
      <div className="absolute top-3 right-3">
        <button
          className="p-1 rounded-full hover:bg-gray-100 focus:outline-none hidden sm:inline-flex"
          onClick={() => setShowSettings((prev) => !prev)}
          aria-label="환경설정"
        >
          <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
        </button>
        {/* 환경설정 드롭다운 */}
        {showSettings && (
          <div ref={settingsRef} className="absolute mt-2 -right-50 z-50 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-2 flex flex-col items-stretch">
            <button
              className="px-4 py-2 text-left hover:bg-gray-100 text-gray-800"
              onClick={() => { signOut({ callbackUrl: '/landing' }) }}
            >
              로그아웃
            </button>
            <div className="px-4 py-2 flex items-center gap-3 justify-between select-none">
              <span className="text-gray-800">다크 모드</span>
              <ToggleSwitch enabled={darkMode} onChange={setDarkMode} />
            </div>
          </div>
        )}
      </div>
      {/* 프로필 원형 */}
      {session.user.image ? (
        <img src={session.user.image} alt="프로필" className="w-14 h-14 rounded-full border mb-2" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xl font-bold mb-2">
          {initial}
        </div>
      )}
      {/* 닉네임 */}
      <div className="text-base font-bold text-gray-800 mb-1">{name}</div>
      <div className="text-xs text-gray-500">{session.user.email}</div>
    </div>
  )
} 