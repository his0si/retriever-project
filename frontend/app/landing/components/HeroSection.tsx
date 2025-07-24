'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function HeroSection() {
  const router = useRouter()

  const handleGetStarted = () => {
    signIn()
  }

  const handleStartNow = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      router.push('/chat?guest=1');
    } else {
      router.push('/chat');
    }
  }


  return (
    <div className="relative min-h-screen flex items-center justify-center py-8 px-2 sm:px-8">
      {/* Background Image Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50 z-10"></div>
      
      {/* Background Image */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat"
           style={{ 
             backgroundImage: 'url(/images/background.png)' 
           }}>
      </div>
      
      {/* Content */}
      <div className="relative z-20 text-center px-2 sm:px-8 max-w-lg sm:max-w-2xl md:max-w-4xl mx-auto w-full">
        <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
          Retriever Project
        </h1>
        
        <div className="text-white mb-8 sm:mb-12 leading-relaxed">
          <p className="text-base sm:text-lg md:text-xl mb-2">
            리트리버가 대신 찾아드릴게요!
          </p>
          <p className="text-xs sm:text-sm md:text-base text-white/70">
            학교 정보, 직접 뒤지지 말고 똑똑한 퍼피 도우미에게 맡겨보세요.<br />
            공식 출처 기반으로 정확하게 알려드립니다.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center w-full">
          <button
            onClick={handleGetStarted}
            className="bg-white text-black px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg hover:bg-gray-100 transition-colors w-[220px] sm:w-[180px] md:w-[200px] h-12 sm:h-16 flex items-center justify-center"
          >
            간편 로그인
          </button>
          
          <button
            onClick={handleStartNow}
            className="border-2 border-white text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg hover:bg-white hover:text-black transition-colors w-[220px] sm:w-[180px] md:w-[200px] h-12 sm:h-16 flex items-center justify-center"
          >
            바로 시작하기
          </button>
        </div>
      </div>
    </div>
  )
} 