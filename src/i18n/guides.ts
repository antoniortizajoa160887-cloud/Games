/**
 * How to play guides for new players, in English and Spanish. Each game has the same sections:
 * goal, steps, controls, specials, scoring and Luma's tips. {top} is replaced with the name of the
 * biggest piece in the current theme (the Star in Space).
 */

export type GuideId =
  | 'drop' | 'rush' | 'tiny' | 'zen' | 'catcher'
  | 'fusion' | 'blocks' | 'bubbles' | 'snake' | 'match3' | 'pairs';

export interface Guide {
  /** One sentence: what you are trying to do. */
  goal: string;
  /** How a game goes, step by step, for someone who has never played. */
  steps: string[];
  /** Taps, swipes and buttons: [name, what it does]. */
  controls: [string, string][];
  /** Special pieces, power-ups and twists: [name, what it does]. */
  specials?: [string, string][];
  /** How points, stars and coins are earned. */
  scoring: string[];
  tips: string[];
}

export const GUIDES_EN: Record<GuideId, Guide> = {
  drop: {
    goal: 'Drop pieces into the dome. Two of the same piece merge into a bigger one. Keep merging up to the {top}!',
    steps: [
      'Drag your finger left and right to aim, then let go to drop the piece.',
      'When two of the same piece touch, they merge into the next, bigger piece.',
      'Bigger pieces take more room, so plan where each one lands.',
      'Keep everything below the dashed line. If a piece stays above it for 3 seconds, the dome overflows and the game ends.',
      'Two {top}s merging make a giant burst worth 500 bonus points.',
    ],
    controls: [
      ['Drag and let go', 'Aim the piece and drop it.'],
      ['Next', 'The box at the top right shows the piece that comes after this one.'],
      ['✦ Gravity Pulse', 'Charges every 10 merges (up to 2). Tap it to shake the pieces down and make room.'],
      ['II', 'Pause, restart, change the volume or quit.'],
      ['?', 'Opens this guide at any time.'],
    ],
    specials: [
      ['Comet', 'Merges with any piece it touches and turns it into the next piece up.'],
      ['💥 Pop', 'Removes one piece you tap. (Classic only.)'],
      ['🔄 Swap', 'Changes the piece you are about to drop. (Classic only.)'],
      ['⏫ Boost', 'Levels up one piece you tap. (Classic only.)'],
      ['Second Chance', 'Once per Classic game, when the dome overflows, a black hole swallows the smallest pieces so you can keep going.'],
      ['Levels', 'Each level has a goal (make a piece, make several, or reach a score) and a set number of drops.'],
      ['Challenges', 'Every 5th level adds a twist: no Gravity Pulse, no Comets, fast drops, a narrow dome or asteroid pegs.'],
      ['Daily', 'The Daily Challenge is a new goal every day (100 coins). The Daily Constellation gives everyone the same drops all day.'],
    ],
    scoring: [
      'Every merge scores points. Bigger pieces score more.',
      'Merges made quickly one after another are a chain: ×1.2, ×1.5, then ×2 points.',
      'The first time in a game you make a big piece, you get a bonus.',
      'Levels: ★★★ if you finish with 40% of your drops left, ★★ with 20%, ★ for any win.',
      'Every 100 points earns 1 coin. Spend coins in the Shop on dome skins and power-ups.',
    ],
    tips: [
      'Keep big pieces in the corners and small ones in the middle.',
      'Look at the Next box before you drop, so you can set up the next merge.',
      'Save the Gravity Pulse for when the pile gets close to the line.',
      'New pieces you make are added to the Atlas, with a fun fact for each one.',
    ],
  },
  rush: {
    goal: 'Score as many points as you can in 90 seconds.',
    steps: [
      'It plays like Classic: drag to aim, let go to drop, and the same pieces merge.',
      'Drops come faster, and only the four smallest pieces fall.',
      'The game ends when the time runs out, or if the dome overflows.',
    ],
    controls: [
      ['Drag and let go', 'Aim the piece and drop it.'],
      ['✦ Gravity Pulse', 'Charges every 10 merges. Tap it to shake the pieces down.'],
      ['II', 'Pause the clock.'],
    ],
    scoring: ['Points work like Classic, so fast chains are worth a lot.', 'Every 100 points earns 1 coin.'],
    tips: ['Don\'t wait for the perfect spot. Speed matters more here.', 'Drop pieces right next to their twins to keep chains going.'],
  },
  tiny: {
    goal: 'Survive as long as you can in a narrow dome.',
    steps: [
      'It plays like Classic, but the dome is much narrower.',
      'Only the four smallest pieces fall, so you have to build up.',
      'If a piece stays above the dashed line for 3 seconds, it\'s over (you get one Second Chance).',
    ],
    controls: [
      ['Drag and let go', 'Aim the piece and drop it.'],
      ['✦ Gravity Pulse', 'Charges every 10 merges. Tap it to shake the pieces down.'],
    ],
    scoring: ['Points work like Classic.', 'Every 100 points earns 1 coin.'],
    tips: ['Stack pieces in size order from one side to the other.', 'Merge often. A tall tower fills the dome fast.'],
  },
  zen: {
    goal: 'Relax and merge. There is no game over and no timer.',
    steps: [
      'Drag to aim and let go to drop, just like Classic.',
      'The dome never overflows, so take your time.',
      'Leave whenever you like with II, then Quit.',
    ],
    controls: [['Drag and let go', 'Aim the piece and drop it.'], ['✦ Gravity Pulse', 'Shakes the pieces down.']],
    scoring: ['You still score points and earn coins for every merge.'],
    tips: ['Zen is a good place to practise big chains without any pressure.'],
  },
  catcher: {
    goal: 'Tap the falling pieces that match the target. You have 60 seconds.',
    steps: [
      'The Catch box at the top shows the piece to catch.',
      'Pieces fall from the top. Tap the ones that match the target.',
      'Tapping the wrong piece costs 15 points and 2 seconds, and breaks your streak.',
      'The target changes every 6 catches, and the pieces fall faster near the end.',
    ],
    controls: [['Tap', 'Catch a falling piece.'], ['II', 'Pause the clock.']],
    scoring: ['Each catch scores 10 points, plus a bonus for your streak (🔥).', 'Letting a target piece fall past the bottom resets the streak.', 'Every 20 points earns 1 coin.'],
    tips: ['Watch the Catch box: the target changes every 6 catches.', 'Accuracy beats speed. Streaks add up quickly.'],
  },
  fusion: {
    goal: 'Swipe the board so matching pieces merge. Keep merging up to the {top}!',
    steps: [
      'Swipe up, down, left or right on the 4×4 board. Every piece slides as far as it can that way.',
      'When two of the same piece meet, they merge into the next, bigger piece.',
      'After every swipe, a new small piece appears in an empty spot.',
      'The game ends when the board is full and no swipe can merge anything.',
    ],
    controls: [['Swipe', 'Slides every piece on the board.'], ['II', 'Pause, restart or quit.']],
    scoring: ['Every merge scores the points of the new piece.', 'Every 40 points earns 1 coin.'],
    tips: ['Keep your biggest piece in one corner and build towards it.', 'Try to use only two or three directions, so the big piece never leaves its corner.'],
  },
  blocks: {
    goal: 'Place shapes on the 8×8 grid. Fill whole rows or columns to clear them.',
    steps: [
      'Three shapes wait at the bottom. Drag one onto the grid and let go.',
      'A full row or column, from one side to the other, clears away.',
      'When all three shapes are placed, you get three new ones.',
      'The game ends when none of your shapes fits anywhere on the grid.',
    ],
    controls: [['Drag and let go', 'Places a shape. It shows above your finger so you can see where it lands.'], ['II', 'Pause, restart or quit.']],
    scoring: [
      'Each square you place is worth 1 point.',
      'Clearing several lines at once is worth much more.',
      'Clearing lines on turns in a row builds a combo that multiplies your points.',
      'Every 10 points earns 1 coin.',
    ],
    tips: ['Keep a space free for the big 3×3 square and long lines.', 'Don\'t leave single holes. They are hard to fill.'],
  },
  bubbles: {
    goal: 'Shoot pieces at the board. Groups of three or more of the same piece pop.',
    steps: [
      'Drag on the screen to aim. The dotted line shows where the shot goes.',
      'Let go to shoot. Shots bounce off the side walls.',
      'Hit a group of the same piece so there are three or more together, and they pop.',
      'Pieces left hanging with nothing holding them fall off for bonus points.',
      'Every 5 shots that don\'t pop anything, a new row comes down.',
      'If the pieces reach the red dashed line, the game ends.',
    ],
    controls: [['Drag', 'Aim.'], ['Let go', 'Shoot.'], ['Next', 'Shows the piece you shoot after this one.']],
    scoring: [
      'Each popped piece scores 10 points. Each falling piece scores 20.',
      'Popping 6 or more at once adds a 50 point bonus.',
      'Clear the whole board for 500 points and a fresh board.',
      'Every 15 points earns 1 coin.',
    ],
    tips: ['Bounce shots off the walls to reach tight spots.', 'Aim for pieces that hold up big clusters. Everything below them falls.'],
  },
  snake: {
    goal: 'Steer the comet around the board, collect pieces and grow the longest trail you can.',
    steps: [
      'Swipe to start. The comet moves on its own in the direction you choose.',
      'Swipe up, down, left or right to turn.',
      'Every piece you collect joins your trail and makes it longer.',
      'The game ends if you hit a wall or your own trail.',
      'The comet speeds up as your trail grows.',
    ],
    controls: [['Swipe', 'Turn the comet. Swipe anywhere on the screen.'], ['II', 'Pause, restart or quit.']],
    specials: [['Bonus {top}', 'Sometimes appears for 6 seconds and is worth 250 points. It blinks just before it goes.']],
    scoring: ['Bigger pieces are worth more points.', 'Every 15 points earns 1 coin.'],
    tips: ['Stay near the middle and avoid the edges when your trail is long.', 'Plan your turns early. You can queue two turns ahead.'],
  },
  match3: {
    goal: 'Swap pieces to line up three or more of the same. Score as much as you can in 30 moves.',
    steps: [
      'Swap two pieces that are next to each other by swiping one towards the other.',
      'A swap only counts if it lines up three or more of the same piece in a row or column.',
      'Matched pieces clear away, the ones above fall down and new ones drop in.',
      'New lines made by falling pieces clear too, as a chain.',
      'The game ends when your 30 moves are used up.',
    ],
    controls: [['Swipe or tap two pieces', 'Swaps neighbours.'], ['Hint', 'If you don\'t move for 5 seconds, a possible swap glows.']],
    specials: [['Reshuffle', 'If no swap is possible, the board mixes itself up for free.']],
    scoring: ['Longer lines score more.', 'Chains from falling pieces multiply your points.', 'Every 20 points earns 1 coin.'],
    tips: ['Look near the bottom first. Matches there make more pieces fall, which can start chains.', 'Lines of 4 or 5 are worth much more than lines of 3.'],
  },
  pairs: {
    goal: 'Flip the cards and find every matching pair before time runs out.',
    steps: [
      'Tap a card to flip it, then tap another.',
      'If the two cards match, they stay face up. If not, they flip back.',
      'Clear the whole board to get a new board and 15 more seconds.',
      'You start with 60 seconds. The game ends when the time reaches 0.',
    ],
    controls: [['Tap', 'Flips a card.'], ['II', 'Pause the clock.']],
    scoring: ['Each pair scores 50 points, more if you find pairs one after another.', 'Every second left when you clear a board adds 5 points.', 'Every 25 points earns 1 coin.'],
    tips: ['Remember where each card was, even the ones that didn\'t match.', 'Start in a corner and work across the board in order.'],
  },
};

