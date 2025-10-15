import React from 'react'

interface ToggleSwitchProps {
  enabled: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

export default function ToggleSwitch({ enabled, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`
        relative w-10 h-6 rounded-full p-0.5
        border transition-all duration-200 ease-in-out
        ${enabled 
          ? 'bg-gray-800 dark:bg-gray-600 border-gray-800 dark:border-gray-600' 
          : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      disabled={disabled}
      aria-label="Toggle dark mode"
      aria-checked={enabled}
      role="switch"
    >
      <span
        className={`
          block w-4 h-4 bg-white rounded-full shadow-md 
          transform transition-transform duration-200 ease-in-out
          ${enabled ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  )
} 