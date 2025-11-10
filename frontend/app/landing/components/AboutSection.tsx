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
          <div className="space-y-6 text-white">
            <p className="text-2xl sm:text-3xl font-semibold text-center leading-relaxed">
              학교생활에 필요한 정보, 찾기 어려우셨죠?
            </p>

            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-white/90">
              <p>
                학사공지, 장학금, 공모전, 학식, 도서관 좌석까지 —<br />
                필요한 정보는 여기저기 흩어져 있고, 우리는 그것을 찾기 위해 여러 사이트를 전전해야 했습니다.
              </p>

              <p>
                Retriever Project는 이러한 불편함을 해결하기 위해 탄생했습니다.
                학교 안팎에 흩어진 정보를 자동으로 수집하고,
                이를 하나의 지능형 채널(챗봇)을 통해 제공하는 기관 특화형 AI 정보 통합 플랫폼입니다.
              </p>

              <p className="text-lg sm:text-xl font-bold text-center pt-4">
                <span
                  className="about-highlight inline-block bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent"
                >
                  그 첫 번째 버전인 Ewha Univ. Edition은<br />
                  기존 학교 공식 챗봇이 다루지 못했던 외부 장학금, 공모전, 대외활동 정보까지 포괄하여<br />
                  정보의 폭과 깊이를 한층 확장했습니다.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
