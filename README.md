# Organizador de pedidos · 3D Backdraft

Primera versión simple y mobile-first para cargar pedidos desde el celular y moverlos por estados.

## Estados incluidos

- Para hacer
- Hecho / Para entregar
- Espera de pago
- Deudor
- Entregado

## Campos del pedido

- Pedido, obligatorio
- Cliente, opcional
- Precio, opcional
- Seña, opcional
- Fecha compromiso, opcional
- Estado
- Nota

## Archivos

- `index.html`: estructura de la app.
- `styles.css`: estilo visual tipo 3D Backdraft.
- `app.js`: lógica de pedidos.
- `apps-script.gs`: conector con Google Sheets.

## Cómo conectarlo a tu Google Sheet

1. Abrí tu planilla de Google Sheets.
2. Entrá en **Extensiones > Apps Script**.
3. Pegá el contenido de `apps-script.gs`.
4. Ejecutá una vez la función `setup` para crear la hoja `BASE PEDIDOS`.
5. Andá a **Implementar > Nueva implementación**.
6. Elegí **Aplicación web**.
7. Configurá:
   - Ejecutar como: tu usuario.
   - Quién tiene acceso: cualquier usuario con el enlace.
8. Copiá la URL que termina en `/exec`.
9. Pegala en `app.js` en esta línea:

```js
const API_URL = "https://script.google.com/macros/s/AKfycbxo2sr9yn75hlKcfXbPQtLargXs_DsoXwdCkihJuNt8Crw-hcKYx0uV2skem-lvrzJ7zg/exec";
```

## Modo prueba

Si `API_URL` queda vacío, la app funciona igual, pero guarda los pedidos solo en el navegador con `localStorage`.

## Publicarlo en GitHub Pages

1. Creá un repositorio nuevo.
2. Subí estos archivos.
3. Entrá en **Settings > Pages**.
4. En Source elegí `Deploy from a branch`.
5. Branch: `main` y carpeta `/root`.
6. Guardá y esperá que GitHub te dé el enlace.
