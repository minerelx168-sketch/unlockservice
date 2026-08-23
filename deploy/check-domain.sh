#!/usr/bin/env bash
#
# Checks that a domain actually reaches this app: DNS first, then HTTP,
# then the certificate. Run it from anywhere — your laptop is the honest
# place, because that is where a customer's browser resolves from.
#
#   ./deploy/check-domain.sh                          # iunlockmobile.com
#   ./deploy/check-domain.sh example.com 1.2.3.4
#
set -uo pipefail

DOMAIN="${1:-iunlockmobile.com}"
EXPECT_IP="${2:-34.138.231.163}"

pass() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; FAILED=1; }
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
FAILED=0

# dig is not everywhere; fall back until something answers.
resolve() {
  local host="$1"
  if command -v dig >/dev/null; then
    dig +short A "$host" | grep -E '^[0-9.]+$'
  elif command -v host >/dev/null; then
    host -t A "$host" 2>/dev/null | awk '/has address/ {print $NF}'
  elif command -v getent >/dev/null; then
    getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u
  else
    python3 - "$host" <<'PY' 2>/dev/null
import socket, sys
try:
    print('\n'.join(sorted({a[4][0] for a in socket.getaddrinfo(sys.argv[1], None, socket.AF_INET)})))
except OSError:
    pass
PY
  fi
}

step "DNS — does $DOMAIN point at the server?"
APEX="$(resolve "$DOMAIN")"
if [ -z "$APEX" ]; then
  fail "$DOMAIN does not resolve yet. If you just changed it, DNS can take up to an hour."
elif echo "$APEX" | grep -qx "$EXPECT_IP"; then
  pass "$DOMAIN → $EXPECT_IP"
else
  fail "$DOMAIN → $(echo "$APEX" | tr '\n' ' ')(expected $EXPECT_IP)"
  warn "A parked page or the old hosting is probably still on the A record."
fi

WWW="$(resolve "www.$DOMAIN")"
if [ -z "$WWW" ]; then
  warn "www.$DOMAIN does not resolve — fine if you do not want the www address."
elif echo "$WWW" | grep -qx "$EXPECT_IP"; then
  pass "www.$DOMAIN → $EXPECT_IP"
else
  warn "www.$DOMAIN → $(echo "$WWW" | tr '\n' ' ')(expected $EXPECT_IP)"
fi

step "HTTP — is anything answering?"
# Port 80 has to be open even after TLS works: that is how the certificate
# gets renewed.
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$DOMAIN/" || true)"
case "$CODE" in
  30*) pass "http:// answers $CODE (redirecting to https, as it should)" ;;
  200) warn "http:// answers 200 — expected a redirect to https" ;;
  000) fail "nothing answered on port 80. Check the firewall allows tcp:80." ;;
  *)   warn "http:// answers $CODE" ;;
esac

step "HTTPS — certificate and app"
CERT="$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null \
        | openssl x509 -noout -issuer -enddate 2>/dev/null || true)"
if [ -n "$CERT" ]; then
  pass "certificate present"
  echo "$CERT" | sed 's/^/      /'
else
  fail "no certificate yet. Caddy needs tcp:80 reachable to obtain one; check firewall and logs."
fi

HEALTH="$(curl -s --max-time 10 "https://$DOMAIN/api/health" || true)"
if echo "$HEALTH" | grep -q '"ok":true'; then
  pass "the app and its database answered: $HEALTH"
else
  fail "https://$DOMAIN/api/health did not answer. ${HEALTH:+Got: $HEALTH}"
fi

if [ "$FAILED" = "0" ]; then
  printf '\n\033[1;32mAll good — https://%s is live.\033[0m\n\n' "$DOMAIN"
else
  printf '\n\033[1;31mNot live yet.\033[0m See deploy/README.md, "Pointing the domain".\n\n'
  exit 1
fi
