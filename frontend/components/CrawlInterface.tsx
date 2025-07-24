'use client'

import { useState, useEffect } from 'react'
import axios, { AxiosError } from 'axios'
import { DocumentIcon, ClockIcon, ArrowPathIcon, LightBulbIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface CrawlSite {
  name: string
  enabled: boolean
}

interface CrawlSites {
  total_enabled: number
  sites: CrawlSite[]
}

interface DbStatusUpdate {
  url: string
  updated_at: string
  chunk_index: number
  total_chunks: number
}

interface DbStatus {
  total_documents: number
  last_checked: string
  recent_updates: DbStatusUpdate[]
}

interface CrawlResponse {
  task_id: string
}

interface AutoCrawlResponse extends CrawlResponse {
  sites: string[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Alert component
const Alert = ({ type, children }: { type: 'success' | 'error' | 'info', children: React.ReactNode }) => {
  const styles = {
    success: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    info: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
  }
  
  return (
    <div className={`p-4 border rounded-lg ${styles[type]}`}>
      {children}
    </div>
  )
}

// Button component
const Button = ({ 
  onClick, 
  disabled, 
  children, 
  variant = 'primary',
  className = '',
  type = 'button'
}: { 
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
  type?: 'button' | 'submit' | 'reset'
}) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700',
    secondary: 'bg-gray-700 dark:bg-gray-600 text-white hover:bg-gray-800 dark:hover:bg-gray-700'
  }
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export default function CrawlInterface() {
  // Manual crawl state
  const [rootUrl, setRootUrl] = useState('')
  const [maxDepth, setMaxDepth] = useState(2)
  const [isLoading, setIsLoading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Auto crawl state
  const [crawlSites, setCrawlSites] = useState<CrawlSites | null>(null)
  const [autoTaskId, setAutoTaskId] = useState<string | null>(null)
  const [autoError, setAutoError] = useState<string | null>(null)
  const [isAutoLoading, setIsAutoLoading] = useState(false)
  
  // Database state
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null)
  const [showDbStatus, setShowDbStatus] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rootUrl.trim() || isLoading) return

    setIsLoading(true)
    setError(null)
    setTaskId(null)

    try {
      const response = await axios.post(`${API_URL}/crawl`, {
        root_url: rootUrl.trim(),
        max_depth: maxDepth
      })

      setTaskId(response.data.task_id)
      
      // Refresh DB status after 30 seconds
      setTimeout(fetchDbStatus, 30000)
    } catch (error) {
      console.error('Crawl error:', error)
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || '크롤링 작업을 시작하는데 실패했습니다.')
      } else {
        setError('크롤링 작업을 시작하는데 실패했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

    const handleAutoCrawl = async () => {
    setIsAutoLoading(true)
    setAutoError(null)
    setAutoTaskId(null)

    try {
      const response = await axios.post<AutoCrawlResponse>(`${API_URL}/crawl/auto`)
      
      setAutoTaskId(response.data.task_id)
      const sitesList = response.data.sites.map((site) => `• ${site}`).join('\n')
      setAutoError(`JSON 파일 사이트 크롤링이 시작되었습니다!\n크롤링 대상:\n${sitesList}`)
      
      // Refresh DB status after 60 seconds
      setTimeout(fetchDbStatus, 60000)
    } catch (error) {
      console.error('Auto crawl error:', error)
      if (axios.isAxiosError(error)) {
        setAutoError(error.response?.data?.message || '자동 크롤링 시작에 실패했습니다.')
      } else {
        setAutoError('자동 크롤링 시작에 실패했습니다.')
      }
    } finally {
      setIsAutoLoading(false)
    }
  }

  const fetchCrawlSites = async () => {
    try {
      const response = await axios.get<CrawlSites>(`${API_URL}/crawl/sites`)
      setCrawlSites(response.data)
    } catch (error) {
      console.error('Failed to fetch crawl sites:', error)
    }
  }

  const fetchDbStatus = async () => {
    setIsRefreshing(true)
    try {
      const response = await axios.get<DbStatus>(`${API_URL}/db/status`)
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
    <div className="space-y-6 p-6 dark:bg-gray-900">
      {/* 자동 크롤링 사이트 정보 */}
      {crawlSites && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
            자동 크롤링
          </h3>
          
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2 mb-3">
            <div className="bg-blue-100 dark:bg-blue-800/30 p-2 rounded text-xs space-y-1">
              <div className="flex items-start gap-2">
                <span className="flex items-center flex-shrink-0 text-gray-500 dark:text-gray-400 font-semibold min-w-[3.5em]">
                  <LightBulbIcon className="w-4 h-4 mr-1" />설명:
                </span>
                <span className="text-gray-600 dark:text-gray-300 font-normal flex-1">
                  crawl_sites.json 파일에 미리 설정된 사이트들을 크롤링합니다. 매일 새벽 2시에 자동 실행되지만, 수동으로도 실행할 수 있습니다.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex items-center flex-shrink-0 text-gray-500 dark:text-gray-400 font-semibold min-w-[3.5em]">
                  <ExclamationTriangleIcon className="w-4 h-4 mr-1" />주의:
                </span>
                <span className="text-gray-600 dark:text-gray-300 font-normal flex-1">
                  아래 "입력한 URL 크롤링"과는 다른 기능입니다!
                </span>
              </div>
            </div>
            
            <div className="font-medium">활성화된 사이트: {crawlSites.total_enabled}개</div>
            {crawlSites.sites.map((site, index) => (
              <div key={index} className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  site.enabled ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'
                }`}></span>
                <span className={site.enabled ? '' : 'line-through opacity-50'}>
                  {site.name}
                </span>
              </div>
            ))}
          </div>

          <Button
            onClick={handleAutoCrawl}
            disabled={isAutoLoading}
            className="w-full mt-3 text-sm"
          >
            {isAutoLoading ? 'JSON 사이트 크롤링 중...' : 'JSON 파일 사이트 크롤링'}
          </Button>
        </div>
      )}

      {/* 자동 크롤링 결과 */}
      {autoError && (
        <Alert type="info">
          <p>{autoError}</p>
        </Alert>
      )}

      {autoTaskId && (
        <Alert type="success">
          <p className="font-medium">자동 크롤링 작업이 시작되었습니다!</p>
          <p className="text-sm mt-1 opacity-90">Task ID: {autoTaskId}</p>
          <p className="text-sm mt-2 opacity-90">
            크롤링이 완료되면 챗봇에서 질문할 수 있습니다.
          </p>
        </Alert>
      )}

              {/* 데이터베이스 상태 */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">데이터베이스 상태</h3>
            <div className="space-x-2 flex">
              <Button
                onClick={fetchDbStatus}
                disabled={isRefreshing}
                className="h-8 px-2 text-xs"
              >
                {isRefreshing ? (
                  <span className="flex items-center gap-1"><ArrowPathIcon className="w-4 h-4 animate-spin" /> 확인 중...</span>
                ) : (
                  <span className="flex items-center gap-1"><ArrowPathIcon className="w-4 h-4" /> 상태 확인</span>
                )}
              </Button>
              <Button
                onClick={() => setShowDbStatus(!showDbStatus)}
                variant="secondary"
                className="h-8 px-2 text-xs"
              >
                {showDbStatus ? '숨기기' : '상세보기'}
              </Button>
            </div>
          </div>

          {/* 진행중인 작업 정보 */}
          {(isLoading || isAutoLoading) && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <p className="text-blue-800 dark:text-blue-200 font-medium"> 진행중인 작업:</p>
              {isLoading && (
                <p className="text-blue-700 dark:text-blue-300 text-sm"> 수동 크롤링: {rootUrl}</p>
              )}
              {isAutoLoading && (
                <p className="text-blue-700 dark:text-blue-300 text-sm"> 자동 크롤링: JSON 파일 사이트들</p>
              )}
              <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                 작업 완료 후 아래 상태가 업데이트됩니다
              </p>
            </div>
          )}

          {dbStatus && (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div> 총 문서 수: <span className="font-semibold">{dbStatus.total_documents}개</span></div>
              <div> 마지막 확인: {new Date(dbStatus.last_checked).toLocaleString()}</div>
              
              {showDbStatus && dbStatus.recent_updates && dbStatus.recent_updates.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">최근 업데이트:</div>
                  {dbStatus.recent_updates.map((item, index) => {
                    const isJsonSite = item.url.includes('cse.ewha.ac.kr');
                    let displayTime = '시간 정보 없음';
                    
                    // Format time if valid data exists
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
                        isJsonSite ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs ${
                            isJsonSite ? 'bg-gray-700 dark:bg-gray-600 text-white' : 'bg-blue-600 dark:bg-blue-700 text-white'
                          }`}>
                            {isJsonSite ? 'JSON' : '수동'}
                          </span>
                          <div className="font-medium flex-1 truncate dark:text-gray-100" title={item.url}>
                            {item.url}
                          </div>
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {displayTime}
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 text-xs">
                          청크 {item.chunk_index + 1}/{item.total_chunks}
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
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2"> 수동 URL 크롤링</h4>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            아래에 직접 입력한 URL을 크롤링합니다. 위의 "JSON 파일 사이트 크롤링"과는 별도의 기능입니다.
          </p>
        </div>

        <div>
          <label htmlFor="rootUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            루트 URL
          </label>
          <input
            id="rootUrl"
            type="url"
            value={rootUrl}
            onChange={(e) => setRootUrl(e.target.value)}
            placeholder="https://example-school.edu"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            최대 깊이
          </label>
          <input
            id="maxDepth"
            type="number"
            min="1"
            max="5"
            value={maxDepth}
            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200"
            disabled={isLoading}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            루트 URL에서 시작하여 탐색할 링크의 최대 깊이 (1-5)
          </p>
        </div>

        <Button
          type="submit"
          disabled={isLoading || !rootUrl.trim()}
          className="w-full"
        >
          {isLoading ? ' 입력 URL 크롤링 중...' : ' 입력한 URL 크롤링 시작'}
        </Button>
      </form>

      {error && (
        <Alert type="error">
          <p>{error}</p>
        </Alert>
      )}

      {taskId && (
        <Alert type="success">
          <p className="font-medium">크롤링 작업이 시작되었습니다!</p>
          <p className="text-sm mt-1 opacity-90">Task ID: {taskId}</p>
          <p className="text-sm mt-2 opacity-90">
            크롤링이 완료되면 챗봇에서 질문할 수 있습니다.
          </p>
        </Alert>
      )}

      <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">크롤링 안내</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• 웹사이트의 구조에 따라 크롤링 시간이 달라질 수 있습니다.</li>
          <li>• 깊이가 클수록 더 많은 페이지를 수집하지만 시간이 오래 걸립니다.</li>
          <li>• 크롤링이 완료되면 수집된 정보를 바탕으로 질문할 수 있습니다.</li>
        </ul>
      </div>
    </div>
  )
}