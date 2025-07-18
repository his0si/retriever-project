'use client'

import { useState } from 'react'
import axios from 'axios'

export default function CrawlInterface() {
  const [rootUrl, setRootUrl] = useState('')
  const [maxDepth, setMaxDepth] = useState(2)
  const [isLoading, setIsLoading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
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
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '크롤링 시작 중...' : '크롤링 시작'}
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