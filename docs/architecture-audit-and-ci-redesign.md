# iUnlockMobile — Architecture Audit & CI Redesign

เอกสารนี้บันทึก **baseline ก่อนแก้โค้ด** ตามที่เจ้าของระบบกำหนด และเสนอทิศทาง Corporate Identity
สองทางเลือกเพื่อขออนุมัติ ก่อนเริ่มงาน visual redesign

| | |
| --- | --- |
| Repository | `minerelx168-sketch/unlockservice` |
| Deploy branch | `claude/website-design-patterns-5043ix` @ `7781840` |
| Audit branch | `feat/architecture-audit-and-ci-redesign` |
| วันที่ | 2026-09-01 |
| Baseline checks | `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` ✅ 11/11 · `npm run build` (ดูหมายเหตุ) |

> **ยังไม่มีการแก้ไขโค้ดของแอปพลิเคชันในคอมมิตนี้** — มีเพียงเอกสารฉบับนี้

---

## 0. ข้อจำกัดของการตรวจครั้งนี้ (อ่านก่อน)

สองอย่างที่ **ตรวจไม่ได้** จากสภาพแวดล้อมนี้ และไม่ควรถือว่าผ่านการตรวจแล้ว:

1. **`https://mobileunlocks.com/` เข้าไม่ได้** — network egress proxy ตอบ `403 CONNECT tunnel failed`
   (policy denial) ผมจึง **ไม่ได้เห็นเว็บไซต์อ้างอิงเลย** และจะไม่แต่งผลการสำรวจขึ้นมา
   ข้อเสนอ CI ในหัวข้อ 7 จึงสร้างจาก **บรีฟที่เจ้าของเขียนไว้เอง** (dark navy/deep blue base,
   electric blue/cyan/teal accent อย่างมีวินัย, light neutral surfaces, semantic colours แยกจาก brand)
   ไม่ใช่จากการสังเกตเว็บอ้างอิง
2. **`https://iunlockmobile.com` เข้าไม่ได้ด้วยเหตุผลเดียวกัน** — จึงยืนยันไม่ได้ว่า production
   ตั้ง `IUNLOCKMOBILE_MAINTENANCE=1` และ `IUNLOCKMOBILE_PROVIDER_MODE=disabled` จริงหรือไม่
   ดู **F-B01** ซึ่งเป็นประเด็นวิกฤตที่เกี่ยวข้องโดยตรง

สิ่งที่ต้องขอจากเจ้าของระบบเพื่อปิดช่องว่างนี้ อยู่ในหัวข้อ 12

---

## 1. Executive Summary

โค้ดฐานนี้มีคุณภาพสูงกว่าที่คาดสำหรับระบบขนาดนี้ — prepared statements ทุกจุด, scrypt +
`timingSafeEqual`, Google OAuth ทำถูกทั้ง PKCE/state/nonce/JWKS, provider client ป้องกัน SSRF
ไว้ดี (https-only, `redirect: 'error'`, timeout, size cap, secret redaction), เงินเป็น integer cents,
และ escrow ledger มี unique index กัน replay อยู่แล้วบางส่วน

ปัญหาที่พบไม่ใช่ "เขียนผิด" แต่เป็น **ช่องว่างที่ยังไม่ได้ปิด** และกระจุกอยู่สามที่:

| กลุ่ม | สาระ |
| --- | --- |
| **การกำกับ production** | ไม่มี `EnvironmentFile` ในไฟล์ systemd ที่ repo ส่งไป → ธงความปลอดภัยที่เจ้าของสั่งให้คงไว้ **ไม่มีที่ให้ตั้ง** และ `activeSupplier()` จะ fall back ไปที่ mock ที่ *ปลอมรหัสปลดล็อก* เมื่อ provider ปิด |
| **ความสมบูรณ์ของเงิน** | `refund`/`hold` ไม่อยู่ใน unique index ที่กัน replay → พิสูจน์ได้ว่าการ refund ซ้ำถูกยอมรับ และไป **ปลดล็อก hold ของออร์เดอร์อื่น** |
| **Funnel และความเป็นส่วนตัว** | ฟอร์มหน้าแรกส่ง **raw IMEI ผ่าน query string** ไป `/register` ซึ่ง **ไม่อ่านค่านั้นเลย** — ทั้งรั่วและทั้งทำให้ลูกค้าต้องกรอกใหม่ |

สรุปตัวเลข: **Critical 4 · High 11 · Medium 22 · Low 11** (frontend 18 · backend 30)

**ยังไม่ควรเปิดรับเงินหรือปลดล็อกจริง** จนกว่า Critical ทั้งสามจะปิด

---

## 2. Current Architecture Map

### 2.1 Route ownership

```
app/layout.tsx ······················ theme guard (inline script), font preload, metadata
│
├── (marketing)/layout.tsx ·········· SiteHeader + SiteFooter · currentSession() → isAuthenticated
│   ├── /                            homepage (Server) → ImeiForm (Client)
│   ├── /check                       Phone Check (Server) → ImeiCheckForm (Client, ต้องล็อกอิน)
│   └── /design-system               living style guide
│
├── (auth)/layout.tsx ··············· .auth-page เปล่า — ไม่มี header/footer
│   ├── /login /register             redirect ออกถ้ามี session · auth-forms.tsx (Client)
│   ├── /forgot-password /reset-password /verify-email
│   ├── /privacy /terms
│   └── /auth/google · /auth/google/callback   route handlers (OAuth)
│
├── (app)/layout.tsx ················ currentSession() → redirect('/login') · sidebar · <meta csrf>
│   ├── /user/dashboard /unlock /orders /orders/[id] /checks /checks/[id]
│   ├── /user/add-funds /payments /invoice/[reference]
│   └── /admin                       requireAdmin() — read-only
│
└── api/
    ├── /api/health                  ไม่ต้องยืนยันตัวตน · เปิด DB + creditIntegrity()
    ├── /api/orders           POST   guard() → submitOrder()
    ├── /api/orders/status    POST   guard() → pollOrder()
    ├── /api/imei/checks      GET|POST
    └── /api/imei/checks/[id] GET|POST
```

### 2.2 Module ownership

| Layer | Modules | หน้าที่ |
| --- | --- | --- |
| Identity | `auth.ts` · `account-security.ts` · `google-oauth.ts` · `rate-limit.ts` | password, session, RBAC, OTP, OAuth, attempt window |
| Money | `credits.ts` · `payments.ts` · `money.ts` | escrow ledger, invoice, integer cents |
| Fulfilment | `orders.ts` · `provider.ts` · `provider-api.ts` · `provider-jobs.ts` · `provider-events.ts` | order pipeline, supplier adapter, audit |
| Reports | `imei-checks.ts` · `imei-check-provider.ts` · `imei.ts` | free check, HMAC fingerprint, Luhn |
| Data | `db.ts` · `catalog.ts` · `admin.ts` | schema + additive migrations + seed |
| UI system | `styles/tokens → fonts → base → components → app` | ทุกสีอยู่ที่ tokens.css ที่เดียว |

### 2.3 Client component surface (8 ไฟล์)

`site-header` · `app-nav` · `theme-toggle` · `auth-forms` · `imei-form` · `imei-check-form` ·
`order-console` · `payment-forms` — ที่เหลือเป็น Server Components ทั้งหมด

### 2.4 Financial invariant ที่ต้องรักษา

