'use client'

import NavBar from './components/NavBar'
import HeroSection from './components/HeroSection'
import Footer from './components/Footer'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <NavBar />
      <HeroSection />
      <Footer />
    </div>
  )
} 