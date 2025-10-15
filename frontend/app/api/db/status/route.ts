import { NextRequest, NextResponse } from 'next/server'

// 이 라우트를 동적으로 만들어 캐싱 비활성화
export const dynamic = 'force-dynamic'
export const revalidate = 0

// 환경에 따라 백엔드 URL 결정
const getBackendUrl = () => {
  // 배포 환경에서는 Docker 컨테이너 내부 주소 사용
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'http://api:8000'
  }
  // 로컬 개발 환경에서는 localhost 사용
  return process.env.BACKEND_URL || 'http://localhost:8000'
}

export async function GET(request: NextRequest) {
  try {
    const backendUrl = getBackendUrl()
    const response = await fetch(`${backendUrl}/db/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',  // Next.js 캐싱 비활성화
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Backend response error:', error)
      return NextResponse.json(
        { error: 'Failed to get DB status' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('DB status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}