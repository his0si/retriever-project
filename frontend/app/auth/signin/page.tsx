'use client'

import { signIn, getProviders } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface Provider {
  id: string
  name: string
  type: string
  signinUrl: string
  callbackUrl: string
}

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const setAuthProviders = async () => {
      const response = await getProviders()
      setProviders(response)
    }
    setAuthProviders()
  }, [])

  const handleSignIn = (providerId: string) => {
    signIn(providerId, { callbackUrl: '/chat' })
  }

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const result = await signIn('admin', {
        username: adminCredentials.username,
        password: adminCredentials.password,
        redirect: false,
      })
      
      if (result?.error) {
        alert('관리자 로그인에 실패했습니다. ID와 비밀번호를 확인해주세요.')
      } else {
        setShowAdminModal(false)
        router.push('/chat')
      }
    } catch (error) {
      alert('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Retriever Project
          </h1>
          <p className="text-gray-600">
            로그인하여 시작하세요
          </p>
        </div>

        <div className="space-y-4">
          {providers && Object.values(providers).map((provider) => (
            <div key={provider.name}>
              {provider.id === 'google' && (
                <button
                  onClick={() => handleSignIn(provider.id)}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  <Image 
                    src="/images/google.svg" 
                    alt="Google" 
                    width={20} 
                    height={20}
                    className="w-5 h-5"
                  />
                  Google로 로그인
                </button>
              )}
              {provider.id === 'kakao' && (
                <button
                  onClick={() => handleSignIn(provider.id)}
                  className="w-full flex items-center justify-center gap-3 bg-yellow-400 text-black px-4 py-3 rounded-lg hover:bg-yellow-500 transition-colors font-medium"
                >
                  <Image 
                    src="/images/kakao.svg" 
                    alt="Kakao" 
                    width={20} 
                    height={20}
                    className="w-5 h-5"
                  />
                  카카오로 로그인
                </button>
              )}
            </div>
          ))}
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>
          
          <button
            onClick={() => setShowAdminModal(true)}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
            </svg>
            관리자 로그인
          </button>
        </div>

        {/* 관리자 로그인 모달 */}
        {showAdminModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  관리자 로그인
                </h2>
                <p className="text-gray-600">
                  관리자 계정으로 로그인하세요
                </p>
              </div>

              <form onSubmit={handleAdminSignIn} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    관리자 ID
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={adminCredentials.username}
                    onChange={(e) => setAdminCredentials(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="관리자 ID를 입력하세요"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    비밀번호
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={adminCredentials.password}
                    onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="비밀번호를 입력하세요"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? '로그인 중...' : '로그인'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            계정이 없으신가요?{' '}
            <button 
              onClick={() => router.push('/landing')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              이전 페이지로 돌아가기
            </button>
          </p>
        </div>
      </div>
    </div>
  )
} 