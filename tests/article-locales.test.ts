import test from 'node:test'
import assert from 'node:assert/strict'
import {articleLocales,listArticles,getArticle,articlePath,articleLanguages} from '../lib/articles'
test('old English catalog and locale-scoped lookup, paths and reciprocal alternates',()=>{
 assert.deepEqual(listArticles(),listArticles('en'))
 for(const locale of articleLocales){
 const rows=listArticles(locale)
 assert.equal(new Set(rows.map(a=>a.slug)).size,rows.length)
 for(const a of rows){
 assert.equal(getArticle(a.slug,locale),a)
 const links=articleLanguages('',a)
 if(!a.translationGroup){assert.deepEqual(links,{});continue}
 assert.ok(Object.values(links).includes(articlePath(a)))
 for(const path of Object.values(links)){
 const edition=articleLocales.flatMap(l=>listArticles(l)).find(b=>articlePath(b)===path)
 assert.ok(edition)
 assert.equal(edition.translationGroup,a.translationGroup)
 assert.deepEqual(articleLanguages('',edition),links)
 }}
 }
 assert.equal(getArticle('comparar-imei-con-anuncio','de'),undefined)
})
