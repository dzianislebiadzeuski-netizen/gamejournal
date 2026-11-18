// HTTP that bypasses CORS on Android (native stack) and falls back to fetch in the browser.
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export async function request({ url, method = 'GET', headers = {}, data, responseType = 'json', timeout = 15000 }) {
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.request({ url, method, headers, data, responseType, connectTimeout: timeout, readTimeout: timeout });
    let body = r.data;
    if (responseType === 'json' && typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }
    return { status: r.status, data: body, headers: r.headers || {} };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      method,
      headers,
      body: data == null ? undefined : typeof data === 'string' ? data : JSON.stringify(data),
      signal: ctrl.signal,
    });
    let body;
    if (responseType === 'blob') {
      const buf = new Uint8Array(await r.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      body = btoa(s);
    } else {
      const text = await r.text();
      body = text;
      if (responseType === 'json') { try { body = JSON.parse(text); } catch {} }
    }
    return { status: r.status, data: body, headers: Object.fromEntries(r.headers.entries()) };
  } finally {
    clearTimeout(t);
  }
}
