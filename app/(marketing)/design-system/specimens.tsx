import { Icon } from '@/components/icons'

/** A static rendering of the field, so the guide shows the valid state. */
export function ImeiFieldSpecimen() {
  return (
    <div className="spec-card">
      <div className="stage" style={{ padding: 26 }}>
        <div className="field" style={{ width: 290 }}>
          <label htmlFor="demo-imei">IMEI number</label>
          <input id="demo-imei" type="text" defaultValue="35 490912 345678 9" readOnly />
          <p className="field-note" data-state="valid">
            <Icon name="checkSmall" strokeWidth={2.2} />
            <span>Checksum looks right</span>
          </p>
        </div>
      </div>
      <div className="cap">
        <b>.field</b>
        <span>
          1px --line · radius 14 · min-h 50 · mono value at +.06em · label 11px w720 +.06em upper
          --muted · note carries the state colour
        </span>
      </div>
    </div>
  )
}
