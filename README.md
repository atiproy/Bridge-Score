# Bridge Scorer

A fast, elegant Contract Bridge scorer. Enter the call, enter the tricks won —
it works out the points and explains every one of them.

## What it does

- **Setup**: two team names (players optional), pick a scoring style.
- **Scoring styles**: Casual (no vulnerability/doubling), Party Bridge
  (per-deal, standard duplicate scoring), Chicago (four-deal rounds), Rubber
  and Rubber with honours — every individual rule (vulnerability, doubling,
  slam bonuses, the insult bonus, honours) can also be toggled on its own.
- **Deal entry**: declarer → level → strain → double/redouble → tricks won.
  A live preview shows the result and, on request, the full point-by-point
  arithmetic before you commit the deal.
- **Scorecard**: every deal, editable and deletable, with full undo/redo.
  Editing an old deal re-scores everything after it automatically —
  vulnerability, game and rubber bonuses all recompute.
- **Sharing**: a plain-text scorecard you can copy, download, or hand to the
  system share sheet — readable without the app.
- **Persistence**: the match is saved to the browser automatically; closing
  the tab and coming back picks up exactly where you left off.
- **Theme**: an ink-and-paper light theme and an obsidian-and-brass dark
  theme, matched to the system by default with a manual override.

## Local development

```bash
npm install
npm run dev
```

## Testing

```bash
npm run test        # engine + full UI integration suite, single run
npm run test:watch  # watch mode
npm run lint
npm run build        # type-checks and produces a production build in dist/
```

The scoring engine (`src/engine`) is pure and has no UI dependency — every
value in the official Contract Bridge scoring tables (trick scores,
overtricks, the undertrick penalty ladder, slam and insult bonuses, rubber
bonuses, honours, and both the duplicate and Chicago vulnerability cycles) is
covered by a dedicated test. `src/App.test.tsx` drives the real rendered app
the way a player would, covering full games, editing history, rule changes
mid-match, persistence, and accessibility behaviour.

## Deploying to Netlify under a subdomain

This is a static single-page app; `netlify.toml` is already configured with
the build command, publish directory, and the SPA fallback redirect it needs.

1. Push this project to a Git repository (or drag-and-drop the `dist/`
   folder after running `npm run build` for a one-off deploy).
2. In Netlify: **Add new site → Import an existing project**, point it at the
   repository, and set the **base directory** to `bridge-scorer` if it lives
   alongside other projects in a monorepo. Build command and publish
   directory are picked up automatically from `netlify.toml`.
3. Once the first deploy succeeds, go to **Site configuration → Domain
   management → Add a domain**, and add your subdomain, e.g.
   `bridge.yourdomain.com`.
4. At your DNS provider, add a `CNAME` record for `bridge` pointing at the
   `*.netlify.app` address Netlify shows you (or use Netlify DNS if your
   domain is already delegated to it).
5. Netlify provisions HTTPS for the subdomain automatically once the DNS
   record resolves.

No environment variables or server-side services are required — the app is
entirely client-side and stores its state in the browser's `localStorage`.
