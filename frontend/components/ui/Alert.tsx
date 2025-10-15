import React from 'react'
import { AlertType } from '@/types/crawl'

interface AlertProps {
  type: AlertType
  children: React.ReactNode
  className?: string
}

const alertStyles = {
  success: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  info: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
} as const

export default function Alert({ type, children, className = '' }: AlertProps) {
  return (
    <div className={`p-4 border rounded-lg ${alertStyles[type]} ${className}`}>
      {children}
    </div>
  )
}