# UX/UI, Conversion และ Performance Audit — unlockservice

วันที่ตรวจ: 6 กันยายน 2026 · ขอบเขต: โค้ดและการเปลี่ยนแปลงใน working tree รอบนี้

การแก้รอบนี้เน้นจุดที่ผู้ซื้อหลุดจากเส้นทางจริง: เลือกรายงานแล้วหายหลังเข้าสู่ระบบ, ต้องเลือกใหม่หลังเติมเงิน, ข้อมูลบริการไม่ตรงกับความพร้อมของระบบ และพื้นที่หน้าจอถูกเมนูหรือรายการสินค้าบัง
ผลที่ยืนยันจากโค้ดคือพฤติกรรมที่เปลี่ยนไป ส่วนผลต่อเวลาโหลดและยอดซื้อจำเป็นต้องวัดเพิ่มเติม
ยังไม่มี production latency, Core Web Vitals, traffic หรือ conversion analytics ที่ผู้ใช้ส่งมา จึงไม่ระบุเปอร์เซ็นต์ความเร็วหรือ conversion uplift และไม่ถือว่าการแก้ใน repository เป็นการขึ้น production แล้ว

## 1. UX/UI และ Conversion Triggers

| จุดติดขัดก่อนแก้ | พฤติกรรมหลังแก้ | หลักฐานใน repository |
|---|---|---|
| หน้าหลักยังเก็บ IMEI และประเทศเมื่อ unlock ปิด | แสดง `Browse phone reports` และ `Join the unlock waitlist` โดยไม่ต้องกรอกข้อมูลก่อน | [imei-form.tsx](../components/imei-form.tsx), [หน้าหลัก](../app/(marketing)/page.tsx) |
| การ์ด Unlock และ IMEI reports พาไปหน้ารวมเดียวกัน | เชื่อมตรงไปหมวดที่ผู้ใช้เลือก ลดการเลือกซ้ำ | [หน้าหลัก](../app/(marketing)/page.tsx) |
| ป้าย Available อ้างอิง JSON ขณะที่ checkout มีเงื่อนไข database/provider เพิ่ม | หน้าร้านใช้ความพร้อมและราคาปัจจุบันจากเงื่อนไขของ checkout; ไม่ส่ง supplier cost หรือ service ID ไปยัง component ลูกค้า | [public-provider-catalog.ts](../lib/public-provider-catalog.ts) |
| เลือกรายงานแล้วเข้าสู่ระบบกลับไปหน้าทั่วไป | คง `product` และปลายทางที่อนุญาตผ่าน login, register, verification, password reset และ Google | [continuation.ts](../lib/continuation.ts), [actions.ts](../lib/actions.ts), [auth-forms.tsx](../components/auth-forms.tsx) |
| รายงานที่เลือกถูกดันลงใต้รายการสินค้าทั้งหมด | แสดงชื่อ รายละเอียด ราคา และเวลาประมาณของรายงานก่อน; เปิดรายการอื่นผ่าน `Change report` | [paid-report-console.tsx](../components/paid-report-console.tsx) |
| ผู้ใช้เพิ่งทราบเงื่อนไขการเติมเงินในขั้นถัดไป | แจ้งยอดเครดิตที่ขาด วิธีจ่าย และการรอตรวจสอบ; ไม่มีขั้นต่ำเติมเงิน; หน้าเติมเงินคงบริการที่เลือกและเติมยอดเริ่มต้นให้ | [add-funds/page.tsx](../app/(app)/user/add-funds/page.tsx), [payment-forms.tsx](../components/payment-forms.tsx) |
| Invoice ไม่มีทางกลับไปซื้อรายงานเดิมหลังยืนยัน | เก็บปลายทาง เพิ่มปุ่มกลับไปรายงาน ปุ่มคัดลอก address และ refresh สถานะ | [invoice/page.tsx](../app/(app)/user/invoice/[reference]/page.tsx), [invoice-actions.tsx](../components/invoice-actions.tsx) |
| Homepage สัญญาส่งผลทาง email และใช้ refund copy ที่กำกวม | เอาสัญญา email ที่ยังไม่รองรับออกจากหน้าหลัก และระบุว่าคืน reserved credit เข้าบัญชี | [หน้าหลัก](../app/(marketing)/page.tsx), [credits.ts](../lib/credits.ts) |

### เส้นทางซื้อหลังแก้

