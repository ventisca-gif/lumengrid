# Dragon Mystery

RPG de mazmorras por turnos con estética pixel art, para Android (navegador o instalado como app web).
Sin dependencias ni compilación: todo el juego está en `public/`.

## Jugar

- **APK para Android:** el flujo `.github/workflows/apk.yml` compila la app (carpeta `android/`, que empaqueta `public/`) y publica `DragonMystery.apk` en *Releases → APK de prueba*. Descárgalo en el teléfono y permite instalar apps de origen desconocido.
- **En el navegador del móvil:** publica la carpeta `public/` (por ejemplo con GitHub Pages, ver abajo), abre la dirección en Chrome y elige *Añadir a pantalla de inicio*.
- **En el ordenador:** `cd public && python3 -m http.server 8000` y abre `http://localhost:8000`.

El juego se muestra siempre en horizontal y a pantalla completa, con los controles sobre la imagen.

Controles táctiles: cruceta de 8 direcciones, **A** (atacar / hablar / confirmar), **TÉC** (técnicas), **MENÚ** y **ESP** (esperar un turno).
Teclado: flechas o WASD, `Z`/Enter = A, `X`/Esc = menú, `C` = técnicas, `V` = esperar.

### GitHub Pages

El flujo `.github/workflows/pages.yml` publica `public/` al hacer push a `main`.
Actívalo una vez en *Settings → Pages → Source: GitHub Actions*.

## Qué incluye

- Pueblo inicial con tienda, curación y compañero reclutable.
- Mazmorra rocosa de 5 pisos generada al azar, con jefe final.
- Combate por turnos, 4 técnicas que gastan energía, compañero con IA.
- Diálogos con retrato, equipamiento (arma, ropa, accesorio), guardado automático.

## Sistema de gráficos (`public/assets/`)

Todos los gráficos se declaran en `public/assets/assets.json`. Al arrancar, el juego intenta cargar cada archivo;
**si falta, usa un marcador dibujado por código**, así que nunca se rompe. Para cambiar un personaje o escenario
basta con subir el PNG y, si hace falta, ajustar su entrada en `assets.json`. No hay que tocar `game.js`.

En el título, la opción **Gráficos cargados** muestra qué archivos se han encontrado y cuáles faltan.

Usa solo gráficos propios o para los que tengas permiso de uso.

### Estado actual

Ningún PNG subido todavía: los 30 archivos de la lista siguiente faltan y se muestran marcadores.

| Carpeta | Archivos esperados |
|---|---|
| `characters/` | `hero.png`, `ally.png`, `npc_sora.png`, `npc_brok.png`, `npc_lia.png` |
| `portraits/` | `hero.png`, `ally.png`, `npc_sora.png`, `npc_brok.png`, `npc_lia.png` |
| `enemies/` | `slime.png`, `bat.png`, `scorp.png`, `lizard.png`, `golem.png` |
| `tiles/` | `grass`, `flower`, `path`, `water`, `tree`, `roof`, `wall`, `door`, `fount`, `gate` (pueblo); `dfloor`, `dtop`, `dcliff`, `stairs` (mazmorra) — todos `.png` |
| `ui/` | `dialog.png` (fondo del cuadro de diálogo) |

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
| `frameW`, `frameH` | Tamaño de cada fotograma en píxeles. |
| `scale` | Multiplicador entero opcional (1 = tamaño original). |
| `footOffset` | Desplaza el sprite en vertical si los pies no tocan el borde inferior. |
| `offsetX`, `offsetY` | Margen de la hoja antes del primer fotograma. |
| `colorKey` | `null` si el PNG ya es transparente; `"#rrggbb"` o `"auto"` (píxel superior izquierdo) para volver transparente un fondo liso. |
| `dirs` | Orden de las filas. Si falta `left` o `right`, se refleja la otra. |
| `anims` | `from` = primera columna, `count` = fotogramas, `fps` = velocidad. `rowStart` opcional si la animación empieza en otra fila. |

Las cuatro animaciones (`idle`, `walk`, `attack`, `hurt`) son independientes del movimiento y del combate.

### Baldosas, retratos e interfaz

- **Baldosas:** PNG de 16 px de alto; si mide más de 16 px de ancho se trata como tira de variantes.
- **Retratos:** cualquier tamaño; se ajustan al recuadro conservando la proporción.
- **Cuadro de diálogo:** `ui/dialog.png` se estira al tamaño del cuadro.

### Textos

En `assets.json → text` se cambian el título, el nombre por defecto del héroe (el jugador puede escribir otro),
el nombre del compañero, del pueblo y de la mazmorra. El nombre de cada personaje del pueblo está en su entrada `name`.
