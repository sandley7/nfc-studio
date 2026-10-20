// Pantallas de tarjetas, con el esquema de NFC Tools (Leer / Escribir / Otros / Mis tareas) más "Venta rápida".
(function () {
  'use strict';
  const { h, field, toast, touch, go, title, statusBox } = App;

  const prefs = { lock: false, verify: true };
  const draft = { records: [], chip: 'ntag213', written: 0, auto: true, cardName: '' };
  const venta = { input: '', client: '', qty: 1, price: '', method: 'Yape', cardName: '' };
  let lastRead = null;
  let lastSerial = ''; // número de serie de la última tarjeta escrita y verificada
  const readHistory = [];

  /* ---------- Compartido ---------- */
  function unsupportedNote(verb) {
    if (Nfc.supported()) return null;
    return h('div', { class: 'note warn' },
      Nfc.isIOS()
        ? 'En iPhone la web no puede ' + verb + ' tarjetas NFC (Safari no lo permite). '
        : 'Este navegador no puede ' + verb + ' NFC (hace falta Chrome en un Android con NFC y la app abierta con https). ',
      'Aquí puedes preparar todo y copiar el contenido a NFC Tools.');
  }

  const newRec = (kind) => {
    const c = App.cur();
    return { id: U.uid(), kind, a: '', b: '', c: '', d: '', rid: c ? c.id : '', mesa: '' };
  };

  const copyValue = (res) => (res.rec && (res.rec.recordType === 'url' || res.rec.recordType === 'text') ? res.rec.data : res.text);

  async function writeRecords(ndef, opts, set) {
    lastSerial = '';
    try {
      set('Acerca la tarjeta a la parte trasera del celular…', '');
      await Nfc.write(ndef, { lock: opts.lock });
      if (opts.verify) {
        set('Verificando… mantén la tarjeta o vuelve a acercarla.', '');
        try {
          const v = await Nfc.verify(ndef);
          lastSerial = v.serial || '';
          if (!v.ok) { set('⚠ Se escribió, pero la verificación falló (' + v.reason + '). Prueba con otra tarjeta.', 'warn'); return false; }
        } catch (e) {
          set('⚠ Se escribió, pero no se pudo verificar (' + Nfc.errMsg(e) + '). Pruébala con tu celular.', 'warn');
          return true;
        }
      }
      set('✓ Tarjeta escrita' + (opts.verify ? ' y verificada' : '') + (opts.lock ? ' y bloqueada' : '') + '.', 'ok');
      return true;
    } catch (e) {
      if (e.name === 'LockUnsupported') { set(Nfc.errMsg(e), 'warn'); return true; }
      set(Nfc.errMsg(e), 'err');
      return false;
    }
  }

  function pushLog(label, text, via) {
    const S = App.S;
    S.log.push({ at: Date.now(), label, text, via });
    if (S.log.length > 500) S.log.splice(0, S.log.length - 500);
  }

  // Lista de nombres para autocompletar (tarjetas ya registradas)
  const cardDatalist = () => h('datalist', { id: 'cardnames' }, App.S.cards.filter((c) => c.status !== 'vendida').map((c) => h('option', { value: c.name })));
  const statusLabel = { stock: 'en stock', programada: 'programada', vendida: 'vendida' };

  const fmtDate = (t) => new Date(t).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const money = (n) => 'S/ ' + Number(n).toFixed(2);
  const optionsRow = (extra) =>
    h('div', { class: 'btns', style: 'margin-top:10px;align-items:center' },
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: prefs.verify, onchange: (e) => { prefs.verify = e.target.checked; } }), 'Verificar después de escribir'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: prefs.lock, onchange: (e) => { prefs.lock = e.target.checked; } }), 'Bloquear después (irreversible)'),
      extra);

  /* ---------- ⚡ Venta rápida ---------- */
  App.views.venta = function () {
    const S = App.S;
    const shop = S.shop;
    const soldCards = S.sales.reduce((n, s) => n + s.qty, 0);
    const revenue = S.sales.reduce((n, s) => n + s.total, 0);
    const left = Math.max(0, shop.stock - soldCards);
    const today = S.sales.filter((s) => new Date(s.at).toDateString() === new Date().toDateString()).reduce((n, s) => n + s.total, 0);
    let curUrl = '';

    const linkNote = h('div');
    const urlIn = h('input', { type: 'text', readonly: true, 'aria-label': 'Enlace para la tarjeta', placeholder: 'El enlace aparecerá aquí' });
    const status = statusBox();
    const qr = h('canvas', { class: 'qr', 'aria-label': 'Código QR' });
    const totalTxt = h('b');

    const input = h('input', { type: 'text', value: venta.input, inputmode: 'url', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      placeholder: 'Pega el enlace de reseña o el Place ID', oninput: (e) => { venta.input = e.target.value; update(); } });
    const copyBtn = h('button', { class: 'btn primary', onclick: async () => toast((await U.copy(curUrl)) ? 'Enlace copiado ✓' : 'No se pudo copiar') }, '📋 Copiar enlace');
    const testBtn = h('button', { class: 'btn', onclick: () => window.open(curUrl, '_blank', 'noopener') }, '🔗 Probar enlace');
    const cardIn = h('input', { type: 'text', list: 'cardnames', value: venta.cardName, placeholder: App.cards.suggest(), autocapitalize: 'off',
      oninput: (e) => { venta.cardName = e.target.value; } });
    const writeBtn = h('button', { class: 'btn', onclick: async () => {
      if (!curUrl) return;
      if (await writeRecords([{ recordType: 'url', data: curUrl }], prefs, status.set)) {
        const nm = venta.cardName.trim() || App.cards.suggest();
        App.cards.markProgrammed(nm, curUrl, lastSerial);
        pushLog(nm, curUrl, 'web-nfc');
        touch(); toast('Tarjeta "' + nm + '" programada ✓');
      }
    } }, '📲 Escribir en tarjeta');

    const client = h('input', { type: 'text', value: venta.client, placeholder: 'Nombre del negocio', oninput: (e) => { venta.client = e.target.value; } });
    const qty = h('input', { type: 'number', min: 1, max: 99, value: venta.qty, oninput: (e) => { venta.qty = e.target.value; update(); } });
    const price = h('input', { type: 'text', inputmode: 'decimal', value: venta.price, placeholder: String(shop.price), oninput: (e) => { venta.price = e.target.value; update(); } });
    const method = h('select', { value: venta.method, onchange: (e) => { venta.method = e.target.value; } },
      ['Yape', 'Plin', 'Efectivo', 'Transferencia'].map((m) => h('option', { value: m }, m)));

    const unit = () => U.price(venta.price === '' ? shop.price : venta.price);

    function update() {
      const x = Nfc.reviewFromInput(venta.input);
      curUrl = x.url;
      urlIn.value = x.url;
      linkNote.className = venta.input ? 'note ' + (x.url ? (x.warn ? 'warn' : 'ok') : 'err') : '';
      linkNote.textContent = venta.input ? (x.url ? x.warn || '✓ Enlace listo. Toca "Probar enlace" y comprueba que abre la ventana de reseña del negocio correcto.' : x.warn) : '';
      [copyBtn, testBtn].forEach((b) => b.toggleAttribute('disabled', !x.url));
      writeBtn.toggleAttribute('disabled', !x.url || !Nfc.supported());
      qr.hidden = !x.url || !App.drawQr(qr, x.url);
      const u = unit();
      totalTxt.textContent = u == null ? '—' : money((Math.max(1, parseInt(venta.qty, 10) || 1)) * u);
    }

    const register = () => {
      const q = Math.max(1, parseInt(venta.qty, 10) || 1);
      const u = unit();
      if (u == null || u < 0) return toast('Precio no válido');
      const name = venta.client.trim() || '(sin nombre)';
      const sold = App.cards.sell(venta.cardName.trim() || null, q, { client: name, price: u, content: curUrl }).map((c) => c.name);
      S.sales.push({ id: U.uid(), at: Date.now(), client: name, qty: q, unit: u, total: +(q * u).toFixed(2), method: venta.method, url: curUrl, cards: sold });
      pushLog(name + ' — ' + sold.join(', '), curUrl || '(sin programar)', 'venta');
      Object.assign(venta, { input: '', client: '', qty: 1, price: '', cardName: '' });
      touch(); toast('Venta registrada ✓'); App.render();
    };

    const exportCsv = () => {
      const rows = [['fecha', 'cliente', 'cantidad', 'precio_unitario', 'total', 'metodo', 'enlace']]
        .concat(S.sales.map((s) => [new Date(s.at).toISOString(), s.client, s.qty, s.unit, s.total, s.method, s.url]));
      const csv = '﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      U.download('ventas.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    };

    const view = h('div', null,
      title('Venta rápida', 'Programa y cobra una tarjeta en 2 minutos, frente al cliente.'),
      h('div', { class: 'grid3 stats' },
        h('div', { class: 'card stat' }, h('b', null, left), h('span', null, 'Tarjetas en stock')),
        h('div', { class: 'card stat' }, h('b', null, money(today)), h('span', null, 'Vendido hoy')),
        h('div', { class: 'card stat' }, h('b', null, money(revenue)), h('span', null, soldCards + ' tarjeta(s) vendidas'))),
      h('div', { class: 'card' }, h('h3', null, '1. Enlace de reseña del cliente'),
        field('Enlace o Place ID', input, 'Pega el enlace de reseña del negocio o su Place ID (empieza con "ChIJ"). Si no lo tienes, mira las 3 formas abajo.'),
        h('div', { class: 'btns', style: 'margin-bottom:8px' },
          h('a', { class: 'btn small', href: 'https://developers.google.com/maps/documentation/places/web-service/place-id', target: '_blank', rel: 'noopener' }, '🔎 Buscar Place ID (herramienta de Google)')),
        linkNote,
        h('details', { style: 'margin-top:10px' }, h('summary', null, '¿Cómo consigo el enlace? (3 formas)'),
          h('ol', { class: 'steps' },
            h('li', null, h('b', null, 'Place ID, desde tu celular (lo más rápido): '), 'toca "Buscar Place ID", escribe el nombre del negocio, copia el código que empieza con "ChIJ" y pégalo arriba. La app arma el enlace.'),
            h('li', null, h('b', null, 'Que el dueño te lo mande, desde una computadora: '), 'business.google.com → ', h('b', null, 'Leer reseñas'), ' → ', h('b', null, 'Consigue más reseñas'), ' → ', h('b', null, 'Copiar'),
              '. Según la ayuda de Google, ese enlace y su QR solo se generan en un navegador de computadora, no en el celular.'),
            h('li', null, h('b', null, 'Plan B, enlace de Google Maps: '), 'en la app de Maps abre el negocio y toca Compartir. Funciona, pero abre la ficha del negocio y el cliente puede necesitar un toque más para escribir la reseña.')),
          h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: async () => {
            const msg = 'Hola 👋 Soy de ' + (S.settings.sellerName || 'altoke.pe') + '. Para dejarte lista tu tarjeta de reseñas de Google necesito el enlace de reseñas de tu negocio. ' +
              'Desde una computadora: entra a business.google.com → Leer reseñas → Consigue más reseñas → Copiar, y envíamelo por aquí. ' +
              'Si prefieres, dime el nombre y la dirección del local y yo lo busco.';
            toast((await U.copy(msg)) ? 'Mensaje copiado ✓ (pégalo en WhatsApp)' : 'No se pudo copiar');
          } }, '📋 Copiar mensaje para pedirle el enlace al dueño')))),
      cardDatalist(),
      h('div', { class: 'card' }, h('h3', null, '2. Programa la tarjeta'),
        field('Nombre de la tarjeta', cardIn, 'Para reconocerla después (ej. "Pollería Rey - Caja"). Vacío = la siguiente del stock.'),
        h('div', { class: 'urlbox' }, urlIn),
        h('div', { class: 'btns', style: 'margin-top:10px' }, copyBtn, testBtn, writeBtn),
        unsupportedNote('escribir') ? h('div', { class: 'note' }, h('b', null, 'En iPhone: '), 'copia el enlace → abre NFC Tools → ', h('code', null, 'Escribir → Añadir un registro → URL/URI'), ' → pega → Escribir → acerca la tarjeta. Pruébala con el iPhone antes de cobrar.') : optionsRow(),
        status,
        h('details', { style: 'margin-top:10px' }, h('summary', null, 'QR de respaldo (para celulares sin NFC)'), qr)),
      h('div', { class: 'card' }, h('h3', null, '3. Cobra y registra'),
        h('div', { class: 'grid3' },
          field('Cliente', client),
          field('Cantidad de tarjetas', qty),
          field('Precio por tarjeta (S/)', price, 'Vacío = precio por defecto (S/ ' + shop.price + ')')),
        h('div', { class: 'grid2' }, field('Pago', method), h('div', { class: 'f' }, h('span', { style: 'font-size:13px;font-weight:600' }, 'Total a cobrar'), h('div', { style: 'font-size:26px;margin-top:6px' }, totalTxt))),
        h('button', { class: 'btn primary', onclick: register }, '✓ Registrar venta')),
      h('div', { class: 'card' }, h('h3', null, 'Ventas'),
        S.sales.length === 0 ? h('p', { class: 'sub' }, 'Aún no hay ventas registradas.') :
          S.sales.slice(-20).reverse().map((s) => h('div', { class: 'step' },
            h('span', { class: 'grow' }, h('b', null, s.client), h('br'), h('span', { style: 'color:var(--muted);font-size:13px' }, fmtDate(s.at) + ' · ' + s.qty + ' × ' + money(s.unit) + ' · ' + s.method + (s.cards && s.cards.length ? ' · 📇 ' + s.cards.join(', ') : ''))),
            h('b', null, money(s.total)),
            h('button', { class: 'btn small danger', 'aria-label': 'Eliminar venta', onclick: () => { if (confirm('¿Eliminar esta venta?')) { S.sales = S.sales.filter((x) => x.id !== s.id); touch(); App.render(); } } }, '🗑'))),
        h('div', { class: 'btns', style: 'margin-top:12px' }, h('button', { class: 'btn small', disabled: !S.sales.length, onclick: exportCsv }, '⬇️ Descargar ventas (CSV)'))),
      h('div', { class: 'card' }, h('h3', null, 'Tu lote'),
        h('div', { class: 'grid2' },
          field('Tarjetas del lote', h('input', { type: 'number', min: 0, value: shop.stock, onchange: (e) => { shop.stock = Math.max(0, parseInt(e.target.value, 10) || 0); touch(); App.render(); } })),
          field('Precio por defecto (S/)', h('input', { type: 'text', inputmode: 'decimal', value: shop.price, onchange: (e) => { const v = U.price(e.target.value); shop.price = v == null ? shop.price : v; touch(); App.render(); } }),
            'Es solo un valor inicial: ajústalo a lo que de verdad cobres.'))));
    update();
    return view;
  };

  /* ---------- 📡 Leer ---------- */
  function recordsFromRead(recs) {
    const out = [];
    let skipped = 0;
    for (const x of recs) {
      if (x.type === 'url' || x.type === 'absolute-url') out.push(Object.assign(newRec('url'), { a: x.value }));
      else if (x.type === 'text') out.push(Object.assign(newRec('text'), { a: x.value }));
      else if (x.type === 'mime' && x.textual) out.push(Object.assign(newRec('raw'), { a: x.mediaType, b: x.value }));
      else skipped++;
    }
    return { records: out, skipped };
  }

  function loadDraft(records, chip) {
    draft.records = records.map((r) => Object.assign({}, r, { id: U.uid() }));
    if (chip) draft.chip = chip;
    go('escribir');
  }

  // Reconoce la tarjeta por su número de serie, o permite ponerle nombre
  function cardBox(d, rerender) {
    const known = App.cards.bySerial(d.serial);
    if (known) {
      return h('div', { class: 'note ok' }, '📇 Es tu tarjeta ', h('b', null, '«' + known.name + '»'),
        ' · ' + statusLabel[known.status] + (known.client ? ' · cliente: ' + known.client : ''));
    }
    if (!d.serial) return null;
    const nameIn = h('input', { type: 'text', list: 'cardnames', placeholder: 'Ponle un nombre a esta tarjeta', autocapitalize: 'off' });
    return h('div', { class: 'note' }, h('div', null, 'Esta tarjeta todavía no tiene nombre en tu inventario.'),
      h('div', { class: 'row', style: 'margin-top:8px;align-items:center' }, nameIn,
        h('div', { class: 'shrink' }, h('button', { class: 'btn small primary', onclick: () => {
          const n = nameIn.value.trim();
          if (!n) return toast('Escribe un nombre');
          App.cards.upsert(n, { serial: d.serial, content: (d.records[0] || {}).value || '' });
          touch(); toast('Guardada como «' + n + '» ✓'); rerender();
        } }, 'Guardar nombre'))));
  }

  App.views.leer = function () {
    const status = statusBox();
    const res = h('div');

    const renderRes = () => {
      res.replaceChildren();
      if (!lastRead) return;
      const d = lastRead;
      const payload = d.records.reduce((n, r) => n + r.size, 0);
      res.append(h('div', { class: 'card' }, h('h3', null, 'Contenido de la tarjeta'),
        h('div', { class: 'kv' }, h('span', null, 'Número de serie'), h('code', null, d.serial || 'no disponible')),
        cardBox(d, renderRes),
        h('div', { class: 'kv' }, h('span', null, 'Registros'), h('b', null, d.records.length)),
        h('div', { class: 'kv' }, h('span', null, 'Datos útiles'), h('b', null, payload + ' bytes')),
        d.records.length === 0 ? h('div', { class: 'note' }, 'La tarjeta está vacía o no tiene datos NDEF.') : null,
        d.records.map((r) => h('div', { class: 'rec' },
          h('div', { class: 'rechead' }, h('b', null, r.type + (r.mediaType ? ' · ' + r.mediaType : '')), h('span', { style: 'flex:1' }),
            r.textual ? h('button', { class: 'btn small', 'aria-label': 'Copiar', onclick: async () => toast((await U.copy(r.value)) ? 'Copiado ✓' : 'No se pudo copiar') }, '📋') : null,
            /^https?:\/\//i.test(r.value) ? h('a', { class: 'btn small', href: r.value, target: '_blank', rel: 'noopener', 'aria-label': 'Abrir enlace' }, '🔗') : null),
          h('div', { class: 'mono' }, r.value || '(vacío)'))),
        h('div', { class: 'btns', style: 'margin-top:12px' },
          h('button', { class: 'btn primary', disabled: !d.records.length, onclick: () => {
            const { records, skipped } = recordsFromRead(d.records);
            if (!records.length) return toast('No hay registros que se puedan copiar');
            if (skipped) toast(skipped + ' registro(s) no se pudieron copiar');
            loadDraft(records);
          } }, '📑 Cargar en Escribir (copiar tarjeta)'))));
    };

    const readBtn = h('button', { class: 'btn primary', disabled: !Nfc.supported(), onclick: async () => {
      status.set('Acerca la tarjeta a la parte trasera del celular…', '');
      try {
        lastRead = await Nfc.readOnce(20000);
        readHistory.unshift({ at: Date.now(), serial: lastRead.serial, first: (lastRead.records[0] || {}).value || '(vacía)' });
        readHistory.splice(10);
        status.set('✓ Tarjeta leída', 'ok');
        renderRes();
      } catch (e) { status.set(Nfc.errMsg(e), 'err'); }
    } }, '📡 Leer tarjeta');

    renderRes();
    return h('div', null, title('Leer', 'Mira qué tiene guardada una tarjeta (número de serie, registros y tamaño).'),
      cardDatalist(),
      unsupportedNote('leer'),
      h('div', { class: 'card' }, h('div', { class: 'btns' }, readBtn), status),
      res,
      readHistory.length ? h('div', { class: 'card' }, h('h3', null, 'Lecturas de esta sesión'),
        readHistory.map((x) => h('div', { class: 'step' }, h('span', { class: 'grow' }, h('span', { class: 'mono' }, x.first), h('br'), h('span', { style: 'color:var(--muted);font-size:13px' }, fmtDate(x.at) + ' · ' + (x.serial || 'sin serie')))))) : null);
  };

  /* ---------- ✍️ Escribir ---------- */
  App.views.escribir = function () {
    const S = App.S;
    const stEls = {};
    let build = { ok: false, items: [], ndef: [], size: { total: 0, message: 0 } };
    const ctx = () => ({ restaurants: S.restaurants, baseUrl: S.settings.baseUrl });

    const list = h('div');
    const bar = h('i');
    const sumText = h('div', { style: 'font-size:14px;margin:6px 0' });
    const capNote = h('div');
    const status = statusBox();
    const qr = h('canvas', { class: 'qr', 'aria-label': 'Código QR' });
    const counter = h('span', { style: 'color:var(--muted);font-size:13px' });
    const taskName = h('input', { type: 'text', placeholder: 'Nombre de la tarea (ej. Pollería: reseña + WhatsApp)' });
    const cardIn = h('input', { type: 'text', list: 'cardnames', value: draft.cardName, placeholder: App.cards.suggest(), autocapitalize: 'off',
      oninput: (e) => { draft.cardName = e.target.value; } });

    const writeBtn = h('button', { class: 'btn primary', onclick: async () => {
      if (!build.ok) return;
      if (await writeRecords(build.ndef, prefs, status.set)) finishCard('web-nfc');
    } }, '📲 Escribir en tarjeta');
    const copyBtn = h('button', { class: 'btn', onclick: async () => toast((await U.copy(build.items.map((i) => copyValue(i.res)).join('\n'))) ? 'Copiado ✓ (pégalo en NFC Tools)' : 'No se pudo copiar') }, '📋 Copiar contenido');
    const doneBtn = h('button', { class: 'btn', onclick: () => { if (build.ok) { finishCard('manual'); toast('Marcada como programada ✓'); } } }, '✓ Ya la escribí (NFC Tools)');
    const saveBtn = h('button', { class: 'btn', onclick: () => {
      const name = taskName.value.trim();
      if (!name) return toast('Ponle un nombre a la tarea');
      S.tasks.push({ id: U.uid(), name, chip: draft.chip, records: draft.records.map(({ kind, a, b, c, d, rid, mesa }) => ({ kind, a, b, c, d, rid, mesa })) });
      touch(); taskName.value = ''; toast('Tarea guardada en "Mis tareas" ✓');
    } }, '💾 Guardar como tarea');
    const clearBtn = h('button', { class: 'btn danger', onclick: () => { if (draft.records.length && !confirm('¿Vaciar la lista de registros?')) return; draft.records = []; renderRecords(); } }, 'Vaciar');

    const summaryLabel = () => draft.records.map((r) => Nfc.KINDS[r.kind].label).join(' + ');
    function finishCard(via) {
      draft.written++;
      const nm = draft.cardName.trim() || App.cards.suggest();
      App.cards.markProgrammed(nm, build.items.map((i) => copyValue(i.res)).join(' | '), via === 'web-nfc' ? lastSerial : '');
      pushLog(nm + ' — ' + summaryLabel(), build.items.map((i) => i.res.text).join(' | '), via);
      if (draft.auto) {
        let changed = false;
        draft.records.forEach((r) => { if (r.kind === 'page' && /^\d+$/.test(String(r.mesa || '').trim())) { r.mesa = String(parseInt(r.mesa, 10) + 1); changed = true; } });
        // "Mesa 3" -> "Mesa 4"; sin número, la próxima vez usa la siguiente tarjeta del stock
        if (draft.cardName.trim()) { draft.cardName = App.cards.inc(nm); cardIn.value = draft.cardName; }
        if (changed) renderRecords();
      }
      cardIn.placeholder = App.cards.suggest();
      toast('Tarjeta "' + nm + '" registrada ✓');
      touch(); recompute();
    }

    function recompute() {
      build = Nfc.build(draft.records, ctx());
      build.items.forEach(({ r, res }) => {
        const el = stEls[r.id];
        if (!el) return;
        el.className = 'rec-st ' + (res.error ? 'err' : res.warn ? 'warn' : 'ok');
        el.textContent = res.error ? res.error : (res.warn ? '⚠ ' + res.warn + ' · ' : '✓ ') + (res.text || '');
      });
      const cap = Nfc.CHIPS[draft.chip].mem, total = build.size.total;
      bar.style.width = Math.min(100, (total / cap) * 100) + '%';
      bar.parentNode.classList.toggle('over', total > cap);
      sumText.textContent = draft.records.length
        ? draft.records.length + ' registro(s) · ' + (build.ok ? total + ' de ' + cap + ' bytes (≈' + Math.round((total / cap) * 100) + '%)' : 'completa los registros para calcular el tamaño')
        : 'Añade un registro para empezar.';
      capNote.className = build.ok && total > cap ? 'note err' : '';
      capNote.textContent = build.ok && total > cap ? 'No cabe en un ' + Nfc.CHIPS[draft.chip].label + '. Usa un chip de más memoria o quita registros.' : '';
      [copyBtn, doneBtn, saveBtn].forEach((b) => b.toggleAttribute('disabled', !build.ok));
      writeBtn.toggleAttribute('disabled', !build.ok || !Nfc.supported() || total > cap);
      const first = build.ok && build.ndef.find((n) => n.recordType === 'url');
      qr.hidden = !first || !App.drawQr(qr, first.data);
      counter.textContent = 'Escritas en esta sesión: ' + draft.written;
    }

    function recCard(rec, i) {
      const K = Nfc.KINDS[rec.kind];
      const st = h('div', { class: 'rec-st' });
      stEls[rec.id] = st;
      const move = (d) => { const j = i + d; if (j < 0 || j >= draft.records.length) return; [draft.records[i], draft.records[j]] = [draft.records[j], draft.records[i]]; renderRecords(); };
      const inputs = K.fields.map((f) => {
        if (f.type === 'select') {
          return field(f.label, h('select', { value: rec[f.k] || f.options[0][0], onchange: (e) => { rec[f.k] = e.target.value; recompute(); } },
            f.options.map(([v, l]) => h('option', { value: v }, l))));
        }
        if (f.type === 'rest') {
          return field(f.label, h('select', { value: rec.rid, onchange: (e) => { rec.rid = e.target.value; recompute(); } },
            S.restaurants.length ? S.restaurants.map((r) => h('option', { value: r.id }, r.name)) : h('option', { value: '' }, '(crea un restaurante primero)')));
        }
        const common = { value: rec[f.k], placeholder: f.ph || '', oninput: (e) => { rec[f.k] = e.target.value; recompute(); } };
        return field(f.label, f.type === 'area' ? h('textarea', Object.assign({ rows: 3 }, common)) : h('input', Object.assign({ type: 'text', autocapitalize: 'off', autocorrect: 'off' }, common)));
      });
      return h('div', { class: 'rec' },
        h('div', { class: 'rechead' }, h('b', null, K.icon + ' ' + K.label), h('span', { style: 'flex:1' }),
          h('button', { class: 'btn small', 'aria-label': 'Copiar registro', onclick: async () => {
            const it = build.items.find((x) => x.r.id === rec.id);
            if (!it || it.res.error) return toast('Completa el registro primero');
            toast((await U.copy(copyValue(it.res))) ? 'Copiado ✓' : 'No se pudo copiar');
          } }, '📋'),
          h('button', { class: 'btn small', 'aria-label': 'Subir', onclick: () => move(-1) }, '↑'),
          h('button', { class: 'btn small', 'aria-label': 'Bajar', onclick: () => move(1) }, '↓'),
          h('button', { class: 'btn small danger', 'aria-label': 'Quitar registro', onclick: () => { draft.records.splice(i, 1); renderRecords(); } }, '🗑')),
        h('div', { class: K.fields.length > 2 ? 'grid2' : '' }, inputs), st);
    }

    function renderRecords() {
      Object.keys(stEls).forEach((k) => delete stEls[k]);
      list.replaceChildren(...draft.records.map(recCard));
      recompute();
    }

    const chipSel = h('select', { value: draft.chip, onchange: (e) => { draft.chip = e.target.value; recompute(); } },
      Object.entries(Nfc.CHIPS).map(([k, c]) => h('option', { value: k }, c.label + ' (' + c.mem + ' bytes)')));
    const autoChk = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: draft.auto, onchange: (e) => { draft.auto = e.target.checked; } }), 'Sumar 1 al número de mesa al terminar cada tarjeta');

    const add = h('div', { class: 'kinds' },
      Object.entries(Nfc.KINDS).filter(([, K]) => !K.hidden).map(([k, K]) =>
        h('button', { class: 'btn small', onclick: () => { draft.records.push(newRec(k)); renderRecords(); } }, K.icon + ' ' + K.label)));

    const view = h('div', null, title('Escribir', 'Arma los registros de la tarjeta, comprueba que caben en el chip y escríbelos.'),
      cardDatalist(),
      unsupportedNote('escribir'),
      h('div', { class: 'card' }, h('h3', null, 'Registros'), list, h('div', { style: 'margin-top:10px' }, h('div', { class: 'sub', style: 'margin:0 0 6px' }, 'Añadir registro:'), add)),
      h('div', { class: 'card' }, h('h3', null, 'Tamaño'),
        field('Chip de la tarjeta', chipSel, 'Si no sabes cuál es, mira la pestaña Otros → Diagnóstico o prueba con NTAG213 (el más chico).'),
        h('div', { class: 'bar' }, bar), sumText, capNote),
      h('div', { class: 'card' }, h('h3', null, 'Escribir'),
        field('Nombre de la tarjeta', cardIn, 'Termina en número ("Mesa 1", "Tarjeta 007") y se suma solo en cada tarjeta. Vacío = la siguiente del stock.'),
        h('div', { class: 'btns' }, writeBtn, copyBtn, doneBtn),
        optionsRow(), autoChk, status, counter,
        h('details', { style: 'margin-top:10px' }, h('summary', null, 'QR de respaldo del primer enlace'), qr)),
      h('div', { class: 'card' }, h('h3', null, 'Guardar'),
        h('div', { class: 'row' }, field('Nombre', taskName), h('div', { class: 'shrink btns', style: 'padding-bottom:12px' }, saveBtn, clearBtn))));
    renderRecords();
    return view;
  };

  /* ---------- 🧰 Otros ---------- */
  App.views.otros = function () {
    const status = statusBox();
    const run = async (fn, okMsg) => {
      status.set('Acerca la tarjeta a la parte trasera del celular…', '');
      try { await fn(); status.set(okMsg, 'ok'); } catch (e) { status.set(Nfc.errMsg(e), e.name === 'LockUnsupported' ? 'warn' : 'err'); }
    };
    const sup = Nfc.supported();
    const yes = (b) => (b ? '✓' : '✗');
    const diag = [
      ['Web NFC (leer y escribir)', sup],
      ['Contexto seguro (https)', window.isSecureContext],
      ['Instalada en la pantalla de inicio', !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches) || !!navigator.standalone],
      ['Funciona sin internet', 'serviceWorker' in navigator && !!navigator.serviceWorker.controller],
      ['Guardado de datos (IndexedDB)', 'indexedDB' in window],
    ];
    const system = Nfc.isIOS() ? 'iPhone / iPad' : /Android/i.test(navigator.userAgent) ? 'Android' : 'Otro (PC)';

    return h('div', null, title('Otros', 'Borrar, bloquear, copiar y revisar tu equipo.'),
      unsupportedNote('usar'),
      h('div', { class: 'card' }, h('h3', null, 'Acciones sobre la tarjeta'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', disabled: !sup, onclick: () => { if (confirm('Se borrará el contenido de la tarjeta. ¿Continuar?')) run(Nfc.erase, '✓ Tarjeta borrada.'); } }, '🧹 Borrar tarjeta'),
          h('button', { class: 'btn', disabled: !sup, onclick: () => { if (confirm('Bloquear la tarjeta es IRREVERSIBLE: no se podrá volver a escribir. ¿Continuar?')) run(Nfc.lockOnly, '✓ Tarjeta bloqueada.'); } }, '🔒 Bloquear tarjeta'),
          h('button', { class: 'btn', disabled: !sup, onclick: async () => {
            status.set('Acerca la tarjeta que quieres copiar…', '');
            try {
              const d = await Nfc.readOnce(20000);
              const { records, skipped } = recordsFromRead(d.records);
              if (!records.length) return status.set('No hay registros que se puedan copiar.', 'err');
              if (skipped) toast(skipped + ' registro(s) no se pudieron copiar');
              loadDraft(records);
            } catch (e) { status.set(Nfc.errMsg(e), 'err'); }
          } }, '📑 Copiar tarjeta')),
        status,
        h('p', { class: 'sub', style: 'margin:10px 0 0' }, 'Copiar tarjeta lee la que acercas y la carga en "Escribir": ahí acercas la tarjeta nueva y escribes.')),
      h('div', { class: 'card' }, h('h3', null, 'Diagnóstico'),
        h('div', { class: 'kv' }, h('span', null, 'Sistema'), h('b', null, system)),
        diag.map(([l, ok]) => h('div', { class: 'kv' }, h('span', null, l), h('b', { class: ok ? 'okc' : 'noc' }, yes(ok))))),
      h('div', { class: 'card' }, h('h3', null, 'Chips más comunes'),
        Object.values(Nfc.CHIPS).map((c) => h('div', { class: 'kv' }, h('span', null, c.label), h('b', null, c.mem + ' bytes de memoria'))),
        h('p', { class: 'sub', style: 'margin:10px 0 0' }, 'Si no sabes cuál tienes, lee la tarjeta con NFC Tools: muestra el tipo y la memoria.')),
      h('div', { class: 'card' }, h('h3', null, 'Lo que la web no puede hacer'),
        h('p', { style: 'margin:0' }, 'Poner contraseña a la tarjeta, formatearla a bajo nivel o leer tarjetas que no sean NDEF no existe en Web NFC. Para eso sigue haciendo falta una app nativa como NFC Tools.')));
  };

  /* ---------- 📁 Mis tareas ---------- */
  App.views.tareas = function () {
    const S = App.S;
    const summary = (t) => t.records.map((r) => (Nfc.KINDS[r.kind] ? Nfc.KINDS[r.kind].icon : '?')).join(' ');
    return h('div', null, title('Mis tareas', 'Plantillas de tarjeta que repites seguido, e historial de lo que has programado.'),
      h('div', { class: 'card' }, h('h3', null, 'Tareas guardadas'),
        S.tasks.length === 0 ? h('p', { class: 'sub' }, 'Aún no guardaste ninguna. Arma una en Escribir y toca "Guardar como tarea".') :
          S.tasks.map((t) => h('div', { class: 'step' },
            h('span', { class: 'grow' }, h('b', null, t.name), h('br'), h('span', { style: 'color:var(--muted);font-size:13px' }, summary(t) + ' · ' + t.records.length + ' registro(s)')),
            h('button', { class: 'btn small primary', onclick: () => loadDraft(t.records, t.chip) }, 'Usar'),
            h('button', { class: 'btn small danger', 'aria-label': 'Eliminar tarea', onclick: () => { if (confirm('¿Eliminar "' + t.name + '"?')) { S.tasks = S.tasks.filter((x) => x.id !== t.id); touch(); App.render(); } } }, '🗑')))),
      h('div', { class: 'card' }, h('h3', null, 'Historial de tarjetas'),
        S.log.length === 0 ? h('p', { class: 'sub' }, 'Todavía no hay tarjetas programadas.') :
          S.log.slice(-30).reverse().map((l) => h('div', { class: 'step' },
            h('span', { class: 'grow' }, h('b', null, l.label), h('br'), h('span', { class: 'mono', style: 'color:var(--muted);font-size:12px' }, l.text), h('br'),
              h('span', { style: 'color:var(--muted);font-size:12px' }, fmtDate(l.at) + ' · ' + ({ 'web-nfc': 'escrita desde la app', manual: 'marcada a mano', venta: 'venta rápida' }[l.via] || l.via))))),
        S.log.length ? h('div', { class: 'btns', style: 'margin-top:12px' },
          h('button', { class: 'btn small danger', onclick: () => { if (confirm('¿Vaciar el historial?')) { S.log = []; touch(); App.render(); } } }, 'Vaciar historial')) : null));
  };

  /* ---------- Atajos que usan otras pantallas (Menú, Mis tarjetas) ---------- */
  App.addRecord = (kind) => { draft.records.push(newRec(kind)); go('escribir'); };
  App.prepWrite = (cardName) => { draft.cardName = cardName || ''; go('escribir'); };
  App.prepSale = (cardName, url) => { venta.cardName = cardName || ''; if (url && /^https?:\/\//i.test(url)) venta.input = url; go('venta'); };
})();
