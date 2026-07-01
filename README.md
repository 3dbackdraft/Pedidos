# Organizador de pedidos · 3D Backdraft

App simple para manejar pedidos desde celular o computadora, conectada a Google Sheets con Apps Script.

## Flujo activo

- Para hacer
- Para entregar
- Para publicar
- Para cobrar
- Deudor
- Finalizado

Cuando un pedido sale de **Para hacer**, la app pregunta si se sacaron fotos:

- Si aceptás, el pedido queda en **Para entregar** y se crean dos tareas en **Para publicar**:
  - Publicar en Instagram
  - Publicar en Mercado Libre
- Si cancelás, queda solamente en **Para entregar**.

**Para publicar** no es un estado exclusivo: es una lista de tareas pendientes. Cada canal tiene su propio texto editable, comentario y estado. Podés marcar Instagram como publicado y dejar Mercado Libre pendiente, o al revés.

Los pedidos en estado **Finalizado** no se muestran en la app, pero quedan guardados como registro en la hoja `BASE PEDIDOS`.

## Precios y métricas

Cada pedido ahora permite cargar:

- Precio unitario
- Cantidad
- Precio total
- Seña / pagado

La app tiene una vista separada llamada **Billetera**. La pantalla principal queda para pedidos y la billetera calcula:

- Ingresó cobrado: suma de pedidos `Finalizado`.
- Ganancia 50%: mitad de lo vendido cobrado.
- Compras: suma de la pestaña `COMPRAS`.
- Balance: ganancia 50% menos compras.
- Para cobrar: saldo pendiente de pedidos en `Para cobrar`.
- Deudores: saldo pendiente de pedidos en `Deudor`.
- Listo para entregar: saldo estimado de pedidos en `Para entregar`.
- En producción: valor total de pedidos en `Para hacer`.
- Potencial activo: suma de lo pendiente y lo que está en camino.

## Compras

Las compras se guardan en una pestaña nueva de la misma hoja de cálculo:

```txt
COMPRAS
```

Columnas:

```txt
ID, Fecha, Concepto, Monto, Nota, Actualizado
```

## Publicaciones

Las publicaciones se guardan dentro de `BASE PEDIDOS`, en columnas separadas:

- Instagram estado
- Instagram texto
- Instagram comentario
- Mercado Libre estado
- Mercado Libre texto
- Mercado Libre comentario

Los estados usados son:

- Pendiente
- Publicado

En la vista **Para publicar** también se pueden crear publicaciones manuales con el botón **+ Publicación manual**. Al crearla, la app pregunta si va para Instagram, Mercado Libre o ambos. Si elegís ambos, se crean dos tareas pendientes resumidas.

## Movimientos

La vista **Billetera** incluye un historial de movimientos. El Apps Script registra automáticamente:

- Compra: cuando se carga una compra.
- Cobro: cuando un pedido pasa a `Finalizado`.
- Deudor: cuando un pedido pasa a `Deudor`.

Los movimientos se guardan en la pestaña:

```txt
MOVIMIENTOS
```

Columnas:

```txt
ID, Fecha, Tipo, Detalle, Monto, Referencia, Pedido ID, Actualizado
```

Si el Apps Script todavía no fue actualizado, la app arma una lista temporal desde compras y pedidos, pero para que quede guardado como historial real hay que desplegar `apps-script.gs`.

## URL de Apps Script cargada en `app.js`

```txt
https://script.google.com/macros/s/AKfycbzxZw_6sg86FlLSfnEkk4wvOfvdk2Xpr8WIjet0w3bwVe7PMzZlpMaoKzvGB0omy_Ym/exec
```

## Muy importante si no guarda en Sheet

En `apps-script.gs`, revisá esta línea:

```js
const SPREADSHEET_ID = '1keP-JZV0c8p_3_-pzGpU4ifJ0u1WvY00GOQDRY-YL2U';
```

Ese ID debe ser el de la **hoja de cálculo**, no el del Apps Script.

La pestaña principal debe llamarse exactamente:

```txt
BASE PEDIDOS
```

## Pasos para actualizar Apps Script

1. Copiar todo `apps-script.gs` y pegarlo en `Code.gs`.
2. Guardar.
3. Ejecutar `setup()`.
4. Ir a **Implementar > Administrar implementaciones > Editar > Nueva versión**.
5. Mantener acceso como **Cualquier persona** y ejecución como **Yo**.

`setup()` conserva los datos existentes y agrega encabezados faltantes. No debería borrar pedidos.

Si la hoja tiene encabezados duplicados por pruebas anteriores, el script ahora usa la primera columna encontrada para cada encabezado. Aun así, conviene limpiar duplicados manualmente cuando ya esté todo funcionando.

## Prueba rápida

Abrí esta URL en el navegador:

```txt
https://script.google.com/macros/s/AKfycbzxZw_6sg86FlLSfnEkk4wvOfvdk2Xpr8WIjet0w3bwVe7PMzZlpMaoKzvGB0omy_Ym/exec?action=diagnostico
```

Tiene que devolver un JSON con `ok: true`, encabezados de `BASE PEDIDOS` y encabezados de `COMPRAS`.
