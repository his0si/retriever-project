'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL, CRAWL_CONSTANTS } from '@/constants/crawl'
import { DbStatus } from '@/types/crawl'
import Alert from '@/components/ui/Alert'
import ScheduledCrawlSection from '@/components/crawl/ScheduledCrawlSection'
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

  // Scheduled crawl state
  const [scheduledTaskId, setScheduledTaskId] = useState<string | null>(null)
  const [scheduledError, setScheduledError] = useState<string | null>(null)

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
    fetchDbStatus()
  }, [])

  return (
    <div className="space-y-6 p-6">
      {/* 크롤링 큐 상태 모니터링 */}
      <QueueMonitor onRefreshTrigger={fetchDbStatus} />

      {/* Supabase 기반 스케줄 크롤링 관리 */}
      <ScheduledCrawlSection
        onScheduledTaskId={setScheduledTaskId}
        onScheduledError={setScheduledError}
      />

      {/* 스케줄 크롤링 에러 */}
      {scheduledError && (
        <Alert type="error">
          <p>{scheduledError}</p>
        </Alert>
      )}

      {/* 스케줄 크롤링 성공 */}
      {scheduledTaskId && !scheduledError && (
        <Alert type="success">
          <p className="font-medium">스케줄 크롤링 작업이 시작되었습니다!</p>
          <p className="text-sm mt-1 opacity-90">Task ID: {scheduledTaskId}</p>
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