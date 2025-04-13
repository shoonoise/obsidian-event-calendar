# Obsidian Plugin: "Event Calendar"

## Purpose

The plugin allows users to embed a visual calendar inside any Markdown page in Obsidian. It displays events based on metadata from notes.

## User Story

I manage trip plans using individual notes. Each trip note includes:

- `start_date`
- `end_date`

I want to embed a calendar view in a note to visually display trips from these notes. To do this, I use a custom code block with Dataview-like syntax:

```events
MONTH
```

When switching to preview/render mode, the plugin shows a calendar (e.g., a month view) with the matched events. Users should also be able to navigate between months.
