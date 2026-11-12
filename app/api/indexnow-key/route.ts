export const dynamic='force-dynamic'
export function GET(){
 const key=process.env.INDEXNOW_KEY??''
 return /^[A-Za-z0-9-]{8,128}$/.test(key)?new Response(key,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}):new Response(null,{status:404})
}
