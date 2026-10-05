# Deploying

The app runs as a systemd service on the box and Caddy terminates TLS in
front of it. One script does both the first-time provisioning and every
update after it.

    Caddy :443  ──reverse_proxy──▶  next start :3000  ──▶  data/iunlockmobile.db

## Before you point customers at it

The build is complete as software and **not ready to take money**. Four
things are still unfinished, and each one is a real problem in production.
The first three now refuse rather than improvise, so the service fails
visibly instead of quietly doing the wrong thing — but refusing is not the
same as working:

1. **No supplier is configured.** Under `NODE_ENV=production` the app will
   not fall back to the demo supplier, because that one derives an unlock
   code from a hash of the IMEI and the order pipeline charges for it
   either way. Orders are refused until `IUNLOCKMOBILE_PROVIDER_MODE`, the
   endpoint, the credentials and a checked service map are set.
2. **No payment address is set.** With `IUNLOCKMOBILE_USDT_BEP20_ADDRESS`
   empty no payment method is offered at all. Before setting it, send a
   small transfer and confirm it arrives: a wrong address sends customer
   funds somewhere unrecoverable.
3. **Top-ups confirm themselves — if the watcher can read the chain.**
   Each invoice asks for a coded USDT amount (25.0037 for $25), and the
   server reads BNB Smart Chain and credits the invoice whose code the
   transfer carries. That needs `IUNLOCKMOBILE_BSC_RPC_URL` pointed at an
   endpoint that serves `eth_getLogs` (see "USDT detection" below). Transfers
   without a code wait in `/admin` for a person. The stand-in self-approval
   button is still off in production and stays off — it mints credit.
4. **Prices and turnarounds are invented.** Everything in
   `lib/catalog.ts` is a plausible schedule, not a quoted one. Nothing in
   the code can tell that this one is wrong.

Deploying is fine — running it as a public storefront is not, until those
are real. `IUNLOCKMOBILE_MAINTENANCE=1` in `/etc/iunlockmobile.env` is the
shipped default and keeps orders closed: the site stays browsable and the
order form says the service is paused.

## Rehearse it on your own machine first

`deploy/local.sh` runs the same steps this deploy runs on the server — `npm
ci`, a real production build, `next start` with `NODE_ENV=production` — but
in the foreground, on its own database, with no sudo, no systemd and no
Caddy. What you see is what the server will serve.

```sh
npm run deploy:local                    # build and serve on :3000
./deploy/local.sh --fresh --demo        # wipe local data and seed an account
./deploy/local.sh --port 4000
```

`--demo` seeds `demo` / `demo-password-123` with credit and three orders —
one delivered, one still with the carrier, one refused and refunded — so
the workspace has something in it. It writes to `data/local.db`, separate
from anything else, and only ever runs locally.

The rehearsal sets `IUNLOCKMOBILE_ALLOW_SELF_APPROVE=1` so the top-up flow can be
walked without an admin. **That is a local-only switch** — it settles an
invoice without a payment, and the server must never have it.

The one layer it does not rehearse is Caddy and TLS, because a certificate
needs a public hostname. Check that config separately:

```sh
caddy validate --config deploy/Caddyfile
```

## Coming from an earlier deploy

The database file and the environment variables were renamed with the
brand. If a box is already running an older build with data worth keeping,
rename the file before deploying — otherwise the app starts on an empty
database and the old one just sits there unused:

```sh
cd ~/apps/unlockservice/data
for f in openline.db openline.db-wal openline.db-shm; do
  [ -f "$f" ] && mv "$f" "iunlockmobile.${f#openline.}"
done
```

`OPENLINE_*` became `IUNLOCKMOBILE_*`. The unit file in this repo already
uses the new names and `deploy.sh` reinstalls it, so nothing else to do —
unless you set one of them somewhere else by hand.

Signed-in sessions end once, because the cookie was renamed too.

## Pointing the domain (GoDaddy)

GoDaddy's Web Hosting and Managed WordPress plans run PHP on a shared
server. This app is a long-running Node process with its own database and
a reverse proxy in front, so it cannot live there — no shell, no systemd,
no way to keep a process up. That hosting plan stays unused; GoDaddy's job
here is the domain.

The app keeps running on the VM, and `iunlockmobile.com` is pointed at it.

### 1. Open port 80 and 443 on the VM

Caddy needs **80** as well as 443 — that is how the certificate is issued
and renewed, so it cannot be closed once TLS works.

The IP suggests Google Cloud. In the console: *VPC network → Firewall →
Create firewall rule*, ingress, source `0.0.0.0/0`, TCP `80,443`. Or:

```sh
gcloud compute firewall-rules create allow-web \
  --direction=INGRESS --action=ALLOW --rules=tcp:80,tcp:443 \
  --source-ranges=0.0.0.0/0 --network=default
```

If the box also runs its own firewall:

```sh
sudo ufw allow 80,443/tcp && sudo ufw status
```

### 2. Detach the domain from the GoDaddy hosting

