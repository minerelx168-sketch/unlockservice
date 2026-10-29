'use client'
import {useMemo,useState} from 'react'
type Service={service_code:string;name:string;category:string;group:string;input_type:string;retail_price:string;reseller_price:string}
export function ResellerPrices({services}:{services:Service[]}) {
  const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[page,setPage]=useState(0)
  const filtered=useMemo(()=>services.filter(s=>(category==='all'||s.category===category)&&`${s.name} ${s.service_code} ${s.group}`.toLowerCase().includes(query.trim().toLowerCase())),[services,query,category])
  const rows=filtered.slice(page*25,page*25+25)
  return <>
    <div className="reseller-form"><label>Find a service<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder="Service name or API code"/></label>
      <label>Category<select value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}><option value="all">All services</option><option value="imei_check">Phone Check</option><option value="unlock">Unlock</option></select></label></div>
    <p className="t-small reseller-count" role="status">{filtered.length} matching services</p>
    <div className="reseller-table-scroll"><table className="reseller-table"><thead><tr><th>Service / API code</th><th>Retail</th><th>Reseller</th><th>Input</th></tr></thead><tbody>{rows.map(s=><tr key={s.service_code}><td>{s.name}<small>{s.service_code}</small></td><td>${s.retail_price}</td><td><strong>${s.reseller_price}</strong></td><td>{s.input_type}</td></tr>)}</tbody></table></div>
    <div className="reseller-actions reseller-pager"><button className="button button--quiet" type="button" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1} of {Math.max(1,Math.ceil(filtered.length/25))}</span><button className="button button--quiet" type="button" disabled={(page+1)*25>=filtered.length} onClick={()=>setPage(page+1)}>Next</button></div>
  </>
}
