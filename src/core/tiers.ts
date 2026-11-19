/** The merge chain: two bodies of one tier fuse into the next. */
export interface Tier {
  name: string;
  radius: number; // in world units (the dome is 400 wide)
  points: number; // points for making this body
  fact: string;
}

export const TIERS: Tier[] = [
  { name: 'Stardust', radius: 15, points: 1, fact: 'Most of the dust between stars is smaller than a grain of sand.' },
  { name: 'Pebble', radius: 20, points: 3, fact: 'Tiny space rocks that burn up in the sky are what we see as shooting stars.' },
  { name: 'Ice Shard', radius: 26, points: 6, fact: 'Comets are mostly ice and dust, like a dirty snowball.' },
  { name: 'Asteroid', radius: 33, points: 10, fact: 'Millions of asteroids orbit the Sun between Mars and Jupiter.' },
  { name: 'Moonlet', radius: 41, points: 15, fact: 'Some moonlets are so small that their gravity could not hold a person down.' },
  { name: 'Moon', radius: 51, points: 21, fact: 'Our Moon drifts about 4 cm farther from Earth every year.' },
  { name: 'Rocky Planet', radius: 62, points: 28, fact: 'Red planets get their colour from rusty, iron-rich dust.' },
  { name: 'Ocean Planet', radius: 75, points: 36, fact: 'Earth is the only planet we know with liquid water oceans on its surface.' },
  { name: 'Ringed Planet', radius: 90, points: 45, fact: 'Planet rings are made of countless chunks of ice and rock.' },
  { name: 'Gas Giant', radius: 108, points: 55, fact: 'A gas giant has no solid ground to stand on.' },
  { name: 'Star', radius: 128, points: 66, fact: 'A star shines because it fuses hydrogen into helium in its core.' },
];

export const STAR = TIERS.length - 1;
export const SUPERNOVA_BONUS = 500;
export const COMET = -1;

/** How often each droppable tier appears (tiers 0..4). */
export const DROP_WEIGHTS = [35, 30, 20, 10, 5];
export const COMET_EVERY = 40; // about one Comet per this many drops
