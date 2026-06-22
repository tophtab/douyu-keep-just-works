# Redesign README presentation

## Goal

Improve the repository README first impression so a visitor can quickly
understand that `douyu-keep-just-works` is a Docker-first Douyu fan medal WebUI
for long-running NAS / home-server use, while keeping the existing deployment
instructions, safety notice, and credits easy to find.

## User Value

- New users should know what the project does before reading setup details.
- Docker users should reach a working Compose snippet quickly.
- Existing project identity should feel more polished without turning the README
  into a broad marketing page.

## Confirmed Facts

- The current README already contains a complete introduction, feature list,
  Docker Compose example, configuration advice, philosophy note, disclaimer, and
  credits.
- The current first screen is plain: one H1, one subtitle, text navigation, then
  the poster image.
- The repository has a strong existing visual asset at `doc/海报.png`
  (`1672x941` PNG) showing the product name, Docker/WebUI positioning, feature
  cards, and a WebUI screenshot-style composition.
- The current WebUI has changed since the existing poster was created, so the
  poster should be refreshed to match the updated UI.
- Any refreshed poster must avoid exposing personal data. Gift names, gift
  quantities, followed streamers, room IDs, fan medal rows, rankings, intimacy
  values, logs, cookies, and account-related values must be fictional sample
  data rather than copied from the user's real screenshot or runtime state.
- The maintained runtime is Docker WebUI. The project uses Node.js 24, Vue,
  Vite, TypeScript, Express, Docker Compose, and Docker Hub image
  `tophtab/douyu-keep-just-works`.
- `docker-compose.yml` supports overriding image and tag through
  `DOCKER_IMAGE` and `DOCKER_TAG`; the README example currently uses the direct
  `tophtab/douyu-keep-just-works:latest` image string.
- The package version is `3.6.0`.
- The repository license is intentionally restricted for personal learning,
  technical research, and non-commercial technical exchange.
- Cherry Studio's README effect is ordinary GitHub-rendered Markdown / HTML:
  centered HTML blocks, badges, image assets, navigation links, and third-party
  SVG widgets. No custom GitHub README runtime is involved.
- The selected README direction is restrained and tool-focused rather than a
  promotional / community-ranking style.
- Node.js does not need a README header badge; the Docker deployment surface is
  more relevant to readers.
- Docker Hub pull/download count can be shown with a shields.io Docker pulls
  badge for `tophtab/douyu-keep-just-works`.
- The refreshed poster should be generated from a controlled local mockup with
  fictional sample data rather than cropped from the user's real screenshot, so
  privacy and text accuracy are deterministic.

## Requirements

- Keep the README as GitHub-compatible Markdown with small, standard HTML blocks
  only where they improve layout.
- Refresh `doc/海报.png` as the primary visual so it reflects the current WebUI
  style while using only fictional sample data.
- Reshape the first screen around:
  - centered project name and short positioning copy;
  - useful Docker-focused badges, including Docker Hub / pulls and the current
    image channel where practical;
  - compact navigation links;
  - the refreshed poster image.
- Preserve or improve the existing practical content:
  - supported task list;
  - Docker Compose deployment;
  - configuration advice;
  - philosophy note;
  - disclaimer;
  - credits.
- The final README may remain compact after user trimming; do not reintroduce a
  longer FAQ or extra command blocks unless requested.
- Keep the tone direct and tool-focused. Avoid Cherry Studio-style community
  ranking cards, product-hunt widgets, or broad internationalization unless
  explicitly requested later.
- Keep the badge row short. Do not include a Node.js badge, star/fork counters,
  Product Hunt cards, trend widgets, or unrelated social proof.
- Ensure deployment snippets match the real `docker-compose.yml` behavior.
- Do not change runtime code, package metadata, release workflows, or Docker
  behavior for this task.
- Treat privacy as a hard requirement for visual assets: never paste real user
  data from screenshots into README imagery.
- Prefer a deterministic HTML/CSS poster mockup captured to PNG over free-form
  image generation, because the poster contains UI text and sample tabular data
  that must stay readable and fictional.

## Acceptance Criteria

- [x] `README.md` opens with a polished, GitHub-rendered project header that
      clearly communicates Docker WebUI, fan medal keepalive, and long-running
      use.
- [x] The README uses the refreshed poster image prominently and keeps the image
      path valid.
- [x] The refreshed poster contains only fictional sample data and does not
      expose real gift, streamer, room, account, cookie, or log information.
- [x] The Docker deployment section remains copy-pasteable and reflects the
      current Compose shape.
- [x] Existing safety / non-commercial disclaimer and upstream credits remain in
      the README.
- [x] No package changes or runtime code changes are required.
- [x] Markdown renders without obvious broken links, duplicate headings, or
      malformed tables / code fences.

## Out of Scope

- Generating a new logo.
- Adding English / Chinese multi-language README variants.
- Adding third-party ranking widgets, Product Hunt-style cards, or analytics.
- Changing Docker image publishing, application behavior, or WebUI design.

## Open Questions

- None.
