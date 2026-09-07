import Link from 'next/link'
import type { ArticleBlock } from '@/lib/articles'
import { Icon } from './icons'

/**
 * Renders an article's blocks.
 *
 * A server component with no client JavaScript: a guide is text, and the
 * whole point of publishing it is that a crawler and a reader both get it
 * from the first response.
 */
export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="article-body">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'h2':
            return (
              <h2 key={block.id} id={block.id}>
                {block.text}
              </h2>
            )
          case 'p':
            return <p key={index}>{block.text}</p>
          case 'list':
            return block.ordered ? (
              <ol key={index}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul key={index}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )
          case 'note':
            return (
              <p className="article-note" key={index}>
                <Icon name="info" strokeWidth={1.9} />
                <span>{block.text}</span>
              </p>
            )
          case 'table':
            return (
              <div className="table-wrap" key={index}>
                <table className="grid">
                  <thead>
                    <tr>
                      {block.head.map((cell) => (
                        <th key={cell}>{cell}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.join('|')}>
                        {row.map((cell) => (
                          <td key={cell}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'cta':
            return (
              <div className="article-cta" key={index}>
                <p>{block.text}</p>
                <Link className="button button--primary" href={block.href}>
                  {block.label}
                  <Icon name="arrowRight" strokeWidth={2.2} />
                </Link>
              </div>
            )
        }
      })}
    </div>
  )
}
