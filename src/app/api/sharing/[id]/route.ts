import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.vpnShare.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sharing config not found' }, { status: 404 })
    }

    const share = await db.vpnShare.update({
      where: { id },
      data: {
        ...(body.interfaceName !== undefined && { interfaceName: body.interfaceName }),
        ...(body.ipRange !== undefined && { ipRange: body.ipRange }),
        ...(body.gateway !== undefined && { gateway: body.gateway }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    })

    return NextResponse.json(share)
  } catch (error) {
    console.error('Failed to update sharing config:', error)
    return NextResponse.json(
      { error: 'Failed to update sharing config' },
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

    const existing = await db.vpnShare.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sharing config not found' }, { status: 404 })
    }

    await db.vpnShare.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete sharing config:', error)
    return NextResponse.json(
      { error: 'Failed to delete sharing config' },
      { status: 500 }
    )
  }
}