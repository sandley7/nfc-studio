// Pantallas de "Negocio": restaurantes, carta, vista previa, publicar y ayuda.
(function () {
  'use strict';
  const { h, field, bind, toast, touch, go, title, restaurantSelect, needRestaurant } = App;
  const { uid, slugify, safeUrl } = U;

  /* ---------- Carga rápida de carta ---------- */
  function parseBulk(text) {
    const cats = [];
    let c = null;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#')) { c = { id: uid(), name: line.replace(/^#+\s*/, ''), items: [] }; cats.push(c); continue; }
      if (!c) { c = { id: uid(), name: 'Carta', items: [] }; cats.push(c); }
      const p = line.split('|').map((s) => s.trim());
      let [name, desc = '', pr = ''] = p;
      if (p.length === 2 && /^(S\/\s*)?\d+([.,]\d+)?$/.test(p[1])) { pr = p[1]; desc = ''; }
      if (name) c.items.push({ id: uid(), name, desc, price: pr.replace(/^S\/\s*/i, ''), photo: null, available: true, badge: '' });
    }
    return cats;
  }

  function demoRestaurant() {
    const r = App.newRestaurant();
    Object.assign(r, {
      name: 'Restaurante Demo', slug: App.uniqueSlug('demo'), slugLocked: true, tagline: 'Cocina criolla · Lima', emoji: '🍲',
      color: '#b91c1c', hours: 'Lun–Dom 12:00–22:00', address: 'Av. Ejemplo 123, Lima',
      categories: parseBulk(
        '# Entradas\nCeviche clásico | Pescado del día, limón, ají limo, camote | 32\nCausa limeña | Papa amarilla rellena de pollo | 18.50\n' +
        '# Platos de fondo\nLomo saltado | Lomo fino, cebolla, tomate, papas fritas y arroz | 36\nAji de gallina | Pollo deshilachado en crema de ají amarillo | 28\n' +
        '# Bebidas\nChicha morada | Jarra de 1 litro | 14\nInca Kola personal | | 5'),
    });
    return r;
  }

  /* ---------- Restaurantes ---------- */
  App.views.restaurantes = function () {
    const S = App.S;
    const r = App.cur();
    const list = h('div', { class: 'list' },
      S.restaurants.map((x) => h('button', { class: 'item' + (r && x.id === r.id ? ' on' : ''), onclick: () => { S.ui.rid = x.id; touch(); App.render(); } },
        (x.emoji || '🍽️') + ' ' + (x.name || '(sin nombre)'), h('small', null, x.slug ? '/' + x.slug + '/' : 'sin enlace'))),
      h('button', { class: 'btn primary', onclick: () => { const n = App.newRestaurant(); n.slug = App.uniqueSlug('nuevo-restaurante'); S.restaurants.push(n); S.ui.rid = n.id; touch(); App.render(); } }, '+ Nuevo restaurante'));

    let form;
    if (!r) {
      form = h('div', { class: 'card' }, h('p', null, 'Aún no tienes restaurantes. Crea el primero con el botón de la izquierda, o prueba con uno de ejemplo.'),
        h('button', { class: 'btn', onclick: () => { const d = demoRestaurant(); S.restaurants.push(d); S.ui.rid = d.id; touch(); toast('Ejemplo cargado'); App.render(); } }, 'Cargar restaurante de ejemplo'));
    } else {
      const urlHint = h('span', { class: 'hint' });
      const showUrl = () => { urlHint.textContent = 'Enlace: ' + (S.settings.baseUrl || 'https://tusitio.pe') + '/' + (r.slug || '…') + '/'; };
      const slugIn = bind(r, 'slug', { placeholder: 'pizzeria-roma' }, () => { r.slug = slugify(r.slug); r.slugLocked = true; showUrl(); });
      slugIn.addEventListener('blur', () => { r.slug = App.uniqueSlug(slugify(r.slug) || 'restaurante', r.id); slugIn.value = r.slug; touch(); showUrl(); });
      showUrl();
      const nameIn = bind(r, 'name', { placeholder: 'Pizzería Roma' }, (v) => {
        if (!r.slugLocked) { r.slug = App.uniqueSlug(slugify(v), r.id); slugIn.value = r.slug; showUrl(); }
      });
      const logoInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { r.logo = await U.resizeImage(f, 256, 0.8); touch(); App.render(); } catch (err) { toast(err.message); }
      } });
      const placeIn = h('input', { type: 'text', placeholder: 'ChIJ…' });
      const revNote = h('div');
      const checkRev = () => {
        const bad = r.reviewUrl && !safeUrl(r.reviewUrl);
        revNote.className = bad ? 'note err' : '';
        revNote.textContent = bad ? 'El enlace de reseña no parece válido (debe empezar con https://).' : '';
      };
      checkRev();

      form = h('div', null,
        h('div', { class: 'card' }, h('h3', null, 'Datos del local'),
          h('div', { class: 'grid2' }, field('Nombre', nameIn), h('label', { class: 'f' }, 'Nombre en el enlace', slugIn, urlHint)),
          h('div', { class: 'grid2' },
            field('Eslogan / tipo de cocina', bind(r, 'tagline', { placeholder: 'Cocina criolla · Miraflores' })),
            field('Horario', bind(r, 'hours', { placeholder: 'Lun–Dom 12:00–22:00' }))),
          h('div', { class: 'grid3' },
            field('Color de la marca', h('input', { type: 'color', value: r.color, oninput: (e) => { r.color = e.target.value; touch(); } })),
            field('Emoji (si no hay logo)', bind(r, 'emoji', { maxlength: 4 })),
            h('div', null, h('div', { style: 'font-size:13px;font-weight:600;margin-bottom:5px' }, 'Logo'),
              h('div', { class: 'btns' },
                h('button', { class: 'btn small', onclick: () => logoInput.click() }, r.logo ? 'Cambiar' : 'Subir logo'),
                r.logo ? h('button', { class: 'btn small danger', onclick: () => { r.logo = null; touch(); App.render(); } }, 'Quitar') : null,
                logoInput)))),
        h('div', { class: 'card' }, h('h3', null, 'Contacto y reseñas'),
          field('Enlace de reseña de Google', bind(r, 'reviewUrl', { type: 'url', placeholder: 'https://g.page/r/…/review' }, checkRev),
            'En Google Business Profile → "Pedir reseñas" → copiar enlace. O usa el Place ID aquí abajo.'),
          revNote,
          h('div', { class: 'row' },
            field('Place ID (alternativa)', placeIn),
            h('div', { class: 'shrink', style: 'padding-bottom:12px' },
              h('button', { class: 'btn', onclick: () => {
                const id = placeIn.value.trim();
                if (!/^[A-Za-z0-9_-]{15,}$/.test(id)) return toast('Place ID no válido');
                r.reviewUrl = 'https://search.google.com/local/writereview?placeid=' + id; touch(); App.render(); toast('Enlace creado');
              } }, 'Crear enlace'))),
          h('div', { class: 'grid2' },
            field('WhatsApp', bind(r, 'whatsapp', { type: 'tel', placeholder: '987654321' }), 'Solo el número; se agrega +51 automáticamente.'),
            field('Mensaje inicial de WhatsApp', bind(r, 'waMessage'))),
          h('div', { class: 'grid2' },
            field('Instagram', bind(r, 'instagram', { placeholder: '@pizzeriaroma' })),
            field('Dirección', bind(r, 'address', { placeholder: 'Av. Larco 123, Miraflores' }))),
          field('Enlace de Google Maps (opcional)', bind(r, 'mapsUrl', { type: 'url', placeholder: 'https://maps.app.goo.gl/…' }), 'Si lo dejas vacío, se usa la dirección.')),
        h('div', { class: 'card' },
          h('button', { class: 'btn danger', onclick: () => {
            if (!confirm('¿Eliminar "' + r.name + '" y toda su carta? No se puede deshacer.')) return;
            S.restaurants = S.restaurants.filter((x) => x.id !== r.id); S.ui.rid = null; touch(); App.render();
          } }, 'Eliminar este restaurante')));
    }
    return h('div', null, title('Restaurantes', 'Cada restaurante tiene su propia página y su propio enlace.'), h('div', { class: 'split' }, list, form));
  };

  /* ---------- Carta ---------- */
  App.views.carta = function () {
    const r = App.cur();
    if (!r) return needRestaurant('Carta', 'Platos, precios y fotos.');
    const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; touch(); App.render(); };

    const cats = r.categories.map((c, ci) =>
      h('div', { class: 'catbox' },
        h('div', { class: 'cathead' }, bind(c, 'name', { placeholder: 'Categoría (Entradas, Fondos…)', 'aria-label': 'Nombre de la categoría' }),
          h('button', { class: 'btn small', title: 'Subir', 'aria-label': 'Subir categoría', onclick: () => move(r.categories, ci, -1) }, '↑'),
          h('button', { class: 'btn small', title: 'Bajar', 'aria-label': 'Bajar categoría', onclick: () => move(r.categories, ci, 1) }, '↓'),
          h('button', { class: 'btn small danger', title: 'Eliminar categoría', 'aria-label': 'Eliminar categoría', onclick: () => {
            if (c.items.length && !confirm('¿Eliminar la categoría con ' + c.items.length + ' platos?')) return;
            r.categories.splice(ci, 1); touch(); App.render();
          } }, '🗑')),
        c.items.map((it, ii) => {
          const photoIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
            const f = e.target.files[0]; if (!f) return;
            try { it.photo = await U.resizeImage(f, 640, 0.72); touch(); App.render(); } catch (err) { toast(err.message); }
          } });
          return h('div', { class: 'dish' },
            bind(it, 'name', { placeholder: 'Nombre del plato', 'aria-label': 'Nombre del plato' }),
            bind(it, 'price', { placeholder: 'S/ 0.00', inputmode: 'decimal', 'aria-label': 'Precio en soles' }),
            h('div', { class: 'full' }, h('textarea', { placeholder: 'Descripción (opcional)', 'aria-label': 'Descripción', rows: 2,
              value: it.desc, oninput: (e) => { it.desc = e.target.value; touch(); } })),
            h('div', { class: 'full tools' },
              it.photo ? h('img', { class: 'thumb', src: it.photo, alt: 'Foto del plato' }) : null,
              h('button', { class: 'btn small', onclick: () => photoIn.click() }, it.photo ? 'Cambiar foto' : '📷 Foto'),
              it.photo ? h('button', { class: 'btn small', onclick: () => { it.photo = null; touch(); App.render(); } }, 'Quitar') : null,
              photoIn,
              h('label', { style: 'display:flex;gap:6px;align-items:center' },
                h('input', { type: 'checkbox', checked: it.available !== false, onchange: (e) => { it.available = e.target.checked; touch(); } }), 'Disponible'),
              bind(it, 'badge', { class: 'badge-in', placeholder: 'Etiqueta (Nuevo)', maxlength: 14, 'aria-label': 'Etiqueta' }),
              h('span', { style: 'flex:1' }),
              h('button', { class: 'btn small', 'aria-label': 'Subir plato', onclick: () => move(c.items, ii, -1) }, '↑'),
              h('button', { class: 'btn small', 'aria-label': 'Bajar plato', onclick: () => move(c.items, ii, 1) }, '↓'),
              h('button', { class: 'btn small danger', 'aria-label': 'Eliminar plato', onclick: () => { c.items.splice(ii, 1); touch(); App.render(); } }, '🗑')));
        }),
        h('button', { class: 'btn small', onclick: () => { c.items.push({ id: uid(), name: '', desc: '', price: '', photo: null, available: true, badge: '' }); touch(); App.render(); } }, '+ Añadir plato')));

    const bulk = h('textarea', { rows: 8, placeholder: '# Entradas\nCeviche clásico | Pescado del día, limón y ají | 32\nCausa limeña | | 18.50\n# Fondos\nLomo saltado | Con papas y arroz | 36' });
    return h('div', null, title('Carta', 'Edita platos y precios. Los cambios se publican al subir el sitio de nuevo; las tarjetas no se tocan.'),
      h('div', { class: 'card' }, restaurantSelect()),
      cats,
      h('div', { class: 'btns', style: 'margin-bottom:16px' },
        h('button', { class: 'btn primary', onclick: () => { r.categories.push({ id: uid(), name: '', items: [] }); touch(); App.render(); } }, '+ Añadir categoría')),
      h('div', { class: 'card' },
        h('details', null, h('summary', null, '⚡ Pegar carta rápida (ahorra mucho tiempo)'),
          h('p', { class: 'sub', style: 'margin-bottom:8px' }, 'Una línea por plato: nombre | descripción | precio. Las líneas que empiezan con # son categorías.'),
          bulk,
          h('div', { class: 'btns', style: 'margin-top:10px' },
            h('button', { class: 'btn primary', onclick: () => {
              const add = parseBulk(bulk.value);
              if (!add.length) return toast('No encontré platos para importar');
              r.categories.push(...add); touch(); App.render(); toast(add.reduce((n, c) => n + c.items.length, 0) + ' platos importados');
            } }, 'Importar a esta carta')))));
  };

  /* ---------- Vista previa ---------- */
  App.views.vista = function () {
    const r = App.cur();
    if (!r) return needRestaurant('Vista previa', 'Así la verá el cliente al acercar el celular.');
    const frame = h('iframe', { title: 'Vista previa de la página del restaurante', sandbox: 'allow-scripts allow-popups' });
    const refresh = () => { frame.srcdoc = Site.buildPage(r, App.S.settings); };
    refresh();
    let t; App.onChange = () => { clearTimeout(t); t = setTimeout(refresh, 250); };
    return h('div', null, title('Vista previa', 'Así la verá el cliente al acercar el celular a la tarjeta.'),
      h('div', { class: 'card' }, restaurantSelect(),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', onclick: () => window.open(URL.createObjectURL(new Blob([Site.buildPage(r, App.S.settings)], { type: 'text/html' })), '_blank') }, 'Abrir en pestaña nueva'),
          h('button', { class: 'btn', onclick: () => go('carta') }, 'Editar carta'))),
      h('div', { class: 'phone' }, frame));
  };

  /* ---------- Publicar ---------- */
  App.views.publicar = function () {
    const S = App.S;
    const st = S.settings;
    const base = h('input', { type: 'url', value: st.baseUrl, placeholder: 'https://mis-cartas.netlify.app',
      oninput: (e) => { st.baseUrl = e.target.value.trim().replace(/\/+$/, ''); touch(); },
      onblur: (e) => { let v = e.target.value.trim().replace(/\/+$/, ''); if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v; st.baseUrl = v; e.target.value = v; touch(); } });
    const restore = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!d || !Array.isArray(d.restaurants)) throw new Error('Archivo de respaldo no válido');
        if (!confirm('Esto reemplaza todos los datos actuales por los del respaldo. ¿Continuar?')) return;
        App.setState(d); touch(); toast('Respaldo restaurado'); App.render();
      } catch (err) { toast(err.message); }
    } });

    const zipBtn = h('button', { class: 'btn primary', onclick: () => {
      if (!S.restaurants.length) return toast('Crea al menos un restaurante');
      const bad = S.restaurants.find((r) => !r.slug);
      if (bad) return toast('"' + bad.name + '" no tiene nombre en el enlace');
      const enc = new TextEncoder();
      const files = [{ name: 'index.html', data: enc.encode(Site.rootPage()) }]
        .concat(S.restaurants.map((r) => ({ name: r.slug + '/index.html', data: enc.encode(Site.buildPage(r, S.settings)) })));
      U.download('cartas-digitales.zip', Zip.makeZip(files));
      toast('ZIP listo: ' + S.restaurants.length + ' restaurante(s)');
    } }, '⬇️ Descargar sitio (ZIP)');

    return h('div', null, title('Publicar', 'Sube una carpeta y listo: cada restaurante queda en su propio enlace.'),
      h('div', { class: 'card' }, h('h3', null, '1. Enlace de tu sitio de cartas'),
        field('Dirección base', base, 'La que te dé Netlify / Cloudflare Pages / GitHub Pages, o tu dominio propio. Es lo que se escribe en las tarjetas "Página del restaurante".')),
      h('div', { class: 'card' }, h('h3', null, '2. Tu marca en cada carta (opcional)'),
        h('div', { class: 'grid2' },
          field('Tu nombre o marca', bind(st, 'sellerName', { placeholder: 'altoke.pe' })),
          field('Tu WhatsApp', bind(st, 'sellerWa', { type: 'tel', placeholder: '987654321' }))),
        h('label', { style: 'display:flex;gap:8px;align-items:center' },
          h('input', { type: 'checkbox', checked: st.showCredit, onchange: (e) => { st.showCredit = e.target.checked; touch(); } }),
          'Mostrar "Carta digital por …" al pie (sirve para conseguir nuevos clientes)')),
      h('div', { class: 'card' }, h('h3', null, '3. Descarga y sube'), zipBtn,
        h('ol', { class: 'steps' },
          h('li', null, 'Descomprime el ZIP en una carpeta.'),
          h('li', null, 'Entra a ', h('code', null, 'app.netlify.com/drop'), ' (cuenta gratuita) y arrastra la carpeta. Netlify te da un enlace https://…netlify.app.'),
          h('li', null, 'Pega ese enlace arriba, en "Dirección base".'),
          h('li', null, 'Para actualizar una carta: edítala aquí, descarga el ZIP y súbelo otra vez al mismo sitio. No hay que reprogramar las tarjetas.'))),
      S.restaurants.length ? h('div', { class: 'card' }, h('h3', null, 'Enlaces de tus restaurantes'),
        S.restaurants.map((r) => {
          const u = st.baseUrl && r.slug ? st.baseUrl + '/' + r.slug + '/' : '';
          return h('div', { class: 'step' }, h('span', { class: 'grow' }, h('b', null, r.name), h('br'), h('span', { style: 'color:var(--muted);font-size:13px' }, u || 'Falta configurar la dirección base')),
            h('button', { class: 'btn small', disabled: !u, onclick: async () => toast((await U.copy(u)) ? 'Copiado ✓' : 'No se pudo copiar') }, 'Copiar'));
        })) : null,
      h('div', { class: 'card' }, h('h3', null, '📲 Instalar altoke.pe en tu celular'),
        h('p', { class: 'sub', style: 'margin-bottom:8px' }, 'No está en la App Store ni en Play Store: se instala desde el navegador y queda como un ícono en tu pantalla de inicio. La pestaña Menú tiene el botón de instalar y un QR para pasarla a otro celular.'),
        h('ol', { class: 'steps' },
          h('li', null, 'iPhone: abre la dirección de la app en Safari → Compartir → ', h('b', null, 'Añadir a pantalla de inicio'), '.'),
          h('li', null, 'Android (Samsung, etc.): ábrela en Chrome → menú ⋮ → ', h('b', null, 'Instalar app'), '.'),
          h('li', null, 'Usa siempre el ícono instalado. Esa app guarda sus datos aparte del navegador, así que si la ves vacía, restaura tu respaldo (abajo).'))),
      h('div', { class: 'card' }, h('h3', null, 'Respaldo de tus datos'),
        h('p', { class: 'sub', style: 'margin-bottom:10px' }, 'Tus datos viven en este navegador. Descarga un respaldo de vez en cuando; también sirve para pasar tu trabajo de la PC al celular.'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', onclick: () => U.download('nfc-studio-respaldo-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([JSON.stringify(S)], { type: 'application/json' })) }, '⬇️ Descargar respaldo'),
          h('button', { class: 'btn', onclick: () => restore.click() }, '⬆️ Restaurar respaldo'), restore)));
  };

  /* ---------- Ayuda ---------- */
  App.views.ayuda = function () {
    return h('div', null, title('Ayuda', 'Qué hace cada pestaña y qué se puede (y qué no) según tu equipo.'),
      h('div', { class: 'card' }, h('h3', null, '🧭 Las pestañas'),
        h('ul', { class: 'steps' },
          h('li', null, h('b', null, '⚡ Venta rápida: '), 'pega el enlace de reseña del cliente, programa la tarjeta y registra el cobro.'),
          h('li', null, h('b', null, '📡 Leer: '), 'lee una tarjeta y muestra su contenido (solo Android con Chrome).'),
          h('li', null, h('b', null, '✍️ Escribir: '), 'arma una lista de registros (reseña, WhatsApp, página del restaurante, texto, contacto…), calcula si caben en el chip y los escribe.'),
          h('li', null, h('b', null, '🧰 Otros: '), 'borrar, bloquear, copiar una tarjeta y diagnóstico del equipo.'),
          h('li', null, h('b', null, '📁 Mis tareas: '), 'plantillas guardadas e historial de tarjetas escritas.'))),
      h('div', { class: 'card' }, h('h3', null, '📱 iPhone'),
        h('p', null, 'Safari no puede leer ni escribir NFC desde una página web. En iPhone la app sirve para preparar cada registro, copiarlo, llevar tus ventas y publicar cartas. El último paso se hace con NFC Tools (gratis):'),
        h('ol', { class: 'steps' },
          h('li', null, 'En ', h('b', null, 'Venta rápida'), ' o ', h('b', null, 'Escribir'), ' toca el botón de copiar.'),
          h('li', null, 'Abre NFC Tools → ', h('b', null, 'Escribir'), ' → ', h('b', null, 'Añadir un registro'), ' → ', h('b', null, 'URL/URI'), ' → pega → Aceptar.'),
          h('li', null, 'Toca ', h('b', null, 'Escribir'), ' y acerca la tarjeta a la parte superior del iPhone.'),
          h('li', null, 'Prueba la tarjeta con el iPhone (XS o posterior lee sin abrir ninguna app) y vuelve a marcarla como programada.'))),
      h('div', { class: 'card' }, h('h3', null, '🤖 Samsung / Android con NFC'),
        h('p', null, 'Con un Samsung la app lee, escribe, verifica, borra y bloquea directo, sin NFC Tools. Se prepara una sola vez:'),
        h('ol', { class: 'steps' },
          h('li', null, 'Activa el NFC: Ajustes → Conexiones → NFC y pagos sin contacto (el nombre puede variar según el modelo).'),
          h('li', null, 'Abre la dirección de la app en ', h('b', null, 'Chrome'), '. La escritura NFC exige https, y la dirección de GitHub Pages ya lo cumple.'),
          h('li', null, 'En Chrome: menú ⋮ → Instalar app (o Añadir a la pantalla de inicio).'),
          h('li', null, 'Abre la app → Otros → Diagnóstico y comprueba que "Web NFC" salga con ✓.'),
          h('li', null, 'La primera vez que escribas, Chrome pide permiso de NFC: acéptalo.')),
        h('p', null, 'Para escribir: deja la pantalla encendida y acerca la tarjeta a la parte de atrás del celular, hacia el centro o la parte alta. Si no la detecta, muévela despacio: la antena cambia según el modelo.')),
      h('div', { class: 'card' }, h('h3', null, '🔌 ¿Y el cable USB del iPhone?'),
        h('p', null, 'Un cable iPhone–PC solo transfiere datos: la PC no puede usar la antena NFC del teléfono. Para escribir desde la PC haría falta un lector NFC USB aparte (tipo ACR122U).')),
      h('div', { class: 'card' }, h('h3', null, '🔒 Bloquear tarjetas'),
        h('p', null, 'Una tarjeta sin bloquear puede ser reescrita por cualquiera con NFC Tools. Bloquear es irreversible: prueba la tarjeta con el celular de otra persona antes.')),
      h('div', { class: 'card' }, h('h3', null, '⭐ Reseñas de Google: reglas'),
        h('p', null, 'Google no permite ofrecer descuentos o premios a cambio de reseñas, ni pedirlas solo a clientes satisfechos. Pide la reseña a todos por igual. Antes de entregar una tarjeta, usa "Probar enlace" y comprueba que abre la ventana de reseña del negocio correcto.')));
  };
})();
