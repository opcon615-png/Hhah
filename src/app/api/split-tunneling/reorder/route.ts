import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'items array is required' },
        { status: 400 }
      )
    }

    await db.$transaction(
      items.map((item: { id: string; order: number }) =>
        db.splitTunnelRule.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reorder split tunneling rules:', error)
    return NextResponse.json(
      { error: 'Failed to reorder split tunneling rules' },
      { status: 500 }
    )
  }
}