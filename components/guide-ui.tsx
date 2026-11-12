import type {ReactNode} from 'react'
import {Icon,type IconName} from './icons'
export function GuideHero({tag,title,children}:{tag:string;title:string;children?:ReactNode;icon?:IconName}){
 return <div className="section-head section-head--center"><span className="kicker">{tag}</span><h1 className="t-section">{title}</h1><div className="t-lead">{children}</div></div>
}
export function GuideTile({href,title,detail,icon}:{href:string;title:string;detail?:string;icon:IconName}){
 return <a className="hub-card" href={href}><span className="icon-tile"><Icon name={icon}/></span><h2 className="t-card">{title}</h2>{detail&&<p>{detail}</p>}<span className="link-arrow" aria-hidden="true">→</span></a>
}
