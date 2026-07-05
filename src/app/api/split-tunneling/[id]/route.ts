import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.splitTunnelRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    const rule = await db.splitTunnelRule.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.targetType !== undefined && { targetType: body.targetType }),
        ...(body.value !== undefined && { value: body.value }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.order !== undefined && { order: body.order }),
      },
    })

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Failed to update split tunneling rule:', error)
    return NextResponse.json(
      { error: 'Failed to update split tunneling rule' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.splitTunnelRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    await db.splitTunnelRule.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete split tunneling rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete split tunneling rule' },
      { status: 500 }
    )
  }
}