```
available = credit_cents − held_cents

hold   : held +p                     ledger −p  affects_balance = 0
charge : held −p, credit −p          ledger −p  affects_balance = 1
refund : held −p                     ledger +p  affects_balance = 0
topup  :         credit +p           ledger +p  affects_balance = 1

creditIntegrity(): SUM(amount WHERE affects_balance=1) must equal users.credit_cents
```

`/api/health` ตรวจ invariant นี้ทุกครั้ง และคืน 503 เมื่อไม่ตรง — เป็นการออกแบบที่ถูกต้องมาก

---

## 3. Frontend Findings

| ID | Severity | ตำแหน่ง | ประเด็น |
| --- | --- | --- | --- |
| F-F01 | **Critical** | `app/(marketing)/page.tsx` FAQ + SERVICES + BAND_ROWS | สำเนาอ้างว่า "submit the official request against your IMEI", "recorded against the IMEI in the carrier or manufacturer database", "Most services complete within hours" ขณะที่ provider ต้อง disabled และคำสั่งที่ให้ไว้ห้ามอ้าง carrier/provider ในสถานะนี้ |
| F-F02 | **High** | `components/imei-form.tsx:170` | ส่ง raw IMEI + country + carrier ผ่าน query string → เข้า Caddy access log, `Referer`, ประวัติเบราว์เซอร์ ขัดกับหลัก "ไม่เก็บ raw IMEI" ของระบบเอง |
| F-F03 | **High** | `app/(auth)/register/page.tsx` | ไม่อ่าน `imei`/`country`/`carrier` ที่หน้าแรกส่งมาเลย → ลูกค้ากรอกซ้ำทั้งหมด funnel ขาดตรงจุดที่ตั้งใจให้ต่อเนื่อง |
| F-F04 | **High** | `components/imei-form.tsx:29-49` | `MARKETS` hardcode 4 ประเทศ 16 carriers ใน client ไม่ตรงกับ `lib/catalog.ts` (20 carriers) → ราคาที่สัญญาไว้หน้าแรกกับที่สั่งได้จริงไม่ตรงกัน มี source of truth สองที่ |
| F-F05 | **High** | ทั้ง `app/` | ไม่มี `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx` เลยสักไฟล์ → ทุก throw กลายเป็นหน้าขาว/สแต็กเริ่มต้นของ Next.js ไม่มี branded recovery |
| F-F06 | Medium | `components/site-header.tsx:1` | ทั้ง header เป็น `'use client'` เพียงเพื่อ toggle เมนูและ `usePathname` → Brand + Icon + NAV ทั้งชุดถูกส่งลง bundle |
| F-F07 | Medium | `components/site-header.tsx:48` | `aria-current` เทียบ `href === pathname` แต่ 4 ใน 5 ลิงก์เป็น hash (`/#check`) จึงไม่มีวัน active → ผู้ใช้ screen reader ไม่รู้ตำแหน่ง |
| F-F08 | Medium | `styles/base.css:64` | focus ring ใช้ `var(--primary)` ซึ่งเป็นสีเดียวกับพื้นปุ่ม primary → โฟกัสบนปุ่มหลักมองไม่เห็น ยังไม่มี `--color-focus` แยก |
| F-F09 | Medium | `styles/tokens.css` `--line: #e4e2d9` | ขอบ `input`/`select` ได้ contrast ~1.2:1 กับพื้นขาว ต่ำกว่า WCAG 2.2 **1.4.11 Non-text Contrast (3:1)** — README อ้าง AA แต่ตรวจเฉพาะข้อความ |
| F-F10 | ~~Medium~~ **ตรวจแล้ว: ผ่าน** | `styles/*` | breakpoint ต่ำสุดคือ 620px จึงตั้งข้อสงสัยไว้ แต่วัดจริงใน Chromium ที่ 1280 / 390 / **320px** แล้ว `scrollWidth` เท่ากับ `innerWidth` ทุกความกว้าง — ไม่มี horizontal overflow ปิดประเด็นนี้ |
| F-F11 | Medium | `components/imei-check-form.tsx:118` | แสดง `badge--success` เสมอ แม้ `status` จะเป็น `unavailable` → บอกผลผิด |
| F-F12 | Medium | `app/(app)/layout.tsx:26` | CSRF token ถูกเขียนลง DOM (`<meta>`) — จำเป็นตามสถาปัตยกรรมเดิม แต่ยังไม่มี CSP จึงไม่มีชั้นกันหากเกิด XSS |
| F-F13 | Medium | `app/(app)/user/orders/page.tsx` | ไม่มี pagination ฝั่ง server (`listOrders` limit 50) — บัญชี reseller จะเห็นไม่ครบ |
| F-F14 | Low | `components/site-footer.tsx:12-17` | ลิงก์ Services ทั้ง 3 ชี้ `/#services` เหมือนกันหมด |
| F-F15 | Low | `app/(auth)/layout.tsx` | หน้า auth ไม่มี header/footer และไม่มีทางกลับหน้าแรกนอกจากโลโก้ |
| F-F16 | Low | `app/` | ไม่มี `robots.ts`/`sitemap.ts`/OpenGraph image |
| F-F17 | Low | `components/order-console.tsx:145-158` | เรียก `router.refresh()` สามจุด อาจซ้อนกันระหว่าง poll |
| F-F18 | Low | `app/(marketing)/layout.tsx` | เรียก `currentSession()` แล้วส่งต่อทั้ง header และ footer — ปัจจุบันเรียกครั้งเดียว ถูกต้องแล้ว แต่หน้า `/check` เรียก `currentSession()` ซ้ำอีกรอบใน page |

### พบเพิ่มระหว่างลงมือแก้ (จากการเปิดเว็บจริงใน Chromium ไม่ใช่จากการอ่านโค้ด)

| ID | Severity | ตำแหน่ง | ประเด็น | สถานะ |
| --- | --- | --- | --- | --- |
| F-F19 | **High** | `components/auth-forms.tsx` `GoogleAuthOption` | ปุ่ม Google เป็น `next/link` แต่ `/auth/google` ไม่ใช่หน้า — มันสร้าง OAuth transaction เขียนแถวลง DB และ set cookie Next prefetch ลิงก์ที่อยู่ในจอ **ทุกคนที่แค่เปิดหน้า login จึงเปิด transaction ใหม่หนึ่งรายการ** และ prefetch ที่มาถึงระหว่าง flow จริงจะทับ cookie ที่ flow นั้นใช้อยู่ | แก้แล้ว — เปลี่ยนเป็น `<a>` |
| F-F20 | Medium | `components/auth-forms.tsx` username field | `pattern="[A-Za-z0-9._-]+"` ไม่ถูกต้องภายใต้ `v` flag ที่ browser ใช้คอมไพล์ attribute นี้ → เบราว์เซอร์ทิ้งทั้ง attribute และ **ไม่ตรวจ field เลย** (ฝั่ง server ยังตรวจอยู่ จึงเป็นการเสีย client-side check เงียบ ๆ ไม่ใช่ช่องโหว่) | แก้แล้ว — escape `\-` |
| F-F21 | Low | `styles/app.css` | `.alert--success` ถูกอ้างถึงใน `auth-forms.tsx` แต่ **ไม่มี CSS** → ข้อความว่า "สำเร็จ" แสดงด้วยสีเหลืองอำพันของ warning | แก้แล้ว |
| F-B31 | Medium | `deploy/deploy.sh` · unit | ไม่มี `EnvironmentFile` ทำให้ธงทั้งหมดไม่มีที่ตั้ง (นี่คือ F-B01) และไม่มีขั้นตอนสร้างไฟล์นั้นในสคริปต์ deploy เลย | แก้แล้ว |
| F-F22 | Medium | `styles/components.css` 693-694, 770, 781, 820 · `styles/app.css` 636 | README ระบุว่า "Tokens are the only place a colour is written · No component hard-codes a hex" แต่**ไม่จริง** — มี 5 จุดที่ hardcode สี (radial wash ของ hero, พื้น `.band` `#0d3b29`, `.band .kicker`, `.band-row svg`, และ fallback ของ `--shadow-xs` ที่ token นั้นไม่มีอยู่จริง) ทำให้เปลี่ยน palette แล้วสีเดิมค้าง | แก้แล้ว — tokenise ครบ ตอนนี้ `grep` หา hex นอก `tokens.css` ได้ศูนย์รายการ |
| F-F23 | Medium | `styles/base.css` focus | `:focus-visible` มี specificity เท่ากับ `.button--primary` และอยู่ก่อนใน source order → **box-shadow ของปุ่มทับ focus ring** บนปุ่มหลักของทุกหน้า | แก้แล้ว — two-ring + specificity ที่ชนะ |

