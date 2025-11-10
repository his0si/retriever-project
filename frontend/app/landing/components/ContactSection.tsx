'use client'

import { useState, useEffect, useRef } from 'react'

export default function ContactSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content
        })
      })

      const data = await response.json()

      if (response.ok) {
        alert(
          `제보가 접수되었습니다!\n\n` +
          `제목: ${formData.title}\n\n` +
          `내용:\n${formData.content}\n\n` +
          `관리자 검토 후 등록됩니다. 감사합니다!`
        )
        // 폼 초기화
        setFormData({ title: '', content: '' })
      } else {
        alert(`오류: ${data.error || '문의 제출에 실패했습니다.'}`)
      }
    } catch (error) {
      console.error('Error submitting inquiry:', error)
      alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="min-h-screen flex items-center justify-center py-20 px-4 sm:px-8 relative"
    >
      {/* Glass Container */}
      <div
        className={`relative z-10 max-w-4xl mx-auto w-full transition-all duration-1000 ${
          isVisible ? 'translate-y-0' : 'translate-y-10'
        }`}
      >
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-8 sm:p-12 border border-white/20 shadow-2xl">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8 text-center">
            💬 Contact
          </h2>

          <div className="space-y-8">
            <div className="text-white space-y-4">
              <p className="text-lg sm:text-xl leading-relaxed">
                Retriever가 아직 찾지 못한 정보가 있나요?<br />
                새로운 사이트를 제보해주시면 데이터베이스에 추가하겠습니다.
              </p>

              <div className="backdrop-blur-md bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-xl font-semibold text-sky-300 mb-3">
                  📨 제보 예시
                </h3>
                <div className="space-y-2 text-sm sm:text-base text-white/90">
                  <p><strong>제목:</strong> 교환학생 프로그램 공지 추가 요청</p>
                  <p className="leading-relaxed">
                    <strong>내용:</strong> 국제교류처 사이트(https://oia.ewha.ac.kr)에
                    교환학생 관련 공지가 많은데, Retriever에서 검색되지 않아요.
                  </p>
                  <p className="text-sky-200 italic">
                    &quot;국제교류처 사이트도 크롤링 대상에 추가해주세요.&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* 제보 폼 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-white font-medium mb-2">
                  제목
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="예: 교환학생 프로그램 공지 추가 요청"
                  className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="content" className="block text-white font-medium mb-2">
                  내용
                </label>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  required
                  rows={6}
                  placeholder="제보할 사이트 URL과 추가 요청 사유를 작성해주세요..."
                  className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl backdrop-blur-md bg-sky-500/80 hover:bg-sky-600/80 text-white font-semibold text-lg border border-sky-400/50 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? '제출 중...' : '제보하기'}
              </button>
            </form>

            <p className="text-sm text-white/70 text-center leading-relaxed">
              해당 요청은 관리자 콘솔에서 검토 후 승인/등록됩니다.<br />
              여러분의 피드백은 Retriever의 데이터 품질 향상에 직접 반영됩니다 🙌
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
