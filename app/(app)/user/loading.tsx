/**
 * The workspace reads the database on every page, so a slow query shows
 * this rather than a blank frame. It mirrors the panel it stands in for so
 * the layout does not jump when the real content lands.
 *
 * Scoped to /user rather than the whole (app) group on purpose. A fallback
 * above /admin turns its RBAC redirect into a streamed one: the frame is
 * sent with a 200 first and the redirect arrives after it, so a customer
 * briefly sits on a page at /admin. No administrator data is in that frame,
 * but a plain redirect is the honest answer and this keeps it.
 */
export default function WorkspaceLoading() {
  return (
    <>
      <div className="app-head">
        <div>
          <h1 className="skeleton skeleton--title" aria-hidden="true" />
          <p className="skeleton skeleton--line" aria-hidden="true" />
        </div>
      </div>
      <p className="t-small" role="status">
        Loading…
      </p>
    </>
  )
}