### หมายเหตุ Content UX

`maintenance` และ `provider-disabled` มีข้อความอยู่แล้วใน `order-console` และ `/check` แต่
**หน้าแรกไม่แสดงสถานะทั้งสองเลย** ลูกค้าจึงเดินทั้ง funnel มาถึงปลายทางแล้วค่อยเจอว่าสั่งไม่ได้ (High UX,
รวมอยู่ใน F-F01)

---

## 4. Backend Findings

| ID | Severity | ตำแหน่ง | ประเด็น |
| --- | --- | --- | --- |
| F-B01 | **Critical** | `deploy/unlockservice.service` · `deploy/deploy.sh` | **ไม่มี `EnvironmentFile=` และไม่มีการตั้ง env ใด ๆ นอกจาก `NODE_ENV`, `PORT`, `IUNLOCKMOBILE_DB`** → `IUNLOCKMOBILE_MAINTENANCE`, `IUNLOCKMOBILE_PROVIDER_MODE`, `RESEND_API_KEY`, `GOOGLE_CLIENT_*`, `IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET`, `IUNLOCKMOBILE_USDT_BEP20_ADDRESS` **ไม่มีที่ให้ตั้งเลยในสิ่งที่ repo ส่งขึ้นเซิร์ฟเวอร์** invariant ที่เจ้าของสั่งให้คงไว้จึงไม่ได้ถูกบังคับด้วยไฟล์ใดในระบบ |
| F-B02 | **Critical** | `lib/provider.ts:212` `activeSupplier()` | เมื่อ provider ไม่ enabled จะ fall back ไป `mockSupplier` **ทุกกรณี รวมถึง production** — mock สร้างรหัสปลดล็อกจาก hash ของ IMEI แล้วระบบ **charge เครดิตจริง** ไม่มี guard ตาม `NODE_ENV` เลย ถ้า `IUNLOCKMOBILE_MAINTENANCE` ไม่ได้ตั้ง (ดู F-B01) นี่คือการเก็บเงินแลกรหัสปลอม |
| F-B03 | **Critical** | `lib/credits.ts` + `db.ts` unique index | `credit_ledger_unique_effect` ครอบเฉพาะ `affects_balance = 1` แต่ `hold`/`refund` เขียน `0` → **replay ได้** พิสูจน์แล้วด้วยสคริปต์: refund ซ้ำถูกยอมรับ และไปปลด hold ของออร์เดอร์อื่น จนออร์เดอร์นั้น charge ไม่ได้อีกเลย |
| F-B04 | **High** | `lib/orders.ts:428` `settleDelivered` | `charge()` แล้วค่อย `UPDATE orders` เป็นคนละ transaction และ `WHERE id = ?` ไม่มี `AND status='processing'` → ถ้าโปรเซสตายคั่นกลาง เงินถูกหักแล้วแต่ออร์เดอร์ยังเป็น `processing` รอบถัดไปจะ charge ซ้ำและชน unique index → ออร์เดอร์ค้างถาวรทั้งที่เก็บเงินไปแล้ว |
| F-B05 | **High** | `lib/orders.ts:307` `submitOrder` | `INSERT orders` → `hold()` → ถ้า hold ล้มเหลวจึง `DELETE` เป็น compensating action นอก transaction ไม่ atomic |
| F-B06 | **High** | `app/api/orders/route.ts` | ไม่มี idempotency key (ทั้งที่ `invoices` และ `imei_checks` มีแล้ว) → ดับเบิลคลิก/retry = สองออร์เดอร์ สอง hold และมีต้นทุน supplier จริงสองครั้ง |
| F-B07 | **High** | `lib/payments.ts:162` `selfApprovalEnabled()` | `... \|\| process.env.NODE_ENV !== 'production'` เป็น **fail-open**: ถ้า `NODE_ENV` หลุดหาย ผู้ใช้ทุกคนกดอนุมัติ invoice ของตัวเองได้ = สร้างเครดิตเอง |
| F-B08 | **High** | `lib/imei-checks.ts:60` | `FINGERPRINT_SECRET` fallback เป็นสตริงคงที่ `'local-imei-check-fingerprint-v1'` ที่อยู่ในซอร์ส → HMAC ที่ใช้กุญแจสาธารณะ ย้อนกลับได้ด้วย brute force (ช่องว่าง serial ต่อ TAC เพียง 10^6) เจตนา "ไม่เก็บ raw IMEI" จึงถูกทำให้เป็นโมฆะ |
| F-B09 | **High** | `lib/google-oauth.ts:236` `linkGoogleIdentity` | ผูกบัญชีด้วย email ที่ตรงกัน โดยไม่พิสูจน์ว่าเจ้าของบัญชีเดิมคือคนเดียวกัน + `IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION` เป็น opt-in (ปิดโดยปริยาย) → **pre-hijacking**: ผู้โจมตีสมัครด้วยอีเมลเหยื่อล่วงหน้า เหยื่อล็อกอิน Google แล้วเข้ามาใช้บัญชีเดียวกับผู้โจมตี |
| F-B10 | **High** | `deploy/Caddyfile` | ไม่มี `Content-Security-Policy` (คู่กับ F-F12), ไม่มี `Permissions-Policy`, ไม่มี `Cross-Origin-Opener-Policy` และไม่มี rate limit ชั้นขอบ |
| F-B11 | Medium | `lib/api.ts:27` `guard()` | ไม่ตรวจ `Origin` header เลย พึ่ง CSRF token + `SameSite=lax` เท่านั้น |
| F-B12 | Medium | `lib/auth.ts:88` `authenticate()` | rate limit ผูกกับ identity อย่างเดียว ไม่มีตัวนับต่อ IP → password spraying ข้ามหลายบัญชีไม่ถูกจำกัด |
| F-B13 | Medium | `lib/auth.ts` sessions | ไม่มีการลบ session ที่หมดอายุ (ตารางโตทางเดียว) และไม่มี session rotation ตอน login |
| F-B14 | Medium | `app/api/health/route.ts` | endpoint สาธารณะเปิดเผย `creditLedger.users` (จำนวนบัญชีทั้งระบบ) และข้อความ error ภายในใน 503 |
| F-B15 | Medium **(แก้คำอธิบายแล้ว)** | `lib/credits.ts` `getBalance()` | ผมเขียนไว้แต่แรกว่า dashboard และ sidebar จะ 500 — **ตรวจซ้ำแล้วไม่จริง**: ทั้งสองหน้าคำนวณจากแถว `users` โดยตรง ไม่ได้เรียก `getBalance` เลย ผลกระทบจริงแคบกว่านั้นคือ `pollOrder` เรียก `getBalance` ก่อนตัดสินใจอะไร → ลูกค้าที่ยอดเสียจะ **เปิดดูออร์เดอร์ตัวเองไม่ได้** (500 ที่ `/api/orders/status`) ซึ่งเป็นหน้าเดียวที่จะบอกเขาได้ว่าเกิดอะไรขึ้น |
| F-B16 | Medium | `lib/db.ts:270` `migrate()` | รันทุกครั้งที่เปิด connection ภายใน `db()` — ปลอดภัยเพราะ additive ทั้งหมด แต่ไม่มี advisory lock ถ้าอนาคตมีหลายโปรเซส |
| F-B17 | Medium | `lib/db.ts` `device_services.brand_ids` | เก็บเป็น CSV และแตกด้วย `split(',')` ในโค้ด — ยังไม่ประกอบเป็น SQL จึงยังไม่เป็นช่องโหว่ แต่เป็นรูปแบบที่กลายเป็นช่องโหว่ได้ง่ายเมื่อมีคนเขียน `IN (...)` |
| F-B18 | Medium | ทุก route handler | ไม่มี runtime schema validation (zod/valibot) — TypeScript ถูกลบตอน runtime, body ถูก cast ด้วย `String()`/`Number()` |
| F-B19 | Medium | `lib/admin.ts` | `/admin` เป็น read-only ล้วน **ไม่มีทาง approve invoice ในการทำงานปกติ** → เงินที่ลูกค้าโอนจริงจะค้างที่ `review` ตลอดกาล นอกจากจะเปิดสวิตช์ที่ F-B07 บอกว่าอันตราย |
| F-B20 | Medium | `deploy/unlockservice.service` | `ProtectSystem=full` (ควรเป็น `strict`), `ProtectHome=false`, ไม่มี `RestrictAddressFamilies`, `PrivateDevices`, `MemoryDenyWriteExecute` |
| F-B21 | Medium | `package.json` `"test"` | ก่อนติดตั้ง devDependencies คำสั่งนี้ล้มด้วย `tsx: not found` — และเมื่ออยู่ใน pipeline แบบต่อท้ายกันจะกลืน exit code ไป CI จึงเขียว ทั้งที่ไม่มีเทสต์รันเลย |
| F-B22 | Medium | ไม่มี background worker ที่ผูกกับ systemd | `scripts/poll-provider-jobs.ts` มีอยู่แต่ไม่มี timer unit → hold ค้างถาวรเมื่อลูกค้าปิดเบราว์เซอร์ (และคำสั่งห้ามเปิด timer จนกว่าจะอนุมัติ — จึงบันทึกไว้เป็นความเสี่ยงที่รับรู้แล้ว) |
| F-B23 | Low | `lib/account-security.ts:88` | `console.error` บันทึก body ของ Resend 300 ตัวอักษร อาจมีอีเมลผู้ใช้ |
| F-B24 | Low | `lib/account-security.ts:141` `resendVerification` | โยน "This email is already verified" → เปิดเผยว่ามีบัญชีนี้อยู่ (ส่วน `requestPasswordReset` ทำถูกแล้ว) |
| F-B25 | Low | `lib/auth.ts:73` `register()` | "That username or email is already registered" รวมสองกรณีไว้ด้วยกัน — ยังบอกได้ว่าอีเมลมีอยู่ |
| F-B26 | Low | `lib/credits.ts:56` | คอลัมน์ชื่อ `balance_after_cents` แต่เก็บ `availableCents` — ชื่อกับค่าไม่ตรงกัน ทำให้รายงานอ่านผิดได้ |
| F-B27 | Low | `lib/provider-api.ts:305` | API key เดินทางใน query string ของ provider (ตามที่ DHRU กำหนด) — เราไม่ได้ log URL จึงยังปลอดภัย แต่ต้องมีกฎห้าม log URL อย่างชัดเจน |
| F-B28 | Low | ไม่มี audit log ของเหตุการณ์สิทธิ์/การเงิน | `provider_events` ครอบเฉพาะฝั่ง supplier ยังไม่มีตารางบันทึก login/approve/adjust |
| F-B29 | Medium | `.github/workflows/deploy.yml:5-8` | trigger มีเฉพาะ `push` ไปยัง deploy branch และ `workflow_dispatch` — **ไม่มี `pull_request`** จึงไม่มี CI รันบน PR ใด ๆ เลย โค้ดถูกตรวจครั้งแรกตอนที่มันอยู่บนสายที่จะ deploy แล้ว |
| F-B30 | Medium | `.github/workflows/deploy.yml:24-26` | job `verify` รัน `lint` + `typecheck` + `build` แต่ **ไม่รัน `npm test`** — เทสต์ทั้ง 11 ตัวไม่เคยถูกรันใน CI (ประกอบกับ F-B21 ที่ทำให้คำสั่งนี้ล้มแบบเงียบอยู่แล้ว) |

