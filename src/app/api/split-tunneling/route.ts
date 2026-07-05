import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const rules = await db.splitTunnelRule.findMany({
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(rules)
  } catch (error) {
    console.error('Failed to fetch split tunneling rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch split tunneling rules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, targetType, value, enabled, order } = body

    if (!type || !targetType || !value) {
      return NextResponse.json(
        { error: 'type, targetType, and value are required' },
        { status: 400 }
      )
    }

    const rule = await db.splitTunnelRule.create({
      data: {
        type,
        targetType,
        value,
        enabled: enabled ?? true,
        order: order ?? 0,
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('Failed to create split tunneling rule:', error)
    return NextResponse.json(
      { error: 'Failed to create split tunneling rule' },
      { status: 500 }
    )
  }
}