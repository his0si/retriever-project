'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL, CRAWL_CONSTANTS } from '@/constants/crawl'
import { CrawlSites, DbStatus, AutoCrawlResponse } from '@/types/crawl'
import Alert from '@/components/ui/Alert'
import AutoCrawlSection from '@/components/crawl/AutoCrawlSection'
import DatabaseStatus from '@/components/crawl/DatabaseStatus'
import ManualCrawlForm from '@/components/crawl/ManualCrawlForm'
import CrawlGuidance from '@/components/crawl/CrawlGuidance'
import UrlSearchSection from '@/components/crawl/UrlSearchSection'
import QueueMonitor from '@/components/crawl/QueueMonitor'

export default function CrawlInterface() {
  // Manual crawl state
  const [rootUrl, setRootUrl] = useState('')
  const [maxDepth, setMaxDepth] = useState<number>(CRAWL_CONSTANTS.DEFAULT_MAX_DEPTH)
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
      
      // Refresh DB status after delay
      setTimeout(fetchDbStatus, CRAWL_CONSTANTS.DB_STATUS_REFRESH_DELAY)
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

      // Refresh DB status after delay
      setTimeout(fetchDbStatus, CRAWL_CONSTANTS.AUTO_CRAWL_REFRESH_DELAY)
    } catch (error) {
      console.error('Auto crawl error:', error)
      if (axios.isAxiosError(error)) {
        setAutoError(error.response?.data?.message || error.response?.data?.detail || '자동 크롤링 시작에 실패했습니다.')
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
      const response = await axios.get<DbStatus>(`${API_URL}/db/status`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        params: {
          _t: Date.now()  // 캐시 방지를 위한 타임스탬프 추가
        }
      })
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
    <div className="space-y-6 p-6">
      {/* 크롤링 큐 상태 모니터링 */}
      <QueueMonitor onRefreshTrigger={fetchDbStatus} />

      {/* 자동 크롤링 사이트 정보 */}
      <AutoCrawlSection
        crawlSites={crawlSites}
        isAutoLoading={isAutoLoading}
        onAutoCrawl={handleAutoCrawl}
        onSitesUpdate={fetchCrawlSites}
      />

      {/* 자동 크롤링 에러 */}
      {autoError && (
        <Alert type="error">
          <p>{autoError}</p>
        </Alert>
      )}

      {/* 자동 크롤링 성공 */}
      {autoTaskId && !autoError && (
        <Alert type="success">
          <p className="font-medium">자동 크롤링 작업이 시작되었습니다!</p>
          <p className="text-sm mt-1 opacity-90">Task ID: {autoTaskId}</p>
          <p className="text-sm mt-2 opacity-90">
            크롤링이 완료되면 챗봇에서 질문할 수 있습니다.
          </p>
        </Alert>
      )}

      {/* 데이터베이스 상태 */}
      <DatabaseStatus
        dbStatus={dbStatus}
        showDbStatus={showDbStatus}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
        isAutoLoading={isAutoLoading}
        rootUrl={rootUrl}
        onRefresh={fetchDbStatus}
        onToggleShow={() => setShowDbStatus(!showDbStatus)}
      />

      {/* URL 검색 섹션 */}
      <UrlSearchSection />

      <ManualCrawlForm
        rootUrl={rootUrl}
        maxDepth={maxDepth}
        isLoading={isLoading}
        onRootUrlChange={setRootUrl}
        onMaxDepthChange={(depth) => setMaxDepth(depth)}
        onSubmit={handleSubmit}
      />

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

      <CrawlGuidance />
    </div>
  )
}