### หลักฐานของ F-B03

```
after two holds   { creditCents: 10000, heldCents: 6000, availableCents: 4000 }
refund('order','B') × 2
DUPLICATE REFUND ACCEPTED -> { creditCents: 10000, heldCents: 0, availableCents: 10000 }
charge('order','A') FAILED: cannot charge more credit than is reserved
```

ออร์เดอร์ A ยังเปิดอยู่แต่ hold หายไปแล้ว จึงไม่มีวัน settle ได้อีก — ลูกค้าได้ของโดยไม่ถูกหักเงิน
และ `/api/health` จะเริ่มรายงาน mismatch

---

## 5. Security / Financial / Privacy Invariants

Invariant ที่ **ต้องไม่ถูกทำลาย** โดยงาน redesign ใด ๆ:

| # | Invariant | บังคับใช้ที่ไหนตอนนี้ | สถานะ |
| --- | --- | --- | --- |
| I-1 | `held_cents` อยู่ระหว่าง 0 ถึง `credit_cents` เสมอ | `getBalance()` throw | ✅ แต่ throw ใน read path (F-B15) |
| I-2 | `SUM(ledger WHERE affects_balance=1) = credit_cents` | `creditIntegrity()` + `/api/health` | ✅ |
| I-3 | ผลลัพธ์ทางการเงินหนึ่งครั้งต่อหนึ่ง reference | unique index — **เฉพาะ affects_balance=1** | ❌ **F-B03** |
| I-4 | ลูกค้าอ่านได้เฉพาะข้อมูลของตัวเอง | ทุก query มี `WHERE user_id = ?` | ✅ ตรวจครบทุก path แล้ว |
| I-5 | Admin ตรวจฝั่ง server เท่านั้น | `requireAdmin()` | ✅ |
| I-6 | ไม่เก็บ raw IMEI ใน `imei_checks` | HMAC fingerprint + masked | ⚠️ **F-B08** (กุญแจสาธารณะ) และ `orders.imei` ยังเก็บ raw ตามสัญญาเดิม |
| I-7 | Free IMEI Check ไม่แตะเครดิต | `createImeiCheck` ไม่เรียก credits เลย | ✅ ยืนยันแล้ว |
| I-8 | Production ต้อง provider-disabled | ไม่มีอะไรบังคับ | ❌ **F-B01/F-B02** |
| I-9 | ไม่มี secret ในซอร์ส | ตรวจแล้ว: ไม่มี key จริง | ✅ ยกเว้น fingerprint fallback (F-B08) |

