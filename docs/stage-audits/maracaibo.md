# Auditoría individual: Puente de Maracaibo

Revisión: 2026-10-17. Alcance: solo Maracaibo, sobre los cambios locales de ampliación del mundo. No se modificaron archivos comunes.

## Resultado

La integración del elevador y la ampliación pasan las comprobaciones ejecutadas. No encontré un defecto de física que requiera cambios en este escenario.

Mundo comprobado: 1440 × 800, origen (-180, -140), suelo de x=-90 a x=1170 y altura y=554. Las pasarelas laterales miden 200 unidades; el elevador central mide 162 y ocupa x=459..621. Su recorrido vertical va de y=346 a y=474, con periodo de 480 ticks (8 segundos de simulación).

## Evidencia de ejecución

Se ejecutó el motor real mediante `node --import tsx --input-type=module`, importando `createMatch`, `emptyInput`, `stepMatch`, `WORLD`, `platformsAtTick` y `arenaBounds`, con aserciones de `node:assert/strict`. Personajes: Zavarce y Javier, sin CPU ni ataques para aislar la plataforma.

- **Cinco ciclos completos con pasajero:** 2400 ticks. El pasajero permaneció apoyado en plataforma 2, x=540, velocidad vertical 0 y dos vidas. El error máximo entre los pies y la plataforma fue 0. Extremos medidos: y=346 y y=474.
- **Saltar y volver a aterrizar:** salidas en ticks 0, 120, 240 y 360. El salto eliminó el soporte de inmediato; el pasajero volvió al elevador en 52, 48, 46 y 50 frames respectivamente.
- **Bajar atravesando la plataforma:** una pulsación de abajo desde las mismas cuatro fases llevó al suelo y=554; durante los siguientes 120 ticks no hubo enganche de regreso al elevador ni pérdida de vidas.
- **Aterrizar desde arriba:** caída iniciada ocho unidades sobre el elevador, velocidad vertical 5, en las cuatro fases. Diez frames después, soporte 2 y altura exactamente igual a `platformsAtTick` en cada caso.
- **Acceso desde el suelo:** doble salto vertical desde x=540, con segundo impulso al frame 20. Acceso correcto al elevador desde las cuatro fases iniciales; aterrizaje en 57..66 frames. Altura mínima alcanzada: y=296.32.
- **Pausa de impacto:** cinco ticks de hitstop conservaron posición y tick; al reanudar, el pasajero mantuvo el soporte correcto.
- **Caídas y KO:** se soltó al pasajero seis unidades después de cada extremo del suelo. Ambos lados produjeron exactamente una pérdida de vida al frame 31 y reaparición en (330,260); después aterrizó en (330,554), con una vida y soporte de suelo.
- **Límites y visibilidad geométrica:** se recorrieron los 480 ticks del elevador con superficies completas dentro del área jugable y del encuadre en lienzos 1440×800, 1897×800 y 1440×853. Los dos extremos del suelo también quedan dentro del encuadre.
- **Suite existente:** `node --import tsx --test tests/stages.test.ts`: 11/11 pruebas correctas. Incluye suelo ampliado, recorridos móviles, proyectiles en las zonas laterales, determinismo, soporte y colisión.

## Navegador y apariencia

Se abrió una pestaña independiente mediante T3 Preview, primero en `https://arena.kevinbravo.com`, para seleccionar Maracaibo e iniciar la pelea existente. Esa versión conserva lienzo 1080×640 y no demuestra los cambios locales.

Después se revisó `http://localhost:5184` usando `target: {kind: 'environment-port', port: 5184}`. Se seleccionó Maracaibo, se inició una pelea y se saltó la presentación. El lienzo medido es 1440×800. La captura local muestra el puente completo como fondo, las tres superficies distinguibles, ambos extremos del suelo y espacio visible por encima y a los lados de los luchadores. No se observó recorte ni deformación del fondo en este encuadre de escritorio.

Captura local real guardada por T3 Preview:

`/home/ubuntu/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvcd88mf-e14aac64.png`

El servidor tuvo un reinicio durante la primera navegación: `ERR_CONNECTION_REFUSED` y `504 (Outdated Request)`. La navegación posterior funcionó. Esos errores corresponden al reinicio del servidor de desarrollo y no se contabilizan como fallos de Maracaibo.

## Límites y recomendaciones

La prueba visual corresponde a escritorio 1280×800. La cobertura de los tres encuadres anteriores es geométrica; no equivale a una sesión táctil real. La comprobación de los cinco ciclos utiliza el motor compartido, no cinco ciclos de juego manual en navegador. No se revisaron cuentas, ranking ni sincronización entre dos clientes dentro de esta auditoría individual.

Conservar las coordenadas compartidas entre simulación y dibujo. El doble salto permite alcanzar el punto más alto del elevador desde el suelo; reducir el salto o aumentar el recorrido exigiría repetir esa comprobación. La QA global final debe incluir móvil apaisado para valorar el tamaño visual de los luchadores tras ampliar el encuadre.
