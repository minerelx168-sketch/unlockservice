import type {ReactNode} from 'react'
import {Icon,type IconName} from './icons'

export function GuideHero({tag,title,children,icon='device'}:{tag:string;title:string;children?:ReactNode;icon?:IconName}){
  return <header className="guide-hero"><div className="guide-hero-copy"><span className="guide-tag"><Icon name={icon}/>{tag}</span><h1>{title}</h1>{children}</div><div className="guide-orbit" aria-hidden="true"><Icon name={icon}/></div></header>
}
export function GuideTile({href,title,detail,icon}:{href:string;title:string;detail?:string;icon:IconName}){
  return <a className="guide-tile" href={href}><span className="guide-symbol"><Icon name={icon}/></span><div><h2>{title}</h2>{detail&&<p>{detail}</p>}</div><span className="guide-arrow" aria-hidden="true">→</span></a>
}