---

## 6. CI Analysis — เว็บไซต์อ้างอิง

**ทำไม่ได้ในรอบนี้** — `mobileunlocks.com` ถูก egress policy ปิดกั้น (403) ผมไม่เห็นหน้าเว็บ
จึงไม่มีข้อสังเกตจริงให้รายงาน และจะไม่เขียนสิ่งที่ไม่ได้เห็น

สิ่งที่ยังทำได้และเป็นฐานของหัวข้อ 7:

- บรีฟที่เจ้าของเขียนไว้เอง (navy/deep blue base · electric blue/cyan/teal accent อย่างมีวินัย ·
  light neutral surface สำหรับฟอร์ม · semantic แยกจาก brand · ไม่มี gradient/animation ที่รบกวน conversion)
- โครงหน้าและลำดับข้อมูลที่ **มีอยู่แล้วใน repo นี้** (hero + form card, trust row, services,
  steps, band, features, FAQ) ซึ่งเป็นลำดับมาตรฐานของหมวดนี้อยู่แล้ว
- geometry เดิมจาก captured design system ที่คำสั่งบอกให้คงไว้

**ทางเลือกในการปิดช่องว่างนี้** (เลือกอย่างใดอย่างหนึ่ง)
1. เจ้าของส่ง screenshot ของ `mobileunlocks.com` (desktop + mobile) มาให้ — ผมวิเคราะห์เป็นหลักการได้ทันที
2. เปิด egress ให้โดเมนนี้ในการตั้งค่า environment
3. อนุมัติให้เดินหน้าด้วยบรีฟที่เขียนไว้แล้ว โดยไม่อ้างอิงเว็บนั้น (เร็วที่สุด และปลอดภัยที่สุดในแง่ลิขสิทธิ์)

---

## 7. CI Options

ทั้งสองทางเลือกเป็น palette ต้นฉบับของ iUnlockMobile ไม่มีการคัดลอกค่าจากเว็บใด
ตัวเลข contrast ด้านล่าง **คำนวณจริงด้วยสูตร WCAG relative luminance** ไม่ใช่ประมาณการ

### Option A — "Signal Blue" (แนะนำ)

พื้นสว่างเย็น · navy เป็น ground ของ header band/footer · CTA น้ำเงินอิ่ม · cyan เป็น accent เส้นบาง ๆ เท่านั้น

| Role | Light | Dark |
| --- | --- | --- |
| `--color-brand-primary` | `#1A4FD6` | `#5B9BFF` |
| `--color-brand-secondary` | `#0B1F3A` | `#0B1F3A` |
| `--color-brand-accent` | `#00707F` (ข้อความ) / `#22C3E6` (พื้น) | `#4FD8F0` |
| `--color-bg` | `#F4F6FA` | `#0C1219` |
| `--color-surface` | `#FFFFFF` | `#12181F` |
| `--color-surface-elevated` | `#FFFFFF` + `--shadow-md` | `#171F28` |
| `--color-text` | `#0E1A2B` | `#E6EDF6` |
| `--color-text-muted` | `#55647A` | `#9FB0C4` |
| `--color-border` | `#DDE3EC` (hairline) | `#232C36` |
| `--color-border-control` | `#7C8BA3` (ขอบ input) | `#647280` |
| `--color-focus` | `#1A4FD6` | `#7FB2FF` |
| `--color-success` | `#0E7A4B` | `#4FD39B` |
| `--color-warning` | `#8A4B00` | `#F0B95C` |
| `--color-danger` | `#B3261E` | `#F08C7F` |

**Contrast ที่วัดได้**

| คู่สี | Light | Dark |
| --- | --- | --- |
| body text บน bg | **16.16:1** AAA | **15.96:1** AAA |
| muted บน surface | **6.02:1** AA | **8.49:1** AAA |
| ตัวอักษรบนปุ่ม primary | ขาวบน `#1A4FD6` = **6.70:1** AA | ink บน `#5B9BFF` = **6.79:1** AA |
| ขาวบน navy band | **16.52:1** AAA | เท่ากัน |
| success / warning / danger บน surface | 5.38 / 6.80 / 6.54 ทั้งหมด AA | 9.97 / 10.57 / 7.85 AAA |
| ขอบ control (WCAG 1.4.11 ≥3:1) | **3.45:1** ผ่าน | **3.62:1** ผ่าน |

**CTA hierarchy**

| ระดับ | ใช้ที่ไหน | รูปแบบ |
| --- | --- | --- |
| Primary | "Unlock Phone", "Place order", "Add funds" — หนึ่งเดียวต่อ viewport | พื้น `--color-brand-primary` ตัวอักษรขาว ไม่มี gradient |
| Secondary | "Track an order", "Sign in" | พื้น surface ขอบ `--color-border-control` ตัวอักษร `--color-text` |
| Tertiary / link | "View full report", ลิงก์ในเนื้อความ | ตัวอักษร `--color-brand-primary` ขีดเส้นใต้ตอน hover |
| Accent | kicker, eyebrow, เส้นใต้หัวข้อ, badge "Free" | `--color-brand-accent` **ห้ามใช้เป็นพื้นปุ่ม** |

**ข้อดี** — น้ำเงินคือภาษาสากลของ "ปลอดภัย/สถาบัน" ซึ่งเป็นสิ่งที่ธุรกิจรับเงินก่อนส่งของต้องการมากที่สุด
ฟอร์มอยู่บนพื้นขาวจึงอ่านง่ายที่สุด · accent แยกจาก semantic ชัดเจน · แปลงเป็น dark theme ได้ตรง ๆ
**ข้อจำกัด** — เป็นทิศทางที่พบบ่อยในหมวดนี้ ต้องอาศัย typography และ spacing เป็นตัวสร้างเอกลักษณ์แทนสี
**ผลต่อ perception** — "สถาบันการเงินขนาดเล็กที่เชื่อถือได้" มากกว่า "ร้านซ่อมมือถือ"

### Option B — "Midnight & Ice"

Midnight เกือบดำเป็น ground ของทั้ง hero · CTA เป็น cyan สว่างพร้อมตัวอักษรเข้ม · พื้นขาวเฉพาะบล็อกฟอร์ม

| Role | Light | Dark |
| --- | --- | --- |
| `--color-brand-primary` | `#22C3E6` (ink `#06222B`) | `#22C3E6` |
| `--color-brand-secondary` | `#0E5866` (teal เข้ม) | `#0E5866` |
| `--color-brand-accent` | `#0B6C7C` | `#5EE1F5` |
| `--color-bg` | `#F2F5F7` | `#08161E` |
| `--color-surface` | `#FFFFFF` | `#0F212B` |
| `--color-text` | `#0D1B24` | `#EAF2F5` |
| `--color-text-muted` | `#4F6472` | `#9DB2BD` |
| semantic | success `#0F7A52` · warning `#8A4B00` · danger `#B3261E` | ชุดสว่างเช่นเดียวกับ A |

**Contrast** — body 15.99:1 AAA · muted 5.64:1 AA · ink บน cyan CTA **7.88:1** AAA ·
ขาวบน midnight band **18.36:1** AAA · semantic 5.35 / 6.80 / 6.54 AA ทั้งหมด

