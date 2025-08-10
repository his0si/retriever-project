import React, { useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'

interface UrlSearchResult {
  search_url: string
  found: boolean
  count: number
  total_checked: number
  matching_urls: Array<{
    url: string
    updated_at: string
    chunk_index: number
    total_chunks: number
  }>
  checked_at: string
  error?: string
}

export default function UrlSearchSection() {
  const [searchUrl, setSearchUrl] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<UrlSearchResult | null>(null)
  const [showResults, setShowResults] = useState(false)

  const handleSearch = async () => {
    if (!searchUrl.trim()) {
      alert('URL을 입력해주세요')
      return
    }

    setIsSearching(true)
    setSearchResult(null)
    setShowResults(true)

    try {
      const response = await fetch(`/api/db/search-url?url=${encodeURIComponent(searchUrl)}`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      const data = await response.json()
      setSearchResult(data)
    } catch (error) {
      console.error('Failed to search URL:', error)
      setSearchResult({
        search_url: searchUrl,
        found: false,
        count: 0,
        total_checked: 0,
        matching_urls: [],
        checked_at: new Date().toISOString(),
        error: '검색 중 오류가 발생했습니다'
      })
    } finally {
      setIsSearching(false)
    }
  }

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

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <div>
                 <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-3">URL 검색</h2>
                 <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
           데이터베이스에 특정 URL이 저장되어 있는지 확인할 수 있습니다.
           <br />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
              예시: &ldquo;https://example-school.edu&rdquo;를 입력하면 해당 사이트의 모든 페이지를 찾습니다.
            </span>
         </p>
        
                 <div className="flex flex-row gap-2 items-stretch w-full">
           <input
             type="text"
             value={searchUrl}
             onChange={(e) => setSearchUrl(e.target.value)}
             onKeyPress={(e) => {
               if (e.key === 'Enter' && !isSearching) {
                 handleSearch()
               }
             }}
             placeholder="https://example-school.edu"
                          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
             disabled={isSearching}
           />
            <button
               onClick={handleSearch}
               disabled={isSearching || !searchUrl.trim()}
               className="flex-shrink-0 px-3 py-2 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-800/50 border border-sky-300 dark:border-sky-600 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-w-[40px]"
             >
                          {isSearching ? (
                <svg className="animate-spin h-4 w-4 text-sky-600 dark:text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <MagnifyingGlassIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              )}
           </button>
        </div>
      </div>

      {/* 검색 결과 */}
      {showResults && searchResult && (
        <div className="mt-4 space-y-3">
          {searchResult.error ? (
            <Alert type="error">
              <p>{searchResult.error}</p>
            </Alert>
          ) : searchResult.found ? (
            <>
                                                           <Alert type="success">
                  <p className="font-medium">URL이 데이터베이스에 존재합니다!</p>
                                   <p className="text-sm mt-1">
                     <span className="text-gray-600 dark:text-gray-400">
                       총 {searchResult.count}개의 페이지를 찾았습니다
                     </span>
                   </p>
                   {searchResult.total_checked >= 1000 && (
                     <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                       ※ 최대 1000개까지만 검색하므로 더 많은 페이지가 있을 수 있습니다
                     </p>
                   )}
                </Alert>
              
                                            {/* 매칭된 URL 목록 */}
                {searchResult.matching_urls.length > 0 && (
                  <div className="mt-3">
                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">발견된 페이지 목록 (최대 20개 표시):</div>
                    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
                                          {searchResult.matching_urls.map((item, index) => (
                                                <div key={index} className="p-2 rounded text-xs border mb-2 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                                                                                   <div className="font-medium flex-1 truncate dark:text-gray-100" title={item.url}>
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                            >
                              {item.url}
                            </a>
                          </div>
                                                   <div className="text-gray-500 dark:text-gray-400">
                             업데이트: {formatDate(item.updated_at)}
                                                       {item.total_chunks > 1 && (
                               <span className="ml-2 text-blue-600 dark:text-blue-400">
                                 (청크 {item.chunk_index + 1}/{item.total_chunks})
                               </span>
                             )}
                          </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
                                                   <Alert type="info">
                <p className="font-medium"> URL이 데이터베이스에 존재하지 않습니다.</p>
                               <p className="text-sm mt-1">
                   <span className="text-gray-600 dark:text-gray-400">
                     이 URL로 시작하는 페이지가 아직 크롤링되지 않았습니다.
                   </span>
                 </p>
                 {searchResult.total_checked >= 1000 && (
                   <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                     ※ 최대 1000개까지만 검색하므로 더 많은 페이지가 있을 수 있습니다
                   </p>
                 )}
              </Alert>
          )}
                                          <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              검색 시간: {formatDate(searchResult.checked_at)}
            </div>
        </div>
      )}
    </div>
  )
}