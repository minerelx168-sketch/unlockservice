

# BaseIMEI.com — Backend Flow Reference

เอกสารอ้างอิงสถาปัตยกรรมและ flow ของ baseimei.com
จัดทำ: 21 ส.ค. 2026 · สำรวจจากฝั่ง client (DOM, static JS assets, network) ในบัญชีผู้ใช้ระดับ Customer
ไม่ได้เข้าถึงซอร์สโค้ด backend — ส่วนที่เป็นการอนุมานถูกทำเครื่องหมาย 🔶 ไว้ทุกจุด

---

## 1. ภาพรวมสถาปัตยกรรม

| 
หัวข้อ | สิ่งที่พบ
 |

| 
รูปแบบแอป | Multi-Page Application (MPA) — PHP server-rendered ทุกหน้า ไม่มี SPA framework
 |

| 
ภาษา/รันไทม์ | PHP (ทุก route ลงท้าย .php)
 |

| 
Frontend | Vanilla JS (ES2020, no bundler) + CSS แยกไฟล์ต่อหน้า · Bootstrap Icons · ฟอนต์ self-host (Google Sans Flex .woff2)
 |

| 
State | PHP session cookie (credentials: "same-origin") + CSRF token ต่อฟอร์ม
 |

| 
การสื่อสาร | ส่วนใหญ่เป็น form POST แบบ full page reload; มีเพียง flow เช็ค IMEI ที่เป็น AJAX (fetch + application/x-www-form-urlencoded)
 |

| 
Local state | localStorage เก็บ service ที่ใช้บ่อย (baseimei-user-preferred-service-{userId})
 |

| 
ธีม | dark/light toggle เก็บที่ document.documentElement 🔶 น่าจะ persist ใน localStorage/cookie
 |

| 
Admin | มี /admin/ (บล็อกใน robots.txt) — ไม่ได้เข้าไปสำรวจ
 |

### โครงไฟล์ static ที่สังเกตได้

/assets/css/    public-home.css · user-shell.css · user-check.css · user-fonts.css
/assets/js/     public-home.js · user-check.js (~39 KB) · user-reseller.js (~14 KB)
/assets/fonts/  google-sans-flex-latin.woff2
/assets/images/ favicon-baseimei.svg · favicon.ico
/uploads/payment_qr/  crypto-qr-<hash>.jpg   ← QR ที่แอดมินอัปโหลด

ข้อสังเกตด้านแพตเทิร์น: CSS/JS แยกเป็น "ต่อหน้า" (user-check.css โหลดเฉพาะหน้า check) ไม่ใช่ bundle ก้อนเดียว — ทำให้หน้าเบา และหน้าที่ไม่มี interaction (payment history, account settings) ไม่โหลด JS เลย

---

## 2. แผนผัง Route ทั้งหมด

graph TD
    subgraph PUBLIC["Public (ไม่ต้องล็อกอิน)"]
        A["/index.php<br/>landing + services + FAQ"]
        B["/login.php"]
        C["/register.php"]
        D["/privacy-policy.php<br/>/terms-conditions.php"]
        E["/seo/{country}.php<br/>หน้า SEO รายประเทศ"]
    end

    subgraph USER["/user/ (ต้องล็อกอิน)"]
        F["dashboard.php<br/>Home / Workspace"]
        G["check_imei.php<br/>สั่งเช็ค"]
        H["add_funds.php<br/>เติมเงิน"]
        I["payment_history.php<br/>Payments"]
        J["user_history.php<br/>Order history"]
        K["api_portal.php<br/>API"]
        L["account_settings.php<br/>Account & security"]
        M["reseller_dashboard.php<br/>Reseller"]
    end

    subgraph EP["Endpoints (AJAX / form target)"]
        N["user/process_check.php"]
        O["user/provider_order_status.php"]
        P["user/payment/create.php"]
        Q["user/payment/status.php?id="]
        R["user/payment/manual_submit.php"]
    end

    subgraph ADMIN["/admin/ (robots: Disallow)"]
        S["ระบบหลังบ้าน<br/>อนุมัติเงิน / API / reseller"]
    end

    B --> G
    C --> F
    G -->|AJAX POST| N
    N -.->|status=pending| O
    H -->|POST| P
    P -->|redirect| Q
    Q -->|POST| R
    R -.-> S
    S -.->|เติมเครดิต| I
    F --> G & H & I & J & K & L & M

