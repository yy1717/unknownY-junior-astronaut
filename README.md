# unknownY — Junior Astronaut Mission Trainer

**unknownY** is a browser-based pixel-art educational game created for the **2026 NASA International Space Apps Challenge — Build a Junior Astronaut Mission Trainer** challenge.

Players ages 7–12 choose a Moon or Mars outpost, explore the base as a junior commander, and learn how real mission systems depend on one another. The game combines resource management, environmental hazards, NASA space-weather data, and an optional space-science learning library.

## Playable systems

- Moon / Mars mission selection with different environmental rules
- Battery and solar-power budgeting
- ECLSS life support: oxygen, carbon dioxide, and water
- Greenhouse food production and crew health
- Radiation shelter gameplay driven by NASA DONKI SEP training data
- Moon local-shadow and Mars dust events
- Moon / Mars communication-delay differences
- Three-cycle mission loop, research upgrades, stars, win/fail states
- Space Notes collectibles and a Space Lab educational library
- Local browser save using `localStorage`; no account is required

## NASA data and resources

The project uses **NASA DONKI (Database Of Notifications, Knowledge, Information)** Solar Energetic Particle (SEP) data for space-weather training.

- NASA Open APIs: https://api.nasa.gov/
- NASA DONKI: https://kauai.ccmc.gsfc.nasa.gov/DONKI/

On Vercel, the browser calls a server-side `/api/nasa/sep` proxy that uses a private `NASA_API_KEY` stored as a Vercel Secret. The private key is never bundled into client JavaScript. Local webpack development can fall back to NASA's public `DEMO_KEY`, which still returns real NASA data but has lower rate limits. A verified historical NASA DONKI SEP event is retained as a clearly labelled training fallback if the API is temporarily unavailable.

## Technology

- Phaser 4
- TypeScript
- Webpack
- VT323 font via Google Fonts
- Browser `localStorage`

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The deployable files are generated in `dist/`.

## Controls

- `WASD` / Arrow keys — Move
- `E` — Use / interact
- `L` — Learn near a facility
- `R` — Toggle ECLSS where applicable
- `K` — Open Space Notes
- `ESC` — Close learning panels

## AI / Super Intelligence assistance disclosure

ChatGPT and Codex were used as development assistants for brainstorming, code iteration, debugging, educational copy refinement, and UI/UX implementation support. The project's concept, scope decisions, testing, integration, and final submission are directed by the project creator. The project does not use NASA logos, mission insignia, or other NASA branding as generated visual elements.

## External resources / credits

- Phaser game framework: https://phaser.io/
- Phaser Webpack TypeScript template (initial project scaffold): https://github.com/phaserjs/template-webpack
- VT323 font by Peter Hull / Google Fonts: https://fonts.google.com/specimen/VT323
- NASA Open APIs / DONKI data: https://api.nasa.gov/

## Privacy

The game requires no account, password, email address, or user profile. Mission progress is stored only in the player's browser with `localStorage`.

## License and attribution

The project was scaffolded from the MIT-licensed Phaser Webpack TypeScript template. Phaser and third-party resources remain subject to their respective licenses.

## Vercel deployment and NASA API key

Production uses a Vercel Function at `/api/nasa/sep` so the private NASA API key never ships in the browser bundle.

1. Generate a fresh NASA API key at `https://api.nasa.gov/`.
2. Import this repository into Vercel.
3. In **Project → Settings → Environment Variables**, add `NASA_API_KEY` as a **Secret** for Production (and Preview if desired).
4. Deploy or redeploy. Environment-variable changes take effect on the next deployment.

Local `npm run dev` uses the public NASA `DEMO_KEY` only when the Vercel proxy is unavailable. This still returns real NASA DONKI data, but has lower rate limits. The radiation training scenario also has a clearly labelled historical fallback for temporary API outages.
