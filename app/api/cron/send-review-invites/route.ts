import {createHash,timingSafeEqual} from 'node:crypto'
import {deliverReviewInvites} from '@/lib/review-invites'
export const runtime='nodejs'
const digest=(s:string)=>createHash('sha256').update(s).digest()
export async function POST(request:Request){
 const secret=process.env.CRON_SECRET
 if(!secret||!timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+secret)))return Response.json({error:'Unauthorized'},{status:401})
 return Response.json(await deliverReviewInvites(),{headers:{'Cache-Control':'no-store'}})
}
