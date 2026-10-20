// 🏠 Menú detallado: todas las funciones de NFC Tools (según su ficha oficial), explicadas y con su estado en esta app.
(function () {
  'use strict';
  const { h, toast, go, title } = App;

  const rec = (kind) => () => App.addRecord(kind);
  const view = (v) => () => go(v);

  // status: ok = disponible · android = necesita Android + Chrome para escribir/leer · exp = experimental · no = no existe en web
  const SECTIONS = [
    { name: 'Empieza aquí', open: true, items: [
      { icon: '⚡', title: 'Venta rápida', status: 'ok', act: view('venta'),
        desc: 'Pega el enlace de reseña de tu cliente, programa la tarjeta, cobra y registra la venta en un solo lugar.',
        use: 'Estás frente al dueño de una pollería: en 2 minutos la tarjeta ya funciona y la venta queda anotada.' },
      { icon: '📇', title: 'Mis tarjetas (nombre de cada tarjeta)', status: 'ok', act: view('tarjetas'),
        desc: 'Ponle nombre a cada tarjeta física y mira cuáles están en stock, programadas o vendidas, y a qué cliente fue cada una.',
        use: '«Pollería Rey - Caja» · vendida a Pollería Rey por S/ 25.' },
      { icon: '✍️', title: 'Escribir una tarjeta', status: 'android', act: view('escribir'),
        desc: 'Arma los datos de la tarjeta (uno o varios registros), mira si caben en el chip y escríbelos.',
        use: 'Una tarjeta con reseña de Google + WhatsApp + ubicación.' },
    ] },
    { name: 'Leer (como la pestaña "Read" de NFC Tools)', items: [
      { icon: '📡', title: 'Leer una tarjeta', status: 'android', act: view('leer'),
        desc: 'Acerca una tarjeta y mira su contenido: número de serie, registros guardados y tamaño.',
        use: 'Comprobar qué enlace tiene una tarjeta que te devolvió un cliente.' },
      { icon: '🆔', title: 'Reconocer una tarjeta por su nombre', status: 'android', act: view('leer'),
        desc: 'Compara el número de serie del chip con tu inventario y te dice qué tarjeta es y a quién se la vendiste.',
        use: 'Encuentras una tarjeta suelta y sabes que es «Mesa 4» de un cliente.' },
      { icon: '🔬', title: 'Tipo de chip, tecnologías, memoria y estado de bloqueo', status: 'no',
        desc: 'NFC Tools muestra el tipo de chip, sus tecnologías, la memoria y si está bloqueado. Desde una web solo se puede leer el número de serie y el contenido NDEF.',
        alt: 'Míralo con NFC Tools antes de comprar más tarjetas: te dice si son NTAG213, 215 o 216.' },
      { icon: '💾', title: 'Volcar y exportar toda la memoria del chip', status: 'no',
        desc: 'NFC Tools puede exportar la memoria completa de un chip. Una web no tiene acceso a ese nivel.',
        alt: 'Usa NFC Tools.' },
    ] },
    { name: 'Escribir: tipos de registro (como "Write → Añadir un registro")', items: [
      { icon: '⭐', title: 'Reseña de Google', status: 'android', act: rec('review'), actLabel: 'Añadir',
        desc: 'Abre la ventana para dejar una reseña del negocio. Acepta el enlace corto de Google o el Place ID y arma el enlace.',
        use: 'Tarjeta en la caja de una cevichería.' },
      { icon: '🍽️', title: 'Página del restaurante', status: 'android', act: rec('page'), actLabel: 'Añadir',
        desc: 'Abre la página del local con su carta, el botón de reseña, WhatsApp, Instagram y mapa. Puedes cambiar la carta sin reprogramar.',
        use: 'Tarjetas "Mesa 1", "Mesa 2"… cada una abre la carta mostrando su número de mesa.' },
      { icon: '🔗', title: 'Enlace (URL)', status: 'android', act: rec('url'), actLabel: 'Añadir',
        desc: 'Cualquier dirección: una página web, un video, un perfil o una app.',
        use: 'La carta en PDF del restaurante.' },
      { icon: '📝', title: 'Texto', status: 'android', act: rec('text'), actLabel: 'Añadir',
        desc: 'Un mensaje corto que se muestra al tocar la tarjeta.', use: '«Gracias por visitarnos. ¡Vuelve pronto!»' },
      { icon: '📞', title: 'Teléfono', status: 'android', act: rec('tel'), actLabel: 'Añadir',
        desc: 'Prepara una llamada al número. Se agrega +51 si escribes un celular peruano de 9 dígitos.', use: 'Reservas por teléfono.' },
      { icon: '💬', title: 'SMS', status: 'android', act: rec('sms'), actLabel: 'Añadir',
        desc: 'Abre un mensaje de texto ya escrito para un número.', use: 'Pedir delivery por SMS.' },
      { icon: '✉️', title: 'Email', status: 'android', act: rec('mail'), actLabel: 'Añadir',
        desc: 'Abre un correo con destinatario, asunto y mensaje.', use: 'Consultas de eventos o pedidos grandes.' },
      { icon: '🟢', title: 'WhatsApp', status: 'android', act: rec('wa'), actLabel: 'Añadir',
        desc: 'Abre un chat de WhatsApp con un mensaje inicial.', use: '«Hola, quiero hacer una reserva».' },
      { icon: '📸', title: 'Instagram', status: 'android', act: rec('ig'), actLabel: 'Añadir',
        desc: 'Abre el perfil de Instagram del negocio.', use: 'Que el cliente siga al restaurante.' },
      { icon: '📍', title: 'Ubicación o dirección', status: 'android', act: rec('map'), actLabel: 'Añadir',
        desc: 'Abre Google Maps con la dirección o las coordenadas.', use: 'Cómo llegar al local.' },
      { icon: '👤', title: 'Contacto (vCard)', status: 'android', act: rec('vcard'), actLabel: 'Añadir',
        desc: 'Guarda nombre, teléfono, correo y empresa como un contacto del celular. En iPhone puede no abrirse al tocar.', use: 'Tarjeta de presentación del dueño.' },
      { icon: '📶', title: 'Wi-Fi', status: 'exp', act: rec('wifi'), actLabel: 'Añadir',
        desc: 'El cliente toca y se conecta a tu Wi-Fi sin escribir la clave. Está armado como lo hace NFC Tools, pero no lo he podido probar en un celular: pruébalo antes de entregarlo. En iPhone no se conecta solo.',
        use: 'Tarjeta en la mesa con el Wi-Fi del local.' },
      { icon: '🔵', title: 'Bluetooth', status: 'no',
        desc: 'NFC Tools puede escribir una configuración Bluetooth. Aquí no está.', alt: 'Usa NFC Tools.' },
      { icon: '🧩', title: 'MIME (avanzado)', status: 'exp', act: rec('raw'), actLabel: 'Añadir',
        desc: 'Un registro de tipo personalizado (por ejemplo text/plain). Solo para casos técnicos.' },
    ] },
    { name: 'Escribir: opciones que ayudan', items: [
      { icon: '🧮', title: 'Varios registros en una tarjeta', status: 'ok', act: view('escribir'),
        desc: 'Puedes poner reseña + WhatsApp + ubicación en la misma tarjeta, siempre que quepan en el chip.' },
      { icon: '📏', title: 'Tamaño y chip', status: 'ok', act: view('escribir'),
        desc: 'Calcula cuántos bytes ocupa lo que vas a escribir y avisa si no cabe en un NTAG213, 215 o 216.',
        use: 'Antes de gastar una tarjeta con un enlace larguísimo.' },
      { icon: '✅', title: 'Verificar después de escribir', status: 'android', act: view('escribir'),
        desc: 'Vuelve a leer la tarjeta y compara con lo que escribiste. Si algo falló, te avisa antes de cobrar.' },
      { icon: '🔢', title: 'Lote con números (mesas y tarjetas)', status: 'ok', act: view('escribir'),
        desc: 'Si llamas a la tarjeta «Mesa 1», la siguiente se llama «Mesa 2» sola, y el número de mesa del enlace también sube.',
        use: 'Programar las 12 mesas de un restaurante una tras otra.' },
    ] },
    { name: 'Otros (como la pestaña "Other")', items: [
      { icon: '🧹', title: 'Borrar tarjeta', status: 'android', act: view('otros'), desc: 'Deja la tarjeta vacía para reutilizarla.' },
      { icon: '🔒', title: 'Bloquear tarjeta', status: 'android', act: view('otros'),
        desc: 'La deja de solo lectura para que nadie la reescriba. Es irreversible: pruébala bien antes.' },
      { icon: '📑', title: 'Copiar o clonar una tarjeta', status: 'android', act: view('otros'),
        desc: 'Lee una tarjeta y carga sus datos para escribirlos en otra. Copia los registros de texto y enlaces, no la memoria completa.' },
      { icon: '🧼', title: 'Formatear', status: 'no',
        desc: 'NFC Tools tiene un botón para formatear. Aquí no hay uno.',
        alt: 'Si una tarjeta nueva no acepta escritura, fórmala con NFC Tools.' },
      { icon: '🔑', title: 'Proteger con contraseña', status: 'no',
        desc: 'NFC Tools puede ponerle contraseña a una tarjeta. Web NFC no ofrece contraseñas.',
        alt: 'Usa NFC Tools, o bloquea la tarjeta si no necesitas volver a escribirla.' },
      { icon: '⚙️', title: 'Comandos avanzados y otros chips (Mifare Classic, DESFire, ICODE…)', status: 'no',
        desc: 'NFC Tools lista muchos chips y comandos avanzados. Desde una web solo se trabaja con etiquetas NDEF.', alt: 'Usa NFC Tools.' },
      { icon: '🩺', title: 'Diagnóstico del equipo', status: 'ok', act: view('otros'),
        desc: 'Te dice si tu celular y navegador permiten leer y escribir NFC, si la app está instalada y si funciona sin internet.' },
    ] },
    { name: 'Tareas (como "My tasks" y "Tasks")', items: [
      { icon: '📁', title: 'Mis tareas (plantillas)', status: 'ok', act: view('tareas'),
        desc: 'Guarda un tipo de tarjeta que repites seguido y úsalo con un toque.', use: '«Reseña + WhatsApp de la pollería».' },
      { icon: '🕘', title: 'Historial de tarjetas', status: 'ok', act: view('tareas'),
        desc: 'Lista de lo que has programado, con fecha y nombre de la tarjeta.' },
      { icon: '🤖', title: 'Automatizaciones del celular (Tasks)', status: 'no',
        desc: 'NFC Tools puede ejecutar acciones del celular al leer una tarjeta (más de 200, según su ficha). Una web no puede controlar el celular.',
        alt: 'Usa la pestaña Tasks de NFC Tools.' },
    ] },
    { name: 'Negocio', items: [
      { icon: '🍴', title: 'Restaurantes', status: 'ok', act: view('restaurantes'), desc: 'Datos de cada local: nombre, enlace de reseña, WhatsApp, Instagram, color y logo.' },
      { icon: '📖', title: 'Carta digital', status: 'ok', act: view('carta'), desc: 'Platos, precios y fotos. Hay "Pegar carta rápida" para cargar muchos platos de una vez.' },
      { icon: '📱', title: 'Vista previa', status: 'ok', act: view('vista'), desc: 'Así ve el cliente la página del restaurante al tocar la tarjeta.' },
      { icon: '🚀', title: 'Publicar', status: 'ok', act: view('publicar'), desc: 'Descarga el sitio con las cartas para subirlo gratis, y respalda tus datos.' },
    ] },
    { name: 'La app', items: [
      { icon: '❓', title: 'Ayuda', status: 'ok', act: view('ayuda'), desc: 'Pasos para iPhone y Samsung, reglas de Google y límites de la web.' },
    ] },
  ];

  const CHIP = {
    ok: ['ok', 'Disponible'],
    exp: ['warn', 'Experimental'],
    no: ['err', 'No disponible en web'],
  };
  const chipFor = (it) => {
    if (it.status === 'android') return Nfc.supported() ? ['ok', 'Listo en este equipo'] : ['warn', 'Solo Android + Chrome'];
    return CHIP[it.status];
  };

  function row(it) {
    const [cls, label] = chipFor(it);
    return h('div', { class: 'mrow' + (it.status === 'no' ? ' dim' : '') },
      h('div', { class: 'mico', 'aria-hidden': 'true' }, it.icon),
      h('div', { class: 'mbody' },
        h('div', { class: 'mtitle' }, h('b', null, it.title), h('span', { class: 'chip ' + cls }, label)),
        h('div', { class: 'mdesc' }, it.desc),
        it.use ? h('div', { class: 'muse' }, 'Ejemplo: ' + it.use) : null,
        it.alt ? h('div', { class: 'malt' }, 'Alternativa: ' + it.alt) : null),
      it.act ? h('button', { class: 'btn small' + (it.status === 'ok' || it.status === 'android' ? ' primary' : ''), onclick: it.act }, it.actLabel || 'Abrir') : null);
  }

  function installCard() {
    const url = new URL('./', location.href).href;
    const web = /^https?:$/.test(location.protocol);
    let body;
    if (App.isStandalone()) {
      body = h('div', { class: 'note ok' }, '✓ Ya estás usando altoke.pe como app.');
    } else if (App.installEvt) {
      body = h('div', null, h('p', { style: 'margin:0 0 10px' }, 'Quedará como una app más en tu celular, abre sin barra del navegador y funciona sin internet.'),
        h('button', { class: 'btn primary', onclick: async () => { toast((await App.install()) ? 'Instalando…' : 'Instalación cancelada'); } }, '📲 Instalar app'));
    } else if (!web) {
      body = h('div', { class: 'note warn' }, 'Estás abriendo la app desde un archivo. Para instalarla en un celular, ábrela desde su dirección web (GitHub Pages).');
    } else if (Nfc.isIOS()) {
      body = h('ol', { class: 'steps' },
        h('li', null, 'Abre esta página en ', h('b', null, 'Safari'), '.'),
        h('li', null, 'Toca el botón Compartir (el cuadrado con la flecha).'),
        h('li', null, 'Elige ', h('b', null, 'Añadir a pantalla de inicio'), '.'));
    } else {
      body = h('p', { style: 'margin:0' }, 'En Chrome: menú ⋮ → ', h('b', null, 'Instalar app'), ' (o "Añadir a la pantalla de inicio"). Si no aparece, recarga la página y espera unos segundos.');
    }
    const qr = h('canvas', { class: 'qr', 'aria-label': 'Código QR de la app' });
    const hasQr = web && App.drawQr(qr, url);
    return h('div', { class: 'card' }, h('h3', null, '📲 Instalar altoke.pe como app'), body,
      hasQr ? h('details', { style: 'margin-top:12px' }, h('summary', null, 'Pasar la app a otro celular (QR)'),
        h('p', { class: 'sub', style: 'margin:0 0 8px' }, 'Escanea este QR con la cámara del otro celular y sigue los mismos pasos.'), qr,
        h('div', { class: 'btns', style: 'margin-top:8px' }, h('button', { class: 'btn small', onclick: async () => toast((await U.copy(url)) ? 'Enlace copiado ✓' : 'No se pudo copiar') }, '📋 Copiar enlace'))) : null);
  }

  App.views.inicio = function () {
    const q = { text: '' };
    const box = h('div');
    const search = h('input', { type: 'text', placeholder: 'Buscar una función (ej. wifi, bloquear, whatsapp)…', 'aria-label': 'Buscar una función', oninput: (e) => { q.text = e.target.value; renderList(); } });

    // Búsqueda sin tildes ni guiones ("wifi" encuentra "Wi-Fi"); cada palabra debe aparecer
    const plain = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-/g, '').toLowerCase();

    function renderList() {
      const t = q.text.trim();
      const words = plain(t).split(/\s+/).filter(Boolean);
      const parts = [];
      for (const sec of SECTIONS) {
        const items = sec.items.filter((it) => {
          const hay = plain(it.title + ' ' + it.desc + ' ' + (it.use || '') + ' ' + (it.alt || ''));
          return words.every((w) => hay.includes(w));
        });
        if (!items.length) continue;
        parts.push(h('details', { class: 'card msec', open: !!(t || sec.open) },
          h('summary', null, h('b', null, sec.name), h('span', { class: 'cnt' }, items.length)),
          items.map(row)));
      }
      box.replaceChildren(...(parts.length ? parts : [h('p', { class: 'sub' }, 'No encontré ninguna función con ese texto.')]));
    }

    renderList();
    return h('div', null,
      title('Menú', 'Todo lo que hace NFC Tools, explicado, y qué puedes hacer aquí.'),
      installCard(),
      h('div', { class: 'card' }, h('label', { class: 'f', style: 'margin:0' }, 'Buscar', search),
        h('div', { class: 'legend' },
          h('span', { class: 'chip ok' }, 'Disponible / listo'), h('span', { class: 'chip warn' }, 'Experimental o solo Android'), h('span', { class: 'chip err' }, 'No disponible en web'))),
      box,
      h('p', { class: 'sub', style: 'font-size:13px' }, 'La lista de funciones sigue la ficha oficial de NFC Tools: ',
        h('a', { href: 'https://www.wakdev.com/en/apps/nfc-tools.html', target: '_blank', rel: 'noopener' }, 'wakdev.com/en/apps/nfc-tools.html'),
        '. Lo que aquí figura como "no disponible" no existe en una web (Web NFC); para eso sigue haciendo falta la app nativa.'));
  };
})();
