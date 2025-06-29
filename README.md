# Ajedrez Didáctico

Esta aplicación web permite jugar al ajedrez con diferentes modos de visualización para ayudar al aprendizaje. Ahora cuenta con un tema oscuro de estilo neón para una experiencia moderna y agradable a la vista.

## Uso

1. Abre `index.html` en tu navegador.
2. Presiona los números del 1 al 4 para cambiar el modo de vista:
   - **1**: vista normal con movimientos disponibles al seleccionar una pieza.
   - **2**: además de los movimientos, muestra las casillas atacadas por la pieza seleccionada.
   - **3**: resalta nuestras piezas que están siendo atacadas.
   - **4**: indica las casillas donde podemos dar jaque al rival.

La partida se juega con click sobre las casillas. El turno comienza con blancas.

## Reglas de juego

* **Turnos**: las blancas mueven primero y luego se alterna un movimiento por
  jugador. Solo pueden seleccionarse piezas del bando al que le toca mover.
  No se permiten jugadas que dejen al propio rey en jaque.

## Ajustes

Usa el botón **Ajustes** para abrir un panel donde puedes modificar:

- El tamaño de las piezas mediante un control deslizante.
- El brillo del color neón del tema oscuro.

* **Capturas**: al mover a una casilla ocupada por una pieza rival, dicha pieza
  se retira del tablero.
* **Jaque**: si un movimiento ataca al rey contrario, el tablero resalta las
  casillas desde las que se puede dar jaque.
* **Movimientos legales**: solo se muestran y ejecutan movimientos que no dejan
  al propio rey en jaque, obligando a mover de forma legal en todo momento.
* **Peón al paso**: cuando un peón avanza dos casillas desde su posición inicial
  puede ser capturado en la siguiente jugada como si solo hubiera avanzado una.
