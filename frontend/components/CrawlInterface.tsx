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
      setAutoError(`자동 크롤링이 시작되었습니다! 
      크롤링 대상:
      ${response.data.sites.map((site: string) => `• ${site}`).join('\n')}`)
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

  useEffect(() => {
    fetchCrawlSites()
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
              💡 <strong>설명:</strong> 매일 새벽 2시에 자동으로 실행되는 기본 크롤링입니다. 
              혹시 자동 크롤링이 실패하거나 즉시 업데이트가 필요한 경우를 대비해 
              수동으로도 실행할 수 있습니다.
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
            {isAutoLoading ? '자동 사이트 수동 크롤링 중...' : '🚀 자동 사이트 수동으로 크롤링'}
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

      <form onSubmit={handleSubmit} className="space-y-4">
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
          {isLoading ? '크롤링 중...' : '크롤링 시작'}
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