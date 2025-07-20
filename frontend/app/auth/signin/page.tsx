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
        </div>

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