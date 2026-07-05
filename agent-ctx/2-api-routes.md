# Task 2: VPN Management Dashboard - API Routes

## Summary
Built all 14 API route files for the VPN Management Dashboard covering CRUD operations for VPN configs, split tunneling rules, ping targets, DNS configs, and VPN sharing. All routes use Next.js 16 App Router patterns with proper error handling and validation.

## Files Created

### VPN Configs (3 files)
1. **`/api/configs/route.ts`** — GET (all, ordered by `order` asc then `createdAt` desc), POST (validate name/protocol/server/port)
2. **`/api/configs/[id]/route.ts`** — GET (single), PUT (partial update), DELETE
3. **`/api/configs/import/route.ts`** — POST import supporting:
   - `type: "v2ray"` — direct link parsing (vmess://, vless://, trojan://, ss://, hysteria2://, hy2://)
   - `type: "base64"` — base64-decoded link parsing
   - `type: "json"` — raw JSON config object
   - Full URI parsing for each protocol (UUIDs, passwords, query params, SNI, paths, etc.)

### Split Tunneling (3 files)
4. **`/api/split-tunneling/route.ts`** — GET (all, ordered by `order`), POST
5. **`/api/split-tunneling/[id]/route.ts`** — PUT, DELETE
6. **`/api/split-tunneling/reorder/route.ts`** — POST batch reorder with Prisma `$transaction`

### Ping (3 files)
7. **`/api/ping/targets/route.ts`** — GET (all), POST (auto-unsets other defaults if `isDefault: true`)
8. **`/api/ping/targets/[id]/route.ts`** — PUT, DELETE
9. **`/api/ping/test/route.ts`** — POST TCP ping test using Node.js `net.Socket` with 3s timeout, returns per-host reachability and latency

### DNS (3 files)
10. **`/api/dns/route.ts`** — GET (all), POST (auto-deactivates others if `isActive: true`)
11. **`/api/dns/[id]/route.ts`** — PUT (auto-deactivates others on activate), DELETE
12. **`/api/dns/activate/route.ts`** — POST activate specific DNS config via transactional deactivate-all-then-activate

### VPN Sharing (2 files)
13. **`/api/sharing/route.ts`** — GET (all), POST
14. **`/api/sharing/[id]/route.ts`** — PUT, DELETE

## Design Decisions
- All dynamic routes use `params: Promise<{ id: string }>` pattern (Next.js 16 requirement)
- Consistent error handling: try/catch with 400/404/500 status codes
- Partial updates in PUT using spread operator (only provided fields are updated)
- DNS activation logic implemented in both POST create and PUT update for consistency
- V2ray import handles edge cases: missing padding in base64, multiple links (uses first), hy2:// alias
- TCP ping uses `net.Socket` directly with manual timeout handling
- No `'use server'` directives (not needed for route handlers)