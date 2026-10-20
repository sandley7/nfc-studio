// ⭐ Reseñas: módulo aparte, solo para tarjetas que llevan al cliente a Google Maps a calificar con estrellas.
// Configura cada tarjeta paso a paso: tarjeta → negocio y enlace → escribir → probar → entregar.
(function () {
  'use strict';
  const { h, field, toast, touch, title, statusBox } = App;

  const form = { id: null, name: '', business: '', input: '', mode: 'maps', price: '', method: 'Yape' };
  const resetForm = () => Object.assign(form, { id: null, name: '', business: '', input: '', mode: 'maps', price: '', method: 'Yape' });
  const isResena = (c) => c.type === 'resena' || /maps\.app\.goo\.gl|google\.[a-z.]+\/maps|g\.page|writereview/i.test(c.content || '');
  const looksLikePlaceId = (v) => /^[A-Za-z0-9_-]{20,}$/.test(String(v || '').trim());

  function chipOf(c) {
    if (c.status === 'vendida') return ['ok', 'Vendida'];
    if (c.tested === true) return ['ok', 'Probada ✓'];
    if (c.tested === false) return ['err', 'Falló la prueba'];
    if (c.status === 'programada') return ['warn', 'Escrita · falta probar'];
    return ['warn', c.url ? 'Configurada · falta escribir' : 'Sin enlace'];
  }

  // Las 3 formas de conseguir el enlace + mensaje de WhatsApp para el dueño
  function linkGuide(S) {
    return h('details', { style: 'margin-top:10px' }, h('summary', null, '¿Cómo consigo el enlace? (3 formas)'),
      h('ol', { class: 'steps' },
        h('li', null, h('b', null, 'Enlace de Google Maps, desde tu celular (lo más fácil): '),
          'abre el negocio en la app de Google Maps, toca ', h('b', null, 'Compartir'), ' y copia el enlace. Al tocar la tarjeta, el cliente ve la ficha del negocio con sus estrellas y toca para calificar.'),
        h('li', null, h('b', null, 'Place ID: '),
          'toca "Buscar Place ID", escribe el nombre del negocio, copia el código que empieza con "ChIJ" y pégalo arriba. La app arma el enlace a la ficha de Maps (o a la ventana de reseña directa, si lo eliges).'),
        h('li', null, h('b', null, 'Enlace directo de reseña, que el dueño genera desde una computadora: '),
          'business.google.com → ', h('b', null, 'Leer reseñas'), ' → ', h('b', null, 'Consigue más reseñas'), ' → ', h('b', null, 'Copiar'),
          '. Según la ayuda de Google, ese enlace y su QR solo se generan en un navegador de computadora, no en el celular.')),
      h('div', { class: 'btns' }, h('button', { class: 'btn small', onclick: async () => {
        const msg = 'Hola 👋 Soy de ' + (S.settings.sellerName || 'altoke.pe') + '. Para dejarte lista tu tarjeta de reseñas necesito el enlace de tu negocio en Google Maps. ' +
          'Ábrelo en la app de Google Maps, toca Compartir y envíamelo por aquí. Si prefieres, dime el nombre y la dirección del local y yo lo busco.';
        toast((await U.copy(msg)) ? 'Mensaje copiado ✓ (pégalo en WhatsApp)' : 'No se pudo copiar');
      } }, '📋 Copiar mensaje para pedirle el enlace al dueño')));
  }

  App.views.resenas = function () {
    const S = App.S;
    const t = App._t;
    const manual = !Nfc.supported(); // sin Web NFC (iPhone, PC): la escritura se hace con NFC Tools
    const ios = Nfc.isIOS();
    const reviewCards = () => S.cards.filter(isResena).sort((a, b) => (b.programmedAt || b.createdAt || 0) - (a.programmedAt || a.createdAt || 0));
    const currentCard = () => (form.id ? S.cards.find((k) => k.id === form.id) : null);
    let curUrl = '';

    const stats = h('div', { class: 'grid4 stats' });
    const list = h('div');
    const testBox = h('div');
    const linkNote = h('div');
    const status = statusBox();
    const urlIn = h('input', { type: 'text', readonly: true, 'aria-label': 'Enlace de la tarjeta', placeholder: 'El enlace aparecerá aquí' });
    const qr = h('canvas', { class: 'qr', 'aria-label': 'Código QR de respaldo' });
    const stat = (n, l) => h('div', { class: 'card stat' }, h('b', null, n), h('span', null, l));

    /* ---------- Campos del formulario ---------- */
    const nameIn = h('input', { type: 'text', list: 'cardnames', value: form.name, autocapitalize: 'off', placeholder: App.cards.suggest(), oninput: (e) => { form.name = e.target.value; } });
    const bizIn = h('input', { type: 'text', value: form.business, placeholder: 'Ej. Pollería Rey', oninput: (e) => { form.business = e.target.value; update(); } });
    const linkIn = h('input', { type: 'text', value: form.input, inputmode: 'url', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      placeholder: 'Pega el enlace de Google Maps, de reseña o el Place ID', oninput: (e) => { form.input = e.target.value; update(); } });
    const modeSel = h('select', { value: form.mode, onchange: (e) => { form.mode = e.target.value; update(); } },
      [['maps', 'Ficha de Google Maps con las estrellas (recomendado)'], ['direct', 'Ventana de reseña directa']].map(([v, l]) => h('option', { value: v }, l)));
    const modeWrap = field('Al tocar la tarjeta, abrir', modeSel, 'Solo aplica cuando pegas un Place ID. Las estrellas se tocan en la ficha de Maps.');
    const priceIn = h('input', { type: 'text', inputmode: 'decimal', value: form.price, placeholder: String(S.shop.price), oninput: (e) => { form.price = e.target.value; } });
    const methodSel = h('select', { value: form.method, onchange: (e) => { form.method = e.target.value; } },
      ['Yape', 'Plin', 'Efectivo', 'Transferencia'].map((m) => h('option', { value: m }, m)));

    const parsed = () => Nfc.reviewFromInput(form.input, { mode: form.mode, name: form.business });

    /* ---------- Guardar la configuración en el inventario ---------- */
    function save(patch) {
      const x = parsed();
      const nm = form.name.trim() || (currentCard() ? currentCard().name : '') || App.cards.suggest();
      let c = App.cards.byName(nm);
      if (!c && form.id) { c = currentCard(); if (c) c.name = nm; }
      if (!c) c = App.cards.upsert(nm, {});
      Object.assign(c, { type: 'resena', business: form.business.trim(), input: form.input.trim(), mode: form.mode, url: x.url || c.url || '' }, patch || {});
      if (x.url) c.content = x.url;
      form.id = c.id; form.name = c.name;
      touch();
      return c;
    }

    /* ---------- Botones de los pasos ---------- */
    const copyBtn = h('button', { class: 'btn primary', onclick: async () => toast((await U.copy(curUrl)) ? 'Enlace copiado ✓' : 'No se pudo copiar') }, '📋 Copiar enlace');
    const testLinkBtn = h('button', { class: 'btn', onclick: () => window.open(curUrl, '_blank', 'noopener') }, '🔗 Probar enlace');
    const saveBtn = h('button', { class: 'btn', onclick: () => { const c = save(); toast('Configuración guardada en «' + c.name + '» ✓'); renderAll(); } }, '💾 Guardar configuración');
    const writeBtn = h('button', { class: 'btn', onclick: async () => {
      const x = parsed();
      if (!x.url) return;
      const c = save();
      if (await t.writeRecords([{ recordType: 'url', data: x.url }], t.prefs, status.set)) {
        App.cards.markProgrammed(c.name, x.url, t.getLastSerial());
        c.tested = null;
        t.pushLog(c.name + ' — ' + (form.business.trim() || 'reseña'), x.url, 'web-nfc');
        touch(); toast('Tarjeta «' + c.name + '» escrita ✓ Ahora pruébala (paso 4)'); renderAll(); update();
      }
    } }, '📲 Escribir en tarjeta');
    const copyBtn3 = h('button', { class: 'btn primary', onclick: async () => toast((await U.copy(curUrl)) ? 'Enlace copiado ✓ Ahora ábrelo en NFC Tools' : 'No se pudo copiar') }, '📋 Copiar enlace');
    const serialIn = h('input', { type: 'text', placeholder: 'Opcional: número de serie (ej. 04:A1:B2:C3:D4:E5:F6)', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Número de serie de la tarjeta' });
    const manualBtn = h('button', { class: ios || manual ? 'btn primary' : 'btn', onclick: () => {
      const x = parsed();
      if (!x.url) return;
      const c = save();
      App.cards.markProgrammed(c.name, x.url, serialIn.value.trim());
      c.tested = null;
      t.pushLog(c.name + ' — ' + (form.business.trim() || 'reseña'), x.url, 'manual');
      touch(); toast('Marcada como escrita ✓ Ahora pruébala (paso 4)'); renderAll();
    } }, '✓ Ya la escribí con NFC Tools');

    const markTest = (ok) => {
      const c = currentCard();
      if (!c) return toast('Primero guarda o escribe la tarjeta');
      c.tested = ok; c.testedAt = Date.now(); touch();
      toast(ok ? 'Tarjeta probada ✓' : 'Anotado: la prueba falló'); renderAll();
    };

    const register = () => {
      const x = parsed();
      const unit = U.price(form.price === '' ? S.shop.price : form.price);
      if (unit == null || unit < 0) return toast('Precio no válido');
      let c = save();
      if (c.tested !== true && !confirm('La tarjeta todavía no está marcada como probada. ¿Registrar la venta igual?')) return;
      const client = form.business.trim() || '(sin nombre)';
      const sold = App.cards.sell(c.name, 1, { client, price: unit, content: x.url });
      S.sales.push({ id: U.uid(), at: Date.now(), client, qty: 1, unit, total: +unit.toFixed(2), method: form.method, url: x.url, cards: sold.map((k) => k.name) });
      t.pushLog(client + ' — ' + sold.map((k) => k.name).join(', '), x.url || '(sin enlace)', 'venta');
      touch(); toast('Venta registrada ✓'); resetForm(); App.render();
    };

    /* ---------- Actualizaciones de pantalla ---------- */
    function update() {
      const x = parsed();
      curUrl = x.url;
      urlIn.value = x.url;
      modeWrap.hidden = !looksLikePlaceId(form.input);
      linkNote.className = form.input ? 'note ' + (x.url ? (x.warn ? 'warn' : 'ok') : 'err') : '';
      linkNote.textContent = form.input
        ? (x.url ? '✓ ' + [x.info, x.warn].filter(Boolean).join(' ') + ' Toca "Probar enlace" y comprueba que abre el negocio correcto.' : x.warn)
        : '';
      [copyBtn, copyBtn3, testLinkBtn, saveBtn, manualBtn].forEach((b) => b.toggleAttribute('disabled', !x.url));
      writeBtn.toggleAttribute('disabled', !x.url || !Nfc.supported());
      qr.hidden = !x.url || !App.drawQr(qr, x.url);
    }

    function renderStats() {
      const rc = reviewCards();
      const left = Math.max(0, S.shop.stock - S.sales.reduce((n, s) => n + s.qty, 0)); // lote − tarjetas vendidas
      stats.replaceChildren(
        stat(left, 'En stock'),
        stat(rc.filter((c) => c.url || c.content).length, 'Configuradas'),
        stat(rc.filter((c) => c.tested === true).length, 'Probadas ✓'),
        stat(rc.filter((c) => c.status === 'vendida').length, 'Vendidas'));
    }

    function renderTest() {
      const c = currentCard();
      const written = c && c.status !== 'stock';
      testBox.replaceChildren(
        h('ol', { class: 'steps' },
          h('li', null, 'Toma un celular que ', h('b', null, 'no'), ' sea el que usaste para escribir (o aleja y vuelve a acercar el mismo).'),
          h('li', null, 'Desbloquea la pantalla y acerca la tarjeta: en Android, a la parte de atrás del celular; en iPhone, a la parte de arriba.'),
          h('li', null, h('b', null, 'iPhone XS o más nuevo'), ' (según Apple): la lee sin abrir ninguna app y muestra una notificación arriba; tócala para abrir el enlace. Si pide desbloquear, desbloquea primero. En un iPhone más antiguo la lectura sin app no está garantizada: prueba con otro celular.'),
          h('li', null, 'Debe abrirse ', h('b', null, 'Google Maps con el negocio correcto'), ' y se deben ver las ', h('b', null, '5 estrellas'), ' para calificar. Toca las estrellas para comprobar que se puede calificar.'),
          h('li', null, 'Si el celular no tiene NFC, prueba con la cámara y el QR de respaldo del paso 2.')),
        !written ? h('div', { class: 'note warn' }, 'Primero escribe la tarjeta (paso 3).') : null,
        h('div', { class: 'btns' },
          h('button', { class: 'btn primary', disabled: !c, onclick: () => markTest(true) }, '✓ Funciona: abre el negocio y puedo calificar'),
          h('button', { class: 'btn danger', disabled: !c, onclick: () => markTest(false) }, '✗ No funcionó')),
        c && c.tested === true ? h('div', { class: 'note ok' }, '✓ Probada el ' + t.fmtDate(c.testedAt) + '. Ya puedes entregarla.') : null,
        c && c.tested === false ? h('div', { class: 'note err' }, h('b', null, 'Qué revisar si falló:'),
          h('ol', { class: 'steps' },
            h('li', null, 'Que el NFC esté activado en el celular de prueba y la pantalla desbloqueada.'),
            h('li', null, 'Que no haya funda gruesa ni metal detrás; mueve la tarjeta despacio por la parte de atrás.'),
            h('li', null, 'Toca "Probar enlace" en el paso 2: si el enlace mismo no abre bien, el problema es el enlace y no la tarjeta.'),
            h('li', null, 'Vuelve a escribir la tarjeta con "Verificar después de escribir" activado (Android). Si falla otra vez, usa otra tarjeta del lote: a S/ 1 alguna puede venir mala.'),
            h('li', null, 'Plan B mientras tanto: el QR de respaldo.'))) : null);
    }

    function row(c) {
      const [cls, label] = chipOf(c);
      const url = c.url || c.content || '';
      return h('div', { class: 'crow' },
        h('div', { class: 'rechead' }, h('b', null, c.name), h('span', { class: 'chip ' + cls }, label)),
        c.business || c.client ? h('div', null, '🏪 ' + (c.business || c.client)) : null,
        url ? h('div', { class: 'mono cc' }, url) : null,
        h('div', { class: 'cinfo' }, [c.serial && '🆔 ' + c.serial, c.programmedAt && '✍️ ' + t.fmtDate(c.programmedAt), c.testedAt && (c.tested ? '✓ probada ' : '✗ prueba ') + t.fmtDate(c.testedAt)].filter(Boolean).join(' · ')),
        h('div', { class: 'btns', style: 'margin-top:8px' },
          h('button', { class: 'btn small', onclick: () => {
            Object.assign(form, { id: c.id, name: c.name, business: c.business || c.client || '', input: c.input || c.url || c.content || '', mode: c.mode || 'maps', price: '', method: 'Yape' });
            App.render(); window.scrollTo(0, 0);
          } }, '✏️ Editar / continuar'),
          h('button', { class: 'btn small', disabled: !url, onclick: () => window.open(url, '_blank', 'noopener') }, '🔗 Probar enlace'),
          h('button', { class: 'btn small', disabled: !url, onclick: async () => toast((await U.copy(url)) ? 'Enlace copiado ✓' : 'No se pudo copiar') }, '📋 Copiar'),
          h('button', { class: 'btn small', title: 'Otra tarjeta para el mismo negocio (otra mesa, otra caja)', onclick: () => {
            let nm = App.cards.inc(c.name);
            while (!nm || App.cards.byName(nm)) nm = nm && App.cards.byName(nm) ? App.cards.inc(nm) : App.cards.nextName();
            Object.assign(form, { id: null, name: nm, business: c.business || c.client || '', input: c.input || c.url || c.content || '', mode: c.mode || 'maps', price: '', method: 'Yape' });
            toast('Copia lista como «' + nm + '»: escríbela en otra tarjeta'); App.render(); window.scrollTo(0, 0);
          } }, '📑 Duplicar para otra tarjeta'),
          h('button', { class: 'btn small danger', 'aria-label': 'Eliminar tarjeta', onclick: () => {
            if (!confirm('¿Eliminar «' + c.name + '» del inventario?')) return;
            S.cards = S.cards.filter((k) => k !== c); if (form.id === c.id) resetForm(); touch(); App.render();
          } }, '🗑')));
    }

    function renderList() {
      const rc = reviewCards();
      list.replaceChildren(...(rc.length ? rc.map(row) : [h('p', { class: 'sub' }, 'Aún no configuraste ninguna tarjeta de reseñas. Empieza con el paso 1.')]));
    }

    function renderAll() { renderStats(); renderList(); renderTest(); }

    /* ---------- Pantalla ---------- */
    const editing = currentCard();
    const view = h('div', null,
      title('Reseñas', 'Tarjetas que llevan al cliente a Google Maps para calificar con estrellas y dejar su opinión.'),
      t.cardDatalist(),
      manual ? h('div', { class: 'note warn' }, ios
        ? '📱 Estás en iPhone: los pasos 1, 2, 4 y 5 se hacen en esta pantalla. El paso 3 (escribir en la tarjeta) se hace con NFC Tools, porque Safari no puede escribir NFC.'
        : 'Este equipo no escribe NFC desde la web. Los pasos 1, 2, 4 y 5 se hacen aquí; el paso 3 se hace con NFC Tools en un celular.') : null,
      h('div', { class: 'card' }, h('h3', null, '⭐ Cómo funciona'),
        h('ol', { class: 'steps' },
          h('li', null, 'El cliente acerca su celular a la tarjeta (o escanea el QR de respaldo).'),
          h('li', null, 'Se abre la ficha del negocio en ', h('b', null, 'Google Maps'), ', con sus estrellas.'),
          h('li', null, 'El cliente toca las estrellas para calificar y, si quiere, escribe su opinión.')),
        h('div', { class: 'note' }, h('b', null, 'Regla de Google: '), 'no se permite ofrecer descuentos ni regalos a cambio de reseñas, ni pedirlas solo a los clientes contentos. Pide la reseña a todos por igual: si la tarjeta lleva a todos al mismo lugar, estás cumpliendo.'),
        h('p', { class: 'sub', style: 'margin:8px 0 0' }, 'Los menús digitales por tarjeta quedan guardados y disponibles en "Menús digitales (para después)"; no se tocan.')),
      stats,

      h('div', { class: 'card' }, h('h3', null, editing ? 'Editando «' + editing.name + '»' : 'Nueva tarjeta de reseñas'),
        editing ? h('div', { class: 'btns', style: 'margin-bottom:8px' }, h('button', { class: 'btn small', onclick: () => { resetForm(); App.render(); } }, '＋ Empezar una tarjeta nueva')) : null,
        h('h3', { style: 'margin-top:6px' }, 'Paso 1 · ¿Qué tarjeta vas a configurar?'),
        field('Nombre de la tarjeta', nameIn, 'Ponle un nombre para reconocerla después (ej. "Pollería Rey - Caja"). Vacío = la siguiente tarjeta del stock.')),

      h('div', { class: 'card' }, h('h3', null, 'Paso 2 · ¿De qué negocio y dónde califican?'),
        field('Nombre del negocio', bizIn),
        field('Enlace de Google Maps, de reseña o Place ID', linkIn,
          'Lo más fácil: abre el negocio en la app de Google Maps, toca Compartir, copia el enlace y pégalo aquí.'),
        modeWrap,
        h('div', { class: 'btns', style: 'margin-bottom:8px' },
          h('a', { class: 'btn small', href: 'https://developers.google.com/maps/documentation/places/web-service/place-id', target: '_blank', rel: 'noopener' }, '🔎 Buscar Place ID (herramienta de Google)')),
        linkNote,
        h('div', { class: 'urlbox', style: 'margin-top:8px' }, urlIn),
        h('div', { class: 'btns', style: 'margin-top:10px' }, copyBtn, testLinkBtn, saveBtn),
        linkGuide(S),
        h('details', { style: 'margin-top:10px' }, h('summary', null, 'QR de respaldo (para celulares sin NFC)'),
          h('p', { class: 'sub', style: 'margin:0 0 8px' }, 'Imprímelo o pégalo junto a la tarjeta: la cámara del celular lo abre.'), qr)),

      h('div', { class: 'card' }, h('h3', null, 'Paso 3 · Escribe el enlace en la tarjeta'),
        manual ? null : h('div', { class: 'btns' }, writeBtn, manualBtn),
        manual
          ? h('div', null,
            h('div', { class: 'note' }, h('b', null, ios ? '📱 Modo iPhone. ' : 'Este equipo no puede escribir NFC desde la web. '),
              'La escritura se hace con la app gratuita ', h('b', null, 'NFC Tools'), ' (de WAKDEV). Esta pantalla te guía y lleva la cuenta de tus tarjetas.'),
            h('ol', { class: 'steps' },
              h('li', null, h('b', null, 'Instala NFC Tools '), '(una sola vez): búscala en la App Store como "NFC Tools", de WAKDEV (',
                h('a', { href: 'https://www.wakdev.com/en/apps/nfc-tools-ios.html', target: '_blank', rel: 'noopener' }, 'ficha oficial'), '). Según WAKDEV, el iPhone puede escribir NFC desde iOS 13.'),
              h('li', null, h('b', null, 'Copia el enlace: '), copyBtn3),
              h('li', null, h('b', null, 'Abre NFC Tools '), '→ pestaña ', h('b', null, 'Escribir'), ' → ', h('b', null, 'Añadir un registro'), ' → ', h('b', null, 'URL/URI'),
                ' → toca el cuadro y ', h('b', null, 'pega'), ' el enlace (iOS puede preguntar "Permitir pegar": acepta) → ', h('b', null, 'Aceptar'), '.'),
              h('li', null, 'Toca ', h('b', null, 'Escribir'), ' y acerca la ', h('b', null, 'parte de arriba del iPhone'), ' a la tarjeta. Sin funda gruesa y sin mover la tarjeta hasta que NFC Tools diga que terminó.'),
              h('li', null, h('b', null, 'Comprueba lo escrito '), '(recomendado): en NFC Tools → ', h('b', null, 'Leer'), ', acerca la tarjeta; debe mostrar tu enlace. Ahí aparece también el número de serie (UID); si quieres, cópialo aquí para reconocer esta tarjeta después:', serialIn),
              h('li', null, 'Vuelve aquí y toca: ', manualBtn)))
          : h('div', null, t.optionsRow(),
            h('ul', { class: 'steps' },
              h('li', null, h('b', null, 'Verificar después de escribir: '), 'vuelve a leer la tarjeta y compara con lo escrito; además guarda su número de serie para reconocerla después.'),
              h('li', null, h('b', null, 'Bloquear: '), 'evita que alguien la reescriba, pero es irreversible. Recomendado solo después de probarla en el paso 4.'))),
        status),

      h('div', { class: 'card' }, h('h3', null, 'Paso 4 · Pruébala como lo haría un cliente'), testBox),

      h('div', { class: 'card' }, h('h3', null, 'Paso 5 · Entrega y cobra'),
        h('p', { class: 'sub', style: 'margin:0 0 10px' }, 'Registra la venta de esta tarjeta. Precio 0 = entrega gratis (por ejemplo, un piloto).'),
        h('div', { class: 'grid2' }, field('Precio (S/)', priceIn, 'Vacío = precio por defecto (S/ ' + S.shop.price + ')'), field('Pago', methodSel)),
        h('button', { class: 'btn primary', onclick: register }, '✓ Registrar venta de esta tarjeta')),

      h('div', { class: 'card' }, h('h3', null, 'Mis tarjetas de reseñas'), list),

      h('div', { class: 'card' }, h('h3', null, 'Tu lote'),
        h('p', { class: 'sub', style: 'margin:0 0 10px' }, 'En stock = tarjetas del lote − tarjetas vendidas.'),
        h('div', { class: 'grid2' },
          field('Tarjetas del lote', h('input', { type: 'number', min: 0, value: S.shop.stock, onchange: (e) => { S.shop.stock = Math.max(0, parseInt(e.target.value, 10) || 0); touch(); App.render(); } })),
          field('Precio por defecto (S/)', h('input', { type: 'text', inputmode: 'decimal', value: S.shop.price,
            onchange: (e) => { const v = U.price(e.target.value); S.shop.price = v == null ? S.shop.price : v; touch(); App.render(); } }), 'Se usa en el paso 5 si dejas el precio vacío.'))));

    renderAll();
    update();
    return view;
  };
})();
