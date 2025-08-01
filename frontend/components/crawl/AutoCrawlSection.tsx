import React, { useState } from 'react'
import { LightBulbIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { CrawlSites } from '@/types/crawl'
import Button from '@/components/ui/Button'

interface AutoCrawlSectionProps {
  crawlSites: CrawlSites | null
  isAutoLoading: boolean
  onAutoCrawl: () => void
}

export default function AutoCrawlSection({ 
  crawlSites, 
  isAutoLoading, 
  onAutoCrawl 
}: AutoCrawlSectionProps) {
  const [enabledSites, setEnabledSites] = useState<Set<string>>(new Set())

  const toggleSite = (siteName: string) => {
    const newEnabledSites = new Set(enabledSites)
    if (newEnabledSites.has(siteName)) {
      newEnabledSites.delete(siteName)
    } else {
      newEnabledSites.add(siteName)
    }
    setEnabledSites(newEnabledSites)
  }

  if (!crawlSites) return null

  return (
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
              아래 &ldquo;입력한 URL 크롤링&rdquo;과는 다른 기능입니다!
            </span>
          </div>
        </div>
        
        <div className="font-medium">활성화된 사이트: {enabledSites.size}개</div>
        {crawlSites.sites.map((site, index) => {
          const isEnabled = enabledSites.has(site.name)
          return (
            <div 
              key={index} 
              className="flex items-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/20 p-1 rounded transition-colors"
              onClick={() => toggleSite(site.name)}
            >
              <span className={`w-2 h-2 rounded-full mr-2 ${
                isEnabled ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'
              }`}></span>
              <span className={isEnabled ? '' : 'line-through opacity-50'}>
                {site.name}
              </span>
            </div>
          )
        })}
      </div>

      <Button
        onClick={onAutoCrawl}
        disabled={isAutoLoading || enabledSites.size === 0}
        className="w-full mt-3 text-sm"
      >
        {isAutoLoading ? 'JSON 사이트 크롤링 중...' : 'JSON 파일 사이트 크롤링'}
      </Button>
    </div>
  )
}