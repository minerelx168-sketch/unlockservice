# Draft: ติดตามบิล card checkout ที่ค้าง ครั้งเดียวหลัง 5 นาที

เอกสารนี้เป็นร่างสำหรับเจ้าของ repository ปรับปรุงต่อ ไม่ใช่ release หรือระบบที่เปิดส่งแล้ว ไม่ merge/deploy ในงานนี้ และไม่มีการส่งอีเมลจริง

## ขอบเขตที่ผู้ใช้กำหนด

ส่งเฉพาะลูกค้าที่เปิดบิล checkout แล้ว ยังไม่ชำระ และมีความยินยอมรับอีเมลติดตามการตลาด ส่งได้สูงสุด **1 ครั้ง** เมื่อบิลมีอายุอย่างน้อย **5 นาที** ไม่ใช่ 2 ชั่วโมง/24 ชั่วโมง/72 ชั่วโมง ไม่ broadcast หารายชื่อสมาชิกทั้งหมด

อีเมลติดตามนี้แยกจากอีเมลลิงก์ครั้งแรกที่ลูกค้าขอ และแยกจาก OTP, receipt, result/refund notification. ไม่มีการเปลี่ยนนโยบายส่งผลบริการ check/unlock

เวลาส่งคือรอบ worker แรกที่เข้าเงื่อนไขหลังครบ 5 นาที ไม่รับประกันการส่งตรงวินาทีที่ 300. การจ่ายสำเร็จ, review, refund, expiry, suppression หรือ gateway verification ที่ไม่ชัดเจนต้องทำให้ไม่ส่ง

## ไฟล์ในร่าง

- `lib/checkout-marketing-reminder.ts`: โครงฟังก์ชันและ typed ports สำหรับ persistent store, gateway verifier และ marketing email transport. ไม่มี direct SDK/fetch, ไม่มี production secrets และไม่ได้ import เข้า runtime worker
- `lib/checkout-marketing-resend.ts`: adapter ส่งผ่าน Resend API ด้วย `RESEND_API_KEY`, `IUNLOCKMOBILE_EMAIL_FROM`, `IUNLOCKMOBILE_EMAIL_REPLY_TO` และ public origin เดิมของระบบ; ปิดค่าเริ่มต้น ไม่ hardcode คีย์และไม่อ่าน environment ตอน import
- `tests/checkout-marketing-reminder.test.ts`: unit tests ด้วย mock ports ไม่เรียก Resend, Whop, Provider หรือรับเงินจริง
- `tests/checkout-marketing-resend.test.ts`: mock fetch tests สำหรับ endpoint/header/idempotency, single recipient และผลส่ง ambiguous; ไม่มี network จริง
- เอกสารนี้: ขอบเขต, integration checklist และข้อจำกัดก่อนเปิดใช้งาน

Feature flag/config ปิดเป็นค่าเริ่มต้น และปฏิเสธการส่งเมื่อข้อมูลผู้ส่ง, ที่อยู่, consent, URL หรือ persisted checkout identity ไม่ครบ

## แบบข้อความอีเมล

Subject: **Complete your iUnlockMobile checkout**

เนื้อหาบอกว่าลูกค้าทิ้ง checkout ไว้ มีชื่อบริการและยอดรวมที่บันทึกไว้ ปุ่ม **Continue secure checkout** ไป private application status page, contact support, ข้อความระบุว่าเป็น marketing reminder, ชื่อ/ที่อยู่ธุรกิจ และ unsubscribe. ไม่มี IMEI/raw identifiers, ส่วนลดหรือการเร่งด่วนที่แต่งขึ้น

ผู้รับต้องเป็นอีเมลที่บันทึกไว้ใน checkout ของเว็บไซต์ ไม่ใช่อีเมลของบัญชีที่ล็อกอินใน Whop. ห้ามเปลี่ยนผู้รับ private link จาก `payment.customer_email` โดยอัตโนมัติ เพราะผู้ชำระและผู้รับผลอาจเป็นคนละคน และต้องรักษาการยืนยันสิทธิ์เข้าถึงออเดอร์

## จุดที่เจ้าของต้องเชื่อมก่อนใช้งาน

### Persistent store

