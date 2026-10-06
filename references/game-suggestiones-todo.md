# Sugerencias de juegos (game-planner)

Lista mantenida por el agente `game-planner`. Flujo: `/add-game <ref>` → revisar spec → `/spec-impl`.

## Pendientes

- [ ] **DUELO PIXEL** (`duelo-pixel`, VERSUS, `yellow`) — recomendado · total 27/30 · 2026-10-06 · único juego que cubre el hueco VERSUS y el color `yellow`; Pong contra CPU, sin assets, `cover-duelo` ya existe · re-confirmado 2026-10-06 (sin cambios: catálogo en BD sigue en 4 juegos, sin respuesta del usuario) · siguiente paso `/add-game "Duelo Pixel: Pong 1 jugador vs CPU, VERSUS, yellow, cover-duelo"`
- [ ] **INVASORES** (`invasores`, SHOOTER, `yellow`) — candidato · total 26/30 · 2026-10-06 · score natural y contrato sencillo, pero repite SHOOTER; `cover-invaders` ya existe · siguiente paso `/add-game "Invasores: Space Invaders, SHOOTER, yellow, cover-invaders"`
- [ ] **GLOTÓN** (`gloton`, ARCADE, `yellow`) — candidato · total 24/30 · 2026-10-06 · buen score y `cover-glot` existe, pero sería el 3er ARCADE y la IA de fantasmas + laberinto es el mayor esfuerzo · siguiente paso `/add-game "Glotón: Pac-Man, ARCADE, yellow, cover-glot"`

### Tanda de 20 (2026-10-06, 4 ejecuciones en paralelo por categoría)

INVASORES y GLOTÓN se repitieron en la tanda (sin cambios, ver arriba). Ojo: varios candidatos compiten por `yellow`; si se elige uno, conviene pasar los demás a otro color.

**VERSUS**

- [ ] **SQUASH NEÓN** (`squash-neon`, VERSUS, `cyan`) — candidato · total 27/30 · 2026-10-06 · Pong de pared de una pala, físicas simples, sin IA · siguiente paso `/add-game "Squash Neón: Pong de pared, VERSUS, cyan"`
- [ ] **CICLOS TRON** (`tron-ciclos`, VERSUS, `yellow`) — candidato · total 27/30 · 2026-10-06 · duelo de estelas contra CPU, neón puro, sin assets · siguiente paso `/add-game "Ciclos Tron: duelo de estelas vs CPU, VERSUS, yellow"`
- [ ] **AIR HOCKEY** (`air-hockey`, VERSUS, `magenta`) — candidato · total 26/30 · 2026-10-06 · duelo de mesa contra CPU · siguiente paso `/add-game "Air Hockey vs CPU, VERSUS, magenta"`
- [ ] **DUELO DE TANQUES** (`tanques-duelo`, VERSUS, `green`) — candidato · total 23/30 · 2026-10-06 · arena con balas rebotantes; IA de apuntado es el mayor esfuerzo · siguiente paso `/add-game "Duelo de Tanques, VERSUS, green"`
- [ ] **PIXEL FIGHTERS** (`pixel-fighters`, VERSUS, `magenta`) — candidato · total 20/30 · 2026-10-06 · lucha 1v1, requiere sprites e IA con estados · siguiente paso `/add-game "Pixel Fighters, VERSUS, magenta"`

**SHOOTER**

