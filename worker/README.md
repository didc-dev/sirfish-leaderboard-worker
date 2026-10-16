# Sir Fish exterior leaderboard worker

The game runs in a sandbox with no network, and the building's lot script cannot read scores,
so the outside board can only change by republishing the building. This worker does that:

1. Every 60 s it reads the public weekly table (`GET https://project0.city/api/lots/3613/game`, no key).
2. If the visible ranking (owner row + top 5) changed, it renders `board.png` (`render_board.py`),
   stages `exterior/base` + `board.png`,
   validates, then publishes. Republish limit is 30/hour; it only publishes on a change.
3. Inside the game the board is already live (`p0.table`), no worker needed there.

## Building files
- `exterior/build_lot.py` regenerates the building (recovered from the 2026-10-12 session; the fake
  leaderboard bars were removed). `exterior/original/` keeps the published version untouched.
- `exterior/base/` is what the worker publishes: LODs + `lot.json` (Stone gets `textures.board`) +
  `stone.glsl`, which draws `board.png` on the right wing's front panel (x 4.9..8.0, y 1.0..3.4, z > 3.63 m).
  No extra material: LOD0 is already at its 4-material budget.
- Save a valid Project 0 key (Connect agent in the game) as one line in `%USERPROFILE%\.p0\project0.key`.

## Run
- `node worker.mjs --once --dry-run` builds the package in `stage/` without touching the API.
- `node worker.mjs --once` checks and publishes if changed; `--force` publishes anyway.
- `powershell -File install-task.ps1` runs it at logon in the background. Log: `worker.log`.
