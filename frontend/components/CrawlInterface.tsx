'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

export default function CrawlInterface() {
  const [rootUrl, setRootUrl] = useState('')
  const [maxDepth, setMaxDepth] = useState(2)
  const [isLoading, setIsLoading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [crawlSites, setCrawlSites] = useState<any>(null)
  const [autoTaskId, setAutoTaskId] = useState<string | null>(null)
  const [autoError, setAutoError] = useState<string | null>(null)
  const [isAutoLoading, setIsAutoLoading] = useState(false)
  const [dbStatus, setDbStatus] = useState<any>(null)
  const [showDbStatus, setShowDbStatus] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rootUrl.trim() || isLoading) return

    setIsLoading(true)
    setError(null)
    setTaskId(null)

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/crawl`,
        {
          root_url: rootUrl.trim(),
          max_depth: maxDepth
        }
      )

      setTaskId(response.data.task_id)
      
      // 작업 완료 후 DB 상태 자동 새로고침 (30초 후)
      setTimeout(() => {
        fetchDbStatus()
      }, 30000)
    } catch (error) {
      console.error('Crawl error:', error)
      setError('크롤링 작업을 시작하는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

    const handleAutoCrawl = async () => {
    setIsAutoLoading(true)
    setAutoError(null)
    setAutoTaskId(null)

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/crawl/auto`
      )
      
      setAutoTaskId(response.data.task_id)
      setAutoError(`🤖 JSON 파일 사이트 크롤링이 시작되었습니다! 
      크롤링 대상:
      ${response.data.sites.map((site: string) => `• ${site}`).join('\n')}`)
      
      // 작업 완료 후 DB 상태 자동 새로고침 (60초 후)
      setTimeout(() => {
        fetchDbStatus()
      }, 60000)
    } catch (error) {
      console.error('Auto crawl error:', error)
      setAutoError('자동 크롤링 시작에 실패했습니다.')
    } finally {
      setIsAutoLoading(false)
    }
  }

  const fetchCrawlSites = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/crawl/sites`
      )
      setCrawlSites(response.data)
    } catch (error) {
      console.error('Failed to fetch crawl sites:', error)
    }
  }

  const fetchDbStatus = async () => {
    setIsRefreshing(true)
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/db/status`
      )
      console.log('DB Status Response:', response.data)
      console.log('Total documents:', response.data.total_documents)
      setDbStatus(response.data)
    } catch (error) {
      console.error('Failed to fetch DB status:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCrawlSites()
    fetchDbStatus()
  }, [])

  return (
    <div className="space-y-6">
      {/* 자동 크롤링 사이트 정보 */}
      {crawlSites && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-medium text-green-900 mb-3">
            🤖 자동 크롤링
          </h3>
          
          <div className="text-sm text-green-700 space-y-2 mb-3">
            <div className="bg-green-100 p-2 rounded text-xs">
              💡 <strong>설명:</strong> crawl_sites.json 파일에 미리 설정된 사이트들을 크롤링합니다. 
              매일 새벽 2시에 자동 실행되지만, 즉시 업데이트가 필요할 때 수동으로도 실행할 수 있습니다.
              <br/>
              <strong>⚠️ 주의:</strong> 아래 "입력한 URL 크롤링"과는 다른 기능입니다!
            </div>
            
            <div className="font-medium">활성화된 사이트: {crawlSites.total_enabled}개</div>
            {crawlSites.sites.map((site: any, index: number) => (
              <div key={index} className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  site.enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}></span>
                <span className={site.enabled ? '' : 'line-through opacity-50'}>
                  {site.name}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleAutoCrawl}
            disabled={isAutoLoading}
            className="w-full mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isAutoLoading ? '🤖 JSON 사이트 크롤링 중...' : '🤖 JSON 파일 사이트 크롤링'}
          </button>
        </div>
      )}

      {/* 자동 크롤링 결과 */}
      {autoError && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">{autoError}</p>
        </div>
      )}

      {autoTaskId && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">자동 크롤링 작업이 시작되었습니다!</p>
          <p className="text-green-600 text-sm mt-1">Task ID: {autoTaskId}</p>
          <p className="text-green-600 text-sm mt-2">
            크롤링이 완료되면 챗봇에서 질문할 수 있습니다.
          </p>
        </div>
      )}

              {/* 데이터베이스 상태 */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-gray-900">데이터베이스 상태</h3>
            <div className="space-x-2">
              <button
                onClick={fetchDbStatus}
                disabled={isRefreshing}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isRefreshing ? '🔄 확인 중...' : '🔄 상태 확인'}
              </button>
              <button
                onClick={() => setShowDbStatus(!showDbStatus)}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
              >
                {showDbStatus ? '숨기기' : '상세보기'}
              </button>
            </div>
          </div>

          {/* 진행중인 작업 정보 */}
          {(isLoading || isAutoLoading) && (
            <div className="mb-3 p-3 bg-yellow-100 border border-yellow-300 rounded">
              <p className="text-yellow-800 font-medium">⚡ 진행중인 작업:</p>
              {isLoading && (
                <p className="text-yellow-700 text-sm">📝 수동 크롤링: {rootUrl}</p>
              )}
              {isAutoLoading && (
                <p className="text-yellow-700 text-sm">🤖 자동 크롤링: JSON 파일 사이트들</p>
              )}
              <p className="text-yellow-600 text-xs mt-1">
                💡 작업 완료 후 아래 상태가 업데이트됩니다
              </p>
            </div>
          )}

          {dbStatus && (
            <div className="text-sm text-gray-600 space-y-1">
              <div>📈 총 문서 수: <span className="font-semibold">{dbStatus.total_documents}개</span></div>
              <div>🕐 마지막 확인: {new Date(dbStatus.last_checked).toLocaleString()}</div>
              
              {showDbStatus && dbStatus.recent_updates && dbStatus.recent_updates.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium text-gray-700 mb-2">최근 업데이트:</div>
                  {dbStatus.recent_updates.map((item: any, index: number) => {
                    const isJsonSite = item.url.includes('cse.ewha.ac.kr');
                    let displayTime = '시간 정보 없음';
                    
                    // 실제 시간 데이터가 있으면 포맷팅
                    if (item.updated_at && item.updated_at !== 'Unknown') {
                      try {
                        displayTime = new Date(item.updated_at).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        });
                      } catch (e) {
                        displayTime = '시간 정보 없음';
                      }
                    }
                    
                    return (
                      <div key={index} className={`p-2 rounded text-xs border ${
                        isJsonSite ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs ${
                            isJsonSite ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                          }`}>
                            {isJsonSite ? 'JSON' : '수동'}
                          </span>
                          <div className="font-medium flex-1 truncate" title={item.url}>
                            {item.url}
                          </div>
                        </div>
                        <div className="text-gray-500">
                          📅 {displayTime}
                        </div>
                        <div className="text-gray-400 text-xs">
                          📄 청크 {item.chunk_index + 1}/{item.total_chunks}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 p-3 rounded-lg mb-4">
          <h4 className="font-medium text-blue-900 mb-2">📝 수동 URL 크롤링</h4>
          <p className="text-xs text-blue-700">
            아래에 직접 입력한 URL을 크롤링합니다. 위의 "JSON 파일 사이트 크롤링"과는 별도의 기능입니다.
          </p>
        </div>

        <div>
          <label htmlFor="rootUrl" className="block text-sm font-medium text-gray-700 mb-1">
            루트 URL
          </label>
          <input
            id="rootUrl"
            type="url"
            value={rootUrl}
            onChange={(e) => setRootUrl(e.target.value)}
            placeholder="https://example-school.edu"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 mb-1">
            최대 깊이
          </label>
          <input
            id="maxDepth"
            type="number"
            min="1"
            max="5"
            value={maxDepth}
            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <p className="text-sm text-gray-500 mt-1">
            루트 URL에서 시작하여 탐색할 링크의 최대 깊이 (1-5)
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || !rootUrl.trim()}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '📝 입력 URL 크롤링 중...' : '📝 입력한 URL 크롤링 시작'}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {taskId && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">크롤링 작업이 시작되었습니다!</p>
          <p className="text-green-600 text-sm mt-1">Task ID: {taskId}</p>
          <p className="text-green-600 text-sm mt-2">
            크롤링이 완료되면 챗봇에서 질문할 수 있습니다.
          </p>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">크롤링 안내</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 웹사이트의 구조에 따라 크롤링 시간이 달라질 수 있습니다.</li>
          <li>• 깊이가 클수록 더 많은 페이지를 수집하지만 시간이 오래 걸립니다.</li>
          <li>• 크롤링이 완료되면 수집된 정보를 바탕으로 질문할 수 있습니다.</li>
        </ul>
      </div>
    </div>
  )
}