**ข้อดี** — โดดเด่นและจำง่ายกว่า A มาก, contrast สูงสุดในสามคู่หลัก, ให้ความรู้สึก "เครื่องมือทางเทคนิค"
**ข้อจำกัด** — ปุ่ม CTA ที่เป็นสีสว่างพร้อมตัวอักษรเข้มอ่านเหมือน "badge" มากกว่า "ปุ่ม" ในสายตาผู้ใช้ทั่วไป
ซึ่งลด click-through ได้ · พื้นเข้มปริมาณมากทำให้ฟอร์มกรอกยากขึ้นบนมือถือกลางแดด · cyan อยู่ใกล้ semantic info
**ผลต่อ perception** — ทันสมัยและเป็นเทคนิค แต่ "อบอุ่น/น่าวางใจ" น้อยกว่า A ซึ่งสวนทางกับธุรกิจที่ต้องให้ลูกค้าโอนเงินก่อน

### สรุปเปรียบเทียบ

| เกณฑ์ | A — Signal Blue | B — Midnight & Ice |
| --- | --- | --- |
| ความน่าเชื่อถือสำหรับ pre-payment | ★★★★★ | ★★★☆☆ |
| ความเป็นเอกลักษณ์ | ★★★☆☆ | ★★★★★ |
| ความชัดของ CTA | ★★★★★ | ★★★☆☆ |
| ความง่ายในการอ่านฟอร์ม | ★★★★★ | ★★★★☆ |
| แรงงานที่ต้องใช้แก้ `components.css` | ต่ำ (เปลี่ยนเฉพาะ token) | กลาง (ต้องปรับ contrast ของ band/hero) |

**แนะนำ: Option A** และหยิบจุดแข็งของ B มาใช้เฉพาะจุด — ให้ hero band และ footer เป็น
`--color-brand-secondary` (navy เข้ม) เพื่อได้ความจำง่ายแบบ B โดยไม่เสีย CTA ที่อ่านง่ายแบบ A

---

## 8. Design Tokens ที่จะเพิ่ม (หลังอนุมัติ)

ชุด token ตามที่โจทย์กำหนด จะถูกประกาศเป็น **ชื่อ canonical ใหม่** ใน `styles/tokens.css`
และ token เดิม (`--primary`, `--ink`, `--line` ฯลฯ) จะกลายเป็น alias ที่ชี้มาที่ชุดใหม่
เพื่อ **ไม่ให้ `components.css` 1,204 บรรทัดต้องแก้พร้อมกัน** และรักษา backward compatibility

```css
:root {
  --color-brand-primary: #1a4fd6;
  --color-brand-secondary: #0b1f3a;
  --color-brand-accent: #00707f;
  --color-bg: #f4f6fa;
  --color-surface: #ffffff;
  --color-surface-elevated: #ffffff;
  --color-text: #0e1a2b;
  --color-text-muted: #55647a;
  --color-border: #dde3ec;
  --color-border-control: #7c8ba3;   /* เพิ่มเพื่อปิด WCAG 1.4.11 (F-F09) */
  --color-focus: #1a4fd6;
  --color-success: #0e7a4b;
  --color-warning: #8a4b00;
  --color-danger: #b3261e;

  --shadow-sm: 0 1px 2px rgb(11 31 58 / 6%), 0 2px 8px rgb(11 31 58 / 4%);
  --shadow-md: 0 12px 32px rgb(11 31 58 / 10%);
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 22px;

  /* alias — geometry เดิมไม่เปลี่ยน */
  --primary: var(--color-brand-primary);
  --ink-strong: var(--color-text);
  --line: var(--color-border);
  /* ... */
}
```

