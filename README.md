# The Golden Child — A 90s Family Game Show

A complete, playable 3D browser game about four adult siblings, one foam slipper, and a deeply questionable competition for Dad's approval. Set in a 1995 Thanksgiving living room, it plays in portrait or landscape on phones and tablets as well as on desktop.

Pick Chad, Brad, Tad, or Stacy, then face four rounds of **Truth or Dare** against the other three siblings. Stop Dad's lie-detector needle in the green zone, or mash through a dare before his patience runs out. Fail, and the Slipper of Justice makes its opinion known.

## Play

- **Hosted:** [Open the game on OMGithub](https://go.ondev.store/mufukajonez/PlayGround).
- **Local:** run a static server from this folder, then open the printed URL:

```bash
python3 -m http.server 3000
# http://localhost:3000
```

The game uses JavaScript modules and a WebGL canvas, so it needs to be served over HTTP rather than opened as a `file://` page. There is no build step, package install, or external runtime asset.

## How to play

1. **Enter the living room** and choose one of the four siblings.
2. Each round, pick **Truth** or **Dare** when your turn comes up.
3. **Truth:** tap **STOP THE NEEDLE** (or press Space) when the needle crosses the green target. The small center band is a perfect hit.
4. **Dare:** tap **MASH!** (or press Space) as fast as possible to fill the nerve meter before the timer expires.
5. Watch the three AI siblings take their turns, then compare approval scores at the end. The highest score becomes the Golden Child and wins the last slice of pumpkin pie.

Every character has a small perk:

| Sibling | Perk |
| --- | --- |
| Chad | Starts with +8 approval |
| Brad | +1 bonus on perfect outcomes |
| Tad | Loses 4 less approval when he fails |
| Stacy | Wider truth target and an easier dare |

Player outcomes are **+13 / +20 / −7** approval for pass / perfect / fail. AI outcomes are **+8 / +13 / −6**. Scores are capped at 100. Failures add a comedic foam-slipper smack to the tally; they do not affect health or stop the game.

## Controls and layout

- Touch, mouse, and keyboard are all supported.
- Tap the large on-screen buttons, or use **Space** for the truth/dare actions.
- The HUD has **sound** and **help** buttons.
- Layouts respect safe-area insets and work in portrait phone, landscape phone, tablet, and desktop viewports.
- Audio starts after the first tap and can be muted at any time.

## Tech notes

- Three.js r160, vendored locally in `vendor/three.module.min.js`.
- 3D living room, characters, props, camera moves, slipper animation, and particle effects are generated procedurally in `js/world.js`.
- UI and responsive styling live in `index.html` and `css/style.css`.
- Game flow, AI turns, minigames, and scoring live in `js/main.js`; prompts and character data are in `js/data.js`.
- Music and sound effects are synthesized with the Web Audio API in `js/audio.js`.
- The display face is the bundled **Anton** font (`vendor/anton-latin.woff2`).

## Content note and assumptions

- The four siblings are adults (ages 21–24), and the game is a fictional, cartoon family sitcom.
- The slipper is explicitly foam and the smacks are comedic, non-graphic, and fully clothed.
- The game assumes a modern browser with WebGL and JavaScript modules enabled.
- Best experienced with sound on, but fully playable muted.

## Credits

- [Three.js](https://threejs.org/) — MIT License.
- **Anton** by The Anton Project Authors — SIL Open Font License 1.1. The license text is included at `vendor/OFL-Anton.txt`.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/mufukajonez/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/mufukajonez/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/mufukajonez/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/mufukajonez/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/mufukajonez/PlayGround).
- 🛠️ [Check build runs](https://github.com/mufukajonez/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/mufukajonez/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/mufukajonez).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->
