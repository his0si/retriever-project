import { NextRequest, NextResponse } from 'next/server'

// 환경에 따라 백엔드 URL 결정
const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'http://api:8000'
  }
  return process.env.BACKEND_URL || 'http://localhost:8000'
}

export async function POST(
  request: NextRequest,
  { params }: { params: { folder_id: string } }
) {
  try {
    const body = await request.json()
    const backendUrl = getBackendUrl()
    const response = await fetch(`${backendUrl}/crawl/folders/${params.folder_id}/sites`, {
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
        { error: 'Failed to add site to folder' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Add site to folder API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
