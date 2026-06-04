# Organizador de pedidos · 3D Backdraft

Frontend simple para cargar y gestionar pedidos conectado a Google Sheets por Apps Script.

## URL de Apps Script cargada

```txt
https://script.google.com/macros/s/AKfycbytucDlKJBH5x0BvMfLrZB5RcAUgDvdGSlLwetRBmqRorEQ8Dbur2zdJCMmR8VE4uWQRw/exec
```

## Flujo

- Para hacer
- Para entregar
- Para cobrar
- Deudor
- Finalizado

Los pedidos con estado **Finalizado** no se muestran en la app, pero quedan guardados en la hoja `BASE PEDIDOS`.

## Instalación

1. Subir estos archivos al repo de GitHub.
2. Activar GitHub Pages desde `Settings > Pages`.
3. En Google Apps Script, usar el archivo `apps-script.gs` como referencia.
4. La pestaña de Google Sheets debe llamarse exactamente `BASE PEDIDOS`.
5. Si se cambia el Apps Script, crear una nueva versión de implementación.

## Archivos

- `index.html`: estructura de la app.
- `styles.css`: estética responsive 3D Backdraft.
- `app.js`: lógica y conexión con Google Sheets.
- `apps-script.gs`: backend para pegar en Apps Script.
