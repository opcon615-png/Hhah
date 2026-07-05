import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.pingTarget.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    // If setting as default, unset others
    if (body.isDefault) {
      await db.pingTarget.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const target = await db.pingTarget.update({
      where: { id },
      data: {
        ...(body.hostname !== undefined && { hostname: body.hostname }),
        ...(body.port !== undefined && { port: Number(body.port) }),
        ...(body.protocol !== undefined && { protocol: body.protocol }),
        ...(body.label !== undefined && { label: body.label }),
        ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    })

    return NextResponse.json(target)
  } catch (error) {
    console.error('Failed to update ping target:', error)
    return NextResponse.json(
      { error: 'Failed to update ping target' },
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

    const existing = await db.pingTarget.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    await db.pingTarget.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete ping target:', error)
    return NextResponse.json(
      { error: 'Failed to delete ping target' },
      { status: 500 }
    )
  }
}