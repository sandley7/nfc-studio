(function () {
  'use strict';
  const U = {};

  U.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.slugify = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

  U.safeUrl = (u) => {
    try {
      const x = new URL(String(u || '').trim());
      return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : '';
    } catch (e) {
      return '';
    }
  };

  // Número peruano -> formato wa.me (51 + 9 dígitos)
  U.waNumber = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 9 && d[0] === '9') return '51' + d;
    if (d.length === 11 && d.startsWith('51')) return d;
    return d.length >= 10 ? d : '';
  };

  U.igUrl = (v) => {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return U.safeUrl(v);
    const user = v.replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '');
    return user ? 'https://instagram.com/' + user : '';
  };

  U.price = (v) => {
    if (v === '' || v == null) return null;
    const n = parseFloat(String(v).replace(',', '.').replace(/^S\/\s*/i, ''));
    return isNaN(n) ? null : n;
  };
  U.fmtPrice = (n) => 'S/ ' + n.toFixed(2);

  U.lum = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  U.onColor = (hex) => (U.lum(hex) > 0.4 ? '#1a1a1a' : '#ffffff');

  U.resizeImage = (file, max, q) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          const g = c.getContext('2d');
          g.fillStyle = '#fff';
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q));
        };
        img.onerror = () => rej(new Error('Imagen no válida'));
        img.src = fr.result;
      };
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(file);
    });

  U.download = (name, blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  U.copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {}
      t.remove();
      return ok;
    }
  };

  window.U = U;
})();