export const GUIDES_ES: Record<GuideId, Guide> = {
  drop: {
    goal: 'Lanza piezas a la cúpula. Dos piezas iguales se fusionan en una más grande. ¡Sigue fusionando hasta llegar a {top}!',
    steps: [
      'Arrastra el dedo a izquierda y derecha para apuntar, y suelta para lanzar la pieza.',
      'Cuando dos piezas iguales se tocan, se fusionan en la siguiente pieza, más grande.',
      'Las piezas grandes ocupan más sitio, así que piensa dónde cae cada una.',
      'Mantén todo por debajo de la línea punteada. Si una pieza se queda encima 3 segundos, la cúpula se desborda y se acaba la partida.',
      'Al fusionar dos {top} se produce una gran explosión que vale 500 puntos extra.',
    ],
    controls: [
      ['Arrastra y suelta', 'Apunta y lanza la pieza.'],
      ['Siguiente', 'El recuadro de arriba a la derecha muestra la pieza que viene después.'],
      ['✦ Pulso de Gravedad', 'Se carga cada 10 fusiones (hasta 2). Tócalo para sacudir las piezas hacia abajo y hacer sitio.'],
      ['II', 'Pausa, reinicia, cambia el volumen o sal.'],
      ['?', 'Abre esta guía cuando quieras.'],
    ],
    specials: [
      ['Cometa', 'Se fusiona con cualquier pieza que toque y la convierte en la siguiente pieza.'],
      ['💥 Explotar', 'Quita una pieza que toques. (Solo en Clásico.)'],
      ['🔄 Cambiar', 'Cambia la pieza que vas a lanzar. (Solo en Clásico.)'],
      ['⏫ Subir', 'Sube de nivel una pieza que toques. (Solo en Clásico.)'],
      ['Segunda oportunidad', 'Una vez por partida de Clásico, cuando la cúpula se desborda, un agujero negro se traga las piezas más pequeñas para que sigas jugando.'],
      ['Niveles', 'Cada nivel tiene un objetivo (hacer una pieza, hacer varias o llegar a una puntuación) y un número fijo de lanzamientos.'],
      ['Desafíos', 'Cada 5 niveles hay un cambio: sin Pulso de Gravedad, sin cometas, caídas rápidas, una cúpula estrecha o asteroides fijos.'],
      ['Diario', 'El Desafío diario es un objetivo nuevo cada día (100 monedas). La Constelación diaria da a todos las mismas piezas durante el día.'],
    ],
    scoring: [
      'Cada fusión da puntos. Las piezas más grandes dan más.',
      'Las fusiones rápidas, una tras otra, forman una cadena: ×1,2, ×1,5 y luego ×2 puntos.',
      'La primera vez en una partida que haces una pieza grande, ganas un extra.',
      'Niveles: ★★★ si terminas con el 40% de los lanzamientos sin usar, ★★ con el 20%, ★ por ganar.',
      'Cada 100 puntos ganas 1 moneda. Gástalas en la Tienda en diseños de cúpula y ayudas.',
    ],
    tips: [
      'Deja las piezas grandes en las esquinas y las pequeñas en el centro.',
      'Mira el recuadro Siguiente antes de lanzar, para preparar la próxima fusión.',
      'Guarda el Pulso de Gravedad para cuando el montón se acerque a la línea.',
      'Cada pieza nueva que haces se añade al Atlas, con un dato curioso.',
    ],
  },
  rush: {
    goal: 'Consigue todos los puntos que puedas en 90 segundos.',
    steps: [
      'Se juega como el Clásico: arrastra para apuntar, suelta para lanzar, y las piezas se fusionan igual.',
      'Las piezas salen más rápido y solo caen las cuatro más pequeñas.',
      'La partida acaba cuando se termina el tiempo, o si la cúpula se desborda.',
    ],
    controls: [
      ['Arrastra y suelta', 'Apunta y lanza la pieza.'],
      ['✦ Pulso de Gravedad', 'Se carga cada 10 fusiones. Tócalo para sacudir las piezas hacia abajo.'],
      ['II', 'Para el reloj.'],
    ],
    scoring: ['Los puntos funcionan como en el Clásico, así que las cadenas rápidas valen mucho.', 'Cada 100 puntos ganas 1 moneda.'],
    tips: ['No esperes al sitio perfecto. Aquí importa más la velocidad.', 'Lanza las piezas junto a su pareja para mantener las cadenas.'],
  },
  tiny: {
    goal: 'Aguanta todo lo que puedas en una cúpula estrecha.',
    steps: [
      'Se juega como el Clásico, pero la cúpula es mucho más estrecha.',
      'Solo caen las cuatro piezas más pequeñas, así que tienes que ir subiendo.',
      'Si una pieza se queda encima de la línea punteada 3 segundos, se acaba (tienes una Segunda oportunidad).',
    ],
    controls: [
      ['Arrastra y suelta', 'Apunta y lanza la pieza.'],
      ['✦ Pulso de Gravedad', 'Se carga cada 10 fusiones. Tócalo para sacudir las piezas hacia abajo.'],
    ],
    scoring: ['Los puntos funcionan como en el Clásico.', 'Cada 100 puntos ganas 1 moneda.'],
    tips: ['Coloca las piezas por tamaño, de un lado al otro.', 'Fusiona a menudo. Una torre alta llena la cúpula enseguida.'],
  },
  zen: {
    goal: 'Relájate y fusiona piezas. No hay fin de partida ni reloj.',
    steps: [
      'Arrastra para apuntar y suelta para lanzar, igual que en el Clásico.',
      'La cúpula nunca se desborda, así que tómatelo con calma.',
      'Sal cuando quieras con II y luego Salir.',
    ],
    controls: [['Arrastra y suelta', 'Apunta y lanza la pieza.'], ['✦ Pulso de Gravedad', 'Sacude las piezas hacia abajo.']],
    scoring: ['Sigues ganando puntos y monedas con cada fusión.'],
    tips: ['Zen es un buen sitio para practicar cadenas largas sin presión.'],
  },
  catcher: {
    goal: 'Toca las piezas que caen y que coinciden con el objetivo. Tienes 60 segundos.',
    steps: [
      'El recuadro Atrapa de arriba muestra la pieza que debes atrapar.',
      'Las piezas caen desde arriba. Toca las que coinciden con el objetivo.',
      'Si tocas una pieza equivocada, pierdes 15 puntos, 2 segundos y la racha.',
      'El objetivo cambia cada 6 piezas atrapadas y las piezas caen más rápido al final.',
    ],
    controls: [['Toca', 'Atrapa una pieza que cae.'], ['II', 'Para el reloj.']],
    scoring: ['Cada pieza atrapada da 10 puntos, más un extra por tu racha (🔥).', 'Si una pieza objetivo se escapa por abajo, la racha vuelve a cero.', 'Cada 20 puntos ganas 1 moneda.'],
    tips: ['Fíjate en el recuadro Atrapa: el objetivo cambia cada 6 piezas.', 'Mejor acertar que correr. Las rachas suman muy rápido.'],
  },
  fusion: {
    goal: 'Desliza el tablero para que las piezas iguales se fusionen. ¡Sigue fusionando hasta llegar a {top}!',
    steps: [
      'Desliza hacia arriba, abajo, izquierda o derecha en el tablero de 4×4. Todas las piezas se mueven hasta donde pueden.',
      'Cuando dos piezas iguales se encuentran, se fusionan en la siguiente, más grande.',
      'Tras cada movimiento aparece una pieza pequeña nueva en un hueco libre.',
      'La partida acaba cuando el tablero está lleno y ningún movimiento fusiona nada.',
    ],
    controls: [['Desliza', 'Mueve todas las piezas del tablero.'], ['II', 'Pausa, reinicia o sal.']],
    scoring: ['Cada fusión da los puntos de la pieza nueva.', 'Cada 40 puntos ganas 1 moneda.'],
    tips: ['Deja tu pieza más grande en una esquina y construye hacia ella.', 'Intenta usar solo dos o tres direcciones, para que la pieza grande no salga de su esquina.'],
  },
  blocks: {
    goal: 'Coloca formas en el tablero de 8×8. Llena filas o columnas enteras para borrarlas.',
    steps: [
      'Abajo esperan tres formas. Arrastra una al tablero y suéltala.',
      'Una fila o columna llena, de lado a lado, desaparece.',
      'Cuando colocas las tres formas, recibes tres nuevas.',
      'La partida acaba cuando ninguna de tus formas cabe en el tablero.',
    ],
    controls: [['Arrastra y suelta', 'Coloca una forma. Se ve encima de tu dedo para que sepas dónde cae.'], ['II', 'Pausa, reinicia o sal.']],
    scoring: [
      'Cada casilla que colocas vale 1 punto.',
      'Borrar varias líneas a la vez vale mucho más.',
      'Borrar líneas en turnos seguidos crea un combo que multiplica tus puntos.',
      'Cada 10 puntos ganas 1 moneda.',
    ],
    tips: ['Deja sitio libre para el cuadrado grande de 3×3 y las líneas largas.', 'No dejes huecos sueltos. Son difíciles de llenar.'],
  },
  bubbles: {
    goal: 'Dispara piezas al tablero. Los grupos de tres o más piezas iguales explotan.',
    steps: [
      'Arrastra en la pantalla para apuntar. La línea de puntos muestra adónde va el disparo.',
      'Suelta para disparar. Los disparos rebotan en las paredes.',
      'Junta tres o más piezas iguales y explotarán.',
      'Las piezas que se quedan colgando sin nada que las sujete caen y dan puntos extra.',
      'Cada 5 disparos sin explotar nada, baja una fila nueva.',
      'Si las piezas llegan a la línea roja discontinua, se acaba la partida.',
    ],
    controls: [['Arrastra', 'Apunta.'], ['Suelta', 'Dispara.'], ['Sigue', 'Muestra la pieza que disparas después.']],
    scoring: [
      'Cada pieza que explota da 10 puntos. Cada pieza que cae da 20.',
      'Explotar 6 o más de golpe suma 50 puntos extra.',
      'Limpia todo el tablero para ganar 500 puntos y un tablero nuevo.',
      'Cada 15 puntos ganas 1 moneda.',
    ],
    tips: ['Rebota en las paredes para llegar a sitios difíciles.', 'Apunta a las piezas que sujetan grupos grandes. Todo lo de debajo caerá.'],
  },
  snake: {
    goal: 'Guía el cometa por el tablero, recoge piezas y haz la estela más larga que puedas.',
    steps: [
      'Desliza para empezar. El cometa avanza solo en la dirección que elijas.',
      'Desliza hacia arriba, abajo, izquierda o derecha para girar.',
      'Cada pieza que recoges se suma a tu estela y la hace más larga.',
      'La partida acaba si chocas con una pared o con tu propia estela.',
      'El cometa va más rápido a medida que crece la estela.',
    ],
    controls: [['Desliza', 'Gira el cometa. Puedes deslizar en cualquier parte de la pantalla.'], ['II', 'Pausa, reinicia o sal.']],
    specials: [['{top} extra', 'A veces aparece durante 6 segundos y vale 250 puntos. Parpadea justo antes de irse.']],
    scoring: ['Las piezas más grandes dan más puntos.', 'Cada 15 puntos ganas 1 moneda.'],
    tips: ['Quédate cerca del centro y evita los bordes cuando la estela sea larga.', 'Planea los giros con tiempo. Puedes adelantar dos giros.'],
  },
  match3: {
    goal: 'Intercambia piezas para juntar tres o más iguales. Consigue todos los puntos que puedas en 30 movimientos.',
    steps: [
      'Intercambia dos piezas vecinas deslizando una hacia la otra.',
      'Un cambio solo vale si junta tres o más piezas iguales en una fila o columna.',
      'Las piezas que coinciden desaparecen, las de arriba caen y entran piezas nuevas.',
      'Las nuevas líneas que se forman al caer también desaparecen, en cadena.',
      'La partida acaba cuando gastas los 30 movimientos.',
    ],
    controls: [['Desliza o toca dos piezas', 'Intercambia piezas vecinas.'], ['Pista', 'Si no te mueves en 5 segundos, brilla un cambio posible.']],
    specials: [['Mezcla', 'Si no hay ningún cambio posible, el tablero se mezcla solo y gratis.']],
    scoring: ['Las líneas más largas dan más puntos.', 'Las cadenas al caer las piezas multiplican tus puntos.', 'Cada 20 puntos ganas 1 moneda.'],
    tips: ['Mira primero cerca de abajo. Las líneas ahí hacen caer más piezas y pueden empezar cadenas.', 'Las líneas de 4 o 5 valen mucho más que las de 3.'],
  },
  pairs: {
    goal: 'Da la vuelta a las cartas y encuentra todas las parejas antes de que se acabe el tiempo.',
    steps: [
      'Toca una carta para darle la vuelta y luego toca otra.',
      'Si las dos coinciden, se quedan boca arriba. Si no, se vuelven a girar.',
      'Completa todo el tablero para tener uno nuevo y 15 segundos más.',
      'Empiezas con 60 segundos. La partida acaba cuando el tiempo llega a 0.',
    ],
    controls: [['Toca', 'Da la vuelta a una carta.'], ['II', 'Para el reloj.']],
    scoring: ['Cada pareja da 50 puntos, y más si encuentras parejas seguidas.', 'Cada segundo que te sobra al completar un tablero suma 5 puntos.', 'Cada 25 puntos ganas 1 moneda.'],
    tips: ['Recuerda dónde estaba cada carta, también las que no coincidieron.', 'Empieza por una esquina y recorre el tablero en orden.'],
  },
};
