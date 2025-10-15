import React from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { DbStatus } from '@/types/crawl'
import Button from '@/components/ui/Button'

interface DatabaseStatusProps {
  dbStatus: DbStatus | null
  showDbStatus: boolean
  isRefreshing: boolean
  isLoading: boolean
  isAutoLoading: boolean
  rootUrl: string
  onRefresh: () => void
  onToggleShow: () => void
}

export default function DatabaseStatus({
  dbStatus,
  showDbStatus,
  isRefreshing,
  isLoading,
  isAutoLoading,
  rootUrl,
  onRefresh,
  onToggleShow
}: DatabaseStatusProps) {
  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Unknown') return '시간 정보 없음'
    
    try {
      return new Date(dateString).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (e) {
      return '시간 정보 없음'
    }
  }

  const getSiteName = (url: string) => {
    if (url.includes('cse.ewha.ac.kr')) return '이화여대 컴퓨터공학과'
    if (url.includes('masscomm.ewha.ac.kr')) return '이화여대 커뮤니케이션·미디어학부'
    return url
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">데이터베이스 상태</h3>
                 <div className="space-x-2 flex">
           <button
             onClick={onRefresh}
             disabled={isRefreshing}
             className="h-8 w-8 p-0 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-800/50 border border-sky-300 dark:border-sky-600 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <ArrowPathIcon className={`w-5 h-5 text-sky-600 dark:text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
           </button>
           <button
             onClick={onToggleShow}
             className="h-8 w-8 p-0 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-800/50 border border-sky-300 dark:border-sky-600 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {showDbStatus ? (
               <svg className="w-5 h-5 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
               </svg>
             ) : (
               <svg className="w-5 h-5 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
               </svg>
             )}
           </button>
         </div>
      </div>

      {/* 진행중인 작업 정보 */}
      {(isLoading || isAutoLoading) && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
          <p className="text-blue-800 dark:text-blue-200 font-medium">진행중인 작업:</p>
          {isLoading && (
            <p className="text-blue-700 dark:text-blue-300 text-sm">수동 크롤링: {rootUrl}</p>
          )}
          {isAutoLoading && (
            <p className="text-blue-700 dark:text-blue-300 text-sm">자동 크롤링: JSON 파일 사이트들</p>
          )}
          <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
            작업 완료 후 아래 상태가 업데이트됩니다
          </p>
        </div>
      )}

      {dbStatus && (
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <div>총 문서 수: <span className="font-semibold">{dbStatus.total_documents}개</span></div>
          <div>마지막 확인: {formatDate(dbStatus.last_checked)}</div>
          
          {showDbStatus && dbStatus.recent_updates && dbStatus.recent_updates.length > 0 && (
            <div className="mt-3">
              <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">최근 업데이트:</div>
              {dbStatus.recent_updates.map((item, index) => {
                const isJsonSite = item.url.includes('cse.ewha.ac.kr') || item.url.includes('masscomm.ewha.ac.kr')
                const siteName = getSiteName(item.url)
                
                return (
                  <div key={index} className={`p-2 rounded text-xs border mb-2 ${
                    isJsonSite 
                      ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs ${
                        isJsonSite 
                          ? 'bg-gray-700 dark:bg-gray-600 text-white' 
                          : 'bg-blue-600 dark:bg-blue-700 text-white'
                      }`}>
                        {isJsonSite ? 'JSON' : '수동'}
                      </span>
                      <div className="font-medium flex-1 truncate dark:text-gray-100" title={item.url}>
                        {siteName}
                      </div>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {formatDate(item.updated_at)}
                    </div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs">
                      청크 {item.chunk_index + 1}/{item.total_chunks}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {showDbStatus && (!dbStatus.recent_updates || dbStatus.recent_updates.length === 0) && (
            <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500 dark:text-gray-400">
              최근 업데이트 정보가 없습니다.
            </div>
          )}
        </div>
      )}
      
      {!dbStatus && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          데이터베이스 상태를 확인해주세요.
        </div>
      )}
    </div>
  )
}