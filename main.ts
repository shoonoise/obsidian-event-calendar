import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

// Remember to rename these classes and interfaces!

interface EventCalendarSettings {
	defaultView: string; // 'month', 'week', etc.
	firstDayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
	debugMode: boolean; // Show debug information
	testMode: boolean; // Enable test mode to show all notes and their metadata
}

const DEFAULT_SETTINGS: EventCalendarSettings = {
	defaultView: 'month',
	firstDayOfWeek: 0,
	debugMode: false,
	testMode: false
}

interface Event {
	title: string;
	startDate: Date;
	endDate: Date | null;
	path: string;
	note: TFile;
}

export default class EventCalendarPlugin extends Plugin {
	settings: EventCalendarSettings;

	async onload() {
		await this.loadSettings();

		// Add styles for the calendar
		this.addStyles();

		// Register the events code block renderer
		this.registerMarkdownCodeBlockProcessor('events', (source, el, ctx) => {
			const child = new EventCalendarRenderer(el, source, this);
			ctx.addChild(child);
		});

		// Add a ribbon icon
		this.addRibbonIcon('calendar', 'Event Calendar', (evt: MouseEvent) => {
			new Notice('Event Calendar plugin is active!');
		});

		// Add settings tab
		this.addSettingTab(new EventCalendarSettingTab(this.app, this));
	}