If `iunlockmobile.com` is attached to the cPanel or WordPress product,
GoDaddy manages its A record and will put its own value back. Remove the
domain from that product first, in *My Products → the hosting plan →
Settings*.

Then check *Domain Portfolio → the domain → Forwarding*: **any forwarding
rule has to go.** Forwarding answers with a redirect before the request
ever reaches the VM, and it is the single most common reason a correctly
pointed domain still shows the wrong page.

### 3. Set the records

*My Products → the domain → DNS → DNS Records.* **Edit the records that
are already there** rather than adding new ones — two A records for `@`
will send half your visitors to the old host.

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `34.138.231.163` | 600 seconds |
| CNAME | `www` | `@` | 1 hour |

GoDaddy ships `www` as a CNAME to `@` already, so it usually needs no
change; if yours is an A record instead, give it the same IP. Caddy
redirects www to the bare domain either way.

Leave the nameservers on GoDaddy's own, and leave `MX` and any mail
records alone — changing an A record does not affect email.

### 4. Deploy, then check

DNS takes anywhere from a few minutes to an hour. Once it has moved, run
the deploy so Caddy picks up the new site and requests a certificate:

```sh
~/apps/unlockservice/deploy/deploy.sh
```

Then, from your own machine — not the server, because what matters is what
a customer's resolver sees:

```sh
./deploy/check-domain.sh
```

It reports DNS, the redirect on port 80, the certificate issuer and expiry,
and whether the app's own health endpoint answers, and exits non-zero if
anything is off.

Certificates are issued on the first request for the new hostname, so give
it a few seconds and re-run if the first attempt catches Caddy mid-issue.
`sudo journalctl -u caddy -f` shows what it is doing.

Once `iunlockmobile.com` is answering, drop the `sslip.io` host from
`deploy/Caddyfile` and deploy again.

## First time on a fresh Ubuntu box

Node 22 or newer, git, and Caddy. As `ubuntu`:

