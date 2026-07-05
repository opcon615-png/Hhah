import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const config = await db.vpnConfig.findUnique({ where: { id } })

    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to fetch VPN config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch VPN config' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.vpnConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    const config = await db.vpnConfig.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.protocol !== undefined && { protocol: body.protocol }),
        ...(body.server !== undefined && { server: body.server }),
        ...(body.port !== undefined && { port: Number(body.port) }),
        ...(body.configData !== undefined && { configData: body.configData }),
        ...(body.remark !== undefined && { remark: body.remark }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.order !== undefined && { order: body.order }),
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to update VPN config:', error)
    return NextResponse.json(
      { error: 'Failed to update VPN config' },
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

    const existing = await db.vpnConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    await db.vpnConfig.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete VPN config:', error)
    return NextResponse.json(
      { error: 'Failed to delete VPN config' },
      { status: 500 }
    )
  }
}