import { NextRequest, NextResponse } from 'next/server'

// 환경에 따라 백엔드 URL 결정
const getBackendUrl = () => {
  // 배포 환경에서는 nginx를 통해 연결
  if (process.env.NODE_ENV === 'production') {
    return 'http://nginx:80'
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
      },
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
    return NextResponse.json(data)
  } catch (error) {
    console.error('DB status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}