	onunload() {
		console.log('Unloading Event Calendar plugin');
		
		// Clean up styles
		const styleEl = document.getElementById('event-calendar-styles');
		if (styleEl) {
			styleEl.remove();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	addStyles() {
		// Add CSS for the calendar and events
		const styleEl = document.createElement('style');
		styleEl.id = 'event-calendar-styles';
		styleEl.textContent = `
			.event-calendar-container {
				margin: 1em 0;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			}
			.event-calendar-nav {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 1em;
			}
			.event-calendar-title {
				font-size: 1.2em;
				font-weight: bold;
			}
			.event-calendar-nav-btn {
				background: var(--interactive-normal);
				border: none;
				border-radius: 4px;
				padding: 4px 10px;
				cursor: pointer;
			}
			.event-calendar-nav-btn:hover {
				background: var(--interactive-hover);
			}
			.event-calendar-grid {
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				overflow: hidden;
				display: flex;
				flex-direction: column;
			}
			.event-calendar-row {
				display: flex;
				flex-direction: row;
				border-bottom: 1px solid var(--background-modifier-border);
				width: 100%;
			}
			.event-calendar-row:last-child {
				border-bottom: none;
			}
			.event-calendar-cell {
				flex: 1;
				min-height: 80px;
				padding: 5px;
				border-right: 1px solid var(--background-modifier-border);
				position: relative;
				width: calc(100% / 7);
				box-sizing: border-box;
			}
			.event-calendar-cell:last-child {
				border-right: none;
			}
			.event-calendar-header {
				background: var(--background-secondary);
				font-weight: bold;
			}
			.event-calendar-day-name {
				text-align: center;
				min-height: auto;
				padding: 8px;
			}
			.event-calendar-day-number {
				font-weight: bold;
				margin-bottom: 5px;
			}
			.event-calendar-events {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}
			.event-calendar-event {
				padding: 2px 5px;
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				border-radius: 3px;
				font-size: 0.8em;
				cursor: pointer;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.event-calendar-event:hover {
				filter: brightness(1.1);
			}
			.other-month {
				background: var(--background-modifier-cover);
				color: var(--text-muted);
			}
			
			/* Debug styles */
			.event-calendar-debug {
				margin-top: 2em;
				padding: 1em;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background: var(--background-secondary);
			}
			.event-calendar-debug-title {
				margin-top: 0;
			}
			.event-calendar-debug-section {
				margin-bottom: 1em;
			}
			.event-calendar-debug-code {
				background: var(--background-primary);
				padding: 0.5em;
				border-radius: 4px;
				font-family: monospace;
				overflow: auto;
			}
			.event-calendar-debug-note-name {
				font-weight: bold;
			}
			.event-calendar-debug-note-path {
				color: var(--text-muted);
				font-size: 0.9em;
			}
			.event-calendar-debug-metadata {
				margin-top: 0.5em;
				margin-bottom: 1em;
			}
			.event-calendar-debug-list {
				margin: 0;
				padding-left: 1.5em;
			}
		`;
		document.head.appendChild(styleEl);
	}
}

class EventCalendarRenderer extends MarkdownRenderChild {
	private source: string;
	private plugin: EventCalendarPlugin;
	private monthDate: Date;
	private events: Event[] = [];
	private app: App;
	private matchedNotes: TFile[] = [];

	constructor(containerEl: HTMLElement, source: string, plugin: EventCalendarPlugin) {
		super(containerEl);
		this.source = source;
		this.plugin = plugin;
		this.monthDate = new Date();
		this.app = plugin.app;
	}

	async onload() {
		// Parse query
		try {
			// Fetch events based on hardcoded filter
			this.events = await this.fetchEvents();
			
			// Render the calendar
			this.renderCalendar();

			// Show debug information if enabled
			if (this.plugin.settings.debugMode) {
				this.renderDebugInfo();
			}
		} catch (error) {
			this.containerEl.createEl('div', {
				text: `Error: ${error.message}`,
				cls: 'event-calendar-error'
			});
		}
	}

	async fetchEvents(): Promise<Event[]> {
		const events: Event[] = [];
		const { vault } = this.app;
		const allFiles = vault.getMarkdownFiles();
		
		// Store all files for debug info
		this.matchedNotes = allFiles;

		if (this.plugin.settings.debugMode) {
			console.log(`[Event Calendar] Total notes in vault: ${allFiles.length}`);
			console.log(`[Event Calendar] Notes found:`, allFiles.map(f => f.path));
		}

		// Filter files with #trip tag
		const filteredFiles = allFiles.filter((file: TFile) => {
			const cache = this.app.metadataCache.getFileCache(file);
			
			// Check for inline tags in the document body
			const hasInlineTag = cache?.tags && cache.tags.some((t: {tag: string}) => t.tag === '#trip');
			
			// Check for frontmatter tags
			let hasFrontmatterTag = false;
			if (cache?.frontmatter && cache.frontmatter.tags) {
				// Tags in frontmatter can be string or array
				if (typeof cache.frontmatter.tags === 'string') {
					hasFrontmatterTag = cache.frontmatter.tags === 'trip' || cache.frontmatter.tags.split(',').map(t => t.trim()).includes('trip');
				} else if (Array.isArray(cache.frontmatter.tags)) {
					hasFrontmatterTag = cache.frontmatter.tags.includes('trip');
				}
			}
			
			const hasTag = hasInlineTag || hasFrontmatterTag;
			
			if (this.plugin.settings.debugMode) {
				console.log(`[Event Calendar] File: ${file.path}`);
				console.log(`[Event Calendar] Has inline tag: ${hasInlineTag}`);
				console.log(`[Event Calendar] Has frontmatter tag: ${hasFrontmatterTag}`);
				console.log(`[Event Calendar] Has tag overall: ${hasTag}`);
				if (cache?.tags) {
					console.log(`[Event Calendar] Inline tags found: ${cache.tags.map(t => t.tag).join(', ')}`);
				}
				if (cache?.frontmatter) {
					console.log(`[Event Calendar] Frontmatter:`, cache.frontmatter);
					if (cache.frontmatter.tags) {
						console.log(`[Event Calendar] Frontmatter tags:`, cache.frontmatter.tags);
					}
				}
			}
			return hasTag;
		});

		if (this.plugin.settings.debugMode) {
			console.log(`[Event Calendar] Notes with #trip tag: ${filteredFiles.length}`);
			console.log(`[Event Calendar] Filtered notes:`, filteredFiles.map(f => f.path));
		}

		// Store filtered files for debug info
		this.matchedNotes = filteredFiles;

		// Extract dates and create events
		for (const file of filteredFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				const frontmatter = cache.frontmatter;
				
				if (this.plugin.settings.debugMode) {
					console.log(`[Event Calendar] Processing file: ${file.path}`);
					console.log(`[Event Calendar] Frontmatter:`, frontmatter);
				}
				
				// Check if both date fields exist
				if (frontmatter['start date']) {
					const startDate = this.parseDate(frontmatter['start date']);
					if (!startDate) {
						if (this.plugin.settings.debugMode) {
							console.log(`[Event Calendar] Could not parse start date for file: ${file.path}`);
						}
						continue;
					}
					
					let endDate = null;
					if (frontmatter['end date']) {
						endDate = this.parseDate(frontmatter['end date']);
						if (!endDate && this.plugin.settings.debugMode) {
							console.log(`[Event Calendar] Could not parse end date for file: ${file.path}`);
						}
					}
					
					events.push({
						title: file.basename,
						startDate,
						endDate,
						path: file.path,
						note: file
					});
				} else if (this.plugin.settings.debugMode) {
					console.log(`[Event Calendar] File ${file.path} does not have required date fields`);
					console.log(`[Event Calendar] Available fields: ${Object.keys(frontmatter).join(', ')}`);
				}
			} else if (this.plugin.settings.debugMode) {
				console.log(`[Event Calendar] File ${file.path} has no frontmatter`);
			}
		}
		
		return events;
	}

	parseDate(dateStr: any): Date | null {
		if (!dateStr) return null;
		
		// Handle various date formats
		if (dateStr instanceof Date) return dateStr;
		
		// Try standard date parsing
		const date = new Date(dateStr);
		if (!isNaN(date.getTime())) return date;
		
		return null;
	}

	renderCalendar() {
		const containerEl = this.containerEl;
		containerEl.empty();
		
		// Create calendar container
		const calendarEl = containerEl.createDiv({
			cls: 'event-calendar-container'
		});
		
		// Add navigation controls
		const navEl = calendarEl.createDiv({
			cls: 'event-calendar-nav'
		});
		
		const prevBtn = navEl.createEl('button', {
			text: '←',
			cls: 'event-calendar-nav-btn'
		});
		
		const titleEl = navEl.createEl('span', {
			cls: 'event-calendar-title',
			text: this.formatMonthTitle(this.monthDate)
		});
		
		const nextBtn = navEl.createEl('button', {
			text: '→',
			cls: 'event-calendar-nav-btn'
		});
		
		// Navigation event handlers
		prevBtn.addEventListener('click', () => {
			this.monthDate = new Date(this.monthDate.getFullYear(), this.monthDate.getMonth() - 1, 1);
			this.renderCalendar();
		});
		
		nextBtn.addEventListener('click', () => {
			this.monthDate = new Date(this.monthDate.getFullYear(), this.monthDate.getMonth() + 1, 1);
			this.renderCalendar();
		});
		
		// Render month grid
		this.renderMonthGrid(calendarEl);
	}

	formatMonthTitle(date: Date): string {
		return date.toLocaleString('default', { month: 'long', year: 'numeric' });
	}

	renderMonthGrid(containerEl: HTMLElement) {
		const gridEl = containerEl.createDiv({
			cls: 'event-calendar-grid'
		});
		
		// Get the current month's days
		const year = this.monthDate.getFullYear();
		const month = this.monthDate.getMonth();
		
		// Create header row with day names
		const headerRow = gridEl.createDiv({
			cls: 'event-calendar-row event-calendar-header'
		});
		
		const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const firstDayOfWeek = this.plugin.settings.firstDayOfWeek;
		
		for (let i = 0; i < 7; i++) {
			const dayIndex = (i + firstDayOfWeek) % 7;
			headerRow.createDiv({
				cls: 'event-calendar-cell event-calendar-day-name',
				text: dayNames[dayIndex]
			});
		}
		
		// Calculate the first day to display
		const firstDayOfMonth = new Date(year, month, 1);
		let startDate = new Date(firstDayOfMonth);
		const dayOfWeek = startDate.getDay();
		
		// Adjust to start on the correct first day of the week
		const diff = (dayOfWeek - firstDayOfWeek + 7) % 7;
		startDate.setDate(startDate.getDate() - diff);
		
		// Calculate the dates for all cells in the grid
		const gridDates: Date[] = [];
		for (let i = 0; i < 42; i++) { // 6 weeks × 7 days
			const date = new Date(startDate);
			date.setDate(startDate.getDate() + i);
			gridDates.push(date);
		}
		
		// Render 6 weeks to ensure we show all days
		for (let week = 0; week < 6; week++) {
			const row = gridEl.createDiv({
				cls: 'event-calendar-row'
			});
			
			for (let day = 0; day < 7; day++) {
				const cellIndex = week * 7 + day;
				const date = gridDates[cellIndex];
				
				// Check if the date is in the current month
				const isCurrentMonth = date.getMonth() === month;
				
				// Create the day cell
				const dayCell = row.createDiv({
					cls: `event-calendar-cell event-calendar-day${isCurrentMonth ? '' : ' other-month'}`
				});
				
				// Add the day number
				dayCell.createDiv({
					cls: 'event-calendar-day-number',
					text: date.getDate().toString()
				});
				
				// Container for events
				const eventsContainer = dayCell.createDiv({
					cls: 'event-calendar-events'
				});
				
				// Get events for this day
				const eventsForDay = this.getEventsForDay(date);
				
				// Process events for this day
				for (const event of eventsForDay) {
					// Create the event element
					const eventEl = eventsContainer.createDiv({
						cls: 'event-calendar-event'
					});
					
					// Add the event title
					eventEl.createDiv({
						cls: 'event-calendar-event-title',
						text: event.title
					});
					
					// Make events clickable
					eventEl.addEventListener('click', async () => {
						await this.app.workspace.getLeaf().openFile(event.note);
					});
				}
			}
		}
	}

	getEventsForDay(day: Date): Event[] {
		return this.events.filter(event => {
			const startDate = event.startDate;
			const endDate = event.endDate || event.startDate;
			
			// Check if the day is between the start and end dates (inclusive)
			return (
				startDate.getDate() <= day.getDate() &&
				day.getDate() <= endDate.getDate() &&
				startDate.getMonth() <= day.getMonth() &&
				day.getMonth() <= endDate.getMonth() &&
				startDate.getFullYear() <= day.getFullYear() &&
				day.getFullYear() <= endDate.getFullYear()
			);
		});
	}

	renderDebugInfo() {
		const debugContainer = this.containerEl.createDiv({
			cls: 'event-calendar-debug'
		});

		debugContainer.createEl('h3', {
			text: 'Debug Information',
			cls: 'event-calendar-debug-title'
		});

		// Show query information
		const queryInfo = debugContainer.createDiv({
			cls: 'event-calendar-debug-section'
		});
		queryInfo.createEl('h4', { text: 'Query Information' });
		queryInfo.createEl('pre', {
			text: this.source,
			cls: 'event-calendar-debug-code'
		});

		// Show all notes in test mode
		if (this.plugin.settings.testMode) {
			const allNotesInfo = debugContainer.createDiv({
				cls: 'event-calendar-debug-section'
			});
			allNotesInfo.createEl('h4', { text: 'All Notes in Vault' });
			
			const allNotesList = allNotesInfo.createEl('ul', {
				cls: 'event-calendar-debug-list'
			});

			for (const note of this.matchedNotes) {
				const li = allNotesList.createEl('li');
				li.createEl('span', {
					text: note.basename,
					cls: 'event-calendar-debug-note-name'
				});
				li.createEl('span', {
					text: ` (${note.path})`,
					cls: 'event-calendar-debug-note-path'
				});
				
				const cache = this.app.metadataCache.getFileCache(note);
				if (cache?.frontmatter) {
					const metadata = li.createEl('div', {
						cls: 'event-calendar-debug-metadata'
					});
					metadata.createEl('pre', {
						text: JSON.stringify(cache.frontmatter, null, 2),
						cls: 'event-calendar-debug-code'
					});
				}
			}
		}

		// Show matched notes
		const notesInfo = debugContainer.createDiv({
			cls: 'event-calendar-debug-section'
		});
		notesInfo.createEl('h4', { text: 'Matched Notes' });
		
		if (this.matchedNotes.length === 0) {
			notesInfo.createEl('p', { text: 'No notes matched the filter criteria.' });
		} else {
			const notesList = notesInfo.createEl('ul', {
				cls: 'event-calendar-debug-list'
			});

			for (const note of this.matchedNotes) {
				const li = notesList.createEl('li');
				li.createEl('span', {
					text: note.basename,
					cls: 'event-calendar-debug-note-name'
				});
				li.createEl('span', {
					text: ` (${note.path})`,
					cls: 'event-calendar-debug-note-path'
				});
				
				const cache = this.app.metadataCache.getFileCache(note);
				if (cache?.frontmatter) {
					const metadata = li.createEl('div', {
						cls: 'event-calendar-debug-metadata'
					});
					metadata.createEl('pre', {
						text: JSON.stringify(cache.frontmatter, null, 2),
						cls: 'event-calendar-debug-code'
					});
				}
			}
		}

		// Show events information
		const eventsInfo = debugContainer.createDiv({
			cls: 'event-calendar-debug-section'
		});
		eventsInfo.createEl('h4', { text: 'Events' });
		
		if (this.events.length === 0) {
			eventsInfo.createEl('p', { text: 'No events found in matched notes.' });
		} else {
			const eventsList = eventsInfo.createEl('ul', {
				cls: 'event-calendar-debug-list'
			});

			for (const event of this.events) {
				const li = eventsList.createEl('li');
				li.createEl('span', {
					text: event.title,
					cls: 'event-calendar-debug-event-name'
				});
				li.createEl('span', {
					text: ` (${event.startDate.toLocaleDateString()} - ${event.endDate?.toLocaleDateString() || 'N/A'})`,
					cls: 'event-calendar-debug-event-dates'
				});
			}
		}
	}
}

class EventCalendarSettingTab extends PluginSettingTab {
	plugin: EventCalendarPlugin;

	constructor(app: App, plugin: EventCalendarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'Event Calendar Settings'});

		new Setting(containerEl)
			.setName('Default view')
			.setDesc('The default calendar view')
			.addDropdown(dropdown => dropdown
				.addOption('month', 'Month')
				.addOption('week', 'Week')
				.setValue(this.plugin.settings.defaultView)
				.onChange(async (value) => {
					this.plugin.settings.defaultView = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('First day of week')
			.setDesc('Choose which day will be shown as the first day of the week')
			.addDropdown(dropdown => dropdown
				.addOption('0', 'Sunday')
				.addOption('1', 'Monday')
				.setValue(this.plugin.settings.firstDayOfWeek.toString())
				.onChange(async (value) => {
					this.plugin.settings.firstDayOfWeek = parseInt(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Debug Mode')
			.setDesc('Show debug information about matched notes and events')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Test Mode')
			.setDesc('Show all notes in the vault and their metadata (for debugging)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.testMode)
				.onChange(async (value) => {
					this.plugin.settings.testMode = value;
					await this.plugin.saveSettings();
				}));
	}
}
