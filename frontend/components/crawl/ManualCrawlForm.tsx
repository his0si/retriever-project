import React from 'react'
import { CRAWL_CONSTANTS } from '@/constants/crawl'
import Button from '@/components/ui/Button'

interface ManualCrawlFormProps {
  rootUrl: string
  maxDepth: number
  isLoading: boolean
  onRootUrlChange: (url: string) => void
  onMaxDepthChange: (depth: number) => void
  onSubmit: (e: React.FormEvent) => void
}

export default function ManualCrawlForm({
  rootUrl,
  maxDepth,
  isLoading,
  onRootUrlChange,
  onMaxDepthChange,
  onSubmit
}: ManualCrawlFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">수동 URL 크롤링</h4>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          아래에 직접 입력한 URL을 크롤링합니다. 위의 &ldquo;JSON 파일 사이트 크롤링&rdquo;과는 별도의 기능입니다.
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
          onChange={(e) => onRootUrlChange(e.target.value)}
          placeholder="https://example-school.edu"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
          min={CRAWL_CONSTANTS.MAX_DEPTH_MIN}
          max={CRAWL_CONSTANTS.MAX_DEPTH_MAX}
          value={maxDepth}
          onChange={(e) => onMaxDepthChange(parseInt(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          disabled={isLoading}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          루트 URL에서 시작하여 탐색할 링크의 최대 깊이 ({CRAWL_CONSTANTS.MAX_DEPTH_MIN}-{CRAWL_CONSTANTS.MAX_DEPTH_MAX})
        </p>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !rootUrl.trim()}
        className="w-full"
      >
        {isLoading ? '입력 URL 크롤링 중...' : '입력한 URL 크롤링 시작'}
      </Button>
    </form>
  )
}