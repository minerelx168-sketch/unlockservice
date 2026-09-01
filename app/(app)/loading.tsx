/**
 * The workspace reads the database on every page, so a slow query shows
 * this rather than a blank frame. It mirrors the panel it is standing in
 * for, so the layout does not jump when the real content lands.
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