เขียน SQLite migration/adapter ที่เก็บ consent, reference, recipient/service/device dedup key แบบ HMAC, due/expiry, attempts/backoff, lease token, accepted provider message ID, accepted timestamp, ambiguous/quarantine และ suppression. ใช้ IMMEDIATE transaction/unique constraints ให้สอง worker claim ได้เพียงรายเดียว และ update ตาม lease token เพื่อป้องกัน worker เก่าเขียนทับ worker ใหม่

อย่าใช้ `checkout_link_sent_at` เดิมเป็น marker ของการตลาด เพราะมันเป็นอีเมลลิงก์ครั้งแรก. อย่าใช้ cookie acceptance, Terms/device-ownership checkbox หรือเพียงการกรอกอีเมลเป็น marketing consent. เพิ่ม optional unchecked opt-in ที่ระบุชัดว่าเป็น one checkout reminder; บันทึกเวลา/แหล่งความยินยอม และตรวจสิทธิ์เจ้าของอีเมลตามนโยบายที่เลือก

รายการเก่าที่ไม่มี consent ต้องไม่ถูก backfill เป็น eligible. บิลซ้ำจากหลายแท็บหรือหลาย request keys สำหรับผู้รับ/บริการ/อุปกรณ์เดียวกันต้อง deduplicate และไม่ไปกระตุ้นชำระบิลอีกใบเมื่อมีใบที่ paid แล้ว

### Authoritative gateway verifier

ดึง Whop payment ที่ผูกกับ checkout/payment ID หรือ list ด้วย exact plan และ match metadata reference แล้ว retrieve รายการนั้น. ตรวจ account, plan, amount/currency, environment และ payment status. หากมี payment ambiguity, dispute, review, refund, timeout หรือ identity mismatch ต้อง fail closed. ใช้ settlement path เดิมเพื่อบันทึกสถานะจ่ายจริงตามที่ผ่านการตรวจ ไม่ใช้ marketing worker เพื่อ charge บัตรหรือ dispatch Provider

หลัง verification ต้อง re-read local row และ suppression ก่อนส่ง. Paid webhook ที่มาระหว่าง network request ต้องทำให้ส่งไม่ได้. การตรวจนี้ลด race แต่ไม่ใช่ atomic transaction กับ gateway/Resend; อีเมลต้องบอกไม่ให้จ่ายซ้ำและ private status page ต้องซ่อน payment CTA หลังจ่าย

### Resend transport และ unsubscribe

ร่างมี `sendCheckoutMarketingEmailWithResend()` แล้ว ใช้ endpoint `https://api.resend.com/emails` และ server mail settings เดียวกับ OTP โดยไม่เปลี่ยน transactional emails. ต้องเชื่อมผล adapter เข้ากับ campaign store/ports หลังตรวจ consent/address/gateway และก่อนเปิด flag. ใช้ deterministic per-bill reminder idempotency key ไม่หมุน key เมื่อผลส่งไม่ชัดเจน

เก็บ API acceptance/provider ID แยกจาก delivered/opened/clicked. เมื่อ transport timeout ไม่ทราบว่า accepted หรือไม่ ให้ quarantine/reconcile ไม่ปล่อย claim เพื่อส่งใหม่แบบ blind. Retry อัตโนมัติได้เฉพาะกรณี transport ยืนยันว่าไม่ accepted และยังอยู่ใน idempotency window/attempt bounds

เพิ่ม signed, non-PII, one-click unsubscribe endpoint รองรับ `List-Unsubscribe` และ `List-Unsubscribe-Post`; การยกเลิกต้องเก็บ durable recipient-level marketing suppression และไม่ต้องล็อกอิน/จ่ายเงิน. ไม่ปิด OTP, receipt หรืออีเมลที่จำเป็นต่อออเดอร์

### ข้อมูลผู้ส่งและการเปิดใช้

ชื่อที่พบในเว็บไซต์คือ **iUnlockMobile**. ณวันที่ร่าง ตรวจ Contact, Terms, Privacy และ source ที่เกี่ยวข้องแล้วไม่พบที่อยู่ไปรษณีย์ของธุรกิจ มีเพียงอีเมล support. เจ้าของต้องใส่ที่อยู่ไปรษณีย์จริงใน config ก่อนเปิดส่ง; ห้ามใส่ที่อยู่สมมุติหรือใช้ URL/อีเมลแทนที่อยู่

