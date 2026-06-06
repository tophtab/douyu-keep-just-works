# Replace project icon rocket with fishing rod

## Goal

Generate a project icon variant from the user-provided fish-holding-rocket image, changing only the held object from a rocket to a fishing rod.

## What I already know

* The user provided a small raster icon showing a white fish/mascot holding an orange rocket on a black background.
* The requested change is narrow: replace the rocket with a fishing rod.
* The user explicitly asked not to change other content.
* The repository root has an existing `icon.png`, but it does not match the uploaded fish/rocket icon.
* `src/docker/webui/index.html` originally used an inline fishing-pole emoji favicon, not a WebUI static PNG asset.
* For Docker/Vite WebUI runtime assets, the conventional project location is `src/docker/webui/public/`, which Vite serves and copies into the Docker WebUI build output.

## Assumptions

* The uploaded image is the intended edit target.
* The final project-bound artifact should be saved into the workspace as a PNG.
* The user confirmed the generated fishing-rod icon should overwrite the root `icon.png`.
* The user confirmed the WebUI public icon should also use the generated fishing-rod icon.

## Requirements

* Preserve the fish/mascot, pose, expression, outline style, black background, and icon-like composition.
* Replace only the rocket with a fishing rod.
* Avoid adding text, watermarks, extra characters, extra scenery, or unrelated objects.
* Keep the result suitable as a project icon.
* Replace root `icon.png` with the generated fishing-rod icon.
* Add the same generated icon at `src/docker/webui/public/icon.png` for Docker WebUI static serving.
* Update WebUI favicon and visible WebUI brand/login icon references to use `/icon.png`.

## Acceptance Criteria

* [x] Generated image visibly shows the fish/mascot holding a fishing rod instead of a rocket.
* [x] No rocket remains in the image.
* [x] Other visual content remains materially unchanged within the limits of model-based raster editing.
* [x] Final PNG is saved in the repository.
* [x] Root `icon.png` and `src/docker/webui/public/icon.png` contain the same generated fishing-rod icon.
* [x] WebUI favicon, login icon, and sidebar brand icon use `/icon.png`.

## Definition of Done

* Generated image saved under the project workspace.
* Any changed project file paths are reported to the user.
* Run frontend lint, WebUI type-check, and WebUI build because WebUI HTML, Vue components, CSS, and public assets changed.

## Out of Scope

* Redesigning the mascot.
* Changing colors, background, dimensions, branding, or WebUI layout.
* Redesigning WebUI layout beyond swapping in the project icon.

## Technical Notes

* Existing repository image assets found: `icon.png`, `doc/海报.png`, and Playwright screenshots under `.playwright-cli/`.
* Root `icon.png` was a 512x512 RGBA blue magic-wand icon and is now replaced with the generated fishing-rod icon.
* WebUI favicon was an inline SVG emoji in `src/docker/webui/index.html` and now points at `/icon.png`.
