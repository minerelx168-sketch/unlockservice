/** JSON-LD is embedded in HTML: escape '<' so text cannot end its script. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
