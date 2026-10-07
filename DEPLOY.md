# Publishing the website

The site is static. `node scripts/stage-site.mjs` copies only the public files (listed in that script) into `dist-site/`, and `wrangler.jsonc` serves that folder as a Cloudflare Worker named `hahn-heroes-site`.

- Build command: `node scripts/stage-site.mjs`
- Deploy command: `npx wrangler deploy`
- Nothing here deploys automatically yet. Hosting today is still ChatGPT Sites; moving hahnheroes.com to this Worker is a separate step that needs the owner's explicit go.

## Adding an episode
Put the page images in `assets/episodes/ep-NN/` and add or edit an entry in `episodes.json` (`number`, `title`, `status`, `summary`, `cover`, `pages`). `status: "Soon"` shows a coming-soon card.

Never commit credentials. `server/`, `src/`, `tests/` and the notes are not published.