### ตาราง Route

| 
Path | Method | Auth | หน้าที่
 |

| 
/index.php | GET | – | Landing: hero, services, dashboard preview, how-it-works, FAQ, contact (anchor sections ในหน้าเดียว)
 |

| 
/login.php · /register.php | GET/POST | – | เข้าสู่ระบบ/สมัคร · ถ้าล็อกอินอยู่แล้วจะ redirect ทันที — login.php → /user/check_imei.php, register.php → /user/dashboard.php
 |

| 
/logout.php | GET | ✔ | ออกจากระบบ
 |

| 
/user/dashboard.php | GET | ✔ | Workspace home: เครดิต, สถิติ, กราฟ 7 วัน, recent checks, ประกาศแอดมิน, membership
 |

| 
/user/check_imei.php | GET | ✔ | ฟอร์มสั่งเช็ค + service picker
 |

| 
/user/process_check.php | POST (AJAX) | ✔ | หัวใจของระบบ — ตัดเครดิต + ยิง provider
 |

| 
/user/provider_order_status.php | POST (AJAX) | ✔ | Poll สถานะออเดอร์ที่ค้าง
 |

| 
/user/add_funds.php | GET | ✔ | เลือกช่องทางชำระ + กรอกยอด
 |

| 
/user/payment/create.php | POST | ✔ | สร้าง invoice → redirect ไปหน้า status
 |

| 
/user/payment/status.php?id={ref} | GET | ✔ | หน้า invoice: ปลายทางโอน, QR, สรุปยอด
 |

| 
/user/payment/manual_submit.php | POST | ✔ | แจ้ง transaction reference ให้แอดมินตรวจ
 |

| 
/user/payment_history.php | GET | ✔ | สรุปการเงิน + ตาราง invoice
 |

| 
/user/user_history.php | GET | ✔ | ประวัติเช็ค / การใช้เครดิต / การเติมเงิน
 |

| 
/user/api_portal.php | GET/POST | ✔ | ขอสิทธิ์ใช้ API (ต้องแอดมินอนุมัติ)
 |

| 
/user/account_settings.php | GET/POST | ✔ | เปลี่ยนรหัสผ่าน / อีเมล
 |

| 
/user/reseller_dashboard.php | GET/POST | ✔ | สมัคร/ใช้งาน reseller
 |

| 
/robots.txt | GET | – | Disallow: /admin/, Disallow: /user/login.php
 |

| 
/sitemap.xml | GET | – | รวมหน้า public + /seo/{country}.php
 |

---

## 3. Flow หลัก — เช็ค IMEI (สำคัญที่สุด)

### 3.1 Sequence

sequenceDiagram
    autonumber
    participant U as ผู้ใช้
    participant JS as user-check.js
    participant PC as process_check.php
    participant DB as Database
    participant PV as Provider ภายนอก
    participant PS as provider_order_status.php

    U->>JS: กรอก IMEI/SN + เลือก service
    Note over JS: validate ฝั่ง client<br/>IMEI = \d{15} · Serial = [A-Z0-9]{6,20} (ต้องมีตัวอักษร)<br/>เช็ค sellPrice <= availableCredit
    JS->>JS: เปิด modal "processing"<br/>เปลี่ยนข้อความทุก 10 วิ (3 ขั้น)
    JS->>PC: POST csrf_token, service_id, imei<br/>(x-www-form-urlencoded, X-Requested-With: XMLHttpRequest)

    PC->>DB: ตรวจ session + CSRF + maintenance mode
    PC->>DB: ตรวจเครดิต >= sell_price
    PC->>DB: **HOLD** เครดิต (credit_held) + สร้าง log row
    PC->>PV: ยิงคำสั่งไปยัง provider ตาม service_id
    alt provider ตอบทันที (success)
        PV-->>PC: ผลลัพธ์
        PC->>DB: **CHARGE** เครดิต (credit_charged) + บันทึกผล
        PC-->>JS: {success:true, response:{...}, sell_price, new_credit, ...}
    else provider ตอบ pending
        PV-->>PC: accepted / pending
        PC-->>JS: {success:true, log_id, response:{status:"pending"}}
        loop สูงสุด 4 รอบ (เว้นรอบละ 10 วินาที)
            JS->>PS: POST log_id, csrf_token
            PS->>DB: อ่านสถานะ log
            PS-->>JS: {status, response, new_credit, message|error}
        end
        Note over JS: status=success → แสดงผล<br/>status=error/rejected → throw + คืนเครดิต<br/>ครบ 4 รอบยังไม่จบ → ให้ไปดูใน Order history
    else provider ล้มเหลว
        PC->>DB: **REFUND** เครดิตที่ hold ไว้ (credit_refunded)
        PC-->>JS: {success:false, error, credit_refunded, credit_balance}
    end

    JS->>U: render ผล + toast "Check completed. $X.XX charged."
    Note over DB: ผลถูก save เข้า order history อัตโนมัติ