1. เข้า catalog → ดูราคา ขอบเขตบริการ เวลาประมาณ และสถานะก่อนเลือก
2. เลือกรายงาน → เข้าสู่ระบบหากจำเป็น → กลับมารายงานเดิม
3. หากเครดิตไม่พอ → เห็นยอดเครดิตที่ขาดและ payment method โดยไม่มีขั้นต่ำเติมเงิน → สร้าง invoice
4. ส่งเงินตาม invoice → ส่ง transaction reference → รอ trusted confirmation → กลับมารายงานเดิม
5. เมื่อเครดิตพอจึงกรอก IMEI → Review → Confirm → รับสถานะและเปิด report history

การเติมเงินไม่ได้สั่งซื้อให้อัตโนมัติ ผู้ใช้ยังตรวจรายการและยืนยันก่อน reserve credit
รอบนี้ลดการสูญเสีย IMEI ในเส้นทางเติมเงินของ paid report ด้วยการขอ IMEI หลังมีเครดิตพอ ไม่ได้เพิ่มการเก็บ IMEI ระยะยาวหรือใส่ลง URL
เส้นทาง legacy unlock ใน [order-console.tsx](../components/order-console.tsx) ยังควรได้รับ draft/resume workflow แบบเดียวกันก่อนขยายการเปิดใช้งาน

### Copy ที่ควรใช้ให้สอดคล้องกัน

- ก่อนซื้อ: `See price and delivery time` และ `Review order · $X.XX` บอกขั้นตอนถัดไปตรงกับการกระทำ
- ก่อนเติม: ระบุยอดเครดิตที่จะได้ ค่าธรรมเนียม และยอดรวม แยกจากราคาของรายงาน
- เมื่อส่ง reference: อธิบายว่ากำลังตรวจสอบ และไม่ต้องส่งเงินซ้ำ; ปุ่ม refresh ไม่ได้ยืนยันเครดิตเอง
- เมื่อไม่สำเร็จ: `The reserved credit was returned to your account balance.`
- เมื่อผลไม่แน่นอน: ให้ตรวจ history หรือ retry request เดิม ไม่ชวนเริ่มคำสั่งซื้อใหม่ทันที

ยังควรตรวจ copy เรื่อง email และการรับประกันที่เหลือในหน้า legacy order ให้ครบทั้งระบบ รวมถึงแสดงหลักฐานหรือเงื่อนไขเฉพาะบริการก่อนกล่าวอ้างเรื่อง warranty, official unlock หรือเวลาให้บริการ
ไม่มีการเพิ่มรีวิว ตัวเลขลูกค้า หรือ trust badge ที่ยังไม่มีหลักฐาน

## 2. Frontend และ Responsive Architecture

### Layout และ Typography ที่แก้แล้ว

- ใช้ `minmax(0, 1fr)` และ `minmax(min(100%, ...), 1fr)` ใน grid เพื่อให้เนื้อหาหดได้ตามพื้นที่จริง
- Invoice เปลี่ยนจาก inline สองคอลัมน์คงที่เป็น `.invoice-grid` และเรียงคอลัมน์เดียวเมื่อพื้นที่แคบ
- Account navigation ย่อเป็นเมนูที่เปิดได้บนจอแคบ แสดงยอดเครดิตโดยไม่ให้ sidebar ยาวดัน checkout ลงทั้งหน้า
- Marketing navigation ยุบเร็วขึ้นที่ 1180px; เมนูเปิดมีความสูงจำกัดและเลื่อนได้
- Filter panel เลิก sticky เมื่อเลย์เอาต์ซ้อนกันที่ 1080px เพื่อคืนพื้นที่ให้ผลลัพธ์
- ปุ่มรองรับข้อความหลายบรรทัด, ข้อความยาวตัดบรรทัดได้ และไม่ตัดคำอธิบายการ์ดเหลือสองบรรทัด
- คงตระกูล `Inter`/system fallback; เปลี่ยนช่องกรอกทั่วไปจาก monospace เป็น body font และใช้ monospace กับตัวเลขที่จำเป็น
- ใช้ขนาดแบบ `rem`: input/select 1rem, label/button โดยทั่วไป 0.9375rem, helper text 0.875rem และหัวข้อใช้ `clamp()`
- ปรับ interactive controls หลายจุดเป็นพื้นที่อย่างน้อย 44px และเคารพ `prefers-reduced-motion`

