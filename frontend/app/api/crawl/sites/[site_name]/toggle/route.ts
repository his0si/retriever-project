import { NextRequest, NextResponse } from 'next/server'

// 환경에 따라 백엔드 URL 결정
const getBackendUrl = () => {
  // 배포 환경에서는 Docker 컨테이너 내부 주소 사용
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'http://api:8000'
  }
  // 로컬 개발 환경에서는 localhost 사용
  return process.env.BACKEND_URL || 'http://localhost:8000'
}

export async function POST(
  request: NextRequest,
  { params }: { params: { site_name: string } }
) {
  try {
    const siteName = decodeURIComponent(params.site_name)
    const backendUrl = getBackendUrl()
    
    // 백엔드 API 호출
    const response = await fetch(`${backendUrl}/crawl/sites/${encodeURIComponent(siteName)}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.detail || 'Failed to toggle site' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error toggling site:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 