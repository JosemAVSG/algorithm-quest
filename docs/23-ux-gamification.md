# Entrada, recompensa, laboratorio y lectura

Cuatro bloques de mejoras de UX y gamificación. La gamificación sigue dentro de D11: no hay puntos, XP, rachas, insignias por cantidad ni rankings. Lo que se recompensa es lo que el taller muestra de verdad.

## Entrada

- **Guía «Cómo se juega»** (`WelcomeGuide`): tres pasos, solo en la primera visita al mapa y mientras no haya misiones completadas. Se cierra con «Entendido» y el navegador lo recuerda (`aq.welcome.dismissed`); si el almacenamiento falla, solo vuelve a salir. No lleva botón principal, así que «Continuar →» sigue siendo la única acción primaria.
- **Aviso de repaso:** cuando hay conceptos en la cola de refuerzo, el mapa lo dice y enlaza a la pantalla de progreso. Dice que es opcional.
- «Continuar →» ya reabría la misión en curso con su sesión guardada, así que no se añadió otro botón.

## Recompensa

- Al cerrar una misión, la fila «sistema → estado» se ilumina una vez (`repair-glow`). Sin `opacity` (contraste) y desactivada con `prefers-reduced-motion`.
- Cada mundo abierto muestra una **barra fina de avance** (sin número en el nodo) y su nombre accesible incluye «3 de 5 misiones». Un mundo completado brilla un poco.
- **«Esta semana»** en el progreso: los sistemas reparados en los últimos siete días. Es una mirada atrás; no hay racha ni penalización por no entrar.

## Laboratorio

- **Barra de símbolos** (`SymbolBar`) bajo el editor en pantallas de menos de 900 px: sangría, llaves, paréntesis, corchetes, `;`, `=`, `<`, `>`, `!`, `&&`, `||` y comilla. Cada tecla mide al menos 44 px y no roba el foco al editor. Los dos editores (CodeMirror y el área de texto de reserva) exponen `onReady` para insertar en el cursor.
- **Diferencia marcada:** en una prueba fallida se subraya, en el esperado y en el obtenido, desde donde empiezan a diferir (`splitAtFirstDifference`; un número se marca entero). Subrayado ondulado y negrita, no solo color.
- Los atajos ya existían (Cmd/Ctrl + Enter ejecuta; Esc y Tab salen del editor) y siguen visibles sobre el editor.

## Navegación y lectura

- **Siguiente misión:** el informe final ofrece «Siguiente: … →» (la que el motor propone) y deja «Volver al taller →» como secundaria. Sin siguiente, «Volver» sigue siendo la primaria.
- **Buscar por concepto:** en el mapa de mundos, un selector lista las misiones que enseñan un concepto; las bloqueadas se ven pero no se abren. Para esto el índice de misiones lleva ahora `concepts`.
- **Lectura:** «Texto grande» (118 %) y «Alto contraste», guardados en `aq.preferences` y aplicados como `data-text` y `data-contrast` en `<html>`.

## Pruebas

`e2e/welcome.spec.ts`, `e2e/ux-polish.spec.ts` y `tests/unit/lab/diffText.test.ts`. En la suite completa fallan `X5` (también falla en `main`) y, a veces bajo carga, `step-navigation:49` (pasa en aislamiento).
