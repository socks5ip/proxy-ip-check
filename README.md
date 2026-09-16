# proxy-ip-check

> Identify an IP's **ASN owner, country and network type** (consumer / hosting / proxy) from the command line.
> Zero dependencies. No API key. Works out of the box.

```bash
$ npx proxy-ip-check 8.8.8.8

  IP          8.8.8.8
  ASN         AS15169
  AS name     GOOGLE
  ISP / org   Google LLC
  Country     United States  /  Virginia
  Type        hosting / datacenter
  Source      ip-api.com
```

## Why

When you evaluate a proxy IP — for scraping, for account management, or for geo-testing — the first question is always *"who owns this network?"* An IP announced by a consumer broadband AS looks like a home user. An IP announced by a hosting AS looks like a server, because it is one.

`proxy-ip-check` answers that in one command, with no signup and no SDK.

## Install

```bash
# one-off, no install
npx proxy-ip-check 1.2.3.4

# or install
npm install -g proxy-ip-check
```

## Usage

```bash
proxy-ip-check <ip> [<ip> ...] [--json]
```

```bash
# single IP
proxy-ip-check 8.8.8.8

# several IPs (sequential, rate-limit friendly)
proxy-ip-check 8.8.8.8 1.1.1.1 223.5.5.5

# machine-readable
proxy-ip-check 8.8.8.8 --json
```

### JSON output

```json
{
  "source": "ip-api.com",
  "ip": "8.8.8.8",
  "asn": "AS15169",
  "asName": "GOOGLE",
  "isp": "Google LLC",
  "org": "Google Public DNS",
  "country": "United States",
  "countryCode": "US",
  "region": "Virginia",
  "city": "Ashburn",
  "isHosting": true,
  "isProxy": false,
  "isMobile": false,
  "networkType": "hosting",
  "isResidentialLike": false,
  "fallbackUsed": false
}
```

## Programmatic use

```javascript
const { lookup, lookupMany } = require('proxy-ip-check');

const r = await lookup('8.8.8.8');
console.log(r.asn, r.asName, r.networkType);
// AS15169 GOOGLE hosting

const list = await lookupMany(['8.8.8.8', '1.1.1.1']);
```

## Fields

| Field | Description |
|---|---|
| `asn` | Autonomous System number, e.g. `AS15169` |
| `asName` | Short AS owner name, e.g. `GOOGLE` |
| `isp` / `org` | ISP and organization name |
| `country` / `countryCode` / `region` / `city` | Location |
| `isHosting` | Provider-flagged hosting/datacenter range |
| `isProxy` | Provider-flagged proxy/VPN range |
| `isMobile` | Mobile carrier range |
| `networkType` | `consumer` / `hosting` / `proxy / vpn` / `unknown` |
| `isResidentialLike` | `true` for consumer, `false` for hosting, `null` when undetermined |
| `source` | Which data source answered (`ip-api.com` or `ipinfo.io`) |
| `fallbackUsed` | `true` if the primary source failed and the fallback answered |

## How `networkType` is determined

1. If the data source explicitly flags the range as **hosting**, → `hosting`.
2. Else if it flags **proxy/VPN**, → `proxy / vpn`.
3. Else if it explicitly flags both as false, → `consumer`.
4. Otherwise fall back to a heuristic over the AS owner name (tokens like `cloud`, `hosting`, `datacenter`, `vps` → hosting; `broadband`, `telecom`, `unicom`, `chinanet` → consumer).

**This is a first signal, not a verdict.** AS ownership tells you what class of network the IP sits on. It does not tell you the IP's reputation, whether it appears on blocklists, or whether your client leaks your real address.

## Data sources & rate limits

| Source | Role | Free tier |
|---|---|---|
| [ip-api.com](http://ip-api.com) | primary | ~45 requests / minute, no key |
| [ipinfo.io](https://ipinfo.io) | fallback | ~50k requests / month, no key |

The fallback kicks in automatically when the primary source fails (network error, rate limit, non-success status). `lookupMany()` inserts a 250 ms delay between lookups to stay polite.

## Requirements

Node.js >= 12. No dependencies.

## Related

Part of a small open toolset for proxy IP work:

- **IP quality & line check center** (free, browser-based — adds blocklist checks, leak tests and IP type databases on top of the ASN signal): https://socks5ip.com.cn/ip-check-center/
- **Proxy IP pricing dataset** (18 providers, machine-readable): https://github.com/socks5ip/proxy-ip-pricing
- **Awesome proxy providers list**: https://github.com/socks5ip/awesome-proxy-providers
- **Source code of this tool**: https://github.com/socks5ip/proxy-ip-check

## License

MIT © [socks5ip](https://socks5ip.com.cn/)
