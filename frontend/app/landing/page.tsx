'use client'

import NavBar from './components/NavBar'
import HeroSection from './components/HeroSection'
import AboutSection from './components/AboutSection'
import FeaturesSection from './components/FeaturesSection'
import ContactSection from './components/ContactSection'
import Footer from './components/Footer'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen scroll-smooth">
      {/* Fixed Background */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat"
           style={{
             backgroundImage: 'url(/images/background.png)'
           }}>
      </div>
      <div className="fixed inset-0 bg-black bg-opacity-50"></div>

      {/* Scrollable content */}
      <div className="relative z-10">
        <NavBar />
        <HeroSection />
        <AboutSection />
        <FeaturesSection />
        <ContactSection />
        <Footer />
      </div>
    </div>
  )
} 