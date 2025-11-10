import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: '문의 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // Supabase에서 문의 삭제
    const { error } = await supabase
      .from('inquiries')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: '문의 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: '문의가 성공적으로 삭제되었습니다.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting inquiry:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
