import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.dnsConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'DNS config not found' }, { status: 404 })
    }

    // If setting as active, deactivate all others
    if (body.isActive) {
      await db.dnsConfig.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      })
    }

    const config = await db.dnsConfig.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.primaryDns !== undefined && { primaryDns: body.primaryDns }),
        ...(body.secondaryDns !== undefined && { secondaryDns: body.secondaryDns }),
        ...(body.dohUrl !== undefined && { dohUrl: body.dohUrl }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to update DNS config:', error)
    return NextResponse.json(
      { error: 'Failed to update DNS config' },
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

    const existing = await db.dnsConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'DNS config not found' }, { status: 404 })
    }

    await db.dnsConfig.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete DNS config:', error)
    return NextResponse.json(
      { error: 'Failed to delete DNS config' },
      { status: 500 }
    )
  }
}