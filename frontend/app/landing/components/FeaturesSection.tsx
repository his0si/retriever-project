'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatBubbleLeftRightIcon, GlobeAltIcon, LockClosedIcon } from '@heroicons/react/24/outline'

export default function FeaturesSection() {
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
  const aiFeatures = [
    {
      title: 'RAG 기반 질의응답',
      description: 'Vector DB에 저장된 학교 정보를 기반으로 정확한 답변 제공'
    },
    {
      title: '전공 맞춤형 검색',
      description: '사용자의 전공/학과 설정에 따라 관련 정보 우선 제공'
    },
    {
      title: '이중 검색 모드',
      description: '필터 모드(정확한 정보)와 확장 모드(유연한 답변) 지원'
    },
    {
      title: '채팅 히스토리',
      description: '세션별 대화 기록 저장 및 즐겨찾기 기능'
    },
    {
      title: '소스 추적',
      description: '모든 답변의 출처 URL 표시'
    }
  ]

  const crawlingFeatures = [
    {
      title: '지능형 크롤링',
      description: 'Playwright 기반 동적 콘텐츠 지원'
    },
    {
      title: '스케줄 크롤링',
      description: '크롤링 깊이 · 수집 주기 · 사이트 활성화 여부 등 세부 옵션을 조정해 필요에 맞게 데이터 수집 범위를 최적화'
    },
    {
      title: '작업 큐 모니터링',
      description: 'RabbitMQ 기반 실시간 크롤링 상태 확인'
    },
    {
      title: 'VPN 지원',
      description: 'IP 차단을 방지하기 위해 NordVPN을 통합하여 안정적인 크롤링 지원'
    },
    {
      title: '중복 방지',
      description: '콘텐츠 해시 기반 스마트 업데이트'
    }
  ]

  const securityFeatures = [
    {
      title: 'OAuth 로그인',
      description: 'Google, Kakao 소셜 로그인 지원'
    },
    {
      title: 'HTTPS/SSL',
      description: 'Let\'s Encrypt 자동 인증서 발급 및 갱신'
    },
    {
      title: '세션 관리',
      description: 'NextAuth 기반 안전한 사용자 세션 관리'
    }
  ]

  return (
    <section
      ref={sectionRef}
      id="features"
      className="min-h-screen flex items-center justify-center py-20 px-4 sm:px-8 relative"
    >
      {/* Glass Container */}
      <div
        className={`relative z-10 max-w-6xl mx-auto w-full transition-all duration-1000 ${
          isVisible ? 'translate-y-0' : 'translate-y-10'
        }`}
      >
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-8 sm:p-12 border border-white/20 shadow-2xl">
          <div className="space-y-12">
            {/* AI 챗봇 기능 */}
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
                AI 챗봇 기능
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiFeatures.map((feature, index) => (
                  <div
                    key={index}
                    className="backdrop-blur-md bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-300"
                  >
                    <h4 className="text-lg font-bold mb-2 relative group">
                      <span
                        className="feature-title relative inline-block bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent"
                      >
                        {feature.title}
                      </span>
                    </h4>
                    <p className="text-sm text-white/80">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 크롤링 시스템 */}
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <GlobeAltIcon className="w-6 h-6 text-white" />
                크롤링 시스템
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {crawlingFeatures.map((feature, index) => (
                  <div
                    key={index}
                    className="backdrop-blur-md bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-300"
                  >
                    <h4 className="text-lg font-bold mb-2 relative group">
                      <span
                        className="feature-title relative inline-block bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent"
                      >
                        {feature.title}
                      </span>
                    </h4>
                    <p className="text-sm text-white/80">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 보안 및 인증 */}
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <LockClosedIcon className="w-6 h-6 text-white" />
                보안 및 인증
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {securityFeatures.map((feature, index) => (
                  <div
                    key={index}
                    className="backdrop-blur-md bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-300"
                  >
                    <h4 className="text-lg font-bold mb-2 relative group">
                      <span
                        className="feature-title relative inline-block bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent"
                      >
                        {feature.title}
                      </span>
                    </h4>
                    <p className="text-sm text-white/80">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
