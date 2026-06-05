# Organizador de pedidos · 3D Backdraft

App simple para manejar pedidos desde celular o computadora, conectada a Google Sheets con Apps Script.

## Flujo activo

- Para hacer
- Para entregar
- Para cobrar
- Deudor
- Finalizado

Los pedidos en estado **Finalizado** no se muestran en la app, pero quedan guardados como registro en la hoja `BASE PEDIDOS`.

## URL de Apps Script cargada en `app.js`

```txt
https://script.google.com/macros/s/AKfycbwGlarDJWfz6LrxvqLVPDBvbroJ9PADBXWspqnE_VFAJXcPZI5bVWt6Z1TTqjcDecc/exec
```

## Muy importante si no guarda en Sheet

En `apps-script.gs`, revisá esta línea:

```js
const SPREADSHEET_ID = '1keP-JZV0c8p_3_-pzGpU4ifJ0u1WvY00GOQDRY-YL2U';
```

Ese ID debe ser el de la **hoja de cálculo**, no el del Apps Script.
Sale de esta parte de la URL:

```txt
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
```

La pestaña debe llamarse exactamente:

```txt
BASE PEDIDOS
```

## Pasos para actualizar Apps Script

1. Copiar todo `apps-script.gs` y pegarlo en `Code.gs`.
2. Guardar.
3. Ejecutar `setup()`.
4. Ejecutar `probarGuardado()`.
5. Revisar que aparezca una fila de prueba en el Sheet.
6. Ir a **Implementar > Administrar implementaciones > Editar > Nueva versión**.
7. Mantener acceso como **Cualquier persona** y ejecución como **Yo**.

## Prueba rápida

Abrí esta URL en el navegador:

```txt
https://script.google.com/macros/s/AKfycbwGlarDJWfz6LrxvqLVPDBvbroJ9PADBXWspqnE_VFAJXcPZI5bVWt6Z1TTqjcDecc/exec?action=diagnostico
```

Tiene que devolver un JSON con `ok: true`, nombre del archivo, nombre de hoja y cantidad de filas.
