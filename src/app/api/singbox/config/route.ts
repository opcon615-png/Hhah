import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ParsedConfigData {
  id?: string
  security?: string
  alterId?: number
  network?: string
  flow?: string
  tls?: boolean
  sni?: string
  password?: string
  method?: string
  address?: string
  privateKey?: string
  publicKey?: string
  presharedKey?: string
  mtu?: number
  ports?: string
  [key: string]: unknown
}

function safeParseConfigData(configData: string): ParsedConfigData {
  try {
    return JSON.parse(configData) as ParsedConfigData
  } catch {
    return {}
  }
}

function buildProxyOutbound(
  protocol: string,
  server: string,
  port: number,
  configData: ParsedConfigData
): Record<string, unknown> {
  const base = { tag: 'proxy', server, server_port: port } as Record<string, unknown>

  switch (protocol) {
    case 'vmess':
      return {
        ...base,
        type: 'vmess',
        uuid: configData.id || '',
        security: configData.security || 'auto',
        alter_id: configData.alterId || 0,
        transport: { type: configData.network || 'tcp' },
      }

    case 'vless': {
      const tlsEnabled = configData.tls === true
      return {
        ...base,
        type: 'vless',
        uuid: configData.id || '',
        flow: configData.flow || '',
        tls: tlsEnabled
          ? {
              enabled: true,
              server_name: configData.sni || server,
              utls: { enabled: true, fingerprint: 'chrome' },
            }
          : { enabled: false },
        transport: { type: configData.network || 'tcp' },
      }
    }

    case 'trojan':
      return {
        ...base,
        type: 'trojan',
        password: configData.password || '',
        tls: {
          enabled: true,
          server_name: configData.sni || server,
        },
      }

    case 'shadowsocks':
      return {
        ...base,
        type: 'shadowsocks',
        method: configData.method || 'aes-256-gcm',
        password: configData.password || '',
      }

    case 'hysteria2': {
      const out: Record<string, unknown> = {
        ...base,
        type: 'hysteria2',
        password: configData.password || '',
        tls: {
          enabled: true,
          server_name: configData.sni || server,
        },
      }
      if (configData.ports) {
        out.hop_ports = configData.ports.split(',').map(Number)
      }
      return out
    }

    case 'wireguard':
      return {
        ...base,
        type: 'wireguard',
        local_address: [configData.address || '10.0.0.2/32'],
        private_key: configData.privateKey || '',
        peer_public_key: configData.publicKey || '',
        pre_shared_key: configData.presharedKey || '',
        mtu: configData.mtu || 1420,
      }

    default:
      return {
        ...base,
        type: protocol,
      }
  }
}

export async function GET() {
  try {
    // 1. Find active VPN config
    const activeConfig = await db.vpnConfig.findFirst({
      where: { isActive: true },
    })

    if (!activeConfig) {
      return NextResponse.json({ error: 'No active config' }, { status: 400 })
    }

    // 2. Parse configData
    const configData = safeParseConfigData(activeConfig.configData)

    // 3. Fetch enabled split tunneling rules
    const splitTunnelRules = await db.splitTunnelRule.findMany({
      where: { enabled: true },
      orderBy: { order: 'asc' },
    })

    // 4. Fetch active DNS config
    const activeDns = await db.dnsConfig.findFirst({
      where: { isActive: true },
    })

    // 5. Fetch enabled VPN share configs
    const vpnShares = await db.vpnShare.findMany({
      where: { enabled: true },
    })

    // 6. Build the complete sing-box config

    // --- DNS ---
    const remoteDnsAddress = activeDns?.dohUrl || activeDns?.primaryDns || '8.8.8.8'
    const localDnsAddress = activeDns?.secondaryDns || '1.1.1.1'

    const dnsServers = [
      { tag: 'remote', address: remoteDnsAddress, detour: 'proxy' },
      { tag: 'local', address: localDnsAddress, detour: 'direct' },
    ]

    const dnsRules = [
      { outbound: 'any', server: 'local' },
      { rule_set: 'geosite:ir', server: 'local' },
    ]

    // --- Split tunneling route rules ---
    const hasWhitelistRules = splitTunnelRules.some((r) => r.type === 'whitelist')

    const routeRules: Record<string, unknown>[] = []

    // In whitelist mode, add catch-all direct rule before whitelist rules
    if (hasWhitelistRules) {
      routeRules.push({
        type: 'domain',
        domain: ['geosite:ir'],
        outbound: 'direct',
      })
    }

    for (const rule of splitTunnelRules) {
      if (rule.targetType === 'domain') {
        routeRules.push({
          type: 'domain',
          domain: [rule.value],
          outbound: rule.type === 'whitelist' ? 'proxy' : 'direct',
        })
      } else if (rule.targetType === 'ip') {
        routeRules.push({
          type: 'ip_cidr',
          ip_cidr: [rule.value],
          outbound: rule.type === 'whitelist' ? 'proxy' : 'direct',
        })
      }
      // app rules are not directly supported in sing-box route rules, skip
    }

    // --- Proxy outbound ---
    const proxyOutbound = buildProxyOutbound(
      activeConfig.protocol,
      activeConfig.server,
      activeConfig.port,
      configData
    )

    // --- Assemble final config ---
    const singboxConfig = {
      log: {
        level: 'info',
        timestamp: true,
      },
      dns: {
        servers: dnsServers,
        rules: dnsRules,
        strategy: 'prefer_ipv4',
      },
      inbounds: [
        {
          type: 'tun',
          tag: 'tun-in',
          interface_name: 'sing-box',
          inet4_address: '172.19.0.1/30',
          auto_route: true,
          strict_route: true,
          stack: 'mixed',
          sniff: true,
          sniff_override_destination: false,
        },
      ],
      outbounds: [
        { type: 'direct', tag: 'direct' },
        { type: 'block', tag: 'block' },
        { type: 'dns', tag: 'dns-out' },
        proxyOutbound,
      ],
      route: {
        rules: routeRules,
        final: hasWhitelistRules ? 'direct' : 'proxy',
        auto_detect_interface: true,
      },
    }

    return NextResponse.json(singboxConfig)
  } catch (error) {
    console.error('Failed to generate sing-box config:', error)
    return NextResponse.json(
      { error: 'Failed to generate sing-box config' },
      { status: 500 }
    )
  }
}