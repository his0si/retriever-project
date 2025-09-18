'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/constants/crawl'
import { QueueStatus, PurgeResponse } from '@/types/crawl'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'

interface QueueMonitorProps {
  onRefreshTrigger?: () => void
}

export default function QueueMonitor({ onRefreshTrigger }: QueueMonitorProps) {
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
    // Auto refresh every 10 seconds
    const interval = setInterval(fetchQueueStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">크롤링 작업 큐 상태</h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={fetchQueueStatus}
            disabled={isLoading}
            className="text-sm"
          >
            {isLoading ? '새로고침...' : '새로고침'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm"
          >
            {showDetails ? '간단히 보기' : '자세히 보기'}
          </Button>
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
          {/* Current Activity Status */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border">
            <h4 className="font-medium text-gray-900 mb-3">🔄 현재 작업 상태</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${queueStatus.current_activity.is_crawling ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span className={`text-sm ${queueStatus.current_activity.is_crawling ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                  {queueStatus.current_activity.is_crawling ? '크롤링 진행 중' : '크롤링 대기'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${queueStatus.current_activity.is_processing_embeddings ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span className={`text-sm ${queueStatus.current_activity.is_processing_embeddings ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
                  {queueStatus.current_activity.is_processing_embeddings ? '임베딩 처리 중' : '임베딩 대기'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${queueStatus.current_activity.has_pending_work ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className={`text-sm ${queueStatus.current_activity.has_pending_work ? 'text-yellow-700 font-medium' : 'text-green-700 font-medium'}`}>
                  {queueStatus.current_activity.has_pending_work ? '대기 작업 있음' : '모든 작업 완료'}
                </span>
              </div>
            </div>
          </div>

          {/* Processing Statistics */}
          {Object.keys(queueStatus.processing_stats).length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">📊 처리 통계</h4>
              {Object.entries(queueStatus.processing_stats).map(([worker, stats]) => (
                <div key={worker} className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">총 처리:</span>
                    <div className="font-semibold text-blue-600">{stats.total_processed}개</div>
                  </div>
                  <div>
                    <span className="text-gray-600">분당 처리:</span>
                    <div className="font-semibold text-green-600">{stats.tasks_per_minute}개</div>
                  </div>
                  <div>
                    <span className="text-gray-600">시간당 처리:</span>
                    <div className="font-semibold text-purple-600">{stats.tasks_per_hour}개</div>
                  </div>
                  <div>
                    <span className="text-gray-600">가동 시간:</span>
                    <div className="font-semibold text-gray-600">{Math.floor(stats.uptime_seconds / 60)}분</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Task Type Breakdown */}
          {Object.keys(queueStatus.total_stats).length > 0 && (
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">📋 작업 유형별 통계</h4>
              {Object.entries(queueStatus.total_stats).map(([worker, tasks]) => (
                <div key={worker} className="space-y-2">
                  {Object.entries(tasks).map(([taskType, count]) => (
                    <div key={taskType} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">
                        {taskType === 'crawl_website' ? '🕷️ 웹사이트 크롤링' :
                         taskType === 'process_url_for_embedding_smart' ? '🧠 스마트 임베딩 처리' :
                         taskType === 'process_url_for_embedding' ? '📝 일반 임베딩 처리' : taskType}
                      </span>
                      <span className="font-semibold text-indigo-600">{count}개 완료</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Main Queue Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">실행 중</div>
              <div className="text-2xl font-bold text-blue-600">
                {queueStatus.queue_status.active_tasks}
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">예약됨</div>
              <div className="text-2xl font-bold text-yellow-600">
                {queueStatus.queue_status.scheduled_tasks}
              </div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">대기 중</div>
              <div className="text-2xl font-bold text-orange-600">
                {queueStatus.queue_status.reserved_tasks}
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">전체 대기</div>
              <div className="text-2xl font-bold text-purple-600">
                {queueStatus.queue_status.total_pending}
              </div>
            </div>
          </div>

          {/* Worker Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">워커 상태</h4>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${queueStatus.workers.online > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                온라인 워커: {queueStatus.workers.online}개
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="primary"
              onClick={handlePurgeQueue}
              disabled={isPurging || queueStatus.queue_status.total_pending === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPurging ? '초기화 중...' : '큐 초기화'}
            </Button>
            {queueStatus.queue_status.total_pending === 0 && (
              <span className="text-sm text-gray-500 flex items-center">
                처리할 작업이 없습니다
              </span>
            )}
          </div>

          {/* Detailed View */}
          {showDetails && (
            <div className="mt-4 space-y-3">
              <h4 className="font-medium text-gray-900">상세 정보</h4>

              {/* Active Tasks Details */}
              {queueStatus.task_details.active.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">🔄 실행 중인 작업</h5>
                  <div className="space-y-2">
                    {queueStatus.task_details.active.map((task, idx) => (
                      <div key={idx} className="text-xs bg-white p-2 rounded border">
                        <div className="font-medium text-blue-800">
                          {task.name === 'crawl_website' ? '🕷️ 웹사이트 크롤링' :
                           task.name === 'process_url_for_embedding_smart' ? '🧠 스마트 임베딩' :
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
                        {task.time_start && (
                          <div className="text-gray-500 mt-1">
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
                  <h5 className="text-sm font-medium text-orange-900 mb-2">⏳ 대기 중인 작업</h5>
                  <div className="space-y-2">
                    {queueStatus.task_details.reserved.slice(0, 5).map((task, idx) => (
                      <div key={idx} className="text-xs bg-white p-2 rounded border">
                        <div className="font-medium text-orange-800">
                          {task.name === 'crawl_website' ? '🕷️ 웹사이트 크롤링' :
                           task.name === 'process_url_for_embedding_smart' ? '🧠 스마트 임베딩' :
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
                  <h5 className="text-sm font-medium text-gray-900 mb-2">👷 워커 세부사항</h5>
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