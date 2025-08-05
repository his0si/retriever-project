import React, { useState, useEffect } from 'react'
import { LightBulbIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { CrawlSites, ToggleSiteResponse } from '@/types/crawl'
import { API_URL } from '@/constants/crawl'
import Button from '@/components/ui/Button'
import axios from 'axios'

interface AutoCrawlSectionProps {
  crawlSites: CrawlSites | null
  isAutoLoading: boolean
  onAutoCrawl: () => void
  onSitesUpdate?: () => void
}

export default function AutoCrawlSection({ 
  crawlSites, 
  isAutoLoading, 
  onAutoCrawl,
  onSitesUpdate
}: AutoCrawlSectionProps) {
  const [isToggling, setIsToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleSite = async (siteName: string) => {
    if (isToggling) return // 이미 토글 중이면 무시
    
    setIsToggling(siteName)
    setError(null)
    
    try {
      const response = await axios.post<ToggleSiteResponse>(`${API_URL}/crawl/sites/${encodeURIComponent(siteName)}/toggle`)
      
      // 성공적으로 토글되면 부모 컴포넌트에 알림
      if (onSitesUpdate) {
        onSitesUpdate()
      }
      
      console.log(`Site ${siteName} toggled to ${response.data.enabled}`)
    } catch (error) {
      console.error(`Failed to toggle site ${siteName}:`, error)
      setError(`사이트 토글에 실패했습니다: ${siteName}`)
    } finally {
      setIsToggling(null)
    }
  }

  if (!crawlSites) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
          자동 크롤링
        </h3>
        <div className="text-sm text-blue-700 dark:text-blue-300">
          사이트 정보를 불러오는 중...
        </div>
      </div>
    )
  }

  const enabledSites = crawlSites.sites.filter(site => site.enabled)
  const disabledSites = crawlSites.sites.filter(site => !site.enabled)

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
      <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
        자동 크롤링
      </h3>
      
      {error && (
        <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      
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
        
        <div className="font-medium">활성화된 사이트: {enabledSites.length}개</div>
        
        {/* 활성화된 사이트들 */}
        {enabledSites.map((site, index) => (
          <div 
            key={`enabled-${index}`} 
            className="flex items-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/20 p-1 rounded transition-colors"
            onClick={() => toggleSite(site.name)}
          >
            <span className={`w-2 h-2 rounded-full mr-2 bg-blue-500 dark:bg-blue-400 ${
              isToggling === site.name ? 'animate-pulse' : ''
            }`}></span>
            <span className="font-medium">
              {site.name}
            </span>
            {isToggling === site.name && (
              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">토글 중...</span>
            )}
          </div>
        ))}
        
        {/* 비활성화된 사이트들 */}
        {disabledSites.map((site, index) => (
          <div 
            key={`disabled-${index}`} 
            className="flex items-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/20 p-1 rounded transition-colors"
            onClick={() => toggleSite(site.name)}
          >
            <span className={`w-2 h-2 rounded-full mr-2 bg-gray-300 dark:bg-gray-600 ${
              isToggling === site.name ? 'animate-pulse' : ''
            }`}></span>
            <span className="line-through opacity-50">
              {site.name}
            </span>
            {isToggling === site.name && (
              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">토글 중...</span>
            )}
          </div>
        ))}
        
        {crawlSites.sites.length === 0 && (
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            설정된 사이트가 없습니다.
          </div>
        )}
      </div>

      <Button
        onClick={onAutoCrawl}
        disabled={isAutoLoading || enabledSites.length === 0}
        className="w-full mt-3 text-sm"
      >
        {isAutoLoading ? 'JSON 사이트 크롤링 중...' : 'JSON 파일 사이트 크롤링'}
      </Button>
    </div>
  )
}