ไม่สร้าง EnvironmentFile, ไม่เปิด flag บน VM, ไม่ตั้ง ScheduleTask/Trigger ใหม่. เมื่อ integration พร้อม จึงเชื่อม worker แบบ bounded หลังการ reconcile payments ใน `scripts/poll-provider-jobs.ts`, โดย marketing sender ยังต้องตรวจ gateway/suppression ของตัวเองและไม่ทำให้ payment/Provider/notification worker หลักหยุด

ร่างนี้รองรับ card service bill ผ่าน typed ports เท่านั้น. การเติมเครดิตผ่าน `whop_topups` และ crypto invoices เป็นคนละ flow หากต้องการรวมต้องมี mapping/consent/expiry และ verification adapter แยกพร้อม tests ไม่ถือว่าถูกครอบคลุมแล้วเพียงเพราะใช้ Whop เหมือนกัน

## Acceptance ก่อนเปลี่ยนเป็นพร้อมใช้

ทดสอบ flag off/missing config, ไม่มี consent, +4:59 ไม่ส่ง/+5:00 eligible, paid/refund/review/expired/unknown ไม่ส่ง, duplicate/concurrent workers ไม่ส่งซ้ำ, unsubscribe suppresses across bills, retry key เดิมเฉพาะ known-not-accepted, ambiguous transport quarantine, HTML escaping/URL origin และไม่เปลี่ยนผู้รับเป็น Whop payer email. จากนั้นทดสอบ SQLite/SDK integration กับข้อมูลสังเคราะห์ก่อนใช้ credentials จริง

Draft PR ไม่ใช่การยืนยันการส่งจริง ไม่ใช่การรับรอง delivery/inbox และไม่ควร merge เพื่อเปิดใช้งานทันทีโดยยังไม่เติม adapter/consent/address

## References

[1]: https://resend.com/docs/email-types "Resend individual marketing emails and consent"
[2]: https://resend.com/docs/api-reference/emails/list-emails "Resend API acceptance and last_event metadata"
[3]: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business "FTC commercial email sender address and opt-out guidance"

## ตัวอย่างการเสียบ ports (ยังปิดส่ง)

ตัวอย่างนี้เป็น integration sketch ไม่ใช่ script สำหรับรันจริง: `sqliteCampaignStore`, `verifiedWhopGateway` และ `configuredSenderMailbox` ต้องจัดทำฝั่ง server ตาม checklist ก่อน

```ts
import { maybeSendCheckoutMarketingReminder } from '../lib/checkout-marketing-reminder'
import { createExistingResendMarketingSender } from '../lib/checkout-marketing-resend'

const result = await maybeSendCheckoutMarketingReminder(billId, {
  enabled: false,
  senderBusinessName: 'iUnlockMobile',
  senderPostalAddress: '', // เจ้าของต้องใส่ที่อยู่ไปรษณีย์จริงก่อนเปิด
  senderEmail: configuredSenderMailbox,
  replyTo: configuredReplyTo,
  publicOrigin: configuredPublicOrigin,
}, {
  store: sqliteCampaignStore,
  gateway: verifiedWhopGateway,
  mailer: createExistingResendMarketingSender({ enabled: false }),
})
```

Resend bridge ใช้ From/Reply-To จาก `IUNLOCKMOBILE_EMAIL_FROM`/`IUNLOCKMOBILE_EMAIL_REPLY_TO` เดิมเป็นผู้มีอำนาจกำหนด sender จริง ไม่รับค่า From จาก browser. ส่งทีละผู้รับ ไม่มี BCC/broadcast; จำแนก known-not-accepted, permanent rejection และ ambiguous เพื่อให้ store ตัดสิน retry/quarantine ได้. Response 408/409/5xx หรือ receipt ไม่ครบไม่ถือว่า “ไม่เคยส่ง”

Draft money renderer ใช้ integer minor units หาร 100; gateway adapter ต้องจำกัดสกุลเงินที่มีสองทศนิยมซึ่งระบบรองรับ และใช้ยอด card quote ที่บันทึกไว้ ไม่คำนวณยอดจากสกุลเงินที่ Whop แปลงให้แสดงบน browser เอง

Local validation ณวันที่ 30 ตุลาคม 2026: full repository tests **433 passed / 0 failed**, typecheck ผ่าน, lint exit 0 พร้อม **11 warnings ในไฟล์เดิม** (ไม่มี lint errors), ไม่มี network/เงินจริงใน mock tests. ไม่มีการเปิดใช้งานจริงจากผลทดสอบนี้
