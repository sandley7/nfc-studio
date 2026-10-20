// Genera la página pública de cada restaurante (HTML autónomo: carta + reseña + contactos).
(function () {
  'use strict';
  const { esc, safeUrl, waNumber, igUrl, price, fmtPrice, onColor } = U;

  const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#faf8f5;color:#1f1b16;-webkit-text-size-adjust:100%}
.hero{background:var(--a);color:var(--on);padding:28px 20px 22px;text-align:center}
.logo{width:84px;height:84px;border-radius:50%;background:#fff;margin:0 auto 12px;display:grid;place-items:center;font-size:42px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.2)}
.logo img{width:100%;height:100%;object-fit:cover}
h1{margin:0;font-size:24px;line-height:1.2}
.tag{margin:6px 0 0;opacity:.92;font-size:15px}
.hours{margin:6px 0 0;opacity:.85;font-size:13px}
.mesa{display:inline-block;margin-top:10px;background:rgba(0,0,0,.22);padding:4px 12px;border-radius:99px;font-size:14px}
.mesa[hidden]{display:none}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px;max-width:640px;margin:0 auto}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 10px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;background:#fff;color:#1f1b16;border:1px solid #e6e0d8;text-align:center}
.btn.primary{background:var(--a);color:var(--on);border-color:transparent;grid-column:1/-1;font-size:17px;padding:16px}
nav.chips{position:sticky;top:0;z-index:5;background:#faf8f5;display:flex;gap:8px;overflow-x:auto;padding:10px 16px;border-bottom:1px solid #e6e0d8}
nav.chips a{white-space:nowrap;padding:7px 14px;border-radius:99px;background:#fff;border:1px solid #e6e0d8;color:inherit;text-decoration:none;font-size:14px}
nav.chips a.on{background:var(--a);color:var(--on);border-color:transparent}
main{max-width:640px;margin:0 auto;padding:8px 16px 24px}
section{scroll-margin-top:62px}
h2{font-size:20px;margin:24px 0 4px}
.item{display:flex;gap:12px;justify-content:space-between;padding:14px 0;border-bottom:1px solid #ece6dd}
.item h3{margin:0;font-size:16px;line-height:1.3}
.item p{margin:4px 0 0;color:#6b6258;font-size:14px;line-height:1.4}
.price{margin-top:6px;font-weight:700}
.item img{width:88px;height:88px;object-fit:cover;border-radius:10px;flex:none}
.item.off{opacity:.55}
.item.off .price{text-decoration:line-through}
.badge{font-size:11px;font-weight:700;background:var(--a);color:var(--on);padding:2px 8px;border-radius:99px;margin-left:6px;vertical-align:middle;white-space:nowrap}
.empty{text-align:center;color:#8a8076;padding:32px 0}
footer{text-align:center;padding:12px 16px 40px;color:#8a8076;font-size:13px}
footer a{color:inherit}
`;

  const SCRIPT = `(function(){
var m=new URLSearchParams(location.search).get('mesa'),e=document.getElementById('mesa');
if(e&&m&&/^[A-Za-z0-9-]{1,8}$/.test(m)){e.textContent='Mesa '+m;e.hidden=false}
var links=[].slice.call(document.querySelectorAll('nav.chips a')),secs=[].slice.call(document.querySelectorAll('section[id]'));
if(!links.length)return;
function mark(){var cur=secs[0].id;secs.forEach(function(s){if(s.getBoundingClientRect().top<=120)cur=s.id});
links.forEach(function(l){var on=l.getAttribute('href')==='#'+cur;l.classList.toggle('on',on);if(on)l.parentNode.scrollLeft=l.offsetLeft-16})}
window.addEventListener('scroll',mark,{passive:true});mark();
})();`;

  function mapsLink(r) {
    const u = safeUrl(r.mapsUrl);
    if (u) return u;
    if (r.address && r.address.trim())
      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.address.trim());
    return '';
  }

  function buildPage(r, settings) {
    settings = settings || {};
    const accent = /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color : '#c2410c';
    const on = onColor(accent);

    const review = safeUrl(r.reviewUrl);
    const wa = waNumber(r.whatsapp);
    const waHref = wa ? 'https://wa.me/' + wa + (r.waMessage ? '?text=' + encodeURIComponent(r.waMessage) : '') : '';
    const ig = igUrl(r.instagram);
    const maps = mapsLink(r);
    const cats = (r.categories || []).filter((c) => (c.items || []).length);

    const btn = (href, label, cls) =>
      `<a class="btn ${cls || ''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;

    const actions = [
      review ? btn(review, '⭐ Déjanos tu reseña en Google', 'primary') : '',
      cats.length ? `<a class="btn" href="#cat-${esc(cats[0].id)}">📖 Ver carta</a>` : '',
      waHref ? btn(waHref, '💬 WhatsApp') : '',
      ig ? btn(ig, '📸 Instagram') : '',
      maps ? btn(maps, '📍 Cómo llegar') : '',
    ].join('');

    const chips = cats.length > 1
      ? `<nav class="chips">${cats.map((c, i) => `<a href="#cat-${esc(c.id)}"${i === 0 ? ' class="on"' : ''}>${esc(c.name)}</a>`).join('')}</nav>`
      : '';

    const sections = cats.length
      ? cats
          .map((c) => {
            const items = c.items
              .map((it) => {
                const p = price(it.price);
                const off = it.available === false;
                return `<article class="item${off ? ' off' : ''}"><div><h3>${esc(it.name)}${it.badge ? `<span class="badge">${esc(it.badge)}</span>` : ''}${off ? '<span class="badge" style="background:#6b6258;color:#fff">Agotado</span>' : ''}</h3>${it.desc ? `<p>${esc(it.desc)}</p>` : ''}${p != null ? `<div class="price">${fmtPrice(p)}</div>` : ''}</div>${it.photo && /^data:image\//.test(it.photo) ? `<img src="${it.photo}" alt="" loading="lazy">` : ''}</article>`;
              })
              .join('');
            return `<section id="cat-${esc(c.id)}"><h2>${esc(c.name)}</h2>${items}</section>`;
          })
          .join('')
      : '<div class="empty">La carta estará disponible muy pronto.</div>';

    const credit =
      settings.showCredit && settings.sellerName
        ? `Carta digital por ${
            waNumber(settings.sellerWa)
              ? `<a href="https://wa.me/${waNumber(settings.sellerWa)}" target="_blank" rel="noopener noreferrer">${esc(settings.sellerName)}</a>`
              : esc(settings.sellerName)
          }`
        : '';

    const logo = r.logo && /^data:image\//.test(r.logo) ? `<img src="${r.logo}" alt="">` : esc(r.emoji || '🍽️');

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(r.name)} · Carta</title>
<meta name="theme-color" content="${accent}">
<style>:root{--a:${accent};--on:${on}}${CSS}</style></head>
<body>
<header class="hero"><div class="logo">${logo}</div><h1>${esc(r.name)}</h1>${r.tagline ? `<p class="tag">${esc(r.tagline)}</p>` : ''}${r.hours ? `<p class="hours">${esc(r.hours)}</p>` : ''}<span class="mesa" id="mesa" hidden></span></header>
<div class="actions">${actions}</div>
${chips}
<main>${sections}</main>
<footer>${credit}</footer>
<script>${SCRIPT}</script>
</body></html>`;
  }

  function rootPage() {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Cartas digitales</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#faf8f5;color:#6b6258}</style></head><body><p>Cartas digitales</p></body></html>`;
  }

  window.Site = { buildPage, rootPage, mapsLink };
})();
