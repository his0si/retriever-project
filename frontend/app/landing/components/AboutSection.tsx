'use client'

import { useEffect, useRef, useState } from 'react'

export default function AboutSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current)
      }
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="about"
      className="min-h-screen flex items-center justify-center py-20 px-4 sm:px-8 relative"
    >
      {/* Glass Container */}
      <div
        className={`relative z-10 max-w-4xl mx-auto transition-all duration-1000 ${
          isVisible ? 'translate-y-0' : 'translate-y-10'
        }`}
      >
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-8 sm:p-12 border border-white/20 shadow-2xl">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8 text-center">
            About
          </h2>

          <div className="space-y-6 text-white">
            <p className="text-xl sm:text-2xl font-semibold text-center leading-relaxed">
              &quot;학교 정보, 직접 뒤지지 말고 Retriever에게 맡겨보세요.&quot;
            </p>

            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-white/90">
              <p>
                Retriever Project는 학교 공식 사이트에 흩어져 있는 공지, 학사 정보, 학과별 안내 등을
                AI가 자동으로 수집·요약·제공하는 지능형 정보 검색 플랫폼입니다.
              </p>

              <p>
                사용자는 챗봇과 대화하듯 질문만 입력하면,
                Retriever가 크롤링 → 임베딩 → 검색 → 응답의 전 과정을 자동으로 수행해
                정확한 출처 기반 답변을 제공합니다.
              </p>

              <p className="text-lg sm:text-xl font-semibold text-center pt-4 text-sky-200">
                본 프로젝트는<br />
                &quot;학생들이 학교 정보를 더 빠르고 정확하게 접근할 수 있는 방법&quot;<br />
                을 목표로 개발되었습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