### 3.2 Request / Response contract

POST /user/process_check.php

Content-Type: application/x-www-form-urlencoded;charset=UTF-8
Accept: application/json
X-Requested-With: XMLHttpRequest
credentials: same-origin

csrf_token=<hex64>&service_id=<int>&imei=<string>

Response JSON — ฟิลด์ที่ฝั่ง client อ่านจริง:

| 
ฟิลด์ | ความหมาย
 |

| 
success | boolean — ตัวตัดสินหลัก (แม้ HTTP 200 ก็ถือว่า fail ถ้า success=false)
 |

| 
log_id | id ของออเดอร์ ใช้ต่อกับ polling
 |

| 
response | object ผลลัพธ์จาก provider · response.status === "pending" = ยังไม่จบ
 |

| 
imei | identifier ที่เช็ค
 |

| 
service | ชื่อ/ข้อมูล service
 |

| 
sell_price | ราคาที่ตัด
 |

| 
reason / error / message | ข้อความ error (ใช้ตามลำดับ)
 |

| 
กลุ่มเครดิต | credit_before, credit_held, credit_charged, credit_refunded, credit_deducted, credit_balance, credit_status, credit_message, new_credit
 |

POST /user/provider_order_status.php

log_id=<int>&csrf_token=<hex64>
→ { status: "success"|"error"|..., response: {...}, new_credit, message, error }

### 3.3 โมเดลเครดิตแบบ Hold → Charge / Refund ⭐

นี่คือส่วนที่ควรลอกไปใช้มากที่สุด — ระบบ ไม่ได้หักเครดิตตรง ๆ แต่ใช้ escrow 3 สถานะ:

stateDiagram-v2
    [*] --> Available: credit_before
    Available --> Held: hold ตอนรับออเดอร์<br/>(credit_held)
    Held --> Charged: provider สำเร็จ<br/>(credit_charged)
    Held --> Refunded: provider fail / timeout<br/>(credit_refunded)
    Charged --> [*]: credit_balance ใหม่
    Refunded --> Available: คืนยอดเดิม
หลักฐานยืนยันจาก UI:

- หน้า Payments เขียนว่า "Failed provider checks that restored the held credit are excluded from service spending."
- ข้อความ AbortError: "The lookup took too long. Your credit is protected; please check your history before trying again."
- หน้า invoice: "Credit is added automatically only after a signed provider confirmation."

### 3.4 UX patterns ที่ฝัง flow ไว้

- Optimistic progress: 3 ข้อความหมุนทุก 10 วิ — Connecting… → The provider is checking… → Preparing your device information…

- Abort controller: ยกเลิก request ได้ พร้อมข้อความยืนยันว่าเครดิตปลอดภัย

- Remember service: toggle เก็บ service ล่าสุดใน localStorage key ผูกกับ user id

- Maintenance mode: config ฝั่ง server ส่งมาเป็น object พร้อม serverNow (unix ts) เพื่อให้ client นับถอยหลังได้

{"active":false,"state":"inactive","target":null,"serverNow":1787316074,
 "message":"IMEI and serial number checks are temporarily unavailable while we improve the service."}

- Config ผ่าน global object — PHP inject window.baseimeiCheckConfig แล้ว JS อ่าน (ไม่ hardcode endpoint ใน JS)

| 
key | ค่า
 |

| 
credit | ยอดเครดิตปัจจุบัน
 |

| 
selectedService | service ที่ preselect (จาก query string)
 |

| 
endpoint | process_check.php
 |

| 
statusEndpoint | provider_order_status.php
 |

| 
preferredServiceKey | baseimei-user-preferred-service-{userId}
 |

| 
maintenance | object ด้านบน
 |

- Service picker ฝัง data ไว้ใน DOM ทั้งหมด (38 รายการ) ไม่ต้องยิง API เพิ่ม:

