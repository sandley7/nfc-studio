<p align="center"><img src="logo.svg" alt="altoke.pe" width="320"></p>

# altoke.pe · Tarjetas NFC al toque

App web instalable (PWA) para **leer, escribir y vender tarjetas NFC** de reseñas de Google, con carta digital para restaurantes. Sigue el esquema de [NFC Tools](https://www.wakdev.com/en/apps/nfc-tools.html) (Leer, Escribir, Otros, Mis tareas), con cada función explicada en español y con inventario con nombre para cada tarjeta.

**Abrir la app:** https://sandley7.github.io/nfc-studio/

Es gratis: no hay servidor ni cuentas. Todo se guarda en el propio celular o navegador.

## Instalarla como app

| Equipo | Pasos |
|---|---|
| **Android (Samsung, etc.)** | Abre el enlace en Chrome → menú ⋮ → **Instalar app**. También hay un botón "Instalar app" dentro del Menú. |
| **iPhone** | Abre el enlace en Safari → Compartir → **Añadir a pantalla de inicio**. |

Después de la primera carga funciona sin internet. En el Menú hay un QR para pasar la app a otro celular.

## Qué incluye

- **⭐ Reseñas (lo principal):** módulo aparte para configurar cada tarjeta paso a paso: nombre de la tarjeta → negocio y enlace de Google Maps → escribir → probar como cliente → entregar y cobrar. El cliente toca la tarjeta, se abre el negocio en Google Maps y califica con las 5 estrellas. Incluye la lista de tus tarjetas de reseñas con su estado, QR de respaldo y un mensaje de WhatsApp para pedirle el enlace al dueño.
- **🏠 Menú:** todas las funciones de NFC Tools explicadas, con ejemplos y con su estado en esta app (disponible, experimental o no disponible en web). Con buscador.
- **⚡ Venta rápida:** pega el enlace de Google Maps, de reseña o el Place ID del cliente, programa la tarjeta, cobra (Yape, Plin, efectivo) y registra la venta. Stock, ventas del día y CSV.
- **📇 Mis tarjetas:** nombre de cada tarjeta física (lotes, "Mesa 1…12"), estado en stock / programada / vendida, cliente y notas.
- **📡 Leer:** número de serie, registros y tamaño; reconoce tus tarjetas por su número de serie.
- **✍️ Escribir:** varios registros por tarjeta (reseña de Google, página del restaurante, URL, texto, teléfono, SMS, email, WhatsApp, Instagram, ubicación, contacto, Wi-Fi, MIME). Calcula el tamaño exacto frente a NTAG213/215/216, verifica después de escribir y suma el número en cada tarjeta.
- **🧰 Otros:** borrar, bloquear, copiar tarjeta y diagnóstico del equipo.
- **📁 Mis tareas:** plantillas e historial.
- **Menús digitales (para después):** restaurantes, carta digital, vista previa y un ZIP con las páginas de cada local para publicar gratis. Queda guardado y funcionando para cuando el negocio crezca.

## Qué puede y qué no puede (importante)

La lectura y escritura NFC desde una web usa [Web NFC](https://developer.chrome.com/docs/capabilities/nfc), que **solo existe en Chrome para Android** y necesita https.

| Equipo | Leer / escribir NFC | Resto de la app |
|---|---|---|
| Android con NFC + Chrome | Sí | Sí |
| iPhone / Safari | No: copia el enlace y pégalo en NFC Tools | Sí |
| PC | No | Sí |

No existen en una web (y por eso aparecen como "no disponible"): contraseña de tarjeta, formatear, datos técnicos del chip, volcado de memoria, otros chips (Mifare, DESFire…) y las automatizaciones del celular. Para eso hace falta NFC Tools.

**Estado de las pruebas:** la app se probó en el navegador con un lector NFC simulado; no se ha probado con tarjetas reales. El registro Wi-Fi está marcado como experimental.

## Desarrollo

Sin compilación ni dependencias: HTML, CSS y JavaScript simples. Para probar en local, sirve esta carpeta con cualquier servidor estático, por ejemplo:

```bash
python -m http.server 5173
```

| Archivo | Para qué sirve |
|---|---|
| `js/nfc.js` | Tipos de registro, tamaño NDEF, leer / escribir / verificar con Web NFC |
| `js/core.js` | Estado, navegación, inventario de tarjetas, instalación |
| `js/views-menu.js` | Menú detallado |
| `js/views-tarjetas.js` | Venta rápida, Leer, Escribir, Otros, Mis tareas |
| `js/views-resenas.js` | ⭐ Reseñas: configurador paso a paso de tarjetas de reseñas |
| `js/views-cards.js` | Mis tarjetas (inventario) |
| `js/views-negocio.js` | Restaurantes, Carta, Vista previa, Publicar, Ayuda |
| `js/site.js`, `js/zip.js` | Página pública de cada restaurante y ZIP del sitio |
| `js/store.js`, `js/util.js`, `js/main.js` | Guardado local (IndexedDB), utilidades, arranque |
| `sw.js`, `manifest.webmanifest` | Instalación y uso sin internet |
| `logo.svg`, `icon.svg`, `icon-*.png` | Logo de altoke.pe: un rayo ("al toque") con ondas NFC |

Los datos (restaurantes, ventas, tarjetas) viven solo en el dispositivo; usa "Descargar respaldo" en Negocio → Publicar para guardarlos y pasarlos de un equipo a otro.

El generador de QR (`qrcode-generator`) se carga desde cdnjs.
