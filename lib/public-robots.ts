/** Public, indexable sections. Everything else keeps its own robots policy. */
const PUBLIC_CONTENT = /^\/(?:(?:es|fr-ca|pt|de|ar)(?:\/.*)?|articles(?:\/.*)?|services(?:\/.*)?|tools(?:\/.*)?|reports(?:\/.*)?|check(?:\/.*)?|support|contact|track|llms\.txt|llms-full\.txt)?$/
const NOINDEX_SECTIONS = /^\/(?:services\/unlock\/(?:catalog|more)|(?:es|fr-ca|pt|de|ar)\/checkout)(?:\/|$)/
export const PUBLIC_ROBOTS = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'

export function isPublicContentPath(path: string): boolean {
  return PUBLIC_CONTENT.test(path) && !NOINDEX_SECTIONS.test(path)
}
