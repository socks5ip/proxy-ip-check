#!/usr/bin/env node
/**
 * proxy-ip-check — identify an IP's ASN owner, country and network type
 * (consumer / hosting / proxy) from the command line.
 *
 * Zero dependencies. Primary source: ip-api.com (free tier, no key required).
 * Fallback source: ipinfo.io (free tier, no key required).
 *
 *   $ proxy-ip-check 8.8.8.8
 *   $ proxy-ip-check 8.8.8.8 1.1.1.1 --json
 *
 * Programmatic:
 *   const { lookup } = require('proxy-ip-check');
 *   const r = await lookup('8.8.8.8');
 *
 * Related tooling: https://socks5ip.com.cn/ip-check-center/
 */
'use strict';

const http = require('http');
const https = require('https');

// AS-owner tokens that indicate a hosting/datacenter network.
const HOSTING_TOKENS = [
  'cloud', 'hosting', 'host', 'datacenter', 'data center', 'data-center',
  'vps', 'server', 'dedicated', 'colocation', 'colo', 'cdn', 'edge',
  'amazon', 'google', 'microsoft', 'azure', 'digitalocean', 'linode',
  'vultr', 'hetzner', 'ovh', 'contabo', 'leaseweb', 'oracle',
  'tencent', 'alibaba', 'scaleway', 'upcloud', 'choopa', 'psychz',
  'colo', 'idc', 'network solutions',
];

const CONSUMER_TOKENS = [
  'broadband', 'telecom', 'telecommunications', 'communications', 'unicom',
  'mobile', 'wireless', 'cable', 'fiber', 'fibre', 'chinanet', 'cnc',
  'cmnet', 'tietong', 'ceranet', 'isp',
];

function isIPv4(ip) {
  const parts = String(ip).trim().split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && +p <= 255);
}

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'proxy-ip-check/1.0' } }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid response from ' + new URL(url).host));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

function classifyByAsName(asName) {
  const n = String(asName || '').toLowerCase();
  if (!n) return 'unknown';
  if (CONSUMER_TOKENS.some((t) => n.includes(t))) return 'consumer';
  if (HOSTING_TOKENS.some((t) => n.includes(t))) return 'hosting';
  return 'unknown';
}

async function fromIpApi(ip) {
  const fields = 'status,message,country,countryCode,regionName,city,isp,org,as,asname,proxy,hosting,mobile';
  const j = await fetchJson('http://ip-api.com/json/' + encodeURIComponent(ip) + '?fields=' + fields);
  if (!j || j.status !== 'success') {
    throw new Error((j && j.message) || 'ip-api lookup failed');
  }
  const asFull = j.as || '';
  return {
    source: 'ip-api.com',
    ip,
    asn: asFull.split(' ')[0] || '',
    asName: j.asname || asFull.split(' ').slice(1).join(' ') || '',
    isp: j.isp || '',
    org: j.org || '',
    country: j.country || '',
    countryCode: j.countryCode || '',
    region: j.regionName || '',
    city: j.city || '',
    isHosting: !!j.hosting,
    isProxy: !!j.proxy,
    isMobile: !!j.mobile,
  };
}

async function fromIpinfo(ip) {
  const j = await fetchJson('https://ipinfo.io/' + encodeURIComponent(ip) + '/json');
  if (!j || j.error) throw new Error((j && j.error && j.error.message) || 'ipinfo lookup failed');
  const org = j.org || '';                 // "AS15169 Google LLC"
  const parts = org.split(' ');
  return {
    source: 'ipinfo.io',
    ip,
    asn: /^AS\d+/i.test(parts[0] || '') ? parts[0] : '',
    asName: parts.slice(1).join(' ') || '',
    isp: org,
    org,
    country: j.country || '',
    countryCode: j.country || '',
    region: j.region || '',
    city: j.city || '',
    isHosting: null,                        // not provided by this source
    isProxy: null,
    isMobile: null,
  };
}

/**
 * Look up ASN, AS owner, country and network type for an IPv4 address.
 * Tries ip-api.com first, falls back to ipinfo.io.
 */
async function lookup(ip) {
  if (!isIPv4(ip)) throw new Error('Only IPv4 addresses are supported: ' + ip);

  let base = null;
  let primaryErr = null;
  try {
    base = await fromIpApi(ip);
  } catch (e) {
    primaryErr = e;
    base = await fromIpinfo(ip);            // may throw
  }

  // Network type: prefer explicit boolean flags, then fall back to AS-name heuristic
  let networkType = 'unknown';
  if (base.isHosting === true) networkType = 'hosting';
  else if (base.isProxy === true) networkType = 'proxy / vpn';
  else if (base.isHosting === false && base.isProxy === false) networkType = 'consumer';
  else networkType = classifyByAsName(base.asName || base.isp);

  return Object.assign(base, {
    networkType,
    isResidentialLike:
      networkType === 'consumer' ? true : networkType === 'hosting' ? false : null,
    fallbackUsed: base.source !== 'ip-api.com',
    primaryError: primaryErr ? primaryErr.message : null,
  });
}

/** Look up several IPs sequentially, staying within free-tier rate limits. */
async function lookupMany(ips, delayMs = 250) {
  const out = [];
  for (const ip of ips) {
    try {
      out.push(await lookup(ip));
    } catch (e) {
      out.push({ ip, error: e.message });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}

module.exports = { lookup, lookupMany, classifyByAsName, isIPv4 };

// ---------- CLI ----------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const ips = argv.filter((a) => !a.startsWith('--'));

  if (!ips.length) {
    console.log('proxy-ip-check — identify an IP\'s ASN owner, country and network type');
    console.log('');
    console.log('Usage:   proxy-ip-check <ip> [<ip> ...] [--json]');
    console.log('Example: proxy-ip-check 8.8.8.8');
    console.log('');
    console.log('Docs: https://socks5ip.com.cn/ip-check-center/');
    process.exit(1);
  }

  (async () => {
    const results = await lookupMany(ips);
    if (asJson) {
      console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
      return;
    }
    for (const r of results) {
      if (r.error) {
        console.log('  ✗ ' + r.ip + '  error: ' + r.error);
        continue;
      }
      const label =
        r.networkType === 'consumer' ? 'consumer / residential-like'
          : r.networkType === 'hosting' ? 'hosting / datacenter'
            : r.networkType === 'proxy / vpn' ? 'proxy / vpn range'
              : 'unknown (inspect AS name)';
      console.log('');
      console.log('  IP          ' + r.ip);
      console.log('  ASN         ' + (r.asn || '-'));
      console.log('  AS name     ' + (r.asName || '-'));
      console.log('  ISP / org   ' + (r.isp || r.org || '-'));
      console.log('  Country     ' + (r.country || '-') + (r.region ? '  /  ' + r.region : ''));
      console.log('  Type        ' + label + (r.isMobile ? '  (mobile carrier)' : ''));
      console.log('  Source      ' + r.source + (r.fallbackUsed ? '  (fallback)' : ''));
    }
    console.log('');
    console.log('  Note: "Type" combines the provider\'s hosting/proxy flags with an AS-name');
    console.log('  heuristic. It is a first signal, not a verdict. For full reputation checks');
    console.log('  (blocklists, leak tests, IP type databases) see');
    console.log('  https://socks5ip.com.cn/ip-check-center/');
  })().catch((e) => {
    console.error('Error: ' + e.message);
    process.exit(1);
  });
}
