// Núcleo: estado, ayudas de DOM, navegación (al estilo NFC Tools: Leer / Escribir / Otros / Tareas) y arranque.
(function () {
  'use strict';
  const { uid, slugify } = U;

  const App = { S: null, views: {} };
  window.App = App;

  let saveTimer = null;
  App.onChange = null; // hook de la vista activa (p. ej. refrescar la vista previa)

  const defaultState = () => ({
    version: 4,
    settings: { baseUrl: '', sellerName: 'altoke.pe', sellerWa: '', showCredit: true },
    shop: { stock: 200, price: 20 }, // lote de tarjetas y precio por defecto (datos del dueño): se ajustan en Reseñas o Venta rápida
    sales: [],
    tasks: [],
    log: [],
    cards: [], // inventario: cada tarjeta física con su nombre
    restaurants: [],
    ui: { view: 'resenas', rid: null },
  });

  App.touch = function touch() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const ok = await Store.save(App.S);
      if (!ok) App.toast('⚠️ No se pudo guardar en este navegador. Descarga un respaldo.');
    }, 350);
    if (App.onChange) App.onChange();
  };

  App.setState = (d) => {
    const base = defaultState();
    const oldVersion = (d && d.version) || 3;
    const S = Object.assign(base, d);
    S.settings = Object.assign(base.settings, S.settings);
    // Datos guardados antes de la marca altoke.pe: ponerla como nombre de la empresa si estaba vacío
    if (oldVersion < 3 && !S.settings.sellerName) S.settings.sellerName = 'altoke.pe';
    S.shop = Object.assign(defaultState().shop, S.shop);
    // Lote y precio que dijo el dueño (200 tarjetas a S/ 20): solo se cambian si nunca los tocó (valores iniciales anteriores: 30 y 25)
    if (oldVersion < 4 && S.shop.stock === 30 && S.shop.price === 25) { S.shop.stock = 200; S.shop.price = 20; App.lotMigrated = true; }
    S.version = 4;
    S.ui = Object.assign(defaultState().ui, S.ui);
    ['sales', 'tasks', 'log', 'cards', 'restaurants'].forEach((k) => { if (!Array.isArray(S[k])) S[k] = []; });
    if (!['inicio', 'resenas', 'venta', 'tarjetas', 'leer', 'escribir', 'otros', 'tareas', 'restaurantes', 'carta', 'vista', 'publicar', 'ayuda'].includes(S.ui.view)) S.ui.view = 'inicio';
    App.S = S;
  };

  App.newRestaurant = () => ({
    id: uid(), slug: '', slugLocked: false, name: 'Nuevo restaurante', tagline: '', emoji: '🍽️', logo: null,
    color: '#c2410c', address: '', mapsUrl: '', whatsapp: '', waMessage: 'Hola, quisiera hacer una reserva',
    instagram: '', reviewUrl: '', hours: '', categories: [],
  });

  App.uniqueSlug = (base, exceptId) => {
    base = base || 'restaurante';
    let s = base, n = 2;
    while (App.S.restaurants.some((r) => r.id !== exceptId && r.slug === s)) s = base + '-' + n++;
    return s;
  };

  App.cur = () => App.S.restaurants.find((r) => r.id === App.S.ui.rid) || App.S.restaurants[0] || null;

  /* ---------- Helpers de DOM ---------- */
  App.h = function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    let value;
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    if (value !== undefined) el.value = value;
    return el;
  };
  const h = App.h;

  App.field = (label, input, hint) => h('label', { class: 'f' }, label, input, hint ? h('span', { class: 'hint' }, hint) : null);

  App.bind = (obj, key, props, after) =>
    h('input', Object.assign({ type: 'text', value: obj[key] == null ? '' : obj[key] }, props, {
      oninput: (e) => {
        obj[key] = e.target.value;
        if (after) after(e.target.value);
        App.touch();
      },
    }));

  let toastTimer;
  App.toast = (msg) => {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  };

  App.title = (t, s) => [h('h1', { class: 'title' }, t), h('p', { class: 'sub' }, s)];

  App.go = (view) => {
    App.S.ui.view = view;
    App.touch();
    App.render();
    window.scrollTo(0, 0);
  };

  App.restaurantSelect = () =>
    h('label', { class: 'f' }, 'Restaurante',
      h('select', { value: App.cur() ? App.cur().id : '', onchange: (e) => { App.S.ui.rid = e.target.value; App.touch(); App.render(); } },
        App.S.restaurants.map((r) => h('option', { value: r.id }, r.name || '(sin nombre)'))));

  App.needRestaurant = (t, s) =>
    h('div', null, App.title(t, s),
      h('div', { class: 'card' }, h('p', null, 'Primero crea un restaurante.'),
        h('button', { class: 'btn primary', onclick: () => App.go('restaurantes') }, 'Ir a Restaurantes')));

  // Cuadro de estado reutilizable: el.set(mensaje, 'ok' | 'warn' | 'err')
  App.statusBox = () => {
    const el = h('div', { role: 'status' });
    el.set = (m, k) => { el.className = m ? 'note ' + (k || '') : ''; el.textContent = m || ''; };
    return el;
  };

  App.drawQr = (canvas, text) => {
    if (typeof qrcode !== 'function') return false;
    try {
      const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
      const n = qr.getModuleCount(), cell = 6, m = 4, size = (n + 2 * m) * cell;
      canvas.width = canvas.height = size;
      const g = canvas.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) g.fillRect((x + m) * cell, (y + m) * cell, cell, cell);
      return true;
    } catch (e) { return false; }
  };

  /* ---------- Navegación ---------- */
  const NAV = [
    ['inicio', '🏠', 'Menú', ''],
    ['resenas', '⭐', 'Reseñas', 'Reseñas (lo principal)'], ['venta', '⚡', 'Venta rápida', 'Reseñas (lo principal)'], ['tarjetas', '📇', 'Mis tarjetas', 'Reseñas (lo principal)'],
    ['leer', '📡', 'Leer', 'Herramientas NFC'], ['escribir', '✍️', 'Escribir', 'Herramientas NFC'], ['otros', '🧰', 'Otros', 'Herramientas NFC'], ['tareas', '📁', 'Mis tareas', 'Herramientas NFC'],
    ['restaurantes', '🍴', 'Restaurantes', 'Menús digitales (para después)'], ['carta', '📖', 'Carta', 'Menús digitales (para después)'],
    ['vista', '📱', 'Vista previa', 'Menús digitales (para después)'], ['publicar', '🚀', 'Publicar', 'Menús digitales (para después)'],
    ['ayuda', '❓', 'Ayuda', ''],
  ];

  function renderNav() {
    const nav = document.getElementById('nav');
    const kids = [h('div', { class: 'brand' },
      h('img', { src: 'icon-192.png', alt: '', width: 32, height: 32 }),
      h('span', { class: 'bname' }, 'altoke', h('span', { class: 'tld' }, '.pe')),
      h('small', null, 'Tarjetas NFC al toque'))];
    let group = null;
    for (const [id, ico, label, g] of NAV) {
      if (g !== group) { group = g; if (g) kids.push(h('div', { class: 'grp' }, g)); else kids.push(h('div', { class: 'grp' }, '')); }
      kids.push(h('button', { class: App.S.ui.view === id ? 'on' : '', 'aria-current': App.S.ui.view === id ? 'page' : null, onclick: () => App.go(id) },
        h('span', { 'aria-hidden': 'true' }, ico), label));
    }
    nav.replaceChildren(...kids);
  }

  App.render = () => {
    App.onChange = null;
    const S = App.S;
    if (!App.views[S.ui.view]) S.ui.view = 'inicio';
    if (!S.restaurants.some((r) => r.id === S.ui.rid)) S.ui.rid = S.restaurants[0] ? S.restaurants[0].id : null;
    renderNav();
    document.getElementById('main').replaceChildren(App.views[S.ui.view]());
  };

  App.start = async () => {
    const saved = await Store.load();
    App.setState(saved && Array.isArray(saved.restaurants) ? saved : {});
    App.render();
    if (App.lotMigrated) {
      App.lotMigrated = false;
      App.touch();
      App.toast('Actualicé tu lote a 200 tarjetas y el precio por defecto a S/ 20');
    }
  };

  /* ---------- Inventario: cada tarjeta física con su nombre ---------- */
  const pad = (n) => String(n).padStart(3, '0');
  const norm = (s) => String(s || '').trim().toLowerCase();
  App.cards = {
    byName: (name) => App.S.cards.find((c) => norm(c.name) === norm(name)),
    bySerial: (serial) => (serial ? App.S.cards.find((c) => c.serial && c.serial === serial) : null),
    firstStock: () => App.S.cards.find((c) => c.status === 'stock'),
    nextName: (prefix) => {
      prefix = prefix || 'Tarjeta ';
      let n = 1;
      while (App.cards.byName(prefix + pad(n))) n++;
      return prefix + pad(n);
    },
    // Nombre sugerido: la primera tarjeta en stock, o la siguiente numerada
    suggest: () => (App.cards.firstStock() ? App.cards.firstStock().name : App.cards.nextName()),
    // "Mesa 7" -> "Mesa 8", "Tarjeta 009" -> "Tarjeta 010"; sin número devuelve ''
    inc: (name) => {
      const m = /^(.*?)(\d+)$/.exec(String(name || '').trim());
      return m ? m[1] + String(parseInt(m[2], 10) + 1).padStart(m[2].length, '0') : '';
    },
    upsert: (name, patch) => {
      name = String(name || '').trim();
      if (!name) return null;
      let c = App.cards.byName(name);
      if (!c) {
        c = { id: uid(), name, status: 'stock', serial: '', content: '', client: '', price: null, notes: '', createdAt: Date.now(), programmedAt: null, soldAt: null };
        App.S.cards.push(c);
      }
      Object.assign(c, patch || {});
      return c;
    },
    markProgrammed: (name, content, serial) => {
      const c = App.cards.upsert(name, {});
      if (!c) return null;
      c.content = content || c.content;
      if (serial) c.serial = serial;
      c.programmedAt = Date.now();
      if (c.status === 'stock') c.status = 'programada';
      return c;
    },
    // Vende `qty` tarjetas: la nombrada (o la primera en stock) y las siguientes del stock
    sell: (name, qty, info) => {
      const list = [];
      list.push(name ? App.cards.upsert(name, {}) : App.cards.firstStock() || App.cards.upsert(App.cards.nextName(), {}));
      for (let i = 1; i < qty; i++) {
        list.push(App.S.cards.find((k) => k.status === 'stock' && !list.includes(k)) || App.cards.upsert(App.cards.nextName(), {}));
      }
      list.forEach((k) => Object.assign(k, { status: 'vendida', client: info.client, price: info.price, soldAt: Date.now(), content: info.content || k.content }));
      return list;
    },
  };

  /* ---------- Instalar como app ---------- */
  App.installEvt = null;
  App.isStandalone = () => !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches) || !!navigator.standalone;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    App.installEvt = e;
    if (App.S && App.S.ui.view === 'inicio') App.render();
  });
  window.addEventListener('appinstalled', () => {
    App.installEvt = null;
    if (App.S && App.S.ui.view === 'inicio') App.render();
  });
  App.install = async () => {
    if (!App.installEvt) return false;
    App.installEvt.prompt();
    const r = await App.installEvt.userChoice;
    App.installEvt = null;
    return r.outcome === 'accepted';
  };

  App.defaultState = defaultState;
  App.slugify = slugify;
})();
