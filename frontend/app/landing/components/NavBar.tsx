'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useDarkMode } from '../../providers';

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-b from-black/80 to-transparent">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo placeholder */}
        <div className="text-white font-bold text-xl sm:text-2xl">
        </div>
        {/* Navigation Menu (Desktop) */}
        <div className="hidden md:flex space-x-6 lg:space-x-8">
          <Link href="#about" className="text-white hover:text-gray-300 transition-colors font-medium text-base lg:text-lg">
            About
          </Link>
          <Link href="#features" className="text-white hover:text-gray-300 transition-colors font-medium text-base lg:text-lg">
            Features
          </Link>
          <Link href="#contact" className="text-white hover:text-gray-300 transition-colors font-medium text-base lg:text-lg">
            Contact
          </Link>
          <Link href="/auth/signin" className="text-white hover:text-gray-300 transition-colors font-medium text-base lg:text-lg">
            Sign In
          </Link>
        </div>
        {/* Mobile menu button */}
        <div className="md:hidden">
          <button className="text-white" onClick={() => setMobileMenuOpen(true)} aria-label="메뉴 열기">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center md:hidden animate-fade-in">
          <button className="absolute top-4 right-4 text-white" onClick={() => setMobileMenuOpen(false)} aria-label="메뉴 닫기">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex flex-col space-y-8 text-center">
            <Link href="#about" className="text-white text-xl font-semibold" onClick={() => setMobileMenuOpen(false)}>
              About
            </Link>
            <Link href="#features" className="text-white text-xl font-semibold" onClick={() => setMobileMenuOpen(false)}>
              Features
            </Link>
            <Link href="#contact" className="text-white text-xl font-semibold" onClick={() => setMobileMenuOpen(false)}>
              Contact
            </Link>
            <Link href="/auth/signin" className="text-white text-xl font-semibold" onClick={() => setMobileMenuOpen(false)}>
              Sign In
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
} 