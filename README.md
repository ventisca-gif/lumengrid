# Dragon Mystery

RPG de mazmorras por turnos con estética pixel art, para Android.
Sin dependencias ni compilación web: todo el juego está en `public/`; `android/` lo empaqueta como app.

## Jugar

- **APK para Android:** el flujo `.github/workflows/apk.yml` compila la app y publica `DragonMystery.apk` en *Releases → APK de prueba*. Descárgalo en el teléfono y permite instalar apps de origen desconocido.
- **En el navegador:** `cd public && python3 -m http.server 8000` y abre `http://localhost:8000`. El flujo `pages.yml` publica `public/` en GitHub Pages al hacer push a `main` (actívalo en *Settings → Pages → Source: GitHub Actions*).

El juego se muestra siempre en horizontal y a pantalla completa, con los controles sobre la imagen.

Controles táctiles: cruceta de 8 direcciones, **A** (atacar / hablar / confirmar), **TÉC** (técnicas), **MENÚ** y **ESP** (esperar un turno).
Teclado: flechas o WASD, `Z`/Enter = A, `X`/Esc = menú, `C` = técnicas, `V` = esperar.

## Qué incluye

- Ciudad inicial con avenidas, edificios, parque, tienda, curación, inventora que da la introducción y compañero reclutable.
- Mazmorra rocosa de 5 pisos generada al azar (56×40 casillas por piso), con jefe final.
- Combate por turnos, 4 técnicas que gastan energía, compañero con IA.
- Interfaz con retrato, nombre, nivel, PS, energía, indicador de piso y minimapa.
- Diálogos con retrato y nombre, inventario, equipamiento (arma, ropa, accesorio) y guardado automático.

Rendimiento: cada mapa se dibuja una sola vez en un lienzo aparte y por fotograma solo se copia la parte visible.

## Sistema de gráficos (`public/assets/`)

Todos los gráficos se declaran en `public/assets/assets.json`. Al arrancar, el juego intenta cargar cada archivo;
**si falta, usa un marcador dibujado por código**, así que nunca se rompe. Para cambiar un personaje o escenario
basta con subir el PNG y, si hace falta, ajustar su entrada en `assets.json`. No hay que tocar `game.js`.

En el título, la opción **Gráficos cargados** muestra qué archivos se han encontrado y cuáles faltan.

Usa solo gráficos propios o para los que tengas permiso de uso.

### Estado actual

El paquete visual v1 incluye las hojas de personajes y enemigos, los retratos, las baldosas sueltas y la interfaz. Los atlas son opcionales.

| Sección de `assets.json` | Para qué | Archivos esperados |
|---|---|---|
| `characters` → `sheet` | Sprite del jugador, compañero y personajes de la ciudad | `characters/hero.png`, `ally.png`, `npc_intro.png`, `npc_sora.png`, `npc_brok.png`, `npc_lia.png` |
| `characters` → `portrait` | Retratos (diálogos e interfaz) | `portraits/` con los mismos seis nombres |
| `enemies` | Sprites de enemigos | `enemies/slime.png`, `bat.png`, `scorp.png`, `lizard.png`, `golem.png` |
| `tilesets.city` | Atlas de baldosas de la ciudad | `tiles/city_tileset.png` |
| `tilesets.dungeon` | Atlas de baldosas de la mazmorra rocosa | `tiles/rocky_tileset.png` |
| `tiles` | Baldosas sueltas (alternativa al atlas) | ciudad: `pave`, `road`, `grass`, `flower`, `path`, `water`, `tree`, `roof`, `roofB`, `roofP`, `wall`, `door`, `bench`, `fount`, `gate`; mazmorra: `dfloor`, `dtop`, `dcliff`, `stairs` |
| `ui` | Interfaz | `ui/hud.png`, `ui/dialog.png`, `ui/menu.png` |
| `ui` | Controles táctiles | `ui/dpad.png`, `ui/btn_a.png`, `ui/btn_tech.png`, `ui/btn_menu.png`, `ui/btn_wait.png` |

### Hojas de personajes y enemigos

Cada **fila** es una dirección y cada **columna** un fotograma. Se dibujan a su tamaño original, sin suavizado,
centradas en la casilla y apoyadas en los pies, así que pueden ser más grandes que 16×16.

```json
"hero": {
  "sheet": "characters/hero.png",
  "portrait": "portraits/hero.png",
  "frameW": 32, "frameH": 32,
  "scale": 1,
  "footOffset": 0,
  "colorKey": null,
  "dirs": ["down", "left", "right", "up"],
  "anims": {
    "idle":   { "from": 0, "count": 1, "fps": 2 },
    "walk":   { "from": 1, "count": 4, "fps": 8 },
    "attack": { "from": 5, "count": 3, "fps": 12 },
    "hurt":   { "from": 8, "count": 1, "fps": 4 }
  }
}
```

| Campo | Significado |
|---|---|
| `name` | Nombre que se muestra (personajes de la ciudad y enemigos). |
| `frameW`, `frameH` | Tamaño de cada fotograma en píxeles. |
| `scale` | Multiplicador entero opcional (1 = tamaño original). |
| `footOffset` | Desplaza el sprite en vertical si los pies no tocan el borde inferior. |
| `offsetX`, `offsetY` | Margen de la hoja antes del primer fotograma. |
| `colorKey` | `null` si el PNG ya es transparente; `"#rrggbb"` o `"auto"` (píxel superior izquierdo) para volver transparente un fondo liso. |
| `dirs` | Orden de las filas. Si falta `left` o `right`, se refleja la otra. |
| `anims` | `from` = primera columna, `count` = fotogramas, `fps` = velocidad. `rowStart` opcional si la animación empieza en otra fila. |

Las cuatro animaciones (`idle`, `walk`, `attack`, `hurt`) son independientes del movimiento y del combate.

### Baldosas

Dos formas, que se pueden combinar (el PNG suelto tiene prioridad):

- **Atlas:** una imagen con muchas baldosas. En `map` se indica la columna y fila de cada una; una lista de pares crea variantes.

```json
"tilesets": {
  "city": {
    "image": "tiles/city_tileset.png",
    "tile": 16,
    "map": { "pave": [[0, 0], [1, 0]], "road": [2, 0], "roof": [0, 1] }
  }
}
```

- **PNG sueltos:** uno por baldosa, de 16 px de alto; si mide más de 16 px de ancho se trata como tira de variantes.

### Interfaz, retratos y controles

- **Retratos:** cualquier tamaño; se ajustan al recuadro conservando la proporción.
- **`ui/hud.png`, `ui/dialog.png`, `ui/menu.png`:** fondo del panel del jugador, del cuadro de diálogo y de los menús; se estiran al tamaño del panel.
- **Controles táctiles:** cada imagen sustituye al botón correspondiente.

### Textos

En `assets.json → text` se cambian el título, el nombre por defecto del héroe (el jugador puede escribir otro),
el nombre del compañero, de la ciudad y de la mazmorra, y la etiqueta de la energía (`energyLabel`).
