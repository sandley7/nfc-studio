// Motor NFC: tipos de registro (al estilo NFC Tools), tamaño NDEF, y envoltorio de Web NFC.
// Web NFC solo existe en Chrome para Android; en iPhone/PC solo se usa la parte de "preparar".
(function () {
  'use strict';
  const enc = new TextEncoder();
  const N = {};

  // Memoria de usuario en bytes de los chips más comunes (datos de fabricante, aprox.)
  N.CHIPS = {
    ntag213: { label: 'NTAG213', mem: 144 },
    ntag215: { label: 'NTAG215', mem: 504 },
    ntag216: { label: 'NTAG216', mem: 888 },
  };

  N.supported = () => typeof window !== 'undefined' && 'NDEFReader' in window;
  N.isIOS = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* ---------- Tamaño NDEF ---------- */
  const PREFIX = [['https://www.', 2], ['http://www.', 1], ['https://', 4], ['http://', 3], ['tel:', 5], ['mailto:', 6]];

  function recBytes(rec) {
    let type, payload;
    switch (rec.recordType) {
      case 'url': {
        const p = PREFIX.find(([s]) => rec.data.startsWith(s));
        type = 1;
        payload = 1 + enc.encode(p ? rec.data.slice(p[0].length) : rec.data).length;
        break;
      }
      case 'text':
        type = 1;
        payload = 1 + (rec.lang || 'en').length + enc.encode(rec.data).length;
        break;
      case 'mime':
        type = rec.mediaType.length;
        payload = typeof rec.data === 'string' ? enc.encode(rec.data).length : rec.data.byteLength;
        break;
      case 'empty':
        return 3;
      default:
        type = 1;
        payload = 0;
    }
    return (payload < 256 ? 3 : 6) + type + payload;
  }

  // message = bytes del mensaje NDEF; total = message + envoltorio TLV de la tarjeta
  N.size = (ndef) => {
    const message = ndef.reduce((n, r) => n + recBytes(r), 0);
    return { message, total: message + (message < 255 ? 3 : 5) };
  };

  /* ---------- Helpers de datos ---------- */
  N.phone = (v) => {
    const raw = String(v || '').trim();
    const d = raw.replace(/\D/g, '');
    if (d.length < 7) return '';
    if (raw.startsWith('+')) return '+' + d;
    if (d.length === 9 && d[0] === '9') return '+51' + d;
    if (d.length === 11 && d.startsWith('51')) return '+' + d;
    return '+' + d;
  };

  // Enlace de reseña desde lo que pegue el usuario: enlace g.page/…, enlace de reseña o Place ID
  N.reviewFromInput = (v) => {
    v = String(v || '').trim();
    if (!v) return { url: '', warn: '' };
    if (/^https?:\/\//i.test(v) || /^(g\.page|maps\.app\.goo\.gl|goo\.gl|search\.google\.com|(www\.)?google\.[a-z.]+)\//i.test(v)) {
      const u = U.safeUrl(/^https?:/i.test(v) ? v : 'https://' + v);
      if (!u) return { url: '', warn: 'Enlace no válido' };
      const maps = /(^|\.)maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps/i.test(u);
      return { url: u, warn: maps ? 'Este enlace abre la ficha del mapa, no la ventana de reseña. Mejor usa g.page/r/…/review o el Place ID.' : '' };
    }
    if (/^[A-Za-z0-9_-]{20,}$/.test(v)) return { url: 'https://search.google.com/local/writereview?placeid=' + v, warn: '' };
    return { url: '', warn: 'No parece un enlace ni un Place ID' };
  };

  const vEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const urlRec = (u) => ({ rec: { recordType: 'url', data: u }, text: u });
  const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

  /* ---------- Wi-Fi (Wi-Fi Simple Configuration, como lo escribe NFC Tools) ---------- */
  const u16 = (v) => new Uint8Array([(v >> 8) & 255, v & 255]);
  const cat = (...parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  };
  const tlv = (type, bytes) => cat(u16(type), u16(bytes.length), bytes);
  N.wifiPayload = (ssid, pass, security) => {
    const open = security === 'open';
    const credential = cat(
      tlv(0x1026, new Uint8Array([1])), // índice de red
      tlv(0x1045, enc.encode(ssid)), // SSID
      tlv(0x1003, u16(open ? 0x0001 : 0x0020)), // autenticación: abierta / WPA2-Personal
      tlv(0x100f, u16(open ? 0x0001 : 0x0008)), // cifrado: ninguno / AES
      tlv(0x1027, enc.encode(open ? '' : pass)), // clave
      tlv(0x1020, new Uint8Array([255, 255, 255, 255, 255, 255])) // MAC (comodín)
    );
    return cat(tlv(0x104a, new Uint8Array([0x10])), tlv(0x100e, credential));
  };

  /* ---------- Tipos de registro (una tabla gobierna la interfaz) ---------- */
  // fields: { k, label, ph, type: 'text' | 'area' | 'rest' }
  // build(r, ctx) -> { rec, text, warn? } | { error }
  N.KINDS = {
    review: {
      icon: '⭐', label: 'Reseña de Google',
      fields: [{ k: 'a', label: 'Enlace o Place ID', ph: 'https://g.page/r/…/review  o  ChIJ…' }],
      build: (r) => {
        const x = N.reviewFromInput(r.a);
        return x.url ? Object.assign(urlRec(x.url), { warn: x.warn }) : { error: x.warn || 'Falta el enlace o Place ID' };
      },
    },
    page: {
      icon: '🍽️', label: 'Página del restaurante',
      fields: [{ k: 'rid', label: 'Restaurante', type: 'rest' }, { k: 'mesa', label: 'Mesa (opcional)', ph: '7' }],
      build: (r, ctx) => {
        const rest = ctx.restaurants.find((x) => x.id === r.rid);
        if (!rest) return { error: 'Elige un restaurante (créalo en Negocio → Restaurantes)' };
        const base = (ctx.baseUrl || '').replace(/\/+$/, '');
        if (!base) return { error: 'Configura la dirección base en Negocio → Publicar' };
        if (!rest.slug) return { error: 'El restaurante no tiene nombre en el enlace' };
        const mesa = String(r.mesa || '').trim();
        return urlRec(base + '/' + rest.slug + '/' + (mesa ? '?mesa=' + encodeURIComponent(mesa) : ''));
      },
    },
    url: {
      icon: '🔗', label: 'Enlace (URL)',
      fields: [{ k: 'a', label: 'Dirección', ph: 'https://…' }],
      build: (r) => {
        let v = String(r.a || '').trim();
        if (!v) return { error: 'Escribe un enlace' };
        if (/^https?:/i.test(v)) { const u = U.safeUrl(v); return u ? urlRec(u) : { error: 'Enlace no válido' }; }
        if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return urlRec(v);
        const u = U.safeUrl('https://' + v);
        return u ? urlRec(u) : { error: 'Enlace no válido' };
      },
    },
    text: {
      icon: '📝', label: 'Texto',
      fields: [{ k: 'a', label: 'Texto', ph: 'Mensaje que se mostrará', type: 'area' }],
      build: (r) => (String(r.a || '').trim() ? { rec: { recordType: 'text', data: r.a, lang: 'es' }, text: r.a } : { error: 'Escribe un texto' }),
    },
    tel: {
      icon: '📞', label: 'Teléfono',
      fields: [{ k: 'a', label: 'Número', ph: '987654321' }],
      build: (r) => { const p = N.phone(r.a); return p ? urlRec('tel:' + p) : { error: 'Número no válido' }; },
    },
    sms: {
      icon: '💬', label: 'SMS',
      fields: [{ k: 'a', label: 'Número', ph: '987654321' }, { k: 'b', label: 'Mensaje (opcional)' }],
      build: (r) => { const p = N.phone(r.a); return p ? urlRec('sms:' + p + (r.b ? '?body=' + encodeURIComponent(r.b) : '')) : { error: 'Número no válido' }; },
    },
    mail: {
      icon: '✉️', label: 'Email',
      fields: [{ k: 'a', label: 'Correo', ph: 'hola@negocio.pe' }, { k: 'b', label: 'Asunto (opcional)' }, { k: 'c', label: 'Mensaje (opcional)' }],
      build: (r) => {
        const a = String(r.a || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) return { error: 'Correo no válido' };
        const p = q({ subject: r.b, body: r.c });
        return urlRec('mailto:' + a + (p ? '?' + p : ''));
      },
    },
    wa: {
      icon: '🟢', label: 'WhatsApp',
      fields: [{ k: 'a', label: 'Número', ph: '987654321' }, { k: 'b', label: 'Mensaje inicial (opcional)' }],
      build: (r) => { const n = U.waNumber(r.a); return n ? urlRec('https://wa.me/' + n + (r.b ? '?text=' + encodeURIComponent(r.b) : '')) : { error: 'Número no válido' }; },
    },
    ig: {
      icon: '📸', label: 'Instagram',
      fields: [{ k: 'a', label: 'Usuario o enlace', ph: '@minegocio' }],
      build: (r) => { const u = U.igUrl(r.a); return u ? urlRec(u) : { error: 'Usuario no válido' }; },
    },
    map: {
      icon: '📍', label: 'Ubicación (Google Maps)',
      fields: [{ k: 'a', label: 'Dirección o coordenadas', ph: 'Av. Larco 123, Miraflores  o  -12.12,-77.03' }],
      build: (r) => {
        const v = String(r.a || '').trim();
        return v ? urlRec('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v)) : { error: 'Escribe una dirección' };
      },
    },
    wifi: {
      icon: '📶', label: 'Wi-Fi',
      fields: [
        { k: 'a', label: 'Nombre de la red (SSID)' },
        { k: 'b', label: 'Contraseña', ph: 'mínimo 8 caracteres' },
        { k: 'c', label: 'Seguridad', type: 'select', options: [['wpa', 'WPA / WPA2 (con contraseña)'], ['open', 'Abierta (sin contraseña)']] },
      ],
      build: (r) => {
        const ssid = String(r.a || '').trim();
        const open = r.c === 'open';
        if (!ssid) return { error: 'Falta el nombre de la red' };
        if (enc.encode(ssid).length > 32) return { error: 'El nombre de la red es muy largo (máx. 32 bytes)' };
        if (!open && String(r.b || '').length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' };
        return {
          rec: { recordType: 'mime', mediaType: 'application/vnd.wfa.wifi', data: N.wifiPayload(ssid, r.b || '', open ? 'open' : 'wpa') },
          text: 'Wi-Fi "' + ssid + '"' + (open ? ' (abierta)' : ''),
          warn: 'Experimental: pruébala con otro celular. En iPhone no se conecta sola.',
        };
      },
    },
    vcard: {
      icon: '👤', label: 'Contacto (vCard)',
      fields: [{ k: 'a', label: 'Nombre' }, { k: 'b', label: 'Teléfono', ph: '987654321' }, { k: 'c', label: 'Correo' }, { k: 'd', label: 'Empresa' }],
      build: (r) => {
        const name = String(r.a || '').trim();
        if (!name) return { error: 'Falta el nombre' };
        const lines = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + vEsc(name), 'N:' + vEsc(name) + ';;;;'];
        if (r.d) lines.push('ORG:' + vEsc(r.d));
        const p = N.phone(r.b);
        if (p) lines.push('TEL;TYPE=CELL:' + p);
        if (r.c) lines.push('EMAIL:' + vEsc(r.c));
        lines.push('END:VCARD');
        return { rec: { recordType: 'mime', mediaType: 'text/vcard', data: lines.join('\r\n') }, text: name + (p ? ' · ' + p : ''), warn: 'En iPhone el contacto puede no abrirse al tocar.' };
      },
    },
    raw: {
      icon: '🧩', label: 'MIME (avanzado)',
      fields: [{ k: 'a', label: 'Tipo MIME' }, { k: 'b', label: 'Contenido', type: 'area' }],
      build: (r) => (/^[a-z]+\/[\w.+-]+$/i.test(String(r.a || '').trim()) ? { rec: { recordType: 'mime', mediaType: r.a.trim(), data: r.b || '' }, text: r.a.trim() } : { error: 'Tipo MIME no válido' }),
    },
  };

  N.build = (records, ctx) => {
    const items = records.map((r) => {
      const k = N.KINDS[r.kind];
      return { r, res: k ? k.build(r, ctx) : { error: 'Tipo desconocido' } };
    });
    const ok = items.length > 0 && items.every((i) => !i.res.error);
    const ndef = ok ? items.map((i) => i.res.rec) : [];
    return { items, ok, ndef, size: ok ? N.size(ndef) : { message: 0, total: 0 } };
  };

  /* ---------- Web NFC ---------- */
  function decodeRecord(r) {
    const bytes = r.data ? new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength) : new Uint8Array(0);
    const out = { type: r.recordType, mediaType: r.mediaType || '', lang: r.lang || '', size: bytes.length, textual: false, value: '' };
    const textual =
      ['text', 'url', 'absolute-url'].includes(r.recordType) || (r.recordType === 'mime' && /^text\/|json|xml|vcard/i.test(r.mediaType || ''));
    if (textual) {
      try { out.value = new TextDecoder(r.encoding || 'utf-8').decode(bytes); out.textual = true; } catch (e) { out.value = ''; }
    } else {
      out.value = Array.from(bytes.slice(0, 48)).map((b) => b.toString(16).padStart(2, '0')).join(' ') + (bytes.length > 48 ? ' …' : '');
    }
    return out;
  }
  N.decodeMessage = (m) => Array.from(m.records || []).map(decodeRecord);

  N.errMsg = (e) => {
    const map = {
      NotAllowedError: 'Permiso de NFC denegado o NFC desactivado. Actívalo en los ajustes del celular.',
      NotSupportedError: 'Este celular no tiene NFC o está apagado.',
      AbortError: 'Tiempo agotado: no se detectó la tarjeta.',
      NetworkError: 'No se pudo escribir. Acerca bien la tarjeta; puede estar bloqueada o ser de poca capacidad.',
      ReadError: 'La tarjeta no tiene datos NDEF legibles (¿está vacía o tiene otro formato?).',
      TypeError: 'Los datos no son válidos para NFC.',
      LockUnsupported: 'Escrita ✓, pero este navegador no puede bloquear la tarjeta.',
    };
    return map[e && e.name] || 'Error: ' + ((e && e.message) || e);
  };

  const err = (name, message) => Object.assign(new Error(message || name), { name });

  N.readOnce = (timeoutMs) =>
    new Promise((resolve, reject) => {
      const nd = new NDEFReader();
      const ctrl = new AbortController();
      const t = setTimeout(() => { ctrl.abort(); reject(err('AbortError')); }, timeoutMs || 20000);
      nd.onreading = (ev) => {
        clearTimeout(t); ctrl.abort();
        resolve({ serial: ev.serialNumber || '', records: N.decodeMessage(ev.message) });
      };
      nd.onreadingerror = () => { clearTimeout(t); ctrl.abort(); reject(err('ReadError')); };
      nd.scan({ signal: ctrl.signal }).catch((e) => { clearTimeout(t); reject(e); });
    });

  N.write = async (ndef, opts) => {
    opts = opts || {};
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const nd = new NDEFReader();
      await nd.write({ records: ndef }, { signal: ctrl.signal });
      if (opts.lock) {
        if (typeof nd.makeReadOnly !== 'function') throw err('LockUnsupported');
        await nd.makeReadOnly({ signal: ctrl.signal });
      }
    } finally { clearTimeout(t); }
  };

  N.erase = async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const nd = new NDEFReader();
      try { await nd.write({ records: [{ recordType: 'empty' }] }, { signal: ctrl.signal }); }
      catch (e) { if (e.name === 'TypeError') await nd.write({ records: [{ recordType: 'text', data: '' }] }, { signal: ctrl.signal }); else throw e; }
    } finally { clearTimeout(t); }
  };

  N.lockOnly = async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const nd = new NDEFReader();
      if (typeof nd.makeReadOnly !== 'function') throw err('LockUnsupported');
      await nd.makeReadOnly({ signal: ctrl.signal });
    } finally { clearTimeout(t); }
  };

  // Releer lo escrito y compararlo con lo esperado
  N.verify = async (ndef) => {
    const got = await N.readOnce(15000);
    if (got.records.length !== ndef.length) return { ok: false, reason: 'cantidad de registros distinta', serial: got.serial };
    for (let i = 0; i < ndef.length; i++) {
      const want = typeof ndef[i].data === 'string' ? ndef[i].data : null;
      if (want !== null && got.records[i].value !== want) return { ok: false, reason: 'el contenido no coincide', serial: got.serial };
    }
    return { ok: true, serial: got.serial };
  };

  window.Nfc = N;
})();
