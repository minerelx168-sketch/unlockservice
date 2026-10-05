'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './icons'

type Example = {
  title: string
  variants: { label: string; output: string }[]
}

type ExampleState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; productCode: string; example: Example }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

function readExample(payload: unknown): Example | null {
  if (!payload || typeof payload !== 'object' || !('success' in payload) || payload.success !== true || !('example' in payload)) return null
  const example = payload.example
  if (!example || typeof example !== 'object' || !('title' in example) || typeof example.title !== 'string' || !example.title.trim() || !('variants' in example) || !Array.isArray(example.variants) || !example.variants.length) return null
  const variants: Example['variants'] = []
  for (const variant of example.variants) {
    if (!variant || typeof variant !== 'object' || typeof variant.label !== 'string' || typeof variant.output !== 'string' || !variant.output.trim()) return null
    variants.push({ label: variant.label, output: variant.output })
  }
  return { title: example.title, variants }
}

/** Render only for a service with a reviewed example, beside (never inside) its selection button. */
export function ServiceOutputExample({ productCode, productName, className = '' }: {
  productCode: string
  productName: string
  className?: string
}) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const [state, setState] = useState<ExampleState>({ status: 'idle' })

  useEffect(() => () => { requestRef.current?.abort() }, [])

  function cancelRequest() {
    requestRef.current?.abort()
    requestRef.current = null
  }

  async function loadExample() {
    cancelRequest()
    const controller = new AbortController()
    requestRef.current = controller
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 12_000)
    setState({ status: 'loading' })
    try {
      // Examples are public reference data. Never attach an IMEI or order information.
      const response = await fetch(`/api/services/${encodeURIComponent(productCode)}/example`, {
        method: 'GET',
        credentials: 'omit',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (requestRef.current !== controller || controller.signal.aborted) return
      if (response.status === 404) {
        setState({ status: 'unavailable' })
        return
      }
      if (!response.ok) throw new Error('Example request failed')
      const example = readExample(await response.json())
      if (requestRef.current !== controller || controller.signal.aborted) return
      if (!example) throw new Error('Example response is incomplete')
      setState({ status: 'ready', productCode, example })
    } catch {
      // Closing the dialog is a cancellation, not an error to show on the next opening.
      if (requestRef.current !== controller || (controller.signal.aborted && !timedOut)) return
      setState({
        status: 'error',
        message: timedOut
          ? 'The example took too long to load. Please try again.'
          : 'We could not load this example. Please try again.',
      })
    } finally {
      window.clearTimeout(timeout)
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  function openExample() {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    titleRef.current?.focus({ preventScroll: true })
    if (state.status !== 'ready' || state.productCode !== productCode) void loadExample()
  }

  function closeExample() {
    cancelRequest()
    dialogRef.current?.close()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`service-output-example__trigger ${className}`.trim()}
        aria-haspopup="dialog"
        aria-controls={`${id}-dialog`}
        aria-label={`View example output for ${productName}`}
        onClick={(event) => { event.stopPropagation(); openExample() }}
      >
        <Icon name="file" />
        <span>View example output</span>
      </button>
      <dialog
        ref={dialogRef}
        id={`${id}-dialog`}
        className="service-output-example__dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={(event) => { event.preventDefault(); event.stopPropagation(); closeExample() }}
        onClose={() => { cancelRequest(); triggerRef.current?.focus({ preventScroll: true }) }}
        onKeyDown={(event) => {
          // A modal inside the service picker must not close that picker when Escape is pressed.
          event.stopPropagation()
          if (event.key === 'Escape') { event.preventDefault(); closeExample() }
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (event.target !== event.currentTarget) return
          const rect = event.currentTarget.getBoundingClientRect()
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeExample()
        }}
      >
        <div className="service-output-example__header">
          <div>
            <p className="service-output-example__eyebrow">Example output</p>
            <h2 ref={titleRef} id={`${id}-title`} tabIndex={-1}>{productName}</h2>
          </div>
          <button type="button" className="service-output-example__close" aria-label="Close example output" onClick={closeExample}>
            <Icon name="cross" />
          </button>
        </div>
        <div className="service-output-example__body" aria-busy={state.status === 'loading'}>
          <p id={`${id}-description`} className="service-output-example__notice">Sample only. Your result depends on the device and service.</p>
          {state.status === 'loading' || state.status === 'idle' ? (
            <p className="service-output-example__status" role="status">Loading example output…</p>
          ) : null}
          {state.status === 'unavailable' ? (
            <p className="service-output-example__status" role="status">An example is not available for this service yet.</p>
          ) : null}
          {state.status === 'error' ? (
            <div className="service-output-example__error">
              <p role="alert">{state.message}</p>
              <button type="button" className="button button--secondary" onClick={() => { void loadExample() }}>Try again</button>
            </div>
          ) : null}
          {state.status === 'ready' && state.productCode === productCode ? (
            <div className="service-output-example__outputs">
              <p className="service-output-example__output-title">{state.example.title}</p>
              {state.example.variants.map((variant, index) => (
                <section className="service-output-example__variant" key={`${variant.label}-${index}`}>
                  {state.example.variants.length > 1 ? <h3>{variant.label || `Example ${index + 1}`}</h3> : null}
                  {/* React escapes provider text: sample HTML is never executed. */}
                  <pre>{variant.output}</pre>
                </section>
              ))}
            </div>
          ) : null}
        </div>
        <div className="service-output-example__footer">
          <button type="button" className="button button--secondary" onClick={closeExample}>Back to service</button>
        </div>
      </dialog>
    </>
  )
}