- [ ] **GALAXIA** (`galaxia`, SHOOTER, `magenta`) — candidato · total 25/30 · 2026-10-06 · Galaga con formaciones y picados; sin cover · siguiente paso `/add-game "Galaxia: Galaga, SHOOTER, magenta"`
- [ ] **COMANDO MISIL** (`comando-misil`, SHOOTER, `green`) — candidato · total 25/30 · 2026-10-06 · Missile Command, mecánica distinta a Asteroids · siguiente paso `/add-game "Comando Misil, SHOOTER, green"`
- [ ] **CIEMPIÉS** (`ciempies`, SHOOTER, `green`) — candidato · total 25/30 · 2026-10-06 · Centipede en una pantalla con campo de setas · siguiente paso `/add-game "Ciempiés: Centipede, SHOOTER, green"`
- [ ] **NOVA** (`nova`, SHOOTER, `magenta`) — candidato · total 23/30 · 2026-10-06 · shoot'em up vertical con power-ups; el más difícil de ajustar · siguiente paso `/add-game "Nova: shoot'em up vertical, SHOOTER, magenta"`

**PUZZLE**

- [ ] **COLUMNAS** (`columnas`, PUZZLE, `magenta`) — candidato · total 26/30 · 2026-10-06 · Columns con gemas neón; misma familia que Tetris · siguiente paso `/add-game "Columnas: Columns, PUZZLE, magenta, cover nuevo"`
- [ ] **2048** (`dosmil`, PUZZLE, `yellow`) — candidato · total 26/30 · 2026-10-06 · solo flechas, lógica mínima, menor riesgo técnico; id `dosmil` para evitar problemas de rutas · siguiente paso `/add-game "2048: PUZZLE, yellow, cover nuevo"`
- [ ] **PÍLDORAS** (`virus`, PUZZLE, `magenta`) — candidato · total 24/30 · 2026-10-06 · estilo Dr. Mario; cae como Tetris, más lógica · siguiente paso `/add-game "Píldoras: Dr. Mario, PUZZLE, magenta"`
- [ ] **GEMAS** (`gemas`, PUZZLE, `green`) — candidato · total 24/30 · 2026-10-06 · match-3 contrarreloj 90 s; mejor con ratón · siguiente paso `/add-game "Gemas: match-3, PUZZLE, green"`
- [ ] **BUSCAMINAS** (`buscaminas`, PUZZLE, `green`) — candidato · total 21/30 · 2026-10-06 · se juega con ratón, score competitivo más débil · siguiente paso `/add-game "Buscaminas, PUZZLE, green"`

**ARCADE**

- [ ] **CORREDOR NEÓN** (`dino-run`, ARCADE, `yellow`) — candidato · total 27/30 · 2026-10-06 · endless runner de un botón, sin assets · siguiente paso `/add-game "Corredor Neón: endless runner, ARCADE, yellow"`
- [ ] **RANA** (`rana`, ARCADE, `yellow`) — candidato · total 26/30 · 2026-10-06 · Frogger; `cover-rana` ya existe · siguiente paso `/add-game "Rana: Frogger, ARCADE, yellow, cover-rana"`
- [ ] **ALETEO** (`aleteo`, ARCADE, `yellow`) — candidato · total 26/30 · 2026-10-06 · estilo Flappy; se parece a Corredor Neón, elegir uno · siguiente paso `/add-game "Aleteo: Flappy, ARCADE, yellow"`
- [ ] **BARRILES** (`barriles`, ARCADE, `magenta`) — candidato · total 22/30 · 2026-10-06 · estilo Donkey Kong, física compleja y sin referencia · siguiente paso `/add-game "Barriles: Donkey Kong, ARCADE, magenta"`

## Aceptados

## Rechazados / Implementados

- [x] **ASTEROIDS** (`asteroids`, SHOOTER, `cyan`) — implementado
- [x] **TETRIS** (`tetris`, PUZZLE, `cyan`) — implementado
- [x] **ARKANOID** (`arkanoid`, ARCADE, `magenta`) — implementado
- [x] **SNAKE** (`snake`, ARCADE, `green`) — implementado

## Preferencias del usuario

- (Sin preferencias declaradas aún.) Nota 2026-10-06: `references/started-games/` ya no tiene referencias pendientes de portar (asteroids, tetris y arkanoid ya implementados); los candidatos salen del catálogo original de `references/templates/data.jsx`, que ya tiene cover CSS.
