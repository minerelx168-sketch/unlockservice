import {rest} from '@/lib/agent-http'
export const dynamic='force-dynamic'
export const GET=(r:Request)=>rest(r,'decode_apple_model')

export {preflight as OPTIONS} from '@/lib/agent-http'
