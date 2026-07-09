# Organizador de pedidos - 3D Backdraft

App simple para manejar pedidos, tareas de publicacion y billeteras conectadas a Google Sheets con Apps Script.

## Vistas principales

- Pedidos
- Publicar
- Ventas
- Billetera Iri
- Billetera mama

El boton **+ Compra** vive solo dentro de las billeteras.

## Flujo de pedidos

Todo pedido nuevo entra en **Para hacer**.

Dentro de Pedidos quedan estas listas:

- Para hacer
- Para entregar
- Para cobrar
- Deudores
- Activos

Cuando un pedido sale de **Para hacer**, la app pregunta si tambien hay que publicarlo:

- Si aceptas, el pedido pasa a **Para entregar** y se crean tareas pendientes en **Publicar**.
- Si cancelas, el pedido pasa solo a **Para entregar**.

Desde **Para entregar** pasa a **Para cobrar**. Desde **Para cobrar** puede terminar como **Finalizado** o como **Deudor**.

## Publicar

**Publicar** es una vista de tareas pendientes, no un estado extra del pedido.

Cada tarea puede ser para Instagram, Mercado Libre o ambos. Al marcarla como publicada, el flujo termina ahi. Tambien se pueden crear publicaciones manuales para usarlas solo como tarea pendiente.

## Ventas

La vista **Ventas** permite cargar ingresos que no nacen de un pedido.

Cada venta suelta pide el total y el reparto:

- Fecha
- Detalle
- Total venta
- Para Iri
- Para mama
- Referencia

Por defecto propone 50% y 50%. Al guardar, crea dos movimientos de tipo `Venta`: uno para `iri` y otro para `mama`. Estas ventas aparecen tambien en el historial de ingresos de la billetera correspondiente y se pueden editar por separado.

## Billeteras

Cada pedido tiene reparto editable:

- Parte Iri
- Parte mama

Por defecto se propone 50% y 50% del precio total. Se puede editar cuando el cobro real no corresponde a ese reparto.

Cuando un pedido pasa a **Finalizado**, Apps Script registra dos movimientos de cobro:

- Billetera Iri: usa `Parte Iri`.
- Billetera mama: usa `Parte mama`.

Cada compra queda asociada a la billetera elegida.

Dentro de cada billetera se muestran dos historiales separados:

- Historial de compras
- Historial de ingresos

Los ingresos incluyen cobros que vienen de pedidos y ventas sueltas. Desde ese historial se puede editar el monto y la billetera cuando alguna persona recibio una parte distinta al 50%.

## Hojas usadas

La pestaña principal debe llamarse:

```txt
BASE PEDIDOS
```

Compras:

```txt
COMPRAS
```

Columnas:

```txt
ID, Fecha, Billetera, Concepto, Monto, Nota, Actualizado
```

Movimientos:

```txt
MOVIMIENTOS
```

Columnas:

```txt
ID, Fecha, Tipo, Detalle, Monto, Billetera, Referencia, Pedido ID, Actualizado
```

## Pasos para actualizar Apps Script

1. Copiar todo `apps-script.gs` y pegarlo en `Code.gs`.
2. Guardar.
3. Ejecutar `setup()`.
4. Ir a **Implementar > Administrar implementaciones > Editar > Nueva version**.
5. Mantener acceso como **Cualquier persona** y ejecucion como **Yo**.

`setup()` conserva datos existentes y agrega encabezados faltantes.
