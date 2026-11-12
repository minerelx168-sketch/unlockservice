import {Icon} from './icons'
export function GuideFaq({rows}:{rows:readonly (readonly string[])[]}){return <div className="faq-list">{rows.map(([q,a])=><details className="faq-item" key={q}><summary>{q}<span className="plus" aria-hidden="true"><Icon name="plus" strokeWidth={2.6}/></span></summary><div className="answer">{a}</div></details>)}</div>}
