import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://api:8000';

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/crawl/auto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Auto crawl API error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger auto crawl' },
      { status: 500 }
    );
  }
}