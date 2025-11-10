import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content } = body

    // 유효성 검사
    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    // Supabase에 문의 저장
    const { data, error } = await supabase
      .from('inquiries')
      .insert([
        {
          title: title.trim(),
          content: content.trim()
        }
      ])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: '문의 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: '문의가 성공적으로 접수되었습니다.',
        data: data
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error submitting inquiry:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: '문의 목록 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error('Error fetching inquiries:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
