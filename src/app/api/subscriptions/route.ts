import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const subscriptions = await db.subscriptionLink.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { configs: true } } },
    })
    return NextResponse.json(subscriptions)
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, url, autoUpdate, updateInterval, enabled } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!url?.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const subscription = await db.subscriptionLink.create({
      data: {
        name: name.trim(),
        url: url.trim(),
        autoUpdate: autoUpdate ?? true,
        updateInterval: updateInterval ?? 3600,
        enabled: enabled ?? true,
      },
    })

    return NextResponse.json(subscription, { status: 201 })
  } catch (error) {
    console.error('Failed to create subscription:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}