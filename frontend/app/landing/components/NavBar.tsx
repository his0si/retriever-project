'use client'

import Link from 'next/link'

export default function NavBar() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-50 px-8 py-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo placeholder */}
        <div className="text-white font-bold text-xl">
          {/* 로고 이미지 자리 */}
        </div>
        
        {/* Navigation Menu */}
        <div className="hidden md:flex space-x-8">
          <Link href="#about" className="text-white hover:text-gray-300 transition-colors font-medium">
            About
          </Link>
          <Link href="#features" className="text-white hover:text-gray-300 transition-colors font-medium">
            Features
          </Link>
          <Link href="#contact" className="text-white hover:text-gray-300 transition-colors font-medium">
            Contact
          </Link>
          <Link href="/auth/signin" className="text-white hover:text-gray-300 transition-colors font-medium">
            Sign In
          </Link>
        </div>
        
        {/* Mobile menu button */}
        <div className="md:hidden">
          <button className="text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
} 