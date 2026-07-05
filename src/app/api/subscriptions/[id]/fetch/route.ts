import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import https from 'https'
import http from 'http'

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
      try {
        decoded = Buffer.from(encoded, 'base64').toString('utf-8')
      } catch {
        decoded = encoded
      }
      const parsed = JSON.parse(decoded)
      return {
        server: parsed.add || parsed.addr || 'unknown',
        port: parseInt(parsed.port, 10) || 443,
        name: parsed.ps || parsed.remarks || 'VMess Node',
      }
    }

    if (l.startsWith('vless://')) {
      const url = new URL(l.replace('vless://', 'http://'))
      const name = decodeURIComponent(url.hash.replace('#', '')) || 'VLESS Node'
      return { server: url.hostname, port: parseInt(url.port, 10) || 443, name }
    }

    if (l.startsWith('trojan://')) {
      const url = new URL(l.replace('trojan://', 'http://'))
      const name = decodeURIComponent(url.hash.replace('#', '')) || 'Trojan Node'
      return { server: url.hostname, port: parseInt(url.port, 10) || 443, name }
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
      const name = decodeURIComponent(url.hash.replace('#', '')) || 'Hysteria2 Node'
      return { server: url.hostname, port: parseInt(url.port, 10) || 443, name }
    }

    if (l.startsWith('wg://')) {
      const url = new URL(l.replace('wg://', 'http://'))
      const name = decodeURIComponent(url.hash.replace('#', '')) || 'WireGuard Node'
      return { server: url.hostname, port: parseInt(url.port, 10) || 51820, name }
    }
  } catch {
    // fallback
  }

  return { server: 'unknown', port: 0, name: 'Unknown Node' }
}

/**
 * Fetch a URL with TLS verification disabled.
 * This is needed because many subscription servers use self-signed certificates.
 */
function fetchWithTlsBypass(url: string, timeoutMs: number = 30000): Promise<{ body: string; status: number; statusText: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const lib = isHttps ? https : http

    const req = lib.request(urlObj, {
      method: 'GET',
      headers: {
        'User-Agent': 'V2Ray-Subscriber/1.0',
        'Accept-Encoding': 'identity',
      },
      rejectUnauthorized: false, // Allow self-signed certificates
      timeout: timeoutMs,
    }, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchWithTlsBypass(res.headers.location, timeoutMs).then(resolve).catch(reject)
        return
      }

      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8')
        resolve({
          body,
          status: res.statusCode || 200,
          statusText: res.statusMessage || 'OK',
        })
      })
      res.on('error', (err: Error) => reject(err))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })

    req.on('error', (err: Error) => reject(err))

    req.end()
  })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const subscription = await db.subscriptionLink.findUnique({ where: { id } })
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Fetch the subscription URL with TLS bypass
    let result: { body: string; status: number; statusText: string }
    try {
      result = await fetchWithTlsBypass(subscription.url, 30000)
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Network error'
      await db.subscriptionLink.update({
        where: { id },
        data: { lastError: errorMsg },
      })
      return NextResponse.json({ error: `Fetch failed: ${errorMsg}` }, { status: 502 })
    }

    if (result.status < 200 || result.status >= 300) {
      const errorMsg = `HTTP ${result.status} ${result.statusText}`
      await db.subscriptionLink.update({
        where: { id },
        data: { lastError: errorMsg },
      })
      return NextResponse.json({ error: errorMsg }, { status: 502 })
    }

    let rawBody = result.body

    // Try base64 decode
    let decoded: string
    try {
      decoded = Buffer.from(rawBody.trim(), 'base64').toString('utf-8')
      if (!decoded.includes('://')) {
        decoded = rawBody
      }
    } catch {
      decoded = rawBody
    }

    // Split by newlines and filter valid links
    const lines = decoded.split(/\n/).map((l) => l.trim()).filter(Boolean)
    const validLinks = lines.filter((l) =>
      SUPPORTED_PROTOCOLS.some((p) => l.startsWith(p))
    )

    if (validLinks.length === 0) {
      await db.subscriptionLink.update({
        where: { id },
        data: {
          lastFetchedAt: new Date(),
          configCount: 0,
          lastError: 'No valid config links found in response',
        },
      })
      return NextResponse.json({ success: true, configCount: 0, newCount: 0 })
    }

    // Process each link: create or update VpnConfig
    let newCount = 0

    for (const link of validLinks) {
      const { server, port, name } = parseServerPort(link)
      const protocol = detectProtocol(link)

      const existing = await db.vpnConfig.findFirst({
        where: {
          subscriptionId: id,
          server,
          port,
        },
      })

      if (existing) {
        await db.vpnConfig.update({
          where: { id: existing.id },
          data: {
            name,
            protocol,
            configData: link,
            subscriptionId: id,
          },
        })
      } else {
        await db.vpnConfig.create({
          data: {
            name,
            protocol,
            server,
            port: port || 443,
            configData: link,
            subscriptionId: id,
            isActive: false,
          },
        })
        newCount++
      }
    }

    // Update subscription record
    const totalConfigs = await db.vpnConfig.count({
      where: { subscriptionId: id },
    })

    await db.subscriptionLink.update({
      where: { id },
      data: {
        lastFetchedAt: new Date(),
        configCount: totalConfigs,
        lastError: null,
      },
    })

    return NextResponse.json({
      success: true,
      configCount: totalConfigs,
      newCount,
    })
  } catch (error) {
    console.error('Failed to fetch subscription:', error)
    try {
      const { id } = await params
      await db.subscriptionLink.update({
        where: { id },
        data: { lastError: error instanceof Error ? error.message : 'Unknown error' },
      })
    } catch {
      // ignore
    }
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}