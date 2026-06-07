# neko-master scrollbar CSS reference

## Source

Repository: `https://github.com/foru17/neko-master`

Local clone inspected: `/tmp/neko-master-scrollbar`

Relevant file: `/tmp/neko-master-scrollbar/apps/web/app/globals.css`

## Findings

The reference project reserves a stable page scrollbar gutter on desktop/fine-pointer devices:

* `@media (pointer: fine)`
* `html { overflow-y: scroll; scrollbar-gutter: stable; }`

Its custom WebKit scrollbar shape is:

* `::-webkit-scrollbar` uses `width: 6px` and `height: 6px`.
* `::-webkit-scrollbar-track` uses `background: transparent`.
* `::-webkit-scrollbar-thumb` uses a semi-transparent background and `border-radius: 3px`.
* The thumb has no border.
* `::-webkit-scrollbar-thumb:hover` only changes the thumb background opacity/color.

## Application To This Project

Keep this project's existing scrollbar color variables:

* `--scrollbar-thumb`
* `--scrollbar-thumb-hover`

Change the shape to match the reference:

* Reduce scrollbar size from 12px to 6px.
* Make the track transparent.
* Remove the `border: 3px solid var(--scrollbar-track)` from the thumb.
* Use a simple 3px thumb radius.

For Firefox, keep `scrollbar-width: thin` and set the track side of `scrollbar-color` to `transparent` to avoid a solid track.
