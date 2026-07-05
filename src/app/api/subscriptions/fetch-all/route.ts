import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import https from 'https'
import http from 'http'

const SUPPORTED_PROTOCOLS = ['vmess://', 'vless://', 'trojan://', 'ss://', 'hysteria2://', 'hy2://', 'wg://']

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
      rejectUnauthorized: false,
      timeout: timeoutMs,
    }, (res) => {
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

export async function POST() {
  try {
    const subscriptions = await db.subscriptionLink.findMany({
      where: { enabled: true, autoUpdate: true },
    })

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, totalFetched: 0, results: [] })
    }

    const results: { id: string; name: string; configCount: number; newCount: number; error?: string }[] = []

    for (const sub of subscriptions) {
      try {
        const result = await fetchWithTlsBypass(sub.url, 30000)

        if (result.status < 200 || result.status >= 300) {
          const errorMsg = `HTTP ${result.status} ${result.statusText}`
          await db.subscriptionLink.update({
            where: { id: sub.id },
            data: { lastError: errorMsg },
          })
          results.push({ id: sub.id, name: sub.name, configCount: 0, newCount: 0, error: errorMsg })
          continue
        }

        let rawBody = result.body

        let decoded: string
        try {
          decoded = Buffer.from(rawBody.trim(), 'base64').toString('utf-8')
          if (!decoded.includes('://')) {
            decoded = rawBody
          }
        } catch {
          decoded = rawBody
        }

        const lines = decoded.split(/\n/).map((l) => l.trim()).filter(Boolean)
        const validLinks = lines.filter((l) => SUPPORTED_PROTOCOLS.some((p) => l.startsWith(p)))

        let newCount = 0

        for (const link of validLinks) {
          const protocol = detectProtocol(link)
          const { server, port, name } = parseServerPort(link)

          const existing = await db.vpnConfig.findFirst({
            where: { subscriptionId: sub.id, server, port },
          })

          if (existing) {
            await db.vpnConfig.update({
              where: { id: existing.id },
              data: { name, protocol, configData: link, subscriptionId: sub.id },
            })
          } else {
            await db.vpnConfig.create({
              data: { name, protocol, server, port, configData: link, subscriptionId: sub.id, isActive: false },
            })
            newCount++
          }
        }

        const totalConfigs = await db.vpnConfig.count({ where: { subscriptionId: sub.id } })
        await db.subscriptionLink.update({
          where: { id: sub.id },
          data: { lastFetchedAt: new Date(), configCount: totalConfigs, lastError: null },
        })

        results.push({ id: sub.id, name: sub.name, configCount: totalConfigs, newCount })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        await db.subscriptionLink.update({
          where: { id: sub.id },
          data: { lastError: errorMsg },
        })
        results.push({ id: sub.id, name: sub.name, configCount: 0, newCount: 0, error: errorMsg })
      }
    }

    const totalFetched = results.filter((r) => !r.error).length
    const totalConfigs = results.reduce((sum, r) => sum + r.configCount, 0)
    const totalNew = results.reduce((sum, r) => sum + r.newCount, 0)

    return NextResponse.json({
      success: true,
      totalFetched,
      totalConfigs,
      totalNew,
      results,
    })
  } catch (error) {
    console.error('Failed to fetch all subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}