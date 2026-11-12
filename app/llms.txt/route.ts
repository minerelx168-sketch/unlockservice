import {discoveryText} from '@/lib/agent-discovery'
export const dynamic='force-dynamic'
export function GET(){return new Response(discoveryText(false),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}})}
