# Mundo 7 — El taller de los clásicos (M38–M42)

Cinco misiones con los algoritmos del libro *Grokking Algorithms* que el juego aún no cubría. Todas siguen el mismo patrón que los mundos anteriores: el problema se presenta sin su nombre, los diagnósticos se verificaron contra implementaciones erróneas reales y los presupuestos de pasos (D13) se calibraron con una solución buena y una ingenua.

| Misión | Función | Concepto | Idea | Sistema del taller |
|---|---|---|---|---|
| M38 La estantería por peso | `sortByLightest` | C42 Ordenación por selección | Sacar siempre la más ligera, sin `.sort` | Clasificadora `working → reliable` |
| M39 Partir el montón en dos | `arrangeBySplitting` | C43 Dividir y vencerás | Repartir en dos montones y repetir con cada uno | Mezcladora `working → reliable` |
| M40 El mapa por plantas | `readByFloors` | C44 Recorrido por niveles | Leer el árbol planta a planta con una lista de espera | Mapa de niveles `absent → installed` |
| M41 La ruta más barata | `cheapestRoute` | C45 Caminos con pesos | Resolver siempre el puesto pendiente más barato | Trazador de rutas `absent → installed` |
| M42 Cubrir todo el taller con pocas emisoras | `pickStations` | C46 Algoritmos voraces | Elegir lo que más aporta ahora, aunque no sea lo mejor | Red de emisoras `absent → installed` |

## Decisiones

- **El nombre de la función no puede contener `.sort`.** M39 se llamó primero `sortBySplitting`; un jugador que escribiera `[...sortBySplitting(x)]` disparaba la regla de construcciones prohibidas (`.sort`) con una solución correcta. Se renombró a `arrangeBySplitting`. Regla para misiones futuras: ningún `entryPoint` puede contener un texto prohibido precedido de `.`.
- **El validador trata `método` como la palabra `todo`.** El lint de relleno usa `\btodo\b` y, sin banderas Unicode, la `é` cuenta como separador. Los campos del debrief usan «procedimiento» en lugar de «método», y «sin resolver» en lugar de «pendiente».
- **M42 pide seguir la regla, no el óptimo.** El caso v3 está construido para que la regla enciende tres emisoras cuando dos bastan; una solución que busca el mínimo falla ese caso y el diagnóstico explica por qué.
- **M41 y M39 tienen presupuesto de pasos**; M38, M40 y M42 no, porque en ellas la corrección es lo que se evalúa. Referencias y solución ingenua están en `tests/support/calibration-solutions.ts`.

| Misión | Pasos de la referencia | Presupuesto | Pasos de la ingenua |
|---|---|---|---|
| M39 | ≈ 91.700 | 300.000 | ≈ 6,8 millones (selección) |
| M41 | ≈ 23.500 | 70.000 | ≈ 11,7 millones (todas las rutas) |

## Repaso espaciado

Cinco variantes nuevas, una por concepto: `R-C42-1` posición de la pieza más ligera, `R-C43-1` repartir en dos montones, `R-C44-1` tamaño de cada planta, `R-C45-1` siguiente puesto a resolver, `R-C46-1` opción que más aporta. En total hay 46 variantes.

## Infraestructura

- `WORLD_IDS` incluye `w7`; `content/worlds.json` lo registra como `in-progress`.
- Figura 3D propia: un yunque (`forge`) en `worldShapes.ts`.
- Tres sistemas nuevos en `content/workshop.json`: `sys.levels`, `sys.pathfinder`, `sys.radio`.
