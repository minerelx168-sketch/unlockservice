'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { activeTimeIncrement, engagementPage } from '@/lib/engagement-pages'
import { analyticsHostAllowed } from '@/lib/site'
type AnalyticsWindow = Window & { iunlockmobileAnalyticsConsent?: string; gtag?: (...args: unknown[]) => void }
const tag = 'G-9WCELVR3V3'
export function CustomerEngagement() {
  const pathname = usePathname() ?? '/'
  useEffect(() => {
    const browser = window as AnalyticsWindow
    if (!analyticsHostAllowed(location.hostname)) return
    const page = engagementPage(pathname)
    let stopped = false, generation = 0, visitId = '', activeMs = 0, sentMs = 0, lastTick = Date.now(), lastActivity = Date.now(), identity: string | null = null, busy = false, started = false
    function clearIdentity() { browser.gtag?.('config',tag,{ user_id:null,send_page_view:false }); identity=null }
    async function send(final = false) {
      if (!page || !visitId || busy || browser.iunlockmobileAnalyticsConsent!=='granted') return
      busy=true
      const version=generation, total=activeMs, key=visitId
      try {
        const response=await fetch('/api/analytics/activity',{method:'POST',credentials:'same-origin',keepalive:final,headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify({visitId:key,page,activeMs:total})})
        if (!response.ok) return
        const result=await response.json() as { tracked:boolean;userId:string|null }
        if (stopped || version!==generation || browser.iunlockmobileAnalyticsConsent!=='granted') return
        if (!result.tracked || !result.userId) { clearIdentity(); visitId=''; return }
        if (identity!==result.userId) { identity=result.userId; browser.gtag?.('config',tag,{user_id:identity,send_page_view:false}) }
        if (!started) { browser.gtag?.('event','account_page_view',{send_to:tag,page_category:page}); started=true }
        const delta=Math.max(0,total-sentMs)
        if (delta>=1000) browser.gtag?.('event','account_page_engagement',{send_to:tag,page_category:page,active_seconds:Math.floor(delta/1000)})
        sentMs=total
      } catch { /* Optional analytics cannot interrupt the customer. */ } finally { busy=false }
    }
    function tick() { const now=Date.now(); if (visitId) activeMs=Math.min(3_600_000,activeMs+activeTimeIncrement(now-lastTick,document.visibilityState==='visible',document.hasFocus(),now-lastActivity)); lastTick=now }
    function activity() { lastActivity=Date.now() }
    function visibility() { tick(); if (document.visibilityState==='hidden') void send(true); else activity() }
    function consent() {
      generation++; clearIdentity(); visitId=''; activeMs=0; sentMs=0; started=false; lastTick=Date.now(); lastActivity=lastTick
      if (browser.iunlockmobileAnalyticsConsent==='granted' && page) { visitId=crypto.randomUUID(); void send() }
    }
    const timer=window.setInterval(tick,1000)
    const heartbeat=window.setInterval(()=>{tick();void send()},15000)
    window.addEventListener('iunlockmobile-consent',consent)
    for (const name of ['pointerdown','keydown','scroll','focus']) window.addEventListener(name,activity,{passive:true})
    document.addEventListener('visibilitychange',visibility)
    window.addEventListener('pagehide',visibility)
    consent()
    return () => { tick(); void send(true); stopped=true; generation++; clearIdentity(); clearInterval(timer); clearInterval(heartbeat); window.removeEventListener('iunlockmobile-consent',consent); for (const name of ['pointerdown','keydown','scroll','focus']) window.removeEventListener(name,activity); document.removeEventListener('visibilitychange',visibility); window.removeEventListener('pagehide',visibility) }
  },[pathname])
  return null
}
