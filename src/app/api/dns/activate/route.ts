import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.dnsConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'DNS config not found' }, { status: 404 })
    }

    // Deactivate all, then activate the requested one
    await db.$transaction([
      db.dnsConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      db.dnsConfig.update({
        where: { id },
        data: { isActive: true },
      }),
    ])

    const activated = await db.dnsConfig.findUnique({ where: { id } })

    return NextResponse.json(activated)
  } catch (error) {
    console.error('Failed to activate DNS config:', error)
    return NextResponse.json(
      { error: 'Failed to activate DNS config' },
      { status: 500 }
    )
  }
}