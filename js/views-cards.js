// 📇 Mis tarjetas: inventario con el nombre de cada tarjeta física.
(function () {
  'use strict';
  const { h, field, toast, touch, title } = App;

  const LABEL = { stock: 'En stock', programada: 'Programada', vendida: 'Vendida' };
  const fmt = (t) => (t ? new Date(t).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
  const ui = { filter: 'all', q: '' };
  const lot = { prefix: 'Tarjeta ', qty: 30, single: '' };

  App.views.tarjetas = function () {
    const S = App.S;
    const statsEl = h('div', { class: 'grid3 stats' });
    const list = h('div');
    const stat = (n, l) => h('div', { class: 'card stat' }, h('b', null, n), h('span', null, l));

    function renderStats() {
      const n = (s) => S.cards.filter((c) => c.status === s).length;
      statsEl.replaceChildren(stat(n('stock'), 'En stock'), stat(n('programada'), 'Programadas'), stat(n('vendida'), 'Vendidas'));
    }

    function row(c) {
      const nameIn = h('input', { type: 'text', value: c.name, 'aria-label': 'Nombre de la tarjeta', autocapitalize: 'off', onchange: (e) => {
        let v = e.target.value.trim();
        if (!v) { e.target.value = c.name; return toast('El nombre no puede estar vacío'); }
        if (S.cards.find((x) => x !== c && x.name.trim().toLowerCase() === v.toLowerCase())) { v += ' (2)'; toast('Ese nombre ya existía; quedó como "' + v + '"'); e.target.value = v; }
        c.name = v; touch();
      } });
      const sel = h('select', { value: c.status, 'aria-label': 'Estado', onchange: (e) => {
        c.status = e.target.value;
        if (c.status === 'vendida' && !c.soldAt) c.soldAt = Date.now();
        if (c.status === 'programada' && !c.programmedAt) c.programmedAt = Date.now();
        touch(); renderList();
      } }, Object.entries(LABEL).map(([v, l]) => h('option', { value: v }, l)));
      const info = [
        c.client && '👤 ' + c.client,
        c.price != null && c.price !== '' && 'S/ ' + Number(c.price).toFixed(2),
        c.serial && '🆔 ' + c.serial,
        c.programmedAt && '✍️ ' + fmt(c.programmedAt),
        c.soldAt && '💰 ' + fmt(c.soldAt),
      ].filter(Boolean).join(' · ');
      return h('div', { class: 'crow' },
        h('div', { class: 'grid2' }, nameIn, sel),
        c.content ? h('div', { class: 'mono cc' }, c.content) : null,
        info ? h('div', { class: 'cinfo' }, info) : null,
        h('input', { type: 'text', value: c.notes || '', placeholder: 'Notas (ej. mesa del fondo, lado izquierdo)', 'aria-label': 'Notas', oninput: (e) => { c.notes = e.target.value; touch(); } }),
        h('div', { class: 'btns', style: 'margin-top:8px' },
          h('button', { class: 'btn small', onclick: () => App.prepWrite(c.name) }, '✍️ Programar'),
          h('button', { class: 'btn small', onclick: () => App.prepSale(c.name, c.content) }, '💰 Vender'),
          h('button', { class: 'btn small danger', 'aria-label': 'Eliminar tarjeta', onclick: () => {
            if (!confirm('¿Eliminar "' + c.name + '" del inventario?')) return;
            S.cards = S.cards.filter((x) => x !== c); touch(); renderList();
          } }, '🗑')));
    }

    function renderList() {
      const q = ui.q.trim().toLowerCase();
      const items = S.cards.filter((c) =>
        (ui.filter === 'all' || c.status === ui.filter) &&
        (!q || [c.name, c.client, c.notes, c.content, c.serial].join(' ').toLowerCase().includes(q)));
      list.replaceChildren(...(items.length ? items.map(row)
        : [h('p', { class: 'sub' }, S.cards.length ? 'Ninguna tarjeta coincide con el filtro.' : 'Aún no tienes tarjetas en el inventario. Crea tu lote aquí abajo.')]));
      renderStats();
    }

    const filterSel = h('select', { value: ui.filter, onchange: (e) => { ui.filter = e.target.value; renderList(); } },
      [['all', 'Todas'], ['stock', 'En stock'], ['programada', 'Programadas'], ['vendida', 'Vendidas']].map(([v, l]) => h('option', { value: v }, l)));
    const search = h('input', { type: 'text', value: ui.q, placeholder: 'Buscar por nombre, cliente o notas', oninput: (e) => { ui.q = e.target.value; renderList(); } });

    const exportCsv = () => {
      const rows = [['nombre', 'estado', 'serie', 'contenido', 'cliente', 'precio', 'programada', 'vendida', 'notas']]
        .concat(S.cards.map((c) => [c.name, LABEL[c.status], c.serial, c.content, c.client, c.price == null ? '' : c.price,
          c.programmedAt ? new Date(c.programmedAt).toISOString() : '', c.soldAt ? new Date(c.soldAt).toISOString() : '', c.notes]));
      const csv = '﻿' + rows.map((r) => r.map((x) => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      U.download('mis-tarjetas.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    };

    const view = h('div', null,
      title('Mis tarjetas', 'Ponle nombre a cada tarjeta y sigue su estado: en stock, programada o vendida.'),
      statsEl,
      h('div', { class: 'card' },
        h('div', { class: 'row' }, field('Estado', filterSel), field('Buscar', search)),
        list,
        h('div', { class: 'btns', style: 'margin-top:12px' },
          h('button', { class: 'btn small', disabled: !S.cards.length, onclick: exportCsv }, '⬇️ Descargar inventario (CSV)'))),
      h('div', { class: 'card' }, h('h3', null, 'Crear mi lote'),
        h('p', { class: 'sub', style: 'margin-bottom:10px' }, 'Crea de golpe los nombres de todas las tarjetas que compraste ("Tarjeta 001", "Tarjeta 002"…). Si tienes negras y blancas, haz un lote de cada color: "Negra " y "Blanca ".'),
        h('div', { class: 'grid2' },
          field('Prefijo del nombre', h('input', { type: 'text', value: lot.prefix, autocapitalize: 'off', oninput: (e) => { lot.prefix = e.target.value; } })),
          field('Cantidad', h('input', { type: 'number', min: 1, max: 500, value: lot.qty, oninput: (e) => { lot.qty = e.target.value; } }))),
        h('button', { class: 'btn primary', onclick: () => {
          const qty = Math.min(500, Math.max(1, parseInt(lot.qty, 10) || 0));
          if (!qty) return toast('Pon una cantidad');
          const prefix = lot.prefix === '' ? 'Tarjeta ' : lot.prefix;
          for (let i = 0; i < qty; i++) App.cards.upsert(App.cards.nextName(prefix), {});
          touch(); renderList(); toast(qty + ' tarjetas creadas ✓');
        } }, 'Crear lote')),
      h('div', { class: 'card' }, h('h3', null, 'Añadir una tarjeta con nombre propio'),
        h('div', { class: 'row' }, field('Nombre', h('input', { type: 'text', value: lot.single, placeholder: 'Ej. Pollería Rey - Caja', oninput: (e) => { lot.single = e.target.value; } })),
          h('div', { class: 'shrink', style: 'padding-bottom:12px' }, h('button', { class: 'btn', onclick: () => {
            const n = lot.single.trim();
            if (!n) return toast('Escribe un nombre');
            if (App.cards.byName(n)) return toast('Ya existe una tarjeta con ese nombre');
            App.cards.upsert(n, {}); lot.single = ''; touch(); App.render(); toast('Tarjeta añadida ✓');
          } }, 'Añadir')))),
      h('div', { class: 'card' }, h('h3', null, 'Cómo se usa'),
        h('ul', { class: 'steps' },
          h('li', null, h('b', null, 'Programar: '), 'toca "Programar" en una tarjeta y se abre Escribir con ese nombre. Al terminar pasa a "Programada".'),
          h('li', null, h('b', null, 'Vender: '), 'en Venta rápida, al registrar la venta, la tarjeta pasa a "Vendida" con el nombre del cliente y el precio.'),
          h('li', null, h('b', null, 'Reconocerla: '), 'en Android, al escribir con verificación la app guarda el número de serie del chip. Después, en Leer, te dice qué tarjeta es.'),
          h('li', null, h('b', null, 'Tarjeta sin nombre: '), 'léela en Leer y toca "Guardar nombre".'))));
    renderList();
    return view;
  };
})();
