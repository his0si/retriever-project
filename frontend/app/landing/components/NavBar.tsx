'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault()
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setMobileMenuOpen(false)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo removed */}
        <div></div>
        {/* Navigation Menu (Desktop) */}
        <div className="hidden md:flex space-x-6 lg:space-x-8">
          <a
            href="#about"
            onClick={(e) => scrollToSection(e, 'about')}
            className="text-white hover:text-sky-300 transition-colors font-medium text-base lg:text-lg cursor-pointer"
          >
            About
          </a>
          <a
            href="#features"
            onClick={(e) => scrollToSection(e, 'features')}
            className="text-white hover:text-sky-300 transition-colors font-medium text-base lg:text-lg cursor-pointer"
          >
            Features
          </a>
          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, 'contact')}
            className="text-white hover:text-sky-300 transition-colors font-medium text-base lg:text-lg cursor-pointer"
          >
            Contact
          </a>
          <Link href="/auth/signin" className="text-white hover:text-sky-300 transition-colors font-medium text-base lg:text-lg">
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
        <div className="fixed inset-0 z-50 backdrop-blur-xl bg-black/90 flex flex-col items-center justify-center md:hidden animate-fade-in">
          <button className="absolute top-4 right-4 text-white" onClick={() => setMobileMenuOpen(false)} aria-label="메뉴 닫기">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex flex-col space-y-8 text-center">
            <a
              href="#about"
              onClick={(e) => scrollToSection(e, 'about')}
              className="text-white text-xl font-semibold hover:text-sky-300 transition-colors cursor-pointer"
            >
              About
            </a>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="text-white text-xl font-semibold hover:text-sky-300 transition-colors cursor-pointer"
            >
              Features
            </a>
            <a
              href="#contact"
              onClick={(e) => scrollToSection(e, 'contact')}
              className="text-white text-xl font-semibold hover:text-sky-300 transition-colors cursor-pointer"
            >
              Contact
            </a>
            <Link href="/auth/signin" className="text-white text-xl font-semibold hover:text-sky-300 transition-colors" onClick={() => setMobileMenuOpen(false)}>
              Sign In
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
} 