import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const targets = await db.pingTarget.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(targets)
  } catch (error) {
    console.error('Failed to fetch ping targets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ping targets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hostname, port, protocol, label, isDefault, enabled } = body

    if (!hostname) {
      return NextResponse.json(
        { error: 'hostname is required' },
        { status: 400 }
      )
    }

    // If setting as default, unset others
    if (isDefault) {
      await db.pingTarget.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const target = await db.pingTarget.create({
      data: {
        hostname,
        port: port ? Number(port) : 443,
        protocol: protocol || 'tcp',
        label: label || null,
        isDefault: isDefault ?? false,
        enabled: enabled ?? true,
      },
    })

    return NextResponse.json(target, { status: 201 })
  } catch (error) {
    console.error('Failed to create ping target:', error)
    return NextResponse.json(
      { error: 'Failed to create ping target' },
      { status: 500 }
    )
  }
}