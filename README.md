# Organizador de pedidos - 3D Backdraft

App simple para agendar pedidos, registrar ventas y entender las billeteras de Iri y mama con Google Sheets y Apps Script.

## Vistas principales

- Pedidos
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

El recorrido es:

```txt
Para hacer -> Para entregar -> Para cobrar -> Finalizado
```

Si el pedido no se cobra, puede pasar de **Para cobrar** a **Deudor**.

Cuando un pedido pasa a **Finalizado**, Apps Script registra el cobro en las billeteras usando el reparto cargado en el pedido.

## Ventas

La vista **Ventas** permite cargar ingresos que no nacen de un pedido.

Cada venta suelta pide:

- Fecha
- Detalle
- Total venta
- Para Iri
- Para mama
- Referencia

Por defecto propone 50% y 50%. Al guardar, crea dos movimientos de tipo `Venta`: uno para `iri` y otro para `mama`.

## Billeteras

Cada pedido tiene reparto editable:

- Parte Iri
- Parte mama

Por defecto se propone 50% y 50% del precio total. Se puede editar cuando el cobro real no corresponde a ese reparto.

Dentro de cada billetera se muestran:

- Historial de compras
- Historial de ingresos

Los ingresos incluyen cobros que vienen de pedidos y ventas sueltas. Desde ese historial se puede editar el monto y la billetera cuando alguna persona recibio una parte distinta al 50%.

## Hojas usadas

Pedidos:

```txt
BASE PEDIDOS
```

Columnas:

```txt
ID, Fecha carga, Pedido, Cliente, Precio unitario, Cantidad, Precio total, Precio, Seña, Parte Iri, Parte mama, Estado, Fecha compromiso, Nota, Actualizado
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
4. Ejecutar una vez `limpiarPublicacionesDePlanilla()` para borrar la hoja vieja `PUBLICACIONES`, limpiar columnas antiguas y sacar tareas viejas del listado de pedidos.
5. Ir a **Implementar > Administrar implementaciones > Editar > Nueva version**.
6. Mantener acceso como **Cualquier persona** y ejecucion como **Yo**.

`setup()` conserva datos existentes y agrega encabezados faltantes.