```sh
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Caddy
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

Open 80 and 443 to the world — Caddy needs both to get and renew its
certificate. The hostname in `Caddyfile` is
`unlockservice.34-138-231-163.sslip.io`, which sslip.io resolves to
`34.138.231.163` with no DNS to configure. Swap it for your own domain
when you have one, and point an A record at the box first.

## Deploy

```sh
curl -fsSL https://raw.githubusercontent.com/minerelx168-sketch/unlockservice/claude/website-design-patterns-5043ix/deploy/deploy.sh | bash
```

After the first run the repo is on the box, so later deploys are just:

```sh
~/apps/unlockservice/deploy/deploy.sh
```

It fetches the branch, reinstalls, rebuilds, reinstalls the units,
restarts, and waits for a 200 before declaring success. If the app does
not come up it prints the last 40 log lines and exits non-zero.

`data/iunlockmobile.db` lives inside the app directory and is untracked, so a
deploy never touches it. Back it up before anything destructive:

```sh
sqlite3 ~/apps/unlockservice/data/iunlockmobile.db ".backup '/home/ubuntu/iunlockmobile-$(date +%F).db'"
```

## Deploy on every push

`.github/workflows/deploy.yml` builds, lints and type-checks every push to
the deploy branch, then runs the same script over SSH. It stays skipped
until you configure, in the repository settings:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `DEPLOY_HOST` | `34.138.231.163` |
| Variable | `DEPLOY_USER` | `ubuntu` |
| Secret | `DEPLOY_SSH_KEY` | Private half of a key whose public half is in the box's `~/.ssh/authorized_keys` |

Generate a deploy-only key rather than reusing a personal one:

```sh
ssh-keygen -t ed25519 -C 'github-deploy' -f ~/.ssh/unlockservice_deploy -N ''
# public half onto the server, private half into the DEPLOY_SSH_KEY secret
```

## Operating it

```sh
sudo systemctl status unlockservice
sudo journalctl -u unlockservice -f
sudo systemctl restart unlockservice
sudo caddy validate --config /etc/caddy/Caddyfile
```

Roll back to the previous commit:

```sh
cd ~/apps/unlockservice
git reset --hard HEAD~1 && npm ci && npm run build
sudo systemctl restart unlockservice
```

## Environment

Everything except the three fixed values in the unit lives in
**`/etc/iunlockmobile.env`**, owned by root, mode 0600. `deploy.sh` installs
it from `deploy/iunlockmobile.env.example` with paused defaults on a first
run, and never touches an existing one.

`EnvironmentFile=` carries a leading dash, so a missing file does not stop
the service from starting. That is deliberate and it is not a soft default:
every dangerous switch fails closed on its own, so with no file at all the
supplier is disabled and orders are refused outright, no payment method is
offered, self-approval is off, and IMEI checks refuse to run. A service that
will not start is the worse failure, and it is the one an operator hits when
a new unit lands a moment before its configuration does. After a deploy,
check what the service actually read rather than what you meant it to:

```sh
sudo systemctl show unlockservice -p Environment
```

```sh
sudo nano /etc/iunlockmobile.env
sudo systemctl restart unlockservice
sudo systemctl show unlockservice -p Environment   # confirm what it actually read
```

`deploy/iunlockmobile.env.example` is the annotated list. The ones that
decide whether the service is safe:

| Variable | Effect |
| --- | --- |
| `IUNLOCKMOBILE_DB` | Where the SQLite file lives. Set in the unit, already pointing at the app's `data/` directory. |
| `IUNLOCKMOBILE_MAINTENANCE=1` | Pauses new orders; the rest of the site stays up. The shipped default. |
| `IUNLOCKMOBILE_PROVIDER_MODE` | `disabled` until a real supplier is configured. While disabled, production refuses orders rather than serving invented codes. |
| `IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET` | Keys the fingerprint that stands in for a stored IMEI. At least 32 characters. Without it, production refuses to run checks. Changing it orphans every existing fingerprint. |
| `IUNLOCKMOBILE_USDT_BEP20_ADDRESS` | The receiving wallet. Unset means no payment method is offered, which is the right state until a test transfer has arrived. |
| `IUNLOCKMOBILE_BSC_RPC_URL` | BNB Smart Chain JSON-RPC the payment watcher reads. Must serve `eth_getLogs`. Read-only; no key for the wallet is ever on the server. |
| `IUNLOCKMOBILE_USDT_SHORTFALL_TOLERANCE_CENTS` / `_BPS` | How short a coded transfer may arrive and still credit the full invoice (exchange withdrawal fees): the smaller of 100 cents and 3% of the invoice by default. Set either to 0 to credit only what arrives. |
| `IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION=1` | Makes an account prove its address. Turn it on once mail works: it also closes the path where a Google sign-in adopts an account that only asserted the address. |
| `IUNLOCKMOBILE_ALLOW_SELF_APPROVE=1` | Lets an account confirm its own invoice. Ignored in production, and it should never be set anywhere that holds real balances — it mints credit without a payment. |
| `IUNLOCKMOBILE_ALLOW_MOCK_SUPPLIER=1` | Serves invented unlock codes in production. For a staging box that deliberately wants the demo, and nothing else. |


## USDT detection

Customers no longer paste a transaction id. `createInvoice` gives every
invoice a two-digit code below the cents — $25.00 becomes **25.0037 USDT** —
and the watcher (`lib/usdt.ts`) reads every USDT transfer into the wallet off
BNB Smart Chain and credits the open invoice whose code it carries.

- **Where it runs.** Inside the web server, started by `instrumentation.ts`,
  every 20 seconds; also on demand while a customer has their invoice open,
  and from `npm run usdt:scan`. A lease in `chain_cursors` keeps them from
  overlapping. `IUNLOCKMOBILE_USDT_WATCH=0` turns the timer off.
- **The RPC.** Any endpoint answers a receipt lookup, but the scan uses
  `eth_getLogs`, which the free `bsc-dataseed` endpoints restrict. Use a
  provider that serves it (NodeReal, Ankr, QuickNode, Chainstack, Alchemy …)
  and put its URL in `IUNLOCKMOBILE_BSC_RPC_URL`. The watcher refuses an
  endpoint that is not chain 56, and `/admin` shows the last good scan and
  the last error.
- **What credits automatically.** A transfer whose code matches exactly one
  unpaid invoice, within ±3 USDT of its amount, in a block strictly later
  than the invoice's creation and no more than 7 days after it, buried
  under `IUNLOCKMOBILE_USDT_CONFIRMATIONS` blocks (default 15). A small
  shortfall (the smaller of $1 and 3%) credits in full; anything else
  credits what arrived. The transfer's hash and log index become the
  invoice's charge id, so one transfer can never pay two invoices and a
  re-scan never credits twice. Transfers under 1 USDT are ignored (address
  poisoning spam).
- **Limits.** An account can hold 5 open top-ups and create 10 an hour.
  Unpaid invoices close after 8 days; their code stays reserved 7 more.
  Keep the server clock on NTP: a transfer only pays an invoice created
  before its block, by the server's clock.
- **What waits for a person.** A transfer with no code (the customer rounded
  the amount), or one the customer pointed at by pasting its hash. The paste
  is checked on chain immediately, but never credits by itself: every
  transfer into the wallet is public, so anyone could paste someone else's.
  `/admin` lists these with the sender, the time, the open invoices each
  could belong to, and any rival invoice pointing at the same transfer.
  Confirming always goes through the chain record, never the pasted text.
  Money sent before its sender made an invoice: credit it with "Adjust user
  credit", then dismiss the transfer naming the adjustment.
- **The receiving wallet must be self-custody** (Trust Wallet, MetaMask, a
  hardware wallet), not an exchange deposit address. Exchanges often settle
  transfers between their own users internally, off-chain — those never
  appear on BNB Smart Chain, and nothing here can see them.
- **First start.** The cursor begins about an hour back. To pick up older
  payments, set `IUNLOCKMOBILE_USDT_SCAN_START_BLOCK` before the first start.
