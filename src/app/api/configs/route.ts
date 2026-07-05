import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const configs = await db.vpnConfig.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(configs)
  } catch (error) {
    console.error('Failed to fetch VPN configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch VPN configs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, protocol, server, port, configData, remark, isActive, order } = body

    if (!name || !protocol || !server || port === undefined) {
      return NextResponse.json(
        { error: 'name, protocol, server, and port are required' },
        { status: 400 }
      )
    }

    const config = await db.vpnConfig.create({
      data: {
        name,
        protocol,
        server,
        port: Number(port),
        configData: configData || '{}',
        remark: remark || null,
        isActive: isActive ?? false,
        order: order ?? 0,
      },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error('Failed to create VPN config:', error)
    return NextResponse.json(
      { error: 'Failed to create VPN config' },
      { status: 500 }
    )
  }
}