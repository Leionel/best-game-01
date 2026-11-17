[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Leionel/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Leionel/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# EMBERFALL — Survive the Swarm

A swarm-survivor roguelite for the make.fun best-game-01 bounty. You are the last
Warden of the Emberfall: the swarm comes at dusk, your embers answer on their own,
and you just have to keep moving. Last until dawn — 5:00 — and the night is yours.

## How to play

- **Move** — WASD or arrow keys.
- **Fight** — your weapons fire by themselves. Kill foes, collect the ember gems
  they drop, level up and choose upgrades.
- **Survive** — bosses wake at 1:00, 2:30 and 4:00. Survive to 5:00 to win.
- **Pause** — P or Esc. **Mute** — M. **Restart** — R.
- **Level up** — click a card or press 1 / 2 / 3.

Five weapons (Ember Bolt, Orbit Flames, Nova Pulse, Frost Shards, Meteor Call) and
five passives (Swift Boots, Ember Heart, Lodestone, Sharp Focus, Quick Hands), each
with five levels. Your best score is kept in localStorage.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files. Screenshots are staged
deterministically with `?shot=title|play|boss|over&seed=7` — the scene plays the
real rules forward from a seeded start and sets `window.__shotReady` when staged.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

MIT licensed. Original code, art and sound — every effect is synthesised with
WebAudio; every sprite is drawn in code.
