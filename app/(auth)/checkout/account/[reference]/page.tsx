import Link from 'next/link'
import { Brand } from '@/components/brand'
import { GuestAccountActivation } from '@/components/guest-account-activation'
import { guestAccountActivation } from '@/lib/guest-account'
import { currentSession } from '@/lib/auth'
export const dynamic='force-dynamic'
export const metadata={title:'Save your service order',robots:{index:false,follow:false,noarchive:true},referrer:'no-referrer' as const}
export default async function GuestAccountPage({params,searchParams}:{params:Promise<{reference:string}>;searchParams:Promise<{token?:string}>}) {
  const reference=(await params).reference,token=(await searchParams).token??'',session=await currentSession(),context=guestAccountActivation(reference,token,session?.user.id)
  return <div className="auth-card"><Brand/><h1>{context?'Keep your orders together.':'This account link is no longer available.'}</h1>
    {context?<><p><strong>{context.email}</strong></p><p>This optional step verifies the email that received your order and saves this paid order to your customer account. You will be signed in on this browser.</p>{context.requiresSignIn?<><p>This email already has an account. Sign in to that account before saving this order, or reset its password by email. Then reopen this account link. Your private tracking link works now without signing in.</p><p><Link href="/login">Sign in to my account</Link></p><p><Link href="/forgot-password">Set or reset password by email</Link></p></>:<GuestAccountActivation reference={reference} token={token} canSetPassword={context.canSetPassword}/>}<p className="t-small">You can keep using the private order link in your email without activating an account.</p></>:<><p>The link may have expired or already been used. The private tracking link in your order email still works without a password.</p><Link href="/login">Sign in</Link><p><Link href="/forgot-password">Set or reset a password by email</Link></p></>}
  </div>
}
