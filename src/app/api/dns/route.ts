import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const configs = await db.dnsConfig.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(configs)
  } catch (error) {
    console.error('Failed to fetch DNS configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DNS configs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, primaryDns, secondaryDns, dohUrl, isActive } = body

    if (!name || !primaryDns) {
      return NextResponse.json(
        { error: 'name and primaryDns are required' },
        { status: 400 }
      )
    }

    // If setting as active, deactivate others
    if (isActive) {
      await db.dnsConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })
    }

    const config = await db.dnsConfig.create({
      data: {
        name,
        primaryDns,
        secondaryDns: secondaryDns || null,
        dohUrl: dohUrl || null,
        isActive: isActive ?? false,
      },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error('Failed to create DNS config:', error)
    return NextResponse.json(
      { error: 'Failed to create DNS config' },
      { status: 500 }
    )
  }
}