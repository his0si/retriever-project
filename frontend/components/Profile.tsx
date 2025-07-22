import { useSession } from 'next-auth/react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function Profile({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean, setSidebarOpen: (open: boolean) => void }) {
  const { data: session } = useSession()
  if (!session?.user) return null
  const name = session.user.name || ''
  const initial = name[0] || '?'
  return (
    <div className="relative flex flex-col items-center bg-white rounded-xl shadow p-4 pt-6 mb-4">
      {/* 뒤로가기 아이콘 */}
      <button className="absolute left-3 top-3 p-1 rounded-full hover:bg-gray-100" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <ArrowLeftIcon className="w-5 h-5 text-gray-400" />
      </button>
      {/* 프로필 원형 */}
      {session.user.image ? (
        <img src={session.user.image} alt="프로필" className="w-14 h-14 rounded-full border mb-2" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xl font-bold mb-2">
          {initial}
        </div>
      )}
      <div className="text-base font-bold text-gray-800 mb-1">{name}</div>
      <div className="text-xs text-gray-500">{session.user.email}</div>
    </div>
  )
} 