'use client'

import React, { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import {
  FolderIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  GlobeAltIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  BoltIcon
} from '@heroicons/react/24/outline'
import { FolderWithSites, CreateFolderRequest, CreateSiteRequest, ScheduleType } from '@/types/crawl'
import { API_URL } from '@/constants/crawl'
import Button from '@/components/ui/Button'
import axios from 'axios'

interface ScheduledCrawlSectionProps {
  onScheduledTaskId?: (taskId: string) => void
  onScheduledError?: (error: string) => void
}

export default function ScheduledCrawlSection({ onScheduledTaskId, onScheduledError }: ScheduledCrawlSectionProps) {
  const [folders, setFolders] = useState<FolderWithSites[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Modal states
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [showEditFolderModal, setShowEditFolderModal] = useState(false)
  const [showCreateSiteModal, setShowCreateSiteModal] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [editingFolder, setEditingFolder] = useState<FolderWithSites | null>(null)

  // Form states
  const [folderForm, setFolderForm] = useState<CreateFolderRequest>({
    name: '',
    schedule_type: 'daily',
    schedule_time: '02:00',
    schedule_day: null,
    enabled: true
  })

  const [siteForm, setSiteForm] = useState<CreateSiteRequest>({
    folder_id: '',
    name: '',
    url: '',
    description: '',
    enabled: true
  })

  // Load folders - 한 번만 정렬하고 그 순서를 계속 유지
  const loadFolders = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.get<FolderWithSites[]>(`${API_URL}/crawl/folders`)

      // 초기 로드 시에만 정렬하고, 이후에는 이 순서를 절대 바꾸지 않음
      const sortedData = response.data.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      sortedData.forEach(folder => {
        folder.sites.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      })

      setFolders(sortedData)
    } catch (err) {
      console.error('Failed to load folders:', err)
      setError('폴더 목록을 불러오는데 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFolders()
  }, [])

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const requestData = {
        ...folderForm,
        schedule_time: `${folderForm.schedule_time}:00`  // HH:MM:SS format
      }

      await axios.post(`${API_URL}/crawl/folders`, requestData)
      setShowCreateFolderModal(false)
      setFolderForm({
        name: '',
        schedule_type: 'daily',
        schedule_time: '02:00',
        schedule_day: null,
        enabled: true
      })
      loadFolders()
    } catch (err: any) {
      alert(err.response?.data?.detail || '폴더 생성에 실패했습니다')
    }
  }

  // Edit folder
  const handleEditFolder = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingFolder) return

    try {
      // 모든 필드를 명시적으로 전송
      const requestData = {
        name: folderForm.name,
        schedule_type: folderForm.schedule_type,
        schedule_time: `${folderForm.schedule_time}:00`,  // HH:MM:SS format
        schedule_day: folderForm.schedule_day,
        enabled: folderForm.enabled
      }

      await axios.patch(`${API_URL}/crawl/folders/${editingFolder.id}`, requestData)
      setShowEditFolderModal(false)
      setEditingFolder(null)
      setFolderForm({
        name: '',
        schedule_type: 'daily',
        schedule_time: '02:00',
        schedule_day: null,
        enabled: true
      })
      await loadFolders()
    } catch (err: any) {
      console.error('Failed to edit folder:', err)
      alert(err.response?.data?.detail || '폴더 수정에 실패했습니다')
    }
  }

  // Open edit folder modal
  const openEditFolderModal = (folder: FolderWithSites) => {
    setEditingFolder(folder)
    setFolderForm({
      name: folder.name,
      schedule_type: folder.schedule_type,
      schedule_time: folder.schedule_time.substring(0, 5), // HH:MM:SS -> HH:MM
      schedule_day: folder.schedule_day,
      enabled: folder.enabled
    })
    setShowEditFolderModal(true)
  }

  // Create site
  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFolderId) return

    try {
      const requestData = {
        ...siteForm,
        folder_id: selectedFolderId
      }

      await axios.post(`${API_URL}/crawl/folders/${selectedFolderId}/sites`, requestData)
      setShowCreateSiteModal(false)
      setSelectedFolderId(null)
      setSiteForm({
        folder_id: '',
        name: '',
        url: '',
        description: '',
        enabled: true
      })
      await loadFolders()
    } catch (err: any) {
      alert(err.response?.data?.detail || '사이트 추가에 실패했습니다')
    }
  }

  // Delete folder
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`정말로 "${folderName}" 폴더를 삭제하시겠습니까?\n폴더 내 모든 사이트도 함께 삭제됩니다.`)) {
      return
    }

    try {
      await axios.delete(`${API_URL}/crawl/folders/${folderId}`)
      await loadFolders()
    } catch (err: any) {
      alert(err.response?.data?.detail || '폴더 삭제에 실패했습니다')
    }
  }

  // Delete site
  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (!confirm(`정말로 "${siteName}" 사이트를 삭제하시겠습니까?`)) {
      return
    }

    try {
      await axios.delete(`${API_URL}/crawl/sites/${siteId}`)
      await loadFolders()
    } catch (err: any) {
      alert(err.response?.data?.detail || '사이트 삭제에 실패했습니다')
    }
  }

  // Toggle site enabled - 스크롤 위치 절대 유지
  const handleToggleSite = async (siteId: string, currentEnabled: boolean) => {
    // 현재 스크롤 위치 저장
    const scrollY = window.pageYOffset || document.documentElement.scrollTop

    // 상태 업데이트
    flushSync(() => {
      setFolders(prevFolders =>
        prevFolders.map(folder => ({
          ...folder,
          sites: folder.sites.map(site =>
            site.id === siteId ? { ...site, enabled: !currentEnabled } : site
          )
        }))
      )
    })

    // 스크롤 위치 강제 고정
    window.scrollTo(0, scrollY)

    // API 호출
    try {
      await axios.patch(`${API_URL}/crawl/sites/${siteId}`, {
        enabled: !currentEnabled
      })
    } catch (err: any) {
      // 실패 시 원래대로 복구
      flushSync(() => {
        setFolders(prevFolders =>
          prevFolders.map(folder => ({
            ...folder,
            sites: folder.sites.map(site =>
              site.id === siteId ? { ...site, enabled: currentEnabled } : site
            )
          }))
        )
      })
      window.scrollTo(0, scrollY)
      alert(err.response?.data?.detail || '사이트 상태 변경에 실패했습니다')
    }
  }

  // Toggle folder enabled
  const handleToggleFolder = async (folderId: string, currentEnabled: boolean) => {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop

    flushSync(() => {
      setFolders(prevFolders =>
        prevFolders.map(folder =>
          folder.id === folderId ? { ...folder, enabled: !currentEnabled } : folder
        )
      )
    })

    window.scrollTo(0, scrollY)

    try {
      await axios.patch(`${API_URL}/crawl/folders/${folderId}`, {
        enabled: !currentEnabled
      })
    } catch (err: any) {
      flushSync(() => {
        setFolders(prevFolders =>
          prevFolders.map(folder =>
            folder.id === folderId ? { ...folder, enabled: currentEnabled } : folder
          )
        )
      })
      window.scrollTo(0, scrollY)
      alert(err.response?.data?.detail || '폴더 상태 변경에 실패했습니다')
    }
  }

  // Execute immediate crawl for folder's enabled sites
  const handleExecuteFolderCrawl = async (folderId: string, folderName: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return

    const enabledSitesCount = folder.sites.filter(s => s.enabled).length

    if (enabledSitesCount === 0) {
      onScheduledError?.('활성화된 사이트가 없습니다')
      return
    }

    const confirmed = confirm(`"${folderName}" 폴더의 활성화된 사이트 ${enabledSitesCount}개를 즉시 크롤링하시겠습니까?`)
    if (!confirmed) return

    try {
      const response = await axios.post(`${API_URL}/crawl/folders/${folderId}/execute`)
      onScheduledTaskId?.(response.data.task_id)
    } catch (err: any) {
      onScheduledError?.(err.response?.data?.detail || err.response?.data?.error || '크롤링 시작에 실패했습니다')
    }
  }

  // Toggle all sites in folder
  const handleToggleAllSites = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return

    const scrollY = window.pageYOffset || document.documentElement.scrollTop
    const enabledCount = folder.sites.filter(s => s.enabled).length
    const newEnabledState = enabledCount < folder.sites.length

    flushSync(() => {
      setFolders(prevFolders =>
        prevFolders.map(f =>
          f.id === folderId
            ? { ...f, sites: f.sites.map(site => ({ ...site, enabled: newEnabledState })) }
            : f
        )
      )
    })

    window.scrollTo(0, scrollY)

    try {
      await Promise.all(
        folder.sites.map(site =>
          axios.patch(`${API_URL}/crawl/sites/${site.id}`, { enabled: newEnabledState })
        )
      )
    } catch (err: any) {
      await loadFolders()
      window.scrollTo(0, scrollY)
      alert(err.response?.data?.detail || '사이트 상태 변경에 실패했습니다')
    }
  }

  // Format schedule display
  const formatSchedule = (folder: FolderWithSites) => {
    const time = folder.schedule_time.substring(0, 5) // HH:MM
    const days = ['일', '월', '화', '수', '목', '금', '토']

    if (folder.schedule_type === 'daily') {
      return `매일 ${time}`
    } else if (folder.schedule_type === 'weekly' && folder.schedule_day !== null) {
      return `매주 ${days[folder.schedule_day]}요일 ${time}`
    } else if (folder.schedule_type === 'monthly') {
      return `매월 1일 ${time}`
    }
    return ''
  }

  if (isLoading) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
        <div className="text-center py-4 text-blue-700 dark:text-blue-300 text-sm">로딩 중...</div>
      </div>
    )
  }

  const enabledFolders = folders.filter(f => f.enabled)

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800" style={{ scrollBehavior: 'auto' }}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
        <h3 className="font-medium text-blue-900 dark:text-blue-100">
          스케줄 크롤링 폴더
        </h3>
        <Button
          onClick={() => setShowCreateFolderModal(true)}
          variant="primary"
          className="w-full sm:w-auto text-sm h-8"
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          폴더 추가
        </Button>
      </div>

      {/* 설명 섹션 */}
      <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1 mb-3">
        <div className="bg-blue-100 dark:bg-blue-800/30 p-2 rounded text-xs space-y-1">
          <div className="flex items-start gap-2">
            <span className="flex items-center flex-shrink-0 text-gray-500 dark:text-gray-400 font-semibold min-w-[3.5em]">
              <LightBulbIcon className="w-3 h-3 mr-1" />설명:
            </span>
            <span className="text-gray-600 dark:text-gray-300 font-normal flex-1">
              폴더에 등록된 사이트를 설정된 주기마다 자동으로 크롤링합니다.
              <br />
              폴더별 또는 사이트별로 활성화 여부(<ClockIcon className="w-3 h-3 inline" />)를 설정할 수 있으며, 필요한 경우 원하는 사이트만 수동으로 즉시 크롤링(<BoltIcon className="w-3 h-3 inline" />) 가능합니다.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex items-center flex-shrink-0 text-gray-500 dark:text-gray-400 font-semibold min-w-[3.5em]">
              <ExclamationTriangleIcon className="w-3 h-3 mr-1" />주의:
            </span>
            <span className="text-gray-600 dark:text-gray-300 font-normal flex-1">
              폴더를 삭제하면 폴더 내 모든 사이트도 함께 삭제됩니다!
            </span>
          </div>
        </div>

        <div className="text-xs text-blue-800 dark:text-blue-200 text-right mt-1 mr-1">
          활성화된 폴더: {enabledFolders.length}개 / 전체: {folders.length}개
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-2 rounded text-xs mb-2">
          {error}
        </div>
      )}

      {folders.length === 0 ? (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          생성된 폴더가 없습니다. 새 폴더를 추가해보세요.
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map((folder) => {
            const isExpanded = expandedFolders.has(folder.id)
            const enabledSitesCount = folder.sites.filter(s => s.enabled).length

            return (
              <div
                key={folder.id}
                className={`rounded-lg transition-all text-sm ${
                  folder.enabled
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-600 shadow-sm'
                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                }`}
              >
                {/* Folder Header */}
                <div className="p-2">
                  {/* 첫 번째 줄: 접기 버튼 + 폴더 아이콘 + 폴더 이름 + 활성화 여부 */}
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.blur()
                        toggleFolder(folder.id)
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex-shrink-0"
                      aria-label={isExpanded ? '접기' : '펼치기'}
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </button>

                    <FolderIcon className={`w-5 h-5 flex-shrink-0 ${folder.enabled ? 'text-blue-500' : 'text-gray-400'}`} />

                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate flex-1 min-w-0">
                      {folder.name}
                    </h4>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.blur()
                        handleToggleAllSites(folder.id)
                      }}
                      className={`text-xs px-2 py-0.5 rounded whitespace-nowrap transition-all hover:opacity-80 ${
                        enabledSitesCount === folder.sites.length
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                      title={enabledSitesCount === folder.sites.length ? '전체 비활성화' : '전체 활성화'}
                    >
                      {enabledSitesCount === folder.sites.length ? '전체 활성화' : '전체 비활성화'}
                    </button>
                  </div>

                  {/* 두 번째 줄: 시간 + 사이트 개수 */}
                  <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 ml-1 mb-1">
                    <span className="flex items-center">
                      <ClockIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{formatSchedule(folder)}</span>
                    </span>
                    <span className="whitespace-nowrap">
                      사이트: {enabledSitesCount}/{folder.sites.length}개
                    </span>
                  </div>

                  {/* 세 번째 줄: 아이콘 버튼들 (오른쪽 정렬) */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.blur()
                        handleToggleFolder(folder.id, folder.enabled)
                      }}
                      className="p-1.5 hover:bg-sky-200 dark:hover:bg-sky-800/50 rounded transition-colors"
                      title={folder.enabled ? '비활성화' : '활성화'}
                    >
                      <ClockIcon className={`w-4 h-4 ${folder.enabled ? 'text-blue-500' : 'text-gray-400'}`} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.blur()
                        handleExecuteFolderCrawl(folder.id, folder.name)
                      }}
                      className="p-1.5 hover:bg-sky-200 dark:hover:bg-sky-800/50 rounded transition-colors"
                      title="활성화된 사이트 즉시 크롤링"
                      disabled={enabledSitesCount === 0}
                    >
                      <BoltIcon className={`w-4 h-4 ${enabledSitesCount > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.blur()
                        openEditFolderModal(folder)
                      }}
                      className="p-1.5 hover:bg-sky-200 dark:hover:bg-sky-800/50 rounded transition-colors"
                      title="폴더 수정"
                    >
                      <PencilIcon className="w-4 h-4 text-blue-500" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.blur()
                        setSelectedFolderId(folder.id)
                        setShowCreateSiteModal(true)
                      }}
                      className="p-1.5 hover:bg-sky-200 dark:hover:bg-sky-800/50 rounded transition-colors"
                      title="사이트 추가"
                    >
                      <PlusIcon className="w-4 h-4 text-blue-500" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.blur()
                        handleDeleteFolder(folder.id, folder.name)
                      }}
                      className="p-1.5 hover:bg-sky-200 dark:hover:bg-sky-800/50 rounded transition-colors"
                      title="폴더 삭제"
                    >
                      <TrashIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Sites List */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-2">
                    {folder.sites.length === 0 ? (
                      <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-xs">
                        사이트가 없습니다. 사이트를 추가해보세요.
                      </div>
                    ) : (
                      folder.sites.map((site) => (
                        <div
                          key={site.id}
                          id={`site-${site.id}`}
                          className={`flex items-center gap-2 p-2 rounded text-xs transition-all ${
                            site.enabled
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                              : 'bg-blue-50 dark:bg-blue-900/20 opacity-60'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              e.currentTarget.blur()
                              handleToggleSite(site.id, site.enabled)
                            }}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              site.enabled
                                ? 'bg-blue-500 border-blue-500'
                                : 'bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500'
                            }`}
                            aria-label={site.enabled ? '비활성화' : '활성화'}
                          >
                            {site.enabled && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          <GlobeAltIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />

                          <div className="flex-1 min-w-0">
                            <div className={`font-medium break-words ${site.enabled ? '' : 'line-through'}`}>
                              {site.name}
                            </div>
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs text-blue-600 dark:text-blue-400 hover:underline break-all ${site.enabled ? '' : 'line-through'}`}
                            >
                              {site.url}
                            </a>
                            {site.description && (
                              <div className={`text-xs text-gray-600 dark:text-gray-400 mt-0.5 break-words ${site.enabled ? '' : 'line-through'}`}>
                                {site.description}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              e.currentTarget.blur()
                              handleDeleteSite(site.id, site.name)
                            }}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                            title="사이트 삭제"
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateFolderModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">새 폴더 만들기</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">폴더 이름</label>
                <input
                  type="text"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="예: 학과 사이트"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">크롤링 주기</label>
                <select
                  value={folderForm.schedule_type}
                  onChange={(e) => setFolderForm({
                    ...folderForm,
                    schedule_type: e.target.value as ScheduleType,
                    schedule_day: e.target.value === 'weekly' ? 0 : null
                  })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                </select>
              </div>

              {folderForm.schedule_type === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium mb-1">요일</label>
                  <select
                    value={folderForm.schedule_day ?? 0}
                    onChange={(e) => setFolderForm({ ...folderForm, schedule_day: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="0">일요일</option>
                    <option value="1">월요일</option>
                    <option value="2">화요일</option>
                    <option value="3">수요일</option>
                    <option value="4">목요일</option>
                    <option value="5">금요일</option>
                    <option value="6">토요일</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">크롤링 시간</label>
                <input
                  type="time"
                  value={folderForm.schedule_time}
                  onChange={(e) => setFolderForm({ ...folderForm, schedule_time: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="folder-enabled"
                  checked={folderForm.enabled}
                  onChange={(e) => setFolderForm({ ...folderForm, enabled: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="folder-enabled" className="text-sm">폴더 활성화</label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
                <Button
                  type="button"
                  onClick={() => setShowCreateFolderModal(false)}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  취소
                </Button>
                <Button type="submit" variant="primary" className="w-full sm:w-auto">
                  생성
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {showEditFolderModal && editingFolder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
          setShowEditFolderModal(false)
          setEditingFolder(null)
        }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">폴더 수정</h3>
            <form onSubmit={handleEditFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">폴더 이름</label>
                <input
                  type="text"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="예: 학과 사이트"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">크롤링 주기</label>
                <select
                  value={folderForm.schedule_type}
                  onChange={(e) => setFolderForm({
                    ...folderForm,
                    schedule_type: e.target.value as ScheduleType,
                    schedule_day: e.target.value === 'weekly' ? (folderForm.schedule_day ?? 0) : null
                  })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                </select>
              </div>

              {folderForm.schedule_type === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium mb-1">요일</label>
                  <select
                    value={folderForm.schedule_day ?? 0}
                    onChange={(e) => setFolderForm({ ...folderForm, schedule_day: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="0">일요일</option>
                    <option value="1">월요일</option>
                    <option value="2">화요일</option>
                    <option value="3">수요일</option>
                    <option value="4">목요일</option>
                    <option value="5">금요일</option>
                    <option value="6">토요일</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">크롤링 시간</label>
                <input
                  type="time"
                  value={folderForm.schedule_time}
                  onChange={(e) => setFolderForm({ ...folderForm, schedule_time: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-folder-enabled"
                  checked={folderForm.enabled}
                  onChange={(e) => setFolderForm({ ...folderForm, enabled: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="edit-folder-enabled" className="text-sm">폴더 활성화</label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setShowEditFolderModal(false)
                    setEditingFolder(null)
                  }}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  취소
                </Button>
                <Button type="submit" variant="primary" className="w-full sm:w-auto">
                  저장
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Site Modal */}
      {showCreateSiteModal && selectedFolderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
          setShowCreateSiteModal(false)
          setSelectedFolderId(null)
        }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">새 사이트 추가</h3>
            <form onSubmit={handleCreateSite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">사이트 이름</label>
                <input
                  type="text"
                  value={siteForm.name}
                  onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="예: 컴퓨터공학과"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="url"
                  value={siteForm.url}
                  onChange={(e) => setSiteForm({ ...siteForm, url: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="https://example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">설명 (선택)</label>
                <textarea
                  value={siteForm.description}
                  onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="사이트 설명"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="site-enabled"
                  checked={siteForm.enabled}
                  onChange={(e) => setSiteForm({ ...siteForm, enabled: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="site-enabled" className="text-sm">사이트 활성화</label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateSiteModal(false)
                    setSelectedFolderId(null)
                  }}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  취소
                </Button>
                <Button type="submit" variant="primary" className="w-full sm:w-auto">
                  추가
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