focus ring จะเปลี่ยนเป็นวงแหวนสองชั้นเพื่อให้เห็นได้แม้อยู่บนปุ่มสีเดียวกัน (ปิด F-F08):

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-focus);
}
```

---

## 9. Implementation Plan (แบ่งเฟส)

**เฟส 0 — ความปลอดภัยก่อน redesign** (ตามกติกา: Critical/High ต้องแก้ก่อน)

| ลำดับ | งาน | ปิด finding |
| --- | --- | --- |
| 0.1 | เพิ่ม `EnvironmentFile=/etc/iunlockmobile.env` + ไฟล์ตัวอย่าง `deploy/iunlockmobile.env.example` (ค่าเปล่า ไม่มี secret จริง) พร้อมขั้นตอนใน `deploy/README.md` | F-B01 |
| 0.2 | `activeSupplier()` ปฏิเสธ mock เมื่อ `NODE_ENV === 'production'` — throw ตอน boot ไม่ใช่ตอนมีออร์เดอร์ | F-B02 |
| 0.3 | ขยาย unique index ให้ครอบ `hold`/`refund` + ทำ `settleDelivered`/`settleUnavailable` เป็น transaction เดียวที่มี `AND status='processing'` | F-B03, F-B04 |
| 0.4 | `submitOrder` รวม insert+hold ไว้ใน transaction เดียว + เพิ่ม `orders.idempotency_key` (additive) | F-B05, F-B06 |
| 0.5 | `selfApprovalEnabled()` เป็น opt-in ล้วน (fail closed) | F-B07 |
| 0.6 | `IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET` ต้องมีจริงใน production ไม่งั้นปิดฟีเจอร์ | F-B08 |
| 0.7 | OAuth: ไม่ auto-merge เข้าบัญชีที่มีรหัสผ่านและยังไม่พิสูจน์อีเมล | F-B09 |
| 0.8 | Caddy: CSP (nonce) + Permissions-Policy + COOP + rate limit · Origin check ใน `guard()` | F-B10, F-B11, F-F12 |
| 0.9 | แก้สำเนาหน้าแรกให้ตรงข้อเท็จจริง + แสดงสถานะ maintenance/provider-disabled บนหน้าแรก | F-F01 |
| 0.10 | เพิ่ม `pull_request` trigger และ `npm test` ลงใน workflow `verify` เพื่อให้เฟสถัด ๆ ไปมีตาข่ายรองรับ | F-B21, F-B29, F-B30 |
| 0.11 | เอา raw IMEI ออกจาก URL (ใช้ short-lived quote id ฝั่ง server) และให้ `/register` รับค่าต่อ | F-F02, F-F03 |

**เฟส 1 — Design tokens** (ต้องได้อนุมัติหัวข้อ 7 ก่อน): เพิ่มชุด token ใหม่ + alias + focus ring + `--color-border-control`

**เฟส 2 — Public surface**: Header/Footer/mobile nav · hero · trust signals · form cards · service cards

**เฟส 3 — Auth surface**: login/register/Google button/recovery + `error.tsx`/`not-found.tsx`/`loading.tsx`

**เฟส 4 — Workspace + Admin**: sidebar, orders, checks, payments, invoice, control panel, status badges, empty/loading states

**เฟส 5 — Accessibility & responsive**: 320px, focus flow, `aria-current`, reduced motion, contrast verification

**เฟส 6 — Tests & evidence**: เพิ่มเทสต์เฉพาะ contract ที่เปลี่ยน · screenshots desktop+mobile ก่อน/หลัง (ข้อมูลสังเคราะห์ล้วน)

---

## 10. Files Changed (คอมมิตนี้)

| ไฟล์ | เหตุผล |
| --- | --- |
| `docs/architecture-audit-and-ci-redesign.md` | บันทึก baseline ก่อนแก้โค้ด ตามขั้นตอนที่ 1 ที่เจ้าของกำหนด |

ยังไม่มีการแก้ไขโค้ดแอปพลิเคชัน

---

## 11. Test / Build Results (baseline)

| คำสั่ง | ผล |
| --- | --- |
| `npm run typecheck` | ✅ ผ่าน ไม่มี error |
| `npm run lint` | ✅ ผ่าน ไม่มี warning |
| `npm test` | ✅ 11/11 ผ่าน (หลังติดตั้ง devDependencies — ดู F-B21) |
| `npm run build` | ✅ ผ่าน (`next build` รัน lint + typecheck ในตัว) |
| Contrast | คำนวณด้วยสูตร WCAG จริง ทุกคู่ในหัวข้อ 7 ผ่าน AA ขึ้นไป |

---

## 12. Remaining Risks & สิ่งที่ต้องขอจากเจ้าของระบบ

| # | ต้องการ | ทำไม |
| --- | --- | --- |
| R-1 | ยืนยันค่า env จริงบนเซิร์ฟเวอร์: `IUNLOCKMOBILE_MAINTENANCE`, `IUNLOCKMOBILE_PROVIDER_MODE` (รันบน VM: `systemctl show unlockservice -p Environment`) | ผมเข้า production ไม่ได้ และไฟล์ใน repo ไม่ได้ตั้งค่าเหล่านี้เลย (F-B01) |
| R-2 | screenshot ของ `mobileunlocks.com` หรือเปิด egress ให้โดเมนนั้น — หรืออนุมัติให้เดินหน้าโดยไม่อ้างอิงเว็บนั้น | egress ถูกปิดกั้น (หัวข้อ 6) |
| R-3 | **อนุมัติ CI direction** (Option A หรือ B) | กติกากำหนดให้หยุดรออนุมัติก่อนแก้ visual จำนวนมาก |
| R-4 | ยืนยันว่าราคาและ ETA ใน `lib/catalog.ts` เป็นของจริงหรือยังเป็น placeholder | ห้ามสร้างราคาใหม่เอง แต่ต้องรู้ว่าตัวเลขที่แสดงเชื่อถือได้หรือไม่ |
| R-5 | ยืนยันว่าจะให้แก้ Critical/High ในเฟส 0 ได้เลยหรือไม่ | กติกาบอกให้หยุด redesign ที่เกี่ยวข้องและแก้ security ก่อน — ต้องการคำยืนยันว่าให้เดินหน้าเฟส 0 |
| R-6 | ช่องทาง staging (URL/host) สำหรับเก็บ screenshot ก่อน/หลัง | ห้าม deploy production ก่อนอนุมัติ |

**ความเสี่ยงที่ยังเปิดอยู่และรับรู้แล้ว** — ไม่มี background worker ผูกกับ systemd (F-B22) จึงมี hold
ที่อาจค้าง เจ้าของสั่งห้ามเปิด timer จนกว่าจะอนุมัติ จึงบันทึกไว้แทนการแก้


---

## 13. สถานะการแก้ (อัปเดตหลังเฟส 0–2)

Branch `feat/architecture-audit-and-ci-redesign` · PR #1 · CI `verify` เขียว

### ปิดแล้ว

| กลุ่ม | Findings |
| --- | --- |
| Critical | F-F01 · F-B01 · F-B02 · F-B03 |
| High | F-F02 · F-F03 · F-F04 · F-F05 · F-F19 · F-B04 · F-B05 · F-B06 · F-B07 · F-B08 · F-B09 · F-B10 |
| Medium | F-F07 · F-F09 · F-F11 · F-F13 · F-F20 · F-F22 · F-F23 · F-B11 · F-B12 (บางส่วน) · F-B13 · F-B14 · F-B15 · F-B21 · F-B29 · F-B30 |
| Low | F-F14 · F-F15 · F-F16 · F-F17 · F-F18 · F-F21 · F-B23 · F-B24 · F-B25 |
| ตรวจแล้วไม่ใช่ปัญหา | F-F10 (ไม่มี overflow ที่ 320px — วัดจริงแล้ว) |

### ยังเปิดอยู่ และเหตุผล

| ID | ประเด็น | ทำไมยังไม่แก้ |
| --- | --- | --- |
| F-B19 | `/admin` ยัง read-only → invoice ที่จ่ายเงินจริงไม่มีทาง approve | ต้องออกแบบ audit trail และนโยบายอนุมัติร่วมกับเจ้าของก่อน — เขียนโค้ดที่ mint เครดิตโดยไม่มีข้อตกลงเรื่องนี้เป็นความเสี่ยงที่ใหญ่กว่าตัวปัญหา |
| F-B22 | ไม่มี background worker → hold อาจค้างถ้าลูกค้าปิดเบราว์เซอร์ | **คำสั่งห้ามเปิด timer** จนกว่าจะอนุมัติ บันทึกเป็นความเสี่ยงที่รับรู้แล้ว |
| F-F06 | `site-header` เป็น client component ทั้งก้อน | ต้องใช้ `usePathname` + toggle จริง ๆ การผ่าเป็น island เสี่ยงทำ mobile menu พังมากกว่าที่จะได้ bundle คืน (ปัจจุบัน shared JS 103 kB) — เลือกไม่แตะ และรายงานตรง ๆ ดีกว่าแก้แล้วเสี่ยง |
| F-B16 | `migrate()` ไม่มี advisory lock | ปลอดภัยตราบใดที่ยังเป็นโปรเซสเดียว ต้องแก้ก่อนขยายเป็นหลายอินสแตนซ์ |
| F-B17 | `device_services.brand_ids` เป็น CSV | ยังไม่เป็นช่องโหว่ (ไม่ได้ประกอบเป็น SQL) แต่ควร normalize เป็นตารางเชื่อมในรอบ schema ถัดไป |
| F-B18 | ไม่มี runtime schema validation (zod) | เป็นงานที่แตะทุก endpoint ควรทำเป็นรอบของตัวเองพร้อมเทสต์ ไม่ใช่แทรกกลางเฟสความปลอดภัย |
| F-B20 | systemd ยัง `ProtectSystem=full` ไม่ใช่ `strict` | `strict` ต้องระบุ `ReadWritePaths` ให้ครบ และผมทดสอบบนเครื่องจริงไม่ได้ — เปลี่ยนแบบเดาแล้วบริการไม่ขึ้นคือความเสียหายที่มากกว่า |
| F-B26 | `balance_after_cents` เก็บ `availableCents` ชื่อไม่ตรงค่า | เปลี่ยนชื่อคอลัมน์ = destructive migration ซึ่งถูกห้าม ควรทำตอนย้าย schema รอบใหญ่ |
| F-B27 | API key ของ provider เดินทางใน query string | เป็นข้อกำหนดของ DHRU เอง ป้องกันด้วยการไม่ log URL — ต้องคงกฎนี้ไว้เป็นข้อตกลง |
| F-B28 | ยังไม่มี audit log ของเหตุการณ์สิทธิ์/การเงิน | ผูกกับ F-B19 ควรออกแบบพร้อมกัน |

### สิ่งที่ยังต้องขอจากเจ้าของระบบ

1. `systemctl show unlockservice -p Environment` บนเซิร์ฟเวอร์ — ยืนยันว่า `IUNLOCKMOBILE_MAINTENANCE=1` และ `IUNLOCKMOBILE_PROVIDER_MODE=disabled` ตั้งอยู่จริง (ผมเข้า production ไม่ได้)
2. screenshot ของ `mobileunlocks.com` หรือเปิด egress ให้โดเมนนั้น — ถ้าต้องการให้เทียบ CI กับเว็บอ้างอิงจริง
3. ยืนยันว่าราคาและ ETA ใน `lib/catalog.ts` เป็นของจริงหรือยัง placeholder
4. อนุมัติผล audit + screenshots ก่อน merge เข้า deploy branch และ deploy

## 14. สถานะงานตาม CRO audit (D-tickets)

รอบนี้ทำตามรายการที่เจ้าของระบบส่งมา (artifact CRO audit) ไม่ใช่จาก findings ของ §3–§4

| ID | เรื่อง | สถานะ | หมายเหตุ |
| --- | --- | --- | --- |
| D10 | copy ที่พูดถึงสิ่งที่ลูกค้าได้ ไม่ใช่วิธีที่เราสร้าง | ปิด | `c9f1af4` |
| D12 | mobile — control 16px, ฟอร์มขึ้นก่อน, เมนูที่กดถึง | ปิด | `1902521` |
| D14 | 404 ที่ออกไปได้ + metadata/JSON-LD | ปิด | `8438d27` |
| D15 | ทุกปุ่มที่กดไม่ได้ต้องบอกว่าติดอะไร | ปิด | `47d5a29` |
| D2 · D3 · D4 | funnel ต้องไม่จบที่หน้า "orders paused" | ปิด | ตารางด้านล่าง |
| D1 | payment rails | รอเจ้าของ | ต้องเลือก gateway และนโยบายอนุมัติ (ผูกกับ F-B19) |
| D5 | Quote API + TAC lookup | รอเจ้าของ | ต้องมี provider ที่เปิดใช้จริงก่อน |
| D6 | guest / passwordless checkout | รอเจ้าของ | เปลี่ยนโมเดล session — ขอตัดสินใจก่อนลงมือ |
| D7 · D8 · D9 | product display layer · guest tracking · trust module | รอเจ้าของ | ขึ้นกับ D1/D5 |
| D11 | GA4 / Clarity | รอเจ้าของ | ต้องการ measurement ID และการตัดสินใจเรื่อง CSP + consent |

### D2/D3/D4 — สิ่งที่เปลี่ยน

ตัวสวิตช์คือ `unlockOrderingEnabled()` ใน `lib/provider.ts` ซึ่ง derive จาก `serviceStatus()`
ไม่ใช่ env flag ตัวใหม่ — flag ตัวที่สองจะขัดกับความจริงได้เมื่อมีคนลืมสลับ

| จุด | ตอน ordering ปิด | ตอนเปิด (ไม่ต้อง deploy ใหม่) |
| --- | --- | --- |
| `/user/unlock` | ฟอร์ม waitlist (email + network + IMEI ที่ไม่บังคับ) | `OrderConsole` ตามเดิม |
| `/unlock-waitlist` (หน้าใหม่, public) | หน้า waitlist เต็มรูปแบบ | `redirect('/services/unlock')` |
| การ์ดใน `/services/unlock` | ปุ่ม "Notify me when this opens" | ปุ่มสั่งซื้อตามเดิม |
| CTA band หน้าแรก · hero alert · `/check` | ลิงก์ไป waitlist | "Unlock Phone Now" ตามเดิม |
| dashboard · orders empty state | "Run a phone check" → `/user/reports/new` | "Unlock a device" |
| หลัง register / login / verify | `landingRoute()` → `/user/reports/new` | `/user/unlock` |
| `startUnlockQuoteAction` | redirect ไป `/services/imei-check` พร้อม IMEI ที่กรอกไว้ | ไป `/user/unlock` |
| `sitemap.xml` | มี `/unlock-waitlist` | ไม่มี |

`unlock_waitlist` เก็บ `imei_fingerprint` (HMAC) + `masked_imei` เท่านั้น ไม่เก็บ IMEI ดิบ
unique index `(email, imei_fingerprint)` ทำให้กดซ้ำเป็น no-op และไม่ส่งอีเมลซ้ำ
rate limit 5 ครั้ง/ชั่วโมงต่ออีเมล อีเมลยืนยันส่งเฉพาะเมื่อ `emailDeliveryConfigured()` และถ้าส่งไม่ผ่าน
แถวยังอยู่ — การเสียใบเสร็จไม่ควรทำให้เสียรายชื่อ

หมายเหตุ: ticket ขอให้แสดง "วันที่คาดว่าจะเปิด" ด้วย ตรงนี้ไม่ได้ใส่ เพราะยังไม่มีวันที่จริง
หน้าเว็บบอกตรง ๆ ว่ายังไม่ได้กำหนดวัน ดีกว่าใส่วันที่ที่อาจพลาด

### F-F15 · F-F17 · F-F18 — สิ่งที่ปิดในรอบเก็บงาน

| ID | แก้อย่างไร |
| --- | --- |
| F-F15 | `app/(auth)/layout.tsx` มีแถวลิงก์ใต้การ์ด (Home · Phone Check · Privacy · Terms) — ยังไม่ใส่ header/footer เต็ม เพราะ navigation bar ข้างช่องรหัสผ่านคือสิ่งที่กดพลาดได้อีกหนึ่งอย่าง |
| F-F17 | `order-console` refresh หลังสั่งซื้อเสมอ (เงินถูก hold แล้ว), หลัง poll เฉพาะเมื่อ poll ทำงานจริง, และในกรณี error เฉพาะเมื่อ order ถูกสร้างไปแล้ว — เดิมออเดอร์ที่จบทันทีจะยิง refresh สองครั้งชนกันใน tick เดียว |
| F-F18 | `currentSession()` ห่อด้วย `cache()` ของ React — layout กับ page ต่างต้องอ่าน session เอง (layout ส่ง prop ให้ page ไม่ได้) ตอนนี้ต่อหนึ่ง request อ่านครั้งเดียว ขอบเขตเป็นราย request จึงไม่มีทางตอบค่าเก่าข้าม request และไม่มีจุดใดในระบบที่เขียน session แล้วอ่านซ้ำใน request เดียวกัน |

ตรวจใน Chromium: `/login` `/register` `/forgot-password` ตอบ 200 ทั้งหมด ลิงก์ครบสี่ตัวและปลายทางตอบ 200
ไม่มี horizontal overflow · สมัคร → เข้า workspace → sign out → `/user/dashboard` เด้งกลับ `/login`
และ header กลับเป็นสถานะ signed-out ทันที (ยืนยันว่า `cache()` ไม่ค้างข้าม request)

หมายเหตุ: การเปลี่ยน refresh ใน `order-console` ยังไม่ได้รันจริงในเบราว์เซอร์ เพราะ ordering ปิดอยู่ในเครื่องทดสอบ
(ไม่มี supplier ที่ตั้งค่าไว้) — ผ่าน typecheck/lint และตรวจตรรกะด้วยสายตาเท่านั้น

### สวิตช์ deploy

`deploy` job ใน `.github/workflows/deploy.yml` ต้องการ repository variable `DEPLOY_ENABLED=1`
เพิ่มเติมจาก `DEPLOY_HOST` — ตอนนี้ยังไม่ได้ตั้ง จึง **merge เข้า branch ได้โดยไม่ขึ้น production**
ตั้งค่าที่ Settings → Secrets and variables → Actions → Variables เมื่อพร้อม deploy
(หรือสั่ง workflow_dispatch จากแท็บ Actions ซึ่งผ่านสวิตช์ตัวเดียวกัน)
