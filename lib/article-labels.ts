import type {ArticleLocale} from './articles'
export const articleLabels = {
 en:['Home','Guides','Published','Updated','min read','Common questions','On this page','Read next'],
 es:['Inicio','Guías','Publicado','Actualizado','min de lectura','Preguntas frecuentes','En esta página','Seguir leyendo'],
 'fr-ca':['Accueil','Guides','Publié','Mis à jour','min de lecture','Questions fréquentes','Sur cette page','À lire ensuite'],
 pt:['Início','Guias','Publicado','Atualizado','min de leitura','Perguntas frequentes','Nesta página','Leia também'],
 de:['Startseite','Ratgeber','Veröffentlicht','Aktualisiert','Min. Lesezeit','Häufige Fragen','Auf dieser Seite','Weiterlesen'],
 ar:['الرئيسية','الأدلة','تاريخ النشر','آخر تحديث','دقائق للقراءة','الأسئلة الشائعة','في هذه الصفحة','اقرأ أيضًا'],
} satisfies Record<ArticleLocale,[string,string,string,string,string,string,string,string]>
