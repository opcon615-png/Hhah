import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const SUPPORTED_PROTOCOLS = ['vmess://', 'vless://', 'trojan://', 'ss://', 'hysteria2://', 'hy2://', 'wg://']

function detectProtocol(link: string): string {
  const l = link.trim()
  if (l.startsWith('vmess://')) return 'vmess'
  if (l.startsWith('vless://')) return 'vless'
  if (l.startsWith('trojan://')) return 'trojan'
  if (l.startsWith('ss://')) return 'shadowsocks'
  if (l.startsWith('hysteria2://') || l.startsWith('hy2://')) return 'hysteria2'
  if (l.startsWith('wg://')) return 'wireguard'
  return 'vmess'
}

function parseServerPort(link: string): { server: string; port: number; name: string } {
  try {
    const l = link.trim()

    if (l.startsWith('vmess://')) {
      const encoded = l.replace('vmess://', '')
      let decoded: string
      try { decoded = Buffer.from(encoded, 'base64').toString('utf-8') } catch { decoded = encoded }
      const parsed = JSON.parse(decoded)
      return { server: parsed.add || parsed.addr || 'unknown', port: parseInt(parsed.port, 10) || 443, name: parsed.ps || parsed.remarks || 'VMess Node' }
    }

    if (l.startsWith('vless://')) {
      const url = new URL(l.replace('vless://', 'http://'))
      return { server: url.hostname, port: parseInt(url.port, 10) || 443, name: decodeURIComponent(url.hash.replace('#', '')) || 'VLESS Node' }
    }

    if (l.startsWith('trojan://')) {
      const url = new URL(l.replace('trojan://', 'http://'))
      return { server: url.hostname, port: parseInt(url.port, 10) || 443, name: decodeURIComponent(url.hash.replace('#', '')) || 'Trojan Node' }
    }

    if (l.startsWith('ss://')) {
      const hashIdx = l.indexOf('#')
      const name = hashIdx >= 0 ? decodeURIComponent(l.slice(hashIdx + 1)) : 'Shadowsocks Node'
      const withoutHash = hashIdx >= 0 ? l.slice(0, hashIdx) : l
      const body = withoutHash.replace('ss://', '')
      const atIdx = body.lastIndexOf('@')
      if (atIdx >= 0) {
        const serverPart = body.slice(atIdx + 1)
        let server = serverPart
        let port = 8388
        const lastColon = serverPart.lastIndexOf(':')
        if (lastColon >= 0 && !serverPart.endsWith(']')) {
          server = serverPart.slice(0, lastColon)
          port = parseInt(serverPart.slice(lastColon + 1), 10) || 8388
        }
        return { server, port, name }
      }
      return { server: 'unknown', port: 8388, name }
    }

    if (l.startsWith('hysteria2://') || l.startsWith('hy2://')) {
      const prefix = l.startsWith('hysteria2://') ? 'hysteria2://' : 'hy2://'
      const url = new URL(l.replace(prefix, 'http://'))
      return { server: url.hostname, port: parseInt(url.port, 10) || 443, name: decodeURIComponent(url.hash.replace('#', '')) || 'Hysteria2 Node' }
    }

    if (l.startsWith('wg://')) {
      const url = new URL(l.replace('wg://', 'http://'))
      return { server: url.hostname, port: parseInt(url.port, 10) || 51820, name: decodeURIComponent(url.hash.replace('#', '')) || 'WireGuard Node' }
    }
  } catch { /* fallback */ }

  return { server: 'unknown', port: 0, name: 'Unknown Node' }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subscriptionId, content } = body

    if (!subscriptionId || !content) {
      return NextResponse.json({ error: 'subscriptionId and content are required' }, { status: 400 })
    }

    const subscription = await db.subscriptionLink.findUnique({ where: { id: subscriptionId } })
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Try base64 decode
    let decoded: string
    try {
      decoded = Buffer.from(content.trim(), 'base64').toString('utf-8')
      if (!decoded.includes('://')) {
        decoded = content
      }
    } catch {
      decoded = content
    }

    const lines = decoded.split(/\n/).map((l) => l.trim()).filter(Boolean)
    const validLinks = lines.filter((l) => SUPPORTED_PROTOCOLS.some((p) => l.startsWith(p)))

    if (validLinks.length === 0) {
      return NextResponse.json({ error: 'No valid config links found in pasted content. Make sure to paste vmess://, vless://, trojan://, ss://, or hy2:// links.' }, { status: 400 })
    }

    let newCount = 0

    for (const link of validLinks) {
      const { server, port, name } = parseServerPort(link)
      const protocol = detectProtocol(link)

      const existing = await db.vpnConfig.findFirst({
        where: { subscriptionId, server, port },
      })

      if (existing) {
        await db.vpnConfig.update({
          where: { id: existing.id },
          data: { name, protocol, configData: link, subscriptionId },
        })
      } else {
        await db.vpnConfig.create({
          data: { name, protocol, server, port: port || 443, configData: link, subscriptionId, isActive: false },
        })
        newCount++
      }
    }

    const totalConfigs = await db.vpnConfig.count({ where: { subscriptionId } })

    await db.subscriptionLink.update({
      where: { id: subscriptionId },
      data: { lastFetchedAt: new Date(), configCount: totalConfigs, lastError: null },
    })

    return NextResponse.json({ success: true, configCount: totalConfigs, newCount })
  } catch (error) {
    console.error('Failed to import subscription content:', error)
    return NextResponse.json({ error: 'Failed to import subscription content' }, { status: 500 })
  }
}