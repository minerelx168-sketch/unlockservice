import {discoveryText} from '@/lib/agent-discovery'
export const dynamic='force-dynamic'
export function GET(){return new Response(discoveryText(true),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}})}