ขนาดเหล่านี้เป็นค่าที่กำหนดใน CSS; ขนาดจริงขึ้นกับ root font และ browser settings ไม่ได้หมายความว่าเปลี่ยน breakpoint แล้วผ่าน accessibility ทุกข้อ
เป้าหมายการทดสอบ reflow คือเนื้อหาทั่วไปยังอ่านและใช้งานได้ที่ความกว้างเทียบเท่า 320 CSS px โดยไม่ต้องเลื่อนสองแกน; ตารางหรือเนื้อหาที่ต้องใช้สองมิติต้องประเมินแยกตามข้อยกเว้นของเกณฑ์ [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

### Snippet จาก CSS ที่ใช้งานจริง

จาก [styles/app.css](../styles/app.css):

```css
.invoice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 20px;
}

@media (max-width: 1180px) {
  .invoice-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

### Loading, Validation และ Recovery

Paid checkout ใช้ `aria-busy`, `aria-invalid`, `aria-describedby`, focus ไปยัง IMEI ที่ผิด และย้าย focus ไปยังหัวข้อ Review/ผลลัพธ์เมื่อเปลี่ยนขั้นตอน
การส่งคำสั่งซื้อมี client deadline 35 วินาทีและป้องกัน submit ซ้ำระหว่าง request กำลังทำงาน; deadline เป็นขอบเขตการรอของ browser ไม่ใช่การยกเลิกงานที่ server รับแล้ว
เมื่อไม่ทราบผล จะคง idempotency key และล็อกข้อมูลที่เปลี่ยนคำสั่งซื้อไว้ แม้ retry ภายหลังตอบ error; ปลดสถานะเมื่อได้ผลคำสั่งซื้อที่ยืนยันแล้ว
ยอดเครดิตใน console อัปเดตจาก response และ refresh ข้อมูลฝั่ง server หลังได้ผล เพื่อให้ยอดบัญชีสอดคล้องกัน
ข้อจำกัดที่ยังเหลือ: server ตรวจ provider readiness ก่อนอ่านผล idempotency เดิม หาก configuration เปลี่ยนระหว่างคำขอที่ยังไม่ทราบผล การ retry อาจถูกปฏิเสธ; ผู้ใช้ยังตรวจ report history ได้ และ UI ล็อกข้อมูลไว้เพื่อเลี่ยงคำสั่งซื้อใหม่โดยไม่ตั้งใจ
รายละเอียด: [paid-report-console.tsx](../components/paid-report-console.tsx)

### Snippet รักษาปลายทางหลัง Authentication

จาก [lib/continuation.ts](../lib/continuation.ts); ใช้คู่กับ `safeContinuation()` ทั้งไฟล์ซึ่งจำกัด path และ query ที่อนุญาต:

```ts
export function withContinuation(path: string, value: unknown): string {
  const next = safeContinuation(value)
  return next ? `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}` : path
}
```

ตัวอย่างผลลัพธ์: `/user/reports/new?product=APPLE_INFO&imei=...` จะเหลือเพียง `/user/reports/new?product=APPLE_INFO`
Invoice อนุญาตปลายทางรายงานที่ผ่านการตรวจอีกชั้นหนึ่ง เพื่อคงบริการหลัง session หมดอายุ โดยไม่เปิดรับ external redirect

## 3. Backend และ API Optimization

| ประเด็น | หลักฐานและสิ่งที่ทำ | ข้อจำกัดการสรุป |
|---|---|---|
| Browser กับ worker poll รายการเดียวกันพร้อมกันได้ | เพิ่ม lease ใน SQLite ก่อนติดต่อ provider; มี expiry และ token ตรวจเจ้าของตอน release | ลดการเรียกซ้อนสำหรับ resource เดียวภายในช่วง lease; ยังไม่มี benchmark production |
| Service map ถูก parse ซ้ำระหว่าง lookup | Cache ผล parse แยก IMEI/unlock; invalidate เมื่อค่า environment เปลี่ยน และ freeze object | เป็นการลดงานซ้ำที่ยืนยันจากโค้ด ไม่ใช่ตัวเลข latency ที่วัดแล้ว |
| หน้าร้านส่งข้อมูล provider มากเกินความจำเป็น | Public projection เลือกเฉพาะ customer fields และใช้ราคา/ความพร้อมร่วมกับ checkout | ยังต้องวัดขนาด HTML/RSC payload ก่อน–หลัง |
| งาน authentication ใช้ `scryptSync` และลบ session หมดอายุเมื่อสร้าง session | ยังเป็นจุดที่ควร profile ภายใต้ concurrent sign-in | เป็นความเสี่ยงที่ต้องวัด ไม่ได้ยืนยันว่าเป็นคอขวดหลักใน production |
| Worker script มีอยู่แล้วและประมวลผลรายการตามลำดับ | [provider-jobs.ts](../lib/provider-jobs.ts), [poll-provider-jobs.ts](../scripts/poll-provider-jobs.ts) | ยังไม่ได้ยืนยัน scheduler, queue lag หรือ throughput ของระบบจริง |

การคงสถานะ processing/เครดิตเมื่อเกิด transient provider polling failure เป็นพฤติกรรมที่ปลอดภัยอยู่เดิม รอบนี้เพิ่ม regression coverage และการป้องกัน poll ซ้อน ไม่ควรรายงานว่าเป็นการแก้ refund จาก transient failure

### Snippet ป้องกัน Poll ซ้อน

ส่วนการ claim จาก [provider-poll-lease.ts](../lib/provider-poll-lease.ts):

```ts
  const now = Date.now()
  const token = randomUUID()
  const expiresAt = now + providerConfiguration().timeoutMs + 5_000
  const claimed = db().prepare(`
    INSERT INTO provider_poll_leases (resource_type, resource_id, token, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(resource_type, resource_id) DO UPDATE
      SET token = excluded.token, expires_at = excluded.expires_at
      WHERE provider_poll_leases.expires_at <= ?
  `).run(resource, id, token, expiresAt, now)
  if (claimed.changes !== 1) return null
```

ใช้ร่วมกับ schema ใน [db.ts](../lib/db.ts) และ release callback ในไฟล์เต็ม; callback ลบเฉพาะ token ของตัวเอง จึงไม่ลบ lease ใหม่ที่มาแทนหลัง expiry
จุดเรียกอยู่ใน [orders.ts](../lib/orders.ts), [imei-checks.ts](../lib/imei-checks.ts), [paid-reports.ts](../lib/paid-reports.ts)

### Caching และ Background Work ที่ควรทำต่อ

Nonce-based CSP ปัจจุบันอ่าน header ใน root layout จึงผูกการ render กับ request; Next.js ระบุว่า nonce ต้องใช้ dynamic rendering และไม่สามารถใช้ static/CDN caching แบบเดิมได้โดยตรง [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy)
ควรแยก public data cache ออกจาก session/balance และกำหนด invalidation เมื่อราคา/availability เปลี่ยนก่อนพิจารณา CDN สำหรับ marketing HTML
อย่า cache response ของบัญชี เครดิต invoice หรือ CSRF ร่วมกันระหว่างผู้ใช้
หากผลวัดชี้ว่า provider เป็นเวลาส่วนใหญ่ ให้รับงานและคืน order ID ก่อน จากนั้น worker ประมวลผลและ status endpoint อ่านสถานะที่เก็บไว้; การออกแบบต้องคง idempotency และ settlement transaction เดิม
การส่ง email ผลลัพธ์ควรผ่าน transactional outbox พร้อม retry และสถานะล้มเหลว ก่อนนำคำสัญญา email กลับมาใช้ใน UX

## 4. Execution Roadmap และการวัดผล

### งานที่ทำแล้วในรอบนี้

| ลำดับ | ผลลัพธ์ที่ตรวจจากโค้ดได้ |
|---|---|
| P1 | รักษา product/ปลายทางผ่าน auth และ funding รวม password recovery และ invoice หลัง session หมดอายุ |
| P1 | แสดง readiness จาก runtime ก่อนเปิด CTA ซื้อ และยกเลิกขั้นต่ำเติมเงินและเปิดเผยเงื่อนไขการชำระเงินก่อนเติม |
| P1 | ป้องกันแก้คำสั่งซื้อระหว่างส่งหรือยังไม่ทราบผล และใช้ request key เดิมเมื่อลองซ้ำ |
| P2 | ปรับ responsive navigation, invoice grid, typography, focus และข้อความอธิบายสถานะ |
| P2 | เพิ่ม poll lease, service-map cache และ regression tests ที่เกี่ยวข้อง |

### Quick Wins ที่ยังเหลือ

เวลาทั้งหมดด้านล่างเป็นประมาณการสำหรับนักพัฒนาที่คุ้นเคยกับระบบ รวมการตรวจสอบเบื้องต้น แต่ไม่ใช่กำหนดส่งหรือเวลาที่ใช้จริง

| ลำดับ | งานถัดไป | ประมาณการ | วิธีตรวจผล |
|---|---|---|---|
| P1 | เก็บ funnel events และ request/provider timing ด้วย payload ที่จำกัดข้อมูล | 1–2 วัน | เชื่อมขั้นตอนถึง order ที่ server ยอมรับได้ และไม่มีข้อมูลอ่อนไหวใน event |
| P1 | ตรวจ copy/trust claim ในหน้า legacy unlock และเชื่อม support จากทุก error/empty state | 0.5–1 วัน | ผู้ใช้ทราบขั้นถัดไปและไม่มีคำสัญญาเกินพฤติกรรมจริง |
| P2 | เพิ่มตัวอย่าง report ที่ปกปิดข้อมูล และอธิบายสิ่งที่แต่ละรายงานตรวจได้ก่อนซื้อ | 1–2 วัน | ทดสอบความเข้าใจบริการก่อนวัดผลต่อ review/order |
| P2 | เพิ่ม coverage การใช้งาน keyboard, zoom, rotation และอุปกรณ์จริงตามช่องว่าง QA | 1–2 วัน | ไม่มีข้อมูลหรือปุ่มสำคัญหายจาก viewport ที่ทดสอบ |

### Structural Updates ที่ยังเหลือ

| ลำดับ | งานถัดไป | ประมาณการ | เงื่อนไขสำคัญ |
|---|---|---|---|
| P1 | ลด friction ของ wallet: USDT BEP-20 และ manual review; ออกแบบ payment confirmation ที่ตรวจสอบได้ | 3–7 วันขึ้นไป | ต้องเลือก provider/วิธีจ่ายและทราบ settlement contract; ตรวจ credit idempotency |
| P1 | Durable worker พร้อม schedule, bounded concurrency, backoff และ monitoring ของรายการค้าง | 2–4 วัน | วัด provider rate limits และ backlog ก่อนตั้ง concurrency |
| P1 | Checkout intent/resume สำหรับ legacy unlock และกรณีซื้อข้ามอุปกรณ์ | 2–3 วัน | กำหนด expiry, privacy และยืนยัน order หลังกลับมาเสมอ |
| P2 | Transactional outbox สำหรับแจ้งผลและแจ้งปัญหา | 2–3 วัน | ตรวจการส่งจริง/ซ้ำ/ล้มเหลวก่อนแสดง email promise |
| P2 | แยก marketing cache/render strategy และปรับ auth งาน synchronous ตาม profiling | 2–5 วัน | ตรวจความเข้ากันได้กับ Next.js เวอร์ชันใน repo และ CSP; ไม่ลดการป้องกันเพื่อแลกคะแนน |

### Metrics ที่ต้องเริ่มเก็บ

Funnel: `product_selected → auth_completed → checkout_viewed → funds_needed → invoice_created → payment_submitted → credit_confirmed → checkout_resumed → order_reviewed → order_accepted → order_delivered`
ผู้ใช้ที่มีเครดิตอยู่แล้วข้าม funding events ได้ จึงต้องแยก cohort นี้ก่อนคำนวณ drop-off
นับ accepted order, credit confirmation, delivered/refunded จาก server transition และ deduplicate event; client click เพียงอย่างเดียวไม่ใช่ยอดซื้อ
แยกผลตาม device class, authentication method, product และลูกค้าใหม่/เดิม พร้อมวัดเวลาแต่ละขั้น
วัด application/API/provider p50 และ p95, request count, queue age และ Core Web Vitals แยกจาก fulfillment time
Guardrails: duplicate order/charge, manual review, refund, validation error และจำนวนติดต่อ support
ห้ามส่ง IMEI, email, wallet address, transaction reference, credential หรือ raw query string ไป analytics
กำหนดเป้าหมายการปรับปรุงหลังมี baseline และปริมาณตัวอย่างที่เพียงพอ ไม่ตีความผล local test เป็น conversion uplift

### ขอบเขต Validation และสถานะผล

| รายการ | สถานะสำหรับบันทึกผลรอบสุดท้าย |
|---|---|
| Scoped lint และ diff check ของ homepage/IMEI CTA | ผ่านในการตรวจเฉพาะสองไฟล์; ยังต้องอ้างผลรวมด้านล่าง |
| `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` | ผ่าน `npm run lint`, `npm run typecheck`, `npm run build`; regression 35/35 ผ่านด้วย `node --import tsx --test tests/*.test.ts` (รัน test เดียวกับ npm test โดยเลี่ยง IPC socket ที่ sandbox ไม่อนุญาต) |
| Browser QA: 320/390/768/1024/1440px; light/dark และเมนู | Home และ invoice ไม่ล้นแนวนอนที่ 320/390/768/1024/1440px; report ที่ 390px ใช้ input 16px, menu เปิด/ปิดด้วย Escape และคืน focus; catalog dark ที่ 768px ไม่ sticky และไม่มี CTA ซื้อเมื่อ provider ปิด |
| Flow QA: product → auth → funding → invoice → resume → review; invalid input และ uncertain response | QA รอบก่อนยกเลิกขั้นต่ำ — Production build บน localhost ใช้บัญชี/เครดิต/provider จำลอง: login คง APPLE_BASIC → invoice $5+$0.10 fee → ส่ง reference → ยืนยันผ่าน backend จำลอง → กลับรายงานเดิม → validation/focus → confirm → report completed; ยอดเครดิตทุกตำแหน่ง $5 → $4.95 |
| Production performance/conversion | ไม่ได้รับข้อมูล ไม่มีผลเปรียบเทียบที่ยืนยันได้ |

Regression tests ที่เพิ่มครอบคลุม continuation allowlist, invoice continuation, service-map invalidation, poll lease ownership/expiry, overlapping provider calls, ledger settlement และ runtime catalog projection
ไฟล์ทดสอบ: [continuation.test.ts](../tests/continuation.test.ts), [provider-reliability.test.ts](../tests/provider-reliability.test.ts), [provider-api.test.ts](../tests/provider-api.test.ts)
การทดสอบ provider แบบ mock ยืนยัน logic และจำนวนคำขอในสถานการณ์ที่กำหนด ไม่ยืนยันเวลาตอบจริงของ provider หรือการรับเงินจริง


### ผลทดสอบคำตอบขาดหาย

ทดสอบผ่าน local fault-injection proxy: คำขอแรกสำเร็จที่ server แต่ตัด response ทิ้ง, retry ครั้งถัดไปตอบ 403 ก่อนทำงาน, retry ครั้งสุดท้ายคืนผลเดิม
UI คงช่อง IMEI และปุ่มแก้ไขในสถานะล็อกจนได้ผลยืนยัน; ทั้ง 3 คำขอใช้ idempotency key เดียว
ตรวจ SQLite fixture พบ order เดียว, hold 1 ครั้ง และ charge 1 ครั้ง; ไม่มี provider หรือเงิน production เกี่ยวข้อง
ทดสอบการคงปลายทาง password recovery/OTP/Google ด้วย code review และ allowlist regression; ยังไม่ได้ทดสอบส่ง email หรือ OAuth กับบริการจริง
Browser ทดสอบผ่าน Codex in-app browser; ไม่ใช่การทดสอบ Safari/iOS/Android บนอุปกรณ์จริงหรือการรับรอง accessibility ทั้งระบบ

### ขนาด JavaScript จาก production build

หน้าแรก First Load JS ประมาณ 109 kB; หน้า paid report ประมาณ 111 kB ตาม Next.js build report ของรอบนี้
เป็นขนาด bundle ที่ build รายงาน ไม่ใช่เวลาโหลดจริงหรือผล before/after


### ปรับนโยบายเติมเงิน: ไม่มีขั้นต่ำ

ยกเลิกขั้นต่ำ $5 ตามคำขอ: invoice ใหม่รับยอด USD ที่มากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่งตามระบบ integer cents เดิม
หน้าเติมเงินเสนอเฉพาะยอดเครดิตที่ขาดของรายงาน เช่น $0.05; หน้าเติมเงินทั่วไปเริ่มช่องยอดว่างให้ผู้ใช้ระบุเอง
ทั้ง UI และ server ใช้เงื่อนไขเดียวกัน คงวงเงินสูงสุดเดิม $10,000 และการปัดค่าธรรมเนียมเป็นเซนต์
Invoice เดิมยังคงยอดที่ล็อกไว้ และเครดิตเข้าหลัง trusted confirmation ตามเดิม

Validation หลังยกเลิกขั้นต่ำ: lint, typecheck และ production build ผ่าน; 35 tests ผ่าน รวม invoice $0.01/$0.05/$0.25/$4.99, ค่าธรรมเนียมที่ปัดเป็นเซนต์, การปฏิเสธยอดไม่ถูกต้อง และการยืนยันซ้ำไม่เพิ่มเครดิตซ้ำ
Browser QA ใน local fixture ยืนยันยอดขาด $0.05 ถูกกรอกล่วงหน้า, invoice $0.05 + fee $0.00 สร้างสำเร็จ และยอด $0 ถูกปฏิเสธโดย server; ไม่มีการโอนเงินจริง
