'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { API_URL } from '@/constants/crawl'
import { QueueStatus, PurgeResponse } from '@/types/crawl'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'

interface QueueMonitorProps {
  onRefreshTrigger?: () => void
  refreshTrigger?: number  // 외부에서 새로고침을 트리거하기 위한 prop
}

export default function QueueMonitor({ onRefreshTrigger, refreshTrigger }: QueueMonitorProps) {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPurging, setIsPurging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const fetchQueueStatus = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.get<QueueStatus>(`${API_URL}/crawl/queue/status`)
      setQueueStatus(response.data)
    } catch (error) {
      console.error('Failed to fetch queue status:', error)
      setError('큐 상태를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePurgeQueue = async () => {
    if (!confirm('정말로 모든 크롤링 작업을 중지하고 초기화하시겠습니까?')) {
      return
    }

    setIsPurging(true)
    setError(null)
    setPurgeMessage(null)

    try {
      const response = await axios.post<PurgeResponse>(`${API_URL}/crawl/queue/purge`)
      setPurgeMessage(`${response.data.message} (제거된 작업: ${response.data.total_cleared}개)`)

      // Refresh queue status and trigger parent refresh
      setTimeout(() => {
        fetchQueueStatus()
        onRefreshTrigger?.()
      }, 1000)
    } catch (error) {
      console.error('Failed to purge queue:', error)
      setError('큐 초기화에 실패했습니다.')
    } finally {
      setIsPurging(false)
    }
  }

  useEffect(() => {
    fetchQueueStatus()
  }, [])

  // refreshTrigger가 변경될 때마다 새로고침
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchQueueStatus()
    }
  }, [refreshTrigger])

  // 자동 폴링: 작업이 있을 때만 2초마다 새로고침
  useEffect(() => {
    if (!queueStatus) return

    const hasPendingWork = queueStatus.current_activity.has_pending_work ||
                          queueStatus.current_activity.is_crawling ||
                          queueStatus.current_activity.is_processing_embeddings

    if (hasPendingWork) {
      const intervalId = setInterval(() => {
        fetchQueueStatus()
      }, 2000) // 2초마다 새로고침

      return () => clearInterval(intervalId)
    }
  }, [queueStatus])

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">크롤링 작업 큐 상태</h3>
        <div className="space-x-2 flex">
          <button
            onClick={fetchQueueStatus}
            disabled={isLoading}
            className="h-8 w-8 p-0 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-800/50 border border-sky-300 dark:border-sky-600 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`w-5 h-5 text-sky-600 dark:text-sky-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="h-8 w-8 p-0 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-800/50 border border-sky-300 dark:border-sky-600 rounded flex items-center justify-center"
          >
            {showDetails ? (
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

      {error && (
        <Alert type="error" className="mb-4">
          <p>{error}</p>
        </Alert>
      )}

      {purgeMessage && (
        <Alert type="success" className="mb-4">
          <p>{purgeMessage}</p>
        </Alert>
      )}

      {queueStatus && (
        <div className="space-y-4">
          {/* Current Activity Status - Simple View */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">현재 작업 상태</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${queueStatus.current_activity.is_crawling ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span className={`text-sm font-medium ${queueStatus.current_activity.is_crawling ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  크롤링 중
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${queueStatus.current_activity.is_processing_embeddings ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span className={`text-sm font-medium ${queueStatus.current_activity.is_processing_embeddings ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  임베딩 중
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${!queueStatus.current_activity.is_crawling && !queueStatus.current_activity.is_processing_embeddings ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className={`text-sm font-medium ${!queueStatus.current_activity.is_crawling && !queueStatus.current_activity.is_processing_embeddings ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  모든 작업 완료
                </span>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
              대기: {queueStatus.queue_status.reserved_tasks}개 | 활성: {queueStatus.queue_status.active_tasks}개
            </div>
          </div>

          {/* Worker Status - Always visible */}
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">워커 상태</h4>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${queueStatus.workers.online > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                온라인 워커: {queueStatus.workers.online}개
              </span>
            </div>
            {queueStatus.workers.online === 0 && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                작업을 처리할 수 있는 워커가 없습니다.
              </div>
            )}
          </div>

          {/* Detailed View - Only shown when showDetails is true */}
          {showDetails && (
            <div className="space-y-4 border-t pt-4">
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handlePurgeQueue}
                  disabled={isPurging}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white disabled:text-gray-500 dark:disabled:text-gray-400 text-sm rounded disabled:cursor-not-allowed"
                >
                  {isPurging ? '초기화 중...' : '큐 초기화'}
                </button>
              </div>

              {/* Processing Statistics */}
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">처리 통계</h4>
                {Object.keys(queueStatus.processing_stats).length > 0 ? (
                  Object.entries(queueStatus.processing_stats).map(([worker, stats]) => (
                    <div key={worker} className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">총 처리:</span>
                        <div className="font-semibold text-blue-600 dark:text-blue-400">{stats.total_processed}개</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">분당 처리:</span>
                        <div className="font-semibold text-green-600 dark:text-green-400">{stats.tasks_per_minute}개</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">시간당 처리:</span>
                        <div className="font-semibold text-purple-600 dark:text-purple-400">{stats.tasks_per_hour}개</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">가동 시간:</span>
                        <div className="font-semibold text-gray-600 dark:text-gray-400">{Math.floor(stats.uptime_seconds / 60)}분</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">총 처리:</span>
                      <div className="font-semibold text-blue-600 dark:text-blue-400">0개</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">분당 처리:</span>
                      <div className="font-semibold text-green-600 dark:text-green-400">0개</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">시간당 처리:</span>
                      <div className="font-semibold text-purple-600 dark:text-purple-400">0개</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">가동 시간:</span>
                      <div className="font-semibold text-gray-600 dark:text-gray-400">0분</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Task Type Breakdown */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">작업 유형별 통계</h4>
                <div className="bg-blue-100 dark:bg-blue-800/30 p-2 rounded text-xs mb-3 space-y-1">
                  <div className="text-gray-600 dark:text-gray-300">크롤링: 페이지 구조를 분석하여 모든 링크를 수집</div>
                  <div className="text-gray-600 dark:text-gray-300">스마트 임베딩 처리: 내용 변경 감지 후 기존 데이터 교체</div>
                  <div className="text-gray-600 dark:text-gray-300">일반 임베딩 처리: 중복 검사 없이 무조건 처리</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      크롤링
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {Object.values(queueStatus.total_stats).reduce((sum, worker: any) => sum + (worker.crawl_website || 0), 0)}개 완료
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      스마트 임베딩 처리
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {Object.values(queueStatus.total_stats).reduce((sum, worker: any) => sum + (worker.process_url_for_embedding_smart || 0), 0)}개 완료
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      일반 임베딩 처리
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {Object.values(queueStatus.total_stats).reduce((sum, worker: any) => sum + (worker.process_url_for_embedding || 0), 0)}개 완료
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Tasks Details */}
              {queueStatus.task_details.active.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                  <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">실행 중인 작업</h5>
                  <div className="space-y-2">
                    {queueStatus.task_details.active.map((task, idx) => (
                      <div key={idx} className="text-xs bg-white dark:bg-gray-700 p-2 rounded border border-blue-200 dark:border-blue-600">
                        <div className="font-medium text-blue-800 dark:text-blue-300">
                          {task.name === 'crawl_website' ? '크롤링' :
                           task.name === 'process_url_for_embedding_smart' ? '스마트 임베딩' :
                           task.name}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 mt-1">
                          ID: {task.task_id.slice(0, 12)}... | 워커: {task.worker}
                        </div>
                        {task.args && task.args.length > 0 && (
                          <div className="text-gray-500 dark:text-gray-400 mt-1 truncate">
                            URL: {task.args[0] || '알 수 없음'}
                          </div>
                        )}
                        {task.time_start && (
                          <div className="text-gray-500 dark:text-gray-400 mt-1">
                            시작: {new Date(task.time_start * 1000).toLocaleTimeString('ko-KR')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reserved Tasks Details */}
              {queueStatus.task_details.reserved.length > 0 && (
                <div className="bg-orange-50 p-3 rounded-lg">
                  <h5 className="text-sm font-medium text-orange-900 mb-2">대기 중인 작업</h5>
                  <div className="space-y-2">
                    {queueStatus.task_details.reserved.slice(0, 5).map((task, idx) => (
                      <div key={idx} className="text-xs bg-white p-2 rounded border">
                        <div className="font-medium text-orange-800">
                          {task.name === 'crawl_website' ? '크롤링' :
                           task.name === 'process_url_for_embedding_smart' ? '스마트 임베딩' :
                           task.name}
                        </div>
                        <div className="text-gray-600 mt-1">
                          ID: {task.task_id.slice(0, 12)}... | 워커: {task.worker}
                        </div>
                        {task.args && task.args.length > 0 && (
                          <div className="text-gray-500 mt-1 truncate">
                            URL: {task.args[0] || '알 수 없음'}
                          </div>
                        )}
                      </div>
                    ))}
                    {queueStatus.task_details.reserved.length > 5 && (
                      <div className="text-xs text-orange-600 text-center py-2">
                        ... 그리고 {queueStatus.task_details.reserved.length - 5}개 더
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Worker Details */}
              {Object.keys(queueStatus.workers.details).length > 0 && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">워커 세부사항</h5>
                  <div className="space-y-2">
                    {Object.entries(queueStatus.workers.details).map(([worker, stats]: [string, any]) => (
                      <div key={worker} className="text-xs bg-white p-2 rounded border">
                        <div className="font-medium text-gray-800">{worker}</div>
                        <div className="text-gray-600 mt-1">
                          PID: {stats.pid} | 가동시간: {Math.floor(stats.uptime / 60)}분
                        </div>
                        {stats.pool && (
                          <div className="text-gray-500 mt-1">
                            동시 실행: {stats.pool['max-concurrency']}개 | 풀: {stats.pool.implementation?.split(':')[1] || 'unknown'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-gray-500 text-right">
            마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
          </div>
        </div>
      )}

      {!queueStatus && !isLoading && !error && (
        <div className="text-center text-gray-500 py-8">
          큐 상태를 불러오는 중...
        </div>
      )}
    </div>
  )
}