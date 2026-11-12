import {paths,markets,homePaths} from './geo-locales'
export const clusters=paths
export function languageLinks(path:string):Record<string,string>{
 const row=paths.find(c=>c.includes(path))??(homePaths.includes(path)?homePaths:paths[0])
 const links:Record<string,string>={'en-CA':row[0],'x-default':row[0]}
 row.forEach((v,i)=>{links[markets[i]]=v})
 if(row[4])links['de-DE']=row[4]
 links['es-US']=row[1]
 return links
}
