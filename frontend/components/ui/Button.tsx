import React from 'react'
import { ButtonVariant } from '@/types/crawl'

interface ButtonProps {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: ButtonVariant
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

const buttonVariants = {
  primary: 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700',
  secondary: 'bg-gray-700 dark:bg-gray-600 text-white hover:bg-gray-800 dark:hover:bg-gray-700'
} as const

export default function Button({ 
  onClick, 
  disabled, 
  children, 
  variant = 'primary',
  className = '',
  type = 'button'
}: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center'
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}