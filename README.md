# Obsidian Event Calendar Plugin

This plugin for [Obsidian](https://obsidian.md) allows you to embed a visual calendar inside any Markdown page in Obsidian. It displays events based on metadata from your notes.

## Features

- Embed a calendar view in any note using a custom code block
- Display events based on metadata from your notes (start_date and end_date)
- Filter events using a Dataview-like syntax
- Navigate between months in the calendar view
- Click on events to open the corresponding note

## Usage

1. Add start_date and end_date metadata to your notes (in YAML frontmatter)
2. Create a code block with the `events` language identifier
3. Use a Dataview-like syntax to specify which events to display

Example:

```events
EVENTS MONTH  
start_date,  
end_date  
  
FROM #trips  
WHERE dateformat(start_date, "yyyy") == 2024
```

This will show a calendar with all notes tagged with #trips that have events in 2024.

## Query Syntax

The query syntax is inspired by Dataview and supports:

- `EVENTS MONTH` - The first line specifies the view type (currently only MONTH is supported)
- Next line(s) specify the date fields to use (start_date, end_date)
- `FROM` - Specifies where to look for notes (e.g., `#tag`, folder)
- `WHERE` - Filters the results (currently only basic date filtering is supported)

## Settings

The plugin settings allow you to:

- Choose the default view (month, week)
- Set the first day of the week (Sunday or Monday)

## Installation

1. Open Settings in Obsidian
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Event Calendar"
4. Install the plugin and enable it

## Manual Installation

1. Download the latest release from the GitHub repository
2. Extract the files into your vault's `.obsidian/plugins/obsidian-event-calendar` directory
3. Reload Obsidian
4. Enable the plugin in the Community Plugins settings

## Development

This plugin uses TypeScript and follows the Obsidian plugin development workflow:

- Clone this repository to your vault's plugins folder
- `npm i` to install dependencies
- `npm run dev` to start compilation in watch mode

## License

This project is licensed under the MIT License - see the LICENSE file for details.
