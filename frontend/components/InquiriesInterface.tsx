'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { EnvelopeIcon, CalendarIcon, TrashIcon } from '@heroicons/react/24/outline'

interface Inquiry {
  id: string
  title: string
  content: string
  created_at: string
}

// 날짜 포맷 함수
function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // UTC 시간을 한국 시간으로 변환 (UTC+9)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const min = String(kst.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

export default function InquiriesInterface() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchInquiries()
  }, [])

  const fetchInquiries = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch inquiries:', error)
      } else {
        setInquiries(data as Inquiry[])
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteInquiry = async (inquiryId: string, e: React.MouseEvent) => {
    e.stopPropagation() // 카드 클릭 이벤트 방지

    if (!confirm('이 문의를 삭제하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(`/api/inquiries/${inquiryId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // 목록에서 제거
        setInquiries(inquiries.filter(inquiry => inquiry.id !== inquiryId))

        // 선택된 문의가 삭제된 경우 초기화
        if (selectedInquiry?.id === inquiryId) {
          setSelectedInquiry(null)
        }

        alert('문의가 삭제되었습니다.')
      } else {
        const data = await response.json()
        alert(`삭제 실패: ${data.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      console.error('Error deleting inquiry:', error)
      alert('서버 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* 문의 목록과 상세 보기 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 문의 목록 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            문의 목록 ({inquiries.length})
          </h2>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              로딩 중...
            </div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              아직 문의가 없습니다.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin">
              {inquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  onClick={() => setSelectedInquiry(inquiry)}
                  className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border relative ${
                    selectedInquiry?.id === inquiry.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2 truncate pr-8">
                    {inquiry.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{formatDate(inquiry.created_at)}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteInquiry(inquiry.id, e)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                      aria-label="삭제"
                    >
                      <TrashIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 문의 상세 보기 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            문의 상세
          </h2>

          {selectedInquiry ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  제목
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                  {selectedInquiry.title}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  작성일
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  {formatDate(selectedInquiry.created_at)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  내용
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap min-h-[200px] max-h-[400px] overflow-y-auto scrollbar-thin">
                  {selectedInquiry.content}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              문의를 선택해주세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
