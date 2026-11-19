# Stellar Drop

An original drop-and-merge physics puzzle for Android. Drop pieces into a glass dome; two of the same kind that touch merge into the next, bigger one, from Stardust all the way to a Star. Two Stars make a Supernova that clears the small pieces.

Free, personal project: no ads, no purchases. Everything is earned by playing.

## What's in the game

- **Classic**: endless run. The run ends when a piece rests above the dashed rim line for 3 seconds. One free **Second Chance** per run (a black hole swallows the small pieces).
- **Levels**: 30 levels with goals (make a piece, reach a score, make several of a piece) and a drop limit. 1 to 3 stars by drops left. Every 5th level is a challenge with a twist (no Gravity Pulse, no Comets, fast drops), and some have asteroid pegs or a narrow dome.
- **Minigames**: *Meteor Rush* (90 seconds, fast drops), *Tiny Dome* (narrow dome survival), *Zen Orbit* (no game over), *Star Catcher* (tap the falling pieces that match the target).
- **Challenges**: a Daily Challenge level made from the date, the Daily Constellation (same drops all day), 3 daily missions and 2 weekly missions that pay coins.
- **Gravity Pulse**: charges every 10 merges; makes every piece hop and resettle. **Comets** merge with whatever they hit first.
- **Power-ups** (coins only): Pop, Swap, Boost. **Shop**: dome skins. **Atlas**: collection of every piece.
- **Themes**: Space, Sea creatures, Gemstones and Sweets. Same rules, different pieces.
- **Music and sound**: a generative soundtrack made in code with Web Audio (a different style per mode, never loops the same way) and synth effects. A recorded track in `public/audio/music-<home|play|rush|zen|catcher>.mp3` replaces the generated one if present.
- **Animations**: pieces pop in, roll, blink and get excited when a twin is near; merge bursts, shockwaves, chain popups, screen shake, Supernova flash, comet tails.
- **Update notice**: on Android the game checks the `apk-latest` release and shows a Download bar when a newer build exists. GitHub only answers that check for public repositories, so it stays quiet while this repository is private; Settings also has an "Open the download page" button.

## Develop

```bash
npm install
npm run dev        # play in the browser
npm test           # rules, levels, missions, scoring
npm run build      # production web build in dist/
```

Code layout: `src/core/` is game logic with no UI (tiers, scoring, levels, missions); `src/game/` is the physics play screen (Matter.js), the Star Catcher minigame and the piece art (all drawn in code); `src/ui/` holds the menus; `src/audio.ts` the music and sound.

## Android

The Android app is the same web game wrapped with [Capacitor](https://capacitorjs.com/), set up the same way as the Mahjong project.

- **Download:** every push to the working branch builds an APK in GitHub Actions and publishes it on the **apk-latest** release: `https://github.com/antoniortizajoa160887-cloud/Games/releases/download/apk-latest/stellar-drop.apk` (sign in to GitHub first while the repository is private). Install it on your phone; you may need to allow installs from unknown sources.
- **Build it yourself** (needs Android Studio): `npm run android:sync`, then `npm run android:open` and press Run.
- The APK is signed with a fixed debug key committed in `android/app/stellardrop-debug.keystore`, so each new APK installs over the old one and keeps your progress.
- App icon and splash are drawn from the game's art: run `npx vite --port 5199`, then `node tools/make-icons.cjs`.
