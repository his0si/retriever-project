import { NextRequest, NextResponse } from 'next/server'

// 환경에 따라 백엔드 URL 결정
const getBackendUrl = () => {
  // Docker 환경에서는 컨테이너 내부 주소 사용
  return process.env.BACKEND_URL || 'http://api:8000'
}

export async function POST(request: NextRequest) {
  try {
    let body = {}
    
    // Request body가 있는지 확인
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 0) {
      try {
        body = await request.json()
      } catch (e) {
        // 빈 body이거나 파싱 오류 시 빈 객체 사용
        body = {}
      }
    }
    
    const backendUrl = getBackendUrl()
    
    const response = await fetch(`${backendUrl}/crawl/auto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Backend response error:', error)
      return NextResponse.json(
        { error: 'Failed to start auto crawl' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Auto crawl API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}