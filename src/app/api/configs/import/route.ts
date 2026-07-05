import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ParsedConfig {
  protocol: string
  server: string
  port: number
  name: string
  configData: string
  remark?: string
}

function parseVlessLink(data: string): ParsedConfig | null {
  try {
    const withoutProtocol = data.replace('vless://', '')
    const hashIndex = withoutProtocol.indexOf('#')
    const name = hashIndex !== -1 ? decodeURIComponent(withoutProtocol.slice(hashIndex + 1)) : 'VLESS Config'
    const mainPart = hashIndex !== -1 ? withoutProtocol.slice(0, hashIndex) : withoutProtocol
    const [credentials, rest] = mainPart.split('@')
    const queryIndex = rest.indexOf('?')
    const hostPort = queryIndex !== -1 ? rest.slice(0, queryIndex) : rest
    const queryParams = queryIndex !== -1 ? new URLSearchParams(rest.slice(queryIndex + 1)) : new URLSearchParams()
    const lastColon = hostPort.lastIndexOf(':')
    const server = hostPort.slice(0, lastColon)
    const port = parseInt(hostPort.slice(lastColon + 1), 10)
    if (!server || isNaN(port)) return null
    const configData = JSON.stringify({
      uuid: credentials,
      security: queryParams.get('security') || 'tls',
      type: queryParams.get('type') || 'tcp',
      ...(queryParams.get('flow') && { flow: queryParams.get('flow') }),
      ...(queryParams.get('sni') && { sni: queryParams.get('sni') }),
      ...(queryParams.get('fp') && { fingerprint: queryParams.get('fp') }),
      ...(queryParams.get('pbk') && { publicKey: queryParams.get('pbk') }),
      ...(queryParams.get('sid') && { shortId: queryParams.get('sid') }),
      ...(queryParams.get('path') && { path: queryParams.get('path') }),
      ...(queryParams.get('host') && { host: queryParams.get('host') }),
    })
    return { protocol: 'vless', server, port, name, configData }
  } catch {
    return null
  }
}

function parseVmessLink(data: string): ParsedConfig | null {
  try {
    const encoded = data.replace('vmess://', '')
    let decoded: string
    try {
      decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    } catch {
      const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4)
      decoded = Buffer.from(padded, 'base64').toString('utf-8')
    }
    const json = JSON.parse(decoded)
    const server = json.add || json.host
    const port = parseInt(json.port, 10)
    if (!server || isNaN(port)) return null
    const configData = JSON.stringify({
      uuid: json.id,
      alterId: json.aid || 0,
      security: json.scy || 'auto',
      network: json.net || 'tcp',
      ...(json.sni && { sni: json.sni }),
      ...(json.path && { path: json.path }),
      ...(json.host && { wsHost: json.host }),
      ...(json.type && { type: json.type }),
    })
    return {
      protocol: 'vmess',
      server,
      port,
      name: json.ps || 'VMess Config',
      configData,
      remark: json.ps || undefined,
    }
  } catch {
    return null
  }
}

function parseTrojanLink(data: string): ParsedConfig | null {
  try {
    const withoutProtocol = data.replace('trojan://', '')
    const hashIndex = withoutProtocol.indexOf('#')
    const name = hashIndex !== -1 ? decodeURIComponent(withoutProtocol.slice(hashIndex + 1)) : 'Trojan Config'
    const mainPart = hashIndex !== -1 ? withoutProtocol.slice(0, hashIndex) : withoutProtocol
    const [password, rest] = mainPart.split('@')
    const queryIndex = rest.indexOf('?')
    const hostPort = queryIndex !== -1 ? rest.slice(0, queryIndex) : rest
    const queryParams = queryIndex !== -1 ? new URLSearchParams(rest.slice(queryIndex + 1)) : new URLSearchParams()
    const lastColon = hostPort.lastIndexOf(':')
    const server = hostPort.slice(0, lastColon)
    const port = parseInt(hostPort.slice(lastColon + 1), 10)
    if (!server || isNaN(port)) return null
    const configData = JSON.stringify({
      password,
      ...(queryParams.get('sni') && { sni: queryParams.get('sni') }),
      ...(queryParams.get('type') && { type: queryParams.get('type') }),
      ...(queryParams.get('path') && { path: queryParams.get('path') }),
      ...(queryParams.get('host') && { host: queryParams.get('host') }),
      ...(queryParams.get('fingerprint') && { fingerprint: queryParams.get('fingerprint') }),
    })
    return { protocol: 'trojan', server, port, name, configData }
  } catch {
    return null
  }
}

function parseSsLink(data: string): ParsedConfig | null {
  try {
    const withoutProtocol = data.replace('ss://', '')
    const hashIndex = withoutProtocol.indexOf('#')
    const name = hashIndex !== -1 ? decodeURIComponent(withoutProtocol.slice(hashIndex + 1)) : 'Shadowsocks Config'
    const mainPart = hashIndex !== -1 ? withoutProtocol.slice(0, hashIndex) : withoutProtocol
    const atIndex = mainPart.lastIndexOf('@')
    if (atIndex === -1) return null
    const encodedMethod = mainPart.slice(0, atIndex)
    const hostPort = mainPart.slice(atIndex + 1)
    let methodPassword: string
    try {
      methodPassword = Buffer.from(encodedMethod, 'base64').toString('utf-8')
    } catch {
      const padded = encodedMethod + '='.repeat((4 - (encodedMethod.length % 4)) % 4)
      methodPassword = Buffer.from(padded, 'base64').toString('utf-8')
    }
    const colonIndex = methodPassword.indexOf(':')
    const method = methodPassword.slice(0, colonIndex)
    const password = methodPassword.slice(colonIndex + 1)
    const lastColon = hostPort.lastIndexOf(':')
    const server = hostPort.slice(0, lastColon)
    const port = parseInt(hostPort.slice(lastColon + 1), 10)
    if (!server || isNaN(port) || !method) return null
    const configData = JSON.stringify({ method, password })
    return { protocol: 'shadowsocks', server, port, name, configData }
  } catch {
    return null
  }
}

