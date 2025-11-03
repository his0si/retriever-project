import { NextRequest, NextResponse } from 'next/server'

// 환경에 따라 백엔드 URL 결정
const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'http://api:8000'
  }
  return process.env.BACKEND_URL || 'http://localhost:8000'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { site_id: string } }
) {
  try {
    const body = await request.json()
    const backendUrl = getBackendUrl()

    const response = await fetch(`${backendUrl}/crawl/sites/${params.site_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Backend response error:', error)
      return NextResponse.json(
        { error: 'Failed to update site' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Update site API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { site_id: string } }
) {
  try {
    const backendUrl = getBackendUrl()

    const response = await fetch(`${backendUrl}/crawl/sites/${params.site_id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Backend response error:', error)
      return NextResponse.json(
        { error: 'Failed to delete site' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Delete site API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
