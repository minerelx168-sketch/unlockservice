import {rest} from '@/lib/agent-http'
export const dynamic='force-dynamic'
export const GET=(r:Request)=>rest(r,'validate_imei')

export {preflight as OPTIONS} from '@/lib/agent-http'
