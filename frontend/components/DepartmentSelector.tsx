'use client'

import { useState, useEffect } from 'react'
import { Department } from '@/lib/userPreferencesApi'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface DepartmentSelectorProps {
  departments: Department[]
  enabled: boolean
  onDepartmentsChange: (departments: Department[]) => void
  onEnabledChange: (enabled: boolean) => void
}

export default function DepartmentSelector({
  departments,
  enabled,
  onDepartmentsChange,
  onEnabledChange
}: DepartmentSelectorProps) {
  const [newDeptName, setNewDeptName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAddDepartment = () => {
    if (!newDeptName.trim()) return
    if (departments.length >= 3) {
      alert('최대 3개의 전공만 추가할 수 있습니다')
      return
    }

    const newDept: Department = {
      name: newDeptName.trim(),
      url: undefined,
      enabled: true
    }

    onDepartmentsChange([...departments, newDept])
    setNewDeptName('')
    setIsAdding(false)
  }

  const handleRemoveDepartment = (index: number) => {
    const newDepts = departments.filter((_, i) => i !== index)
    onDepartmentsChange(newDepts)
  }

  const handleToggleDepartment = (index: number) => {
    const newDepts = departments.map((dept, i) => {
      if (i === index) {
        return { ...dept, enabled: !dept.enabled }
      }
      return dept
    })
    onDepartmentsChange(newDepts)
  }

  return (
    <div className="space-y-4">
      {/* 전공 맞춤형 검색 토글 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          전공 맞춤형 검색 활성화
        </span>
        <button
          type="button"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-sky-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          onClick={() => onEnabledChange(!enabled)}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 전공 목록 */}
      <div className="space-y-2">
        {departments.map((dept, index) => (
          <div
            key={index}
            className="flex items-center justify-between bg-sky-50 dark:bg-sky-900/20 border border-sky-300 dark:border-sky-700 rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2 flex-1">
              {/* 전공 활성화 토글 */}
              <input
                type="checkbox"
                checked={dept.enabled}
                onChange={() => handleToggleDepartment(index)}
                className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className={`text-sm ${dept.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                {dept.name}
              </span>
            </div>
            {/* 삭제 버튼 */}
            <button
              type="button"
              onClick={() => handleRemoveDepartment(index)}
              className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* 전공 추가 버튼 또는 입력창 */}
      {isAdding ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddDepartment()
              } else if (e.key === 'Escape') {
                setIsAdding(false)
                setNewDeptName('')
              }
            }}
            placeholder="전공명 입력 (예: 컴퓨터공학과)"
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddDepartment}
            className="px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium"
          >
            추가
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false)
              setNewDeptName('')
            }}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          disabled={departments.length >= 3}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg text-sm font-medium transition-colors ${
            departments.length >= 3
              ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20'
          }`}
        >
          <PlusIcon className="w-5 h-5" />
          <span>전공 추가 ({departments.length}/3)</span>
        </button>
      )}

      {departments.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          전공을 추가하면 해당 전공 홈페이지의 내용을 우선적으로 검색합니다
        </p>
      )}
    </div>
  )
}
