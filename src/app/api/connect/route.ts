import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import net from 'net'

function tcpTest(server: string, port: number, timeoutMs: number): Promise<{ reachable: boolean; latency: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = new net.Socket()

    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ reachable: false, latency: -1, error: `Connection timed out after ${timeoutMs}ms` })
    }, timeoutMs)

    socket.connect(port, server, () => {
      const latency = Date.now() - start
      clearTimeout(timer)
      socket.destroy()
      resolve({ reachable: true, latency })
    })

    socket.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      socket.destroy()
      resolve({ reachable: false, latency: -1, error: err.message || 'Connection failed' })
    })
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, configId } = body

    if (action === 'connect') {
      if (!configId) {
        return NextResponse.json({ error: 'Config ID is required' }, { status: 400 })
      }

      const config = await db.vpnConfig.findUnique({
        where: { id: configId },
      })

      if (!config) {
        return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
      }

      // Test TCP connectivity to the VPN server first
      const testResult = await tcpTest(config.server, config.port, 5000)
      if (!testResult.reachable) {
        return NextResponse.json({
          error: `Cannot reach ${config.server}:${config.port} - ${testResult.error || 'Connection refused'}`,
          serverTest: testResult,
        }, { status: 502 })
      }

      // Deactivate all configs, then activate the selected one
      await db.vpnConfig.updateMany({ data: { isActive: false } })
      await db.vpnConfig.update({
        where: { id: configId },
        data: { isActive: true },
      })

      return NextResponse.json({
        success: true,
        config: {
          id: config.id,
          name: config.name,
          protocol: config.protocol,
          server: config.server,
          port: config.port,
        },
        serverTest: testResult,
      })
    }

    if (action === 'disconnect') {
      await db.vpnConfig.updateMany({ data: { isActive: false } })
      return NextResponse.json({ success: true, disconnected: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Connect/disconnect failed:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}