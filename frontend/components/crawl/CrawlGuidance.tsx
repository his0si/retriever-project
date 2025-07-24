import React from 'react'

export default function CrawlGuidance() {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg">
      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">크롤링 안내</h3>
      <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
        <li>• 웹사이트의 구조에 따라 크롤링 시간이 달라질 수 있습니다.</li>
        <li>• 깊이가 클수록 더 많은 페이지를 수집하지만 시간이 오래 걸립니다.</li>
        <li>• 크롤링이 완료되면 수집된 정보를 바탕으로 질문할 수 있습니다.</li>
      </ul>
    </div>
  )
}