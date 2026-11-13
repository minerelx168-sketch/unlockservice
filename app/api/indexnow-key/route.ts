export const dynamic='force-dynamic'
const KEY=/^[A-Za-z0-9-]{8,128}$/
/**
 * IndexNow ownership proof at /indexnow-key.txt. The default location
 * /<INDEXNOW_KEY>.txt is answered by middleware.ts.
 */
export function GET(){
 const key=process.env.INDEXNOW_KEY?.trim()??''
 if(!KEY.test(key))return new Response(null,{status:404})
 return new Response(key,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=300'}})
}
