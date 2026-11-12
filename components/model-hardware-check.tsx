'use client'

import { useState } from 'react'
import type { iphoneHardwareSpecs } from '@/lib/data/iphone-hardware-specs'

type Hardware = (typeof iphoneHardwareSpecs)[number]
const markets = [
  ['us', 'United States'], ['canada', 'Canada'], ['japan', 'Japan'],
  ['globalUkEu', 'UK / EU'], ['chinaMainland', 'Mainland China'], ['hongKong', 'Hong Kong'],
] as const

export function ModelHardwareCheck({ model }: { model: Hardware }) {
  const [number, setNumber] = useState('')
  const normalized = number.trim().toUpperCase()
  const matches = markets.filter(([key]) => model.modelNumbers[key] === normalized)
  return <section className="requirements-card">
    <h2>Identify your {model.displayName} hardware</h2>
    <label htmlFor="variant-number">A-number from Settings → General → About</label>
    <input id="variant-number" value={number} maxLength={5} autoComplete="off"
      placeholder={model.modelNumbers.us} onChange={event => setNumber(event.target.value)}/>
    <div aria-live="polite">
      {normalized.length === 5 && (matches.length
        ? <ul>{matches.map(([region, label]) => <li key={region}>{label} · {model.simArchitecture[region]} · {region === 'us' ? model.fiveGBandsSummary.us : model.fiveGBandsSummary.international}</li>)}</ul>
        : <p>This number does not match the listed markets for {model.displayName}. Verify the model before ordering.</p>)}
    </div>
  </section>
}
