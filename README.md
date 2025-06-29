# Ajedrez Didáctico

Esta aplicación web permite jugar al ajedrez con diferentes modos de visualización para ayudar al aprendizaje. Ahora cuenta con un tema oscuro de estilo neón para una experiencia moderna y agradable a la vista. Los movimientos se animan suavemente y se resalta la última jugada para seguir mejor el desarrollo de la partida.

## Uso

1. Abre `index.html` en tu navegador.
2. Presiona las teclas numéricas (1 a 4) para alternar cada modo de vista. Puedes combinarlos:
   - **1**: muestra los movimientos disponibles al seleccionar o pasar el ratón sobre una pieza.
   - **2**: resalta las casillas atacadas por la pieza seleccionada.
   - **3**: señala nuestras piezas en peligro.
   - **4**: indica las casillas desde las que podemos dar jaque.

   Debajo de estas instrucciones ahora se muestra un indicador con los modos
   activos para saber en todo momento qué vistas están habilitadas.
 
La partida se juega haciendo clic o arrastrando las piezas hasta su destino. El turno comienza con blancas. En todo momento se muestran las piezas capturadas y un contador de tiempo para cada bando.

## Reglas de juego

* **Turnos**: las blancas mueven primero y luego se alterna un movimiento por
  jugador. Solo pueden seleccionarse piezas del bando al que le toca mover.
  No se permiten jugadas que dejen al propio rey en jaque.

## Ajustes

Usa el botón **Ajustes** para abrir un panel donde puedes modificar:

- El tamaño de las piezas mediante un control deslizante (por defecto ahora se
  muestran más grandes).
- El brillo del color neón del tema oscuro.

* **Capturas**: al mover a una casilla ocupada por una pieza rival, dicha pieza
  se retira del tablero.
* **Jaque**: si un movimiento ataca al rey contrario, el tablero resalta las
  casillas desde las que se puede dar jaque.
* **Movimientos legales**: solo se muestran y ejecutan movimientos que no dejan
  al propio rey en jaque, obligando a mover de forma legal en todo momento.
* **Peón al paso**: cuando un peón avanza dos casillas desde su posición inicial
  puede ser capturado en la siguiente jugada como si solo hubiera avanzado una.
