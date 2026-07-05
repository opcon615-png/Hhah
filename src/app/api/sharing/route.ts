import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const shares = await db.vpnShare.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(shares)
  } catch (error) {
    console.error('Failed to fetch sharing configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sharing configs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { interfaceName, ipRange, gateway, enabled } = body

    if (!interfaceName || !ipRange) {
      return NextResponse.json(
        { error: 'interfaceName and ipRange are required' },
        { status: 400 }
      )
    }

    const share = await db.vpnShare.create({
      data: {
        interfaceName,
        ipRange,
        gateway: gateway || null,
        enabled: enabled ?? false,
      },
    })

    return NextResponse.json(share, { status: 201 })
  } catch (error) {
    console.error('Failed to create sharing config:', error)
    return NextResponse.json(
      { error: 'Failed to create sharing config' },
      { status: 500 }
    )
  }
}