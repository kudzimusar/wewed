# Notebook Writing & AI UX UAT

Authority: `WW-NOTEBOOK-WRITING-UX-2026-08-19-01`

## Manual checks after exact-head qualification

1. Open an existing wedding-scoped Meeting note. It opens in **Read** mode with headings, bold text, lists, quotes and links rendered; raw Markdown markers are not the normal reading view.
2. Choose **Write**, edit the note and pause. Status moves through Editing/Saving to **Saved** without exposing an internal `vN` revision.
3. Re-open Saved history and confirm ordinary typing did not add a new primary history point.
4. Click **Save checkpoint** after autosave finishes. Saved history gains a meaningful checkpoint.
5. Open **AI & suggested actions** on desktop and phone-sized viewport. The panel is immediately visible, with `Use AI in 3 steps` and `Suggest Wewed actions` above the fold/at the top of the panel.
6. Run **Structure meeting**. The AI preview renders Markdown visually; `**bold**`, Markdown list tokens, quote tokens and link syntax are not shown as the normal preview presentation.
7. Accept the rewrite. The note returns to Read mode and the AI acceptance remains a meaningful saved history point.
8. Open legacy history on a note that previously reached many revisions (for example the UAT note that reached internal revision 49). Legacy autosaves are collapsed under `Earlier autosave history` and no longer accumulate during ordinary typing.
9. Verify existing sharing, linked records, recording/transcription, Ask Notebook and governed suggestion application still work.

PASS requires no data loss, no cross-wedding exposure, no automatic AI mutation and no regression of optimistic conflict protection.
