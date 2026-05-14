# Set fishbar table column widths

## Goal

Align the Yuba status table column sizing with the other WebUI tables: first column is 50px and each of the six remaining columns is 100px, for a 650px table baseline.

## What I Already Know

- The Yuba table has seven columns: index plus six data/status columns.
- Comparable tables use explicit `<col style="width:50px">` and `<col style="width:100px">` entries in their Vue templates.
- `src/docker/webui/styles/tables.css` already sets `.yuba-status-table` to `min-width:650px`.

## Requirements

- Do not add any new Yuba list columns.
- Make the Yuba table column widths follow `50 + 6 * 100`.
- Keep mobile responsive table behavior unchanged.

## Acceptance Criteria

- [ ] Yuba table has one 50px column and six 100px columns.
- [ ] No backend or data shape changes.
- [ ] Frontend type-check passes.

## Out of Scope

- Adding group title, unread count, progress, links, or other new table fields.
- Changing other table layouts.

## Technical Notes

- Relevant files: `src/docker/webui/components/YubaStatusTable.vue`, `src/docker/webui/styles/tables.css`.
- Frontend specs read before editing: directory structure, component guidelines, quality guidelines, shared thinking guide index.