<button data-service-option data-id="62" data-name="Apple BASIC INFO (PRO) - new"
        data-sell-price="0.07" data-search="apple basic info (pro) - new 62">

data-search = string ที่ normalize แล้วสำหรับ filter ฝั่ง client

---

## 4. Flow การเงิน — Add Funds → Invoice → Manual Verify

sequenceDiagram
    autonumber
    participant U as ผู้ใช้
    participant AF as add_funds.php
    participant CR as payment/create.php
    participant ST as payment/status.php
    participant MS as payment/manual_submit.php
    participant AD as แอดมิน (/admin/)
    participant DB as Database

    U->>AF: เลือก gateway + กรอกยอด USD
    AF->>CR: POST csrf_token, gateway=crypto_networks, credit_amount
    Note over CR: ล็อกค่า fee / tax / exchange rate / total<br/>ลงใน invoice ตอนสร้าง
    CR->>DB: สร้าง invoice (ref = md5 32 hex, status=pending)
    CR-->>U: 302 → status.php?id={ref}
    ST-->>U: แสดง asset (USDT), network (BEP-20),<br/>wallet address, QR, total due
    U->>U: โอนคริปโตนอกระบบ
    U->>MS: POST csrf_token, invoice_id, payment_reference (tx hash), note
    MS->>DB: บันทึกเป็น "Pending / review"
    AD->>DB: ตรวจสอบ tx แล้วอนุมัติ
    DB-->>U: เครดิตเข้าบัญชี · invoice → success

### 4.1 จุดสำคัญของโมเดลนี้

