# Ajedrez Didáctico

Esta aplicación web permite jugar al ajedrez con diferentes modos de visualización para ayudar al aprendizaje. Ahora se incluyen varios temas visuales —neón oscuro, clásico y alto contraste— para distinguir mejor entre piezas blancas y negras. Los movimientos cuentan con una animación más épica y, al capturar una pieza, aparece brevemente una celebración con un efecto de fuego generado en canvas. También se resalta la última jugada para seguir mejor el desarrollo de la partida. Las piezas muestran ahora un contorno sutil para distinguir mejor las blancas de las negras incluso con casillas resaltadas.

## Uso

1. En una terminal, ejecuta `cd server && npm install && npm start` para iniciar el proxy local.
2. Abre `http://localhost:8787` en tu navegador.
3. Presiona las teclas numéricas (1 a 4) para alternar cada modo de vista. Puedes combinarlos:
   - **1**: muestra los movimientos disponibles al seleccionar o pasar el ratón sobre una pieza.
   - **2**: resalta las casillas atacadas por la pieza seleccionada.
   - **3**: señala nuestras piezas en peligro.
   - **4**: indica las casillas desde las que podemos dar jaque.

   Debajo de estas instrucciones se muestra un indicador con iconos a color que
   representan cada vista activa para saber en todo momento qué opciones están
   habilitadas.
 
Al cargar la página se pregunta con qué color quieres jugar. El adversario analiza las jugadas legales usando heurísticas básicas —capturas, amenazas y jaques— y mueve de forma automática tras cada una de tus jugadas. La partida se juega haciendo clic o arrastrando las piezas hasta su destino y se muestran las piezas capturadas junto con un contador de tiempo para cada bando.

## Reglas de juego

* **Turnos**: las blancas mueven primero y luego se alterna un movimiento por
  jugador. Solo pueden seleccionarse piezas del bando al que le toca mover.
  No se permiten jugadas que dejen al propio rey en jaque.

## Ajustes

Usa el botón **Ajustes** para abrir un panel donde puedes modificar:

- El tamaño de las piezas mediante un control deslizante (por defecto ahora se
  muestran más grandes).
- El brillo del color neón del tema oscuro.
- Elegir el tema visual entre neón oscuro (por defecto), clásico o alto contraste.
  - Dentro del submenú **Iluminación** puedes ajustar:
  - La intensidad del resplandor que rodea tablero y resaltados.
  - La saturación del color neón.

* **Capturas**: al mover a una casilla ocupada por una pieza rival, dicha pieza
  se retira del tablero.
* **Jaque**: si un movimiento ataca al rey contrario, el tablero resalta las
  casillas desde las que se puede dar jaque.
* **Movimientos legales**: solo se muestran y ejecutan movimientos que no dejan
  al propio rey en jaque, obligando a mover de forma legal en todo momento.
* **Peón al paso**: cuando un peón avanza dos casillas desde su posición inicial
  puede ser capturado en la siguiente jugada como si solo hubiera avanzado una.

## Historial de movimientos

Debajo del tablero se muestra una lista con todas las jugadas realizadas en notación algebraica.
Un botón permite exportar la partida en formato PGN para analizarla con otros programas.

## Visualización de datos

El archivo `data-viz.html` ofrece estadísticas detalladas de tus partidas. Incluye gráficas de rachas ganadoras y perdedoras, análisis según descanso entre partidas y un listado de aperturas que puede filtrarse por color. Las gráficas de winrate muestran una línea con la media global de victorias para comparar cada categoría con tu rendimiento general. Pulsa la tecla `d` y aparecerá un círculo alrededor del cursor; al hacer clic en cualquier elemento informativo, DeepSeek describirá esa sección y te dará un consejo para mejorar en ajedrez.

## Integración con Chess.com

En la sección **Aprender** puedes cargar tu historial de partidas desde Chess.com.
Los datos recuperados se guardan en el navegador durante 5 horas para evitar
excesos de peticiones. Si necesitas información actualizada antes de ese plazo,
usa el botón **Forzar descarga** para omitir la caché y traer la versión más reciente.

## Análisis de precisión

Al cargar datos de Chess.com, cada partida se evalúa automáticamente con Stockfish para estimar la pérdida media de centipeones de ambos jugadores. Los resultados se guardan en `precision` (tu media) y `oppPrecision` (la del rival). Las evaluaciones se almacenan en caché para evitar reprocesar partidas ya analizadas salvo que existan datos nuevos. Estas métricas se muestran en `data-viz.html` como columnas adicionales y en el listado de partidas.

## Pruebas

Se incluye un pequeño conjunto de pruebas para comprobar la lógica del motor y el cálculo de precisión.
Ejecuta `node tests/evaluateMove.test.js` y `node tests/precision.test.js` desde la raíz del proyecto.

## Mantenimiento

Se eliminaron archivos duplicados y versiones antiguas para mantener una estructura clara y evitar funcionalidades huérfanas.