function parseHysteria2Link(data: string): ParsedConfig | null {
  try {
    const withoutProtocol = data.replace('hysteria2://', '').replace('hy2://', '')
    const hashIndex = withoutProtocol.indexOf('#')
    const name = hashIndex !== -1 ? decodeURIComponent(withoutProtocol.slice(hashIndex + 1)) : 'Hysteria2 Config'
    const mainPart = hashIndex !== -1 ? withoutProtocol.slice(0, hashIndex) : withoutProtocol
    const [password, rest] = mainPart.split('@')
    const queryIndex = rest.indexOf('?')
    const hostPort = queryIndex !== -1 ? rest.slice(0, queryIndex) : rest
    const queryParams = queryIndex !== -1 ? new URLSearchParams(rest.slice(queryIndex + 1)) : new URLSearchParams()
    const lastColon = hostPort.lastIndexOf(':')
    const server = hostPort.slice(0, lastColon)
    const port = parseInt(hostPort.slice(lastColon + 1), 10)
    if (!server || isNaN(port)) return null
    const configData = JSON.stringify({
      password,
      ...(queryParams.get('sni') && { sni: queryParams.get('sni') }),
      ...(queryParams.get('insecure') && { insecure: queryParams.get('insecure') }),
      ...(queryParams.get('obfs') && { obfs: queryParams.get('obfs') }),
      ...(queryParams.get('obfs-password') && { obfsPassword: queryParams.get('obfs-password') }),
    })
    return { protocol: 'hysteria2', server, port, name, configData }
  } catch {
    return null
  }
}

function parseLink(data: string): ParsedConfig | null {
  const trimmed = data.trim()
  if (trimmed.startsWith('vless://')) return parseVlessLink(trimmed)
  if (trimmed.startsWith('vmess://')) return parseVmessLink(trimmed)
  if (trimmed.startsWith('trojan://')) return parseTrojanLink(trimmed)
  if (trimmed.startsWith('ss://')) return parseSsLink(trimmed)
  if (trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) return parseHysteria2Link(trimmed)
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    if (!type || !data) {
      return NextResponse.json(
        { error: 'type and data are required' },
        { status: 400 }
      )
    }

    let linksToImport: string[] = []

    if (type === 'v2ray') {
      // Split by newlines - support bulk import
      const lines = data.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length === 0) {
        return NextResponse.json({ error: 'No valid data provided' }, { status: 400 })
      }
      // Filter to only valid protocol links
      linksToImport = lines.filter(l =>
        l.startsWith('vmess://') || l.startsWith('vless://') ||
        l.startsWith('trojan://') || l.startsWith('ss://') ||
        l.startsWith('hysteria2://') || l.startsWith('hy2://')
      )
      if (linksToImport.length === 0) {
        return NextResponse.json(
          { error: 'No valid links found. Supported: vmess://, vless://, trojan://, ss://, hysteria2://' },
          { status: 400 }
        )
      }
    } else if (type === 'base64') {
      let decoded: string
      try {
        decoded = Buffer.from(data, 'base64').toString('utf-8')
      } catch {
        return NextResponse.json({ error: 'Invalid base64 data' }, { status: 400 })
      }
      const lines = decoded.split('\n').map(l => l.trim()).filter(Boolean)
      linksToImport = lines.filter(l =>
        l.startsWith('vmess://') || l.startsWith('vless://') ||
        l.startsWith('trojan://') || l.startsWith('ss://') ||
        l.startsWith('hysteria2://') || l.startsWith('hy2://')
      )
      if (linksToImport.length === 0) {
        return NextResponse.json({ error: 'No valid links found after base64 decode' }, { status: 400 })
      }
    } else if (type === 'json') {
      // Single JSON config import
      try {
        const json = typeof data === 'string' ? JSON.parse(data) : data
        if (!json.protocol || !json.server || !json.port) {
          return NextResponse.json({ error: 'JSON config must have protocol, server, and port fields' }, { status: 400 })
        }
        const config = await db.vpnConfig.create({
          data: {
            name: json.name || `${json.protocol} Config`,
            protocol: json.protocol,
            server: json.server,
            port: Number(json.port),
            configData: JSON.stringify(json.configData || json.settings || {}),
            remark: json.remark || null,
            isActive: false,
            order: 0,
          },
        })
        return NextResponse.json({ imported: 1, total: 1, configs: [config] }, { status: 201 })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid JSON data'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid type. Must be one of: v2ray, base64, json' }, { status: 400 })
    }

    // Bulk import - parse and create all links
    let imported = 0
    let failed = 0
    const createdConfigs: unknown[] = []

    for (const link of linksToImport) {
      const parsed = parseLink(link)
      if (!parsed) {
        failed++
        continue
      }

      try {
        const config = await db.vpnConfig.create({
          data: {
            name: parsed.name,
            protocol: parsed.protocol,
            server: parsed.server,
            port: parsed.port,
            configData: parsed.configData,
            remark: parsed.remark || null,
            isActive: false,
            order: 0,
          },
        })
        createdConfigs.push(config)
        imported++
      } catch {
        failed++
      }
    }

    if (imported === 0) {
      return NextResponse.json(
        { error: `Failed to import any configs (${failed} failed to parse)` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      imported,
      total: linksToImport.length,
      failed,
      configs: createdConfigs,
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to import VPN config:', error)
    return NextResponse.json({ error: 'Failed to import VPN config' }, { status: 500 })
  }
}