- Manual settlement — ไม่มี payment gateway webhook อัตโนมัติ; แอดมินยืนยันเอง (มี CTA ให้ทัก Messenger / WhatsApp / Email / โทร)
- ล็อกตัวเลขตอนสร้าง invoice: "Fees, tax, exchange rate, and the final amount are locked into your invoice."
- Invoice reference = 32-hex (ดูเป็น md5) ใช้เป็นทั้ง URL param และเลขที่แสดงผล (ตัด 10 ตัวแรกเป็นตัวใหญ่ เช่น #6EB7B722D1)
- หน้า invoice เป็น standalone layout (ไม่มี sidebar) — เหมาะกับการเปิดข้ามอุปกรณ์/ส่งลิงก์
- QR เป็นไฟล์ที่แอดมินอัปโหลด: /uploads/payment_qr/crypto-qr-<hash>.jpg

### 4.2 ฟอร์ม

| 
Endpoint | Fields
 |

| 
payment/create.php | csrf_token, gateway=crypto_networks, credit_amount (pattern="\d{1,8}(?:\.\d{1,2})?")
 |

| 
payment/manual_submit.php | csrf_token, invoice_id, payment_reference, note
 |

### 4.3 สถานะ invoice ที่พบ

Awaiting payment (Pending) · Successful · Failed / closed · Refunded
— หน้า Payments นับแยกเป็น 5 ตัวเลข: Successful / Pending-review / Failed-closed / Refunded / All attempts

---

## 5. Reporting & History

### 5.1 payment_history.php

- Filter ผ่าน query string ล้วน: ?period={today|week|month|year|all}&status={all|…}&gateway={all|…}
- ฟอร์ม filter เป็น method="get" + hidden period → ไม่มี JS เลย
- KPI cards: Credit purchased · Credit used · Other credit added (adjustments/restored) · Payment success %
- แยกการใช้เครดิตเป็น Website checks vs API checks → 🔶 ตาราง log มีคอลัมน์ source หรือ channel
- ตาราง: Invoice · Payment method · Credit · Total paid (+fee) · Status · Date · Open

### 5.2 user_history.php

- 3 แท็บ: ?tab={checks|usage|funds} × &filter={all|today|week|month|year} + &page=N
- Server-side pagination (หน้าแสดง Page 1, 0 entries)
- Search box เป็น client-side filter ของหน้าปัจจุบัน (มี keyboard shortcut /)

### 5.3 dashboard.php widgets

Total checks (all-time) · This month + completed today · Most-used service · กราฟแท่ง 7 วัน · Recent checks · ประกาศจากแอดมิน (พร้อม Updated {date}) · Membership tier (Newbie) + Member since + Account type (Customer) · Popular services · Recent top-ups

🔶 Membership tier น่าจะคำนวณจากยอดใช้จ่าย/จำนวนเช็คสะสม (ยังไม่เห็นเกณฑ์)

---

## 6. โมดูลที่ต้องแอดมินอนุมัติ (gated)

### 6.1 API Portal

- สถานะบัญชีปัจจุบัน: None
- ฟอร์มขอสิทธิ์: action=request_access, website_url, contact_channel, use_case
- คำอธิบายบอกว่ารองรับ 3 รูปแบบ: REST · PHP query style · DHRU compatible
(DHRU Fusion = มาตรฐาน API ของวงการ IMEI unlock — สำคัญมากถ้าจะทำระบบแนวนี้ให้ reseller เชื่อมได้)
- ใช้ เครดิตก้อนเดียวกับหน้าเว็บ (prepaid balance ร่วม)

### 6.2 Reseller

- ฟอร์มสมัคร: action=request_reseller, return_section
- ความสามารถที่โฆษณาไว้ (เมื่อได้รับอนุมัติ):
Invite customers — สร้าง registration link แบบจำกัดการใช้งาน
- Control credit — โอน/ดึงเครดิตคืนจากลูกค้า พร้อม audit trail
- Protect accounts — pause บัญชีลูกค้าโดยไม่ลบข้อมูล/ยอดคงเหลือ

- user-reseller.js (~14 KB) เป็น UI logic ล้วน — ทุก action post กลับหน้าเดิมพร้อม hidden action

### 6.3 Account & Security

ทั้ง 3 ฟอร์ม POST กลับหน้าเดิม แยกด้วย hidden action:

| 
action | fields
 |

| 
change_password | csrf_token, current_password, new_password, confirm_password
 |

| 
send_password_reset | csrf_token
 |

| 
request_email_change | csrf_token, new_email, email_current_password
 |

เปลี่ยนอีเมลเป็น flow 3 ขั้น: กรอกอีเมลใหม่ + รหัสผ่าน → เปิดลิงก์ยืนยันในกล่องใหม่ → อีเมลใหม่มีผล (อีเมลเดิมยังใช้ได้จนกว่าจะยืนยัน)

---

## 7. Schema ที่อนุมานได้ 🔶

erDiagram
    USERS ||--o{ IMEI_LOGS : places
    USERS ||--o{ INVOICES : creates
    USERS ||--o{ CREDIT_LEDGER : has
    USERS ||--o{ API_KEYS : owns
    USERS ||--o{ USERS : "reseller parent"
    SERVICES ||--o{ IMEI_LOGS : "used in"
    PROVIDERS ||--o{ SERVICES : supplies
    INVOICES ||--o{ CREDIT_LEDGER : "credits on approval"
    IMEI_LOGS ||--o{ CREDIT_LEDGER : "hold/charge/refund"

    USERS {
        int id PK
        string username
        string email
        string password_hash
        decimal credit
        string account_type "Customer|Reseller|Admin"
        string membership_tier "Newbie|..."
        int parent_reseller_id FK
        string status "active|paused"
        datetime created_at
    }
    SERVICES {
        int id PK "62, 27, 55, ... (ไม่เรียงต่อเนื่อง → มีการเพิ่ม/ปิดตามเวลา)"
        string name
        decimal cost_price
        decimal sell_price
        int provider_id FK
        string identifier_type "imei|serial|both"
        bool is_active
    }
    IMEI_LOGS {
        int id PK "= log_id ที่ client ใช้ poll"
        int user_id FK
        int service_id FK
        string identifier
        string status "pending|success|error"
        json response
        decimal sell_price
        string source "website|api"
        string provider_order_id
        datetime created_at
    }
    INVOICES {
        string reference PK "32-hex"
        int user_id FK
        string gateway "crypto_networks"
        decimal credit_amount
        decimal payment_amount
        decimal fee
        decimal tax
        decimal total_due
        string currency "USD"
        string status "pending|success|failed|refunded"
        string payment_reference "tx hash ที่ผู้ใช้แจ้ง"
        text note
        datetime created_at
    }
    CREDIT_LEDGER {
        int id PK
        int user_id FK
        decimal amount
        string type "topup|hold|charge|refund|adjustment|reseller_transfer"
        string ref_type
        int ref_id
        decimal balance_after
        datetime created_at
    }
    API_KEYS {
        int id PK
        int user_id FK
        string key_hash
        string status "none|pending|approved"
        string website_url
        string contact_channel
        text use_case
    }
เหตุผลที่เชื่อว่ามี ledger แยก: หน้า Payments มีการ์ด "Other credit added — Adjustments and restored credit" แยกจาก "Credit purchased" และแยก "Credit used" ออกเป็น website vs API → ต้องมีตารางเคลื่อนไหวเครดิตที่มี type ไม่ใช่แค่คอลัมน์ credit ในตาราง users

---

## 8. ความปลอดภัย / แพตเทิร์นที่สังเกตได้

| 
หัวข้อ | สิ่งที่ทำ
 |

| 
CSRF | ทุกฟอร์มและทุก AJAX มี csrf_token (hex 64 ตัว) — token ถูกอ่านจาก DOM ก่อนยิง poll ด้วย
 |

| 
Session | cookie-based, credentials: "same-origin"
 |

| 
AJAX marker | ส่ง X-Requested-With: XMLHttpRequest ให้ backend แยก request ได้
 |

| 
Response guard | client ไม่เชื่อ HTTP status อย่างเดียว — parse JSON แล้วเช็ค data.success เสมอ; ถ้า parse ไม่ได้ throw "server returned an unreadable response"
 |

| 
Validation | ตรวจซ้ำสองชั้น (client regex + 🔶 server)
 |

| 
robots.txt | ซ่อน /admin/ และ /user/login.php
 |

| 
Money handling | เก็บ/แสดงเป็นทศนิยม 2 ตำแหน่ง, invoice ล็อกอัตราตอนสร้าง
 |

---

## 9. สิ่งที่ควรหยิบไปใช้ / สิ่งที่ควรทำต่างออกไป

ควรลอก

- Hold → Charge/Refund สำหรับทุกงานที่พึ่ง provider ภายนอก — ป้องกันเครดิตหายเมื่อ provider ล่ม
- สอง endpoint แยกกัน: process_check (สั่ง) + provider_order_status (poll) — ทำให้จัดการ async ได้โดยไม่ต้องมี websocket
- Config injection ผ่าน global object แทนการ hardcode endpoint ใน JS
- Maintenance mode พร้อม serverNow ให้ client นับถอยหลังได้โดยไม่พึ่งนาฬิกาเครื่อง
- หน้า invoice แบบ standalone + reference URL — ส่งลิงก์ให้ลูกค้า/แอดมินได้ตรง ๆ
- แยก usage เป็น website / API ตั้งแต่ต้น จะรายงานได้โดยไม่ต้อง migrate ทีหลัง
- CSS/JS ต่อหน้า — หน้าที่ไม่มี interaction ไม่โหลด JS เลย

ควรปรับปรุงถ้าทำเอง

- Polling จำกัด 4 รอบ × 10 วิ = 40 วินาที เท่านั้น — งานที่ช้ากว่านั้นผู้ใช้ต้องไปดูเองใน history → ควรมี webhook/SSE หรือ push notification
- เติมเงินเป็น manual ล้วน (ต้องรอแอดมิน) → ควรต่อ webhook ของ payment processor หรือ watcher บน chain
- เข้าหน้า add funds แล้ว สร้าง invoice ค้างได้ไม่จำกัด (พบ invoice pending ซ้ำ 2 ใบในนาทีเดียวกัน) → ควร reuse invoice ที่ยัง pending อยู่ หรือมี TTL/auto-expire
- ไม่มี rate limit ที่มองเห็นบน endpoint สั่งเช็ค 🔶
- Service list 38 รายการ render ลง DOM ทั้งหมด — ยังโอเคที่สเกลนี้ แต่ถ้าเกิน ~200 ควรเปลี่ยนเป็น search endpoint

---

## ภาคผนวก A — Service catalog (38 รายการ, ราคาขาย USD)

| 
ID | Service | ราคา
 |

| 
62 | Apple BASIC INFO (PRO) - new | 0.07
 |

| 
27 | Apple Carrier Check (S2) | 0.07
 |

| 
55 | Apple Demo Unit Device Info | 0.24
 |

| 
31 | APPLE FULL INFO [+Carrier] A | 0.12
 |

| 
24 | Apple FULL INFO [+Carrier] B (+MDM) | 0.24
 |

| 
10 | Apple FULL INFO [No Carrier] | 0.10
 |

| 
48 | Apple SERIAL Info (model, size, color) | 0.04
 |

| 
25 | Apple SimLock Check | 0.05
 |

| 
13 | Apple Warranty + Activation - PRO [IMEI/SN] | 0.05
 |

| 
35 | Apple Warranty + Activation [IMEI/SN] | 0.04
 |

| 
15 | Blacklist Pro Check (GSMA) | 0.10
 |

| 
14 | Blacklist Status (GSMA) | 0.05
 |

| 
50 | Blacklist Status - cheap | 0.04
 |

| 
37 | Find My iPhone [FMI] (ON/OFF) | 0.04
 |

| 
51 | Google Pixel Info | 0.22
 |

| 
36 | GSX Next Tether + iOS (GSX Carrier) | 0.70
 |

| 
52 | Honor Info | 0.08
 |

| 
22 | Huawei IMEI Info | 0.10
 |

| 
11 | iCloud Clean/Lost Check | 0.05
 |

| 
23 | iMac FMI Status On/Off | 0.40
 |

| 
38 | IMEI to Brand/Model/Name | 0.04
 |

| 
42 | IMEI to Model [all brands][IMEI/SN] | 0.04
 |

| 
20 | IMEI to SN (Full Convertor) | 0.05
 |

| 
47 | LG IMEI INFO | 0.08
 |

| 
32 | MDM STATUS ON/OFF + FMIP + MODEL | 0.41
 |

| 
19 | Model + Color + Storage + FMI | 0.05
 |

| 
49 | Model Description (Any Apple SN/IMEI) | 0.05
 |

| 
28 | ONEPLUS IMEI INFO | 0.07
 |

| 
53 | Realme Info | 0.07
 |

| 
30 | Replaced Status (Original Device) | 0.04
 |

| 
29 | Replacement Status (Active Device) | 0.04
 |

| 
66 | Samsung Info + KNOX GUARD (imei only)(S1) | 0.14
 |

| 
57 | Samsung Info (S1) (IMEI) | 0.08
 |

| 
45 | Samsung Info (S1) + Blacklist | 0.09
 |

| 
17 | SOLD BY + GSX Apple | 1.49
 |

| 
41 | T-mobile (ESN) PRO Check | 0.07
 |

| 
43 | Verizon (ESN) Clean/Lost Status | 0.07
 |

| 
44 | XIAOMI MI LOCK & INFO | 0.08
 |

ช่วงราคา 0.04 – 1.49 USD · ID ไม่เรียงต่อเนื่อง (10–66) → มีการเปิด/ปิด service ตามเวลา

---

## ภาคผนวก B — ข้อจำกัดของเอกสารนี้

สิ่งที่ ยืนยันได้จริง: route ทั้งหมด, ชื่อ endpoint, ชื่อฟิลด์ในฟอร์ม/JSON, logic ฝั่ง client (validation, polling, retry), โครง UI, สถานะที่ระบบใช้, service catalog

สิ่งที่ ยังไม่ได้ตรวจสอบ (ต้องดูจากฝั่ง server หรือทดลองใช้งานจริง):

- โค้ด PHP, โครงตารางจริง, index, transaction isolation
- Flow login/register/reset password (บัญชีล็อกอินอยู่ ระบบ redirect ทุกครั้ง — ไม่ได้ logout เพื่อเลี่ยงการรบกวน session)
- Response จริงของ process_check.php (ยอดเครดิต $0.00 จึงยิงจริงไม่ได้)
- โครงสร้าง object response ที่ provider ส่งกลับ (ยังไม่มีออเดอร์ในบัญชี)
- /admin/ ทั้งหมด (robots disallow — ไม่แตะต้อง)
- API spec จริง (REST / PHP query / DHRU) — ต้องได้รับอนุมัติจากแอดมินก่อน
- ฟีเจอร์ reseller หลังอนุมัติ
- rate limit, logging, retry policy ฝั่ง server

ขั้นตอนถัดไปที่จะเติมช่องว่างได้เร็วที่สุด: เติมเครดิตขั้นต่ำแล้วสั่งเช็คบริการถูกสุด (0.04 USD) 1 ครั้ง โดยเปิด DevTools Network ค้างไว้ — จะได้ payload/response จริงของ process_check.php และโครง response object ครบ

.mermaid-diagram{margin-block:4px}.mermaid-diagram svg{display:block;margin:0 auto;max-width:100%;height:auto}
