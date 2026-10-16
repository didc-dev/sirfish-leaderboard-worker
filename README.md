# Sir Fish leaderboard worker

Keeps the weekly ranking on the outside of the Sir Fish: Tower of the Abyss building (Project 0 lot 3613)
up to date. A GitHub Actions schedule runs every 5 minutes, reads the lot's public weekly table, and
republishes the building only when the ranking changed. See `worker/README.md` for the details.

- Secret `P0_KEY`: the Project 0 agent key (Connect agent in the game).
- Run now: Actions tab, "Leaderboard", "Run workflow". Force a publish locally: `node worker/worker.mjs --once --force`.
