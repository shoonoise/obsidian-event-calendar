import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

// Remember to rename these classes and interfaces!

interface EventCalendarSettings {
	defaultView: string; // 'agenda', 'year'
	firstDayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
	debugMode: boolean; // Show debug information
	testMode: boolean; // Enable test mode to show all notes and their metadata
}

const DEFAULT_SETTINGS: EventCalendarSettings = {
	defaultView: 'agenda',
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
	color: string; // Store the color for the event
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
				margin-bottom: 1.5em;
				padding: 6px 4px;
				background: var(--background-secondary-alt);
				border-radius: 6px;
			}
			.event-calendar-title {
				font-size: 1.2em;
				font-weight: bold;
				padding: 0 15px;
				flex: 1;
				text-align: center;
			}
			.event-calendar-nav-btn {
				background: var(--interactive-normal);
				border: none;
				border-radius: 4px;
				padding: 6px 12px;
				margin: 0 4px;
				cursor: pointer;
				font-weight: bold;
			}
			.event-calendar-nav-btn:hover {
				background: var(--interactive-hover);
				color: var(--text-accent);
			}
			.event-calendar-view-toggle {
				margin-left: auto;
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
				background: var(--background-primary);
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
				border-radius: 0px;
				font-size: 0.8em;
				cursor: pointer;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.event-calendar-event:hover {
				filter: brightness(1.1);
			}
			.event-calendar-event-content {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.event-calendar-event-title {
				flex-grow: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.event-calendar-days-until {
				font-size: 0.85em;
				font-weight: bold;
				background: rgba(0, 0, 0, 0.2);
				padding: 1px 4px;
				border-radius: 3px;
				margin-left: 4px;
				white-space: nowrap;
			}
			.event-calendar-empty-cell {
				background: transparent;
				border: none;
				min-height: 0;
				padding: 0;
				width: 0;
				flex: 0;
			}
			.other-month {
				display: none; /* Hide cells from other months */
			}
			
			/* Year view styles */
			.event-calendar-year-grid {
				display: flex;
				flex-direction: column;
				gap: 20px;
			}
			.event-calendar-year-row {
				display: flex;
				flex-direction: row;
				gap: 20px;
				width: 100%;
			}
			.event-calendar-year-month {
				flex: 1;
				border: 1px solid var(--background-modifier-border);
				border-radius: 0px;
				padding: 8px;
			}
			.event-calendar-year-month-title {
				text-align: center;
				margin: 0 0 8px 0;
				font-size: 0.9em;
			}
			.event-calendar-mini-grid {
				width: 100%;
			}
			.event-calendar-mini-row {
				display: flex;
				flex-direction: row;
				width: 100%;
			}
			.event-calendar-mini-cell {
				flex: 1;
				text-align: center;
				font-size: 0.7em;
				padding: 2px 0;
				cursor: pointer;
				border-radius: 0px;
			}
			.event-calendar-mini-cell:hover {
				background: var(--background-modifier-hover);
			}
			.event-calendar-mini-header {
				font-weight: bold;
				margin-bottom: 2px;
			}
			.event-calendar-mini-day-name {
				cursor: default;
			}
			.mini-other-month {
				color: var(--text-muted);
				opacity: 0.5;
				background-color: var(--background-modifier-border);
				text-decoration: none;
				pointer-events: none; /* Remove hover effect */
			}
			.event-calendar-mini-has-events {
				background-color: var(--interactive-accent-hover);
				color: var(--text-on-accent);
				font-weight: bold;
			}
			
			.event-calendar-mini-empty-cell {
				background-color: var(--background-secondary-alt);
				border: none;
			}
			
			/* Legend styles */
			.event-calendar-legend {
				margin-bottom: 1.5em;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				padding: 10px;
				background: var(--background-primary);
			}
			.event-calendar-legend-title {
				margin: 0 0 10px 0;
				font-size: 1em;
				text-align: center;
			}
			.event-calendar-legend-list {
				display: flex;
				flex-wrap: wrap;
				gap: 10px;
				justify-content: center;
			}
			.event-calendar-legend-item {
				display: flex;
				align-items: center;
				cursor: pointer;
				padding: 4px 8px;
				border-radius: 4px;
				margin: 2px;
				background: var(--background-secondary-alt);
			}
			.event-calendar-legend-item:hover {
				background: var(--background-modifier-hover);
			}
			.event-calendar-legend-swatch {
				width: 15px;
				height: 15px;
				border-radius: 3px;
				margin-right: 5px;
				flex-shrink: 0;
			}
			.event-calendar-legend-content {
				display: flex;
				flex-direction: column;
			}
			.event-calendar-legend-label {
				font-size: 0.9em;
			}
			.event-calendar-legend-days-until {
				font-size: 0.75em;
				font-weight: bold;
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
					
					// Use title from frontmatter if available, otherwise use filename
					const title = frontmatter.title || file.basename;
					
					events.push({
						title,
						startDate,
						endDate,
						path: file.path,
						note: file,
						color: '#1976d2' // Temporary default color
					});
				} else if (this.plugin.settings.debugMode) {
					console.log(`[Event Calendar] File ${file.path} does not have required date fields`);
					console.log(`[Event Calendar] Available fields: ${Object.keys(frontmatter).join(', ')}`);
				}
			} else if (this.plugin.settings.debugMode) {
				console.log(`[Event Calendar] File ${file.path} has no frontmatter`);
			}
		}
		
		// Assign colors to events
		this.assignColorsToVisibleEvents(events);
		
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
			text: this.formatCalendarTitle()
		});
		
		const nextBtn = navEl.createEl('button', {
			text: '→',
			cls: 'event-calendar-nav-btn'
		});
		
		// For agenda view, hide navigation buttons
		if (this.plugin.settings.defaultView === 'agenda') {
			prevBtn.style.visibility = 'hidden';
			nextBtn.style.visibility = 'hidden';
		}
		
		// Add view toggle button
		const viewToggleBtn = navEl.createEl('button', {
			text: this.plugin.settings.defaultView === 'agenda' ? 'Year View' : 'Agenda View',
			cls: 'event-calendar-nav-btn event-calendar-view-toggle'
		});
		
		// Navigation event handlers only apply to year view
		if (this.plugin.settings.defaultView !== 'agenda') {
			prevBtn.addEventListener('click', () => {
				this.monthDate = new Date(this.monthDate.getFullYear() - 1, 0, 1);
				this.renderCalendar();
			});
			
			nextBtn.addEventListener('click', () => {
				this.monthDate = new Date(this.monthDate.getFullYear() + 1, 0, 1);
				this.renderCalendar();
			});
		}
		
		// View toggle handler
		viewToggleBtn.addEventListener('click', () => {
			this.plugin.settings.defaultView = this.plugin.settings.defaultView === 'agenda' ? 'year' : 'agenda';
			this.plugin.saveSettings();
			this.renderCalendar();
		});
		
		// Render appropriate view
		if (this.plugin.settings.defaultView === 'agenda') {
			// Render agenda view without legend
			this.renderAgendaView(calendarEl);
		} else {
			// Render year view first
			this.renderYearGrid(calendarEl);
			
			// Then add the collapsible legend at the bottom
			this.renderCollapsibleLegend(calendarEl);
		}
	}

	formatCalendarTitle(): string {
		if (this.plugin.settings.defaultView === 'agenda') {
			return 'Next 10 Events';
		} else {
			return this.monthDate.getFullYear().toString();
		}
	}

	renderAgendaView(containerEl: HTMLElement) {
		// Create agenda container
		const agendaEl = containerEl.createDiv({
			cls: 'event-calendar-agenda'
		});
		
		// Get today's date
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		// Get all events
		const allEvents = [...this.events];
		
		// Find upcoming and ongoing events
		const upcomingEvents = allEvents.filter(event => {
			const startDate = new Date(event.startDate);
			startDate.setHours(0, 0, 0, 0);
			return startDate.getTime() >= today.getTime();
		});
		
		const ongoingEvents = allEvents.filter(event => {
			const startDate = new Date(event.startDate);
			startDate.setHours(0, 0, 0, 0);
			const endDate = event.endDate ? new Date(event.endDate) : startDate;
			endDate.setHours(0, 0, 0, 0);
			
			return startDate.getTime() <= today.getTime() && endDate.getTime() >= today.getTime();
		});
		
		// Combine events - ongoing first, then upcoming
		const combinedEvents = [...ongoingEvents];
		
		// Sort upcoming by start date (closest first) and limit to 10-[ongoing count]
		upcomingEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
		combinedEvents.push(...upcomingEvents.slice(0, 10 - ongoingEvents.length));
		
		// If no events, show a message
		if (combinedEvents.length === 0) {
			agendaEl.createEl('p', {
				text: 'No upcoming events scheduled.',
				cls: 'event-calendar-agenda-empty'
			});
			return;
		}
		
		// Create event list
		const eventsList = agendaEl.createDiv({
			cls: 'event-calendar-agenda-list'
		});
		
		// Add each event to the list
		combinedEvents.forEach(event => {
			// Check if it's ongoing or upcoming
			const startDate = new Date(event.startDate);
			startDate.setHours(0, 0, 0, 0);
			const isOngoing = startDate.getTime() <= today.getTime();
			
			const eventItem = eventsList.createDiv({
				cls: isOngoing ? 'event-calendar-agenda-item event-calendar-agenda-ongoing-item' : 'event-calendar-agenda-item'
			});
			
			// Add colored event marker
			const eventMarker = eventItem.createDiv({
				cls: 'event-calendar-agenda-marker'
			});
			eventMarker.style.backgroundColor = event.color;
			
			// Create event content container
			const eventContent = eventItem.createDiv({
				cls: 'event-calendar-agenda-content'
			});
			
			// Add event title
			eventContent.createEl('div', {
				text: event.title,
				cls: 'event-calendar-agenda-title'
			});
			
			// Add event dates
			const dateText = event.endDate ? 
				`${event.startDate.toLocaleDateString()} - ${event.endDate.toLocaleDateString()}` : 
				event.startDate.toLocaleDateString();
				
			eventContent.createEl('div', {
				text: dateText,
				cls: 'event-calendar-agenda-date'
			});
			
			// Add countdown for upcoming events or 'ongoing' badge
			if (isOngoing) {
				eventContent.createEl('div', {
					text: 'Ongoing',
					cls: 'event-calendar-agenda-ongoing'
				});
			} else {
				const daysUntil = this.getDaysUntilStart(event);
				if (daysUntil > 0) {
					eventContent.createEl('div', {
						text: `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until start`,
						cls: 'event-calendar-agenda-countdown'
					});
				}
			}
			
			// Make event clickable
			eventItem.addEventListener('click', async () => {
				await this.app.workspace.getLeaf().openFile(event.note);
			});
		});
	}

	getEventsForDay(day: Date): Event[] {
		// Create a date at midnight for proper comparison
		const checkDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
		
		return this.events.filter(event => {
			// Create dates at midnight for proper comparison
			const startDate = new Date(event.startDate.getFullYear(), event.startDate.getMonth(), event.startDate.getDate());
			const endDate = event.endDate ? 
				new Date(event.endDate.getFullYear(), event.endDate.getMonth(), event.endDate.getDate()) : 
				startDate;
			
			// Check if the day is between the start and end dates (inclusive)
			// Using timestamp comparison for accuracy
			return checkDate.getTime() >= startDate.getTime() && 
				   checkDate.getTime() <= endDate.getTime();
		});
	}

	// Calculate days remaining until event start
	getDaysUntilStart(event: Event): number {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		const startDate = new Date(event.startDate);
		startDate.setHours(0, 0, 0, 0);
		
		const timeDiff = startDate.getTime() - today.getTime();
		const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
		
		return daysDiff;
	}

	renderYearGrid(containerEl: HTMLElement) {
		const yearGrid = containerEl.createDiv({
			cls: 'event-calendar-year-grid'
		});
		
		const year = this.monthDate.getFullYear();
		const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
							'July', 'August', 'September', 'October', 'November', 'December'];
		
		// Create a 3x4 grid of months
		for (let row = 0; row < 4; row++) {
			const monthRow = yearGrid.createDiv({
				cls: 'event-calendar-year-row'
			});
			
			for (let col = 0; col < 3; col++) {
				const monthIndex = row * 3 + col;
				
				// Create a container for this month
				const monthCell = monthRow.createDiv({
					cls: 'event-calendar-year-month'
				});
				
				// Add month header
				monthCell.createEl('h4', {
					text: monthNames[monthIndex],
					cls: 'event-calendar-year-month-title'
				});
				
				// Create mini month grid
				this.renderMiniMonth(monthCell, year, monthIndex);
			}
		}
	}

	renderMiniMonth(containerEl: HTMLElement, year: number, month: number) {
		const gridEl = containerEl.createDiv({
			cls: 'event-calendar-mini-grid'
		});
		
		// Determine the day of week names based on first day of week setting
		const dayNameAbbrev = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
		const firstDayOfWeek = this.plugin.settings.firstDayOfWeek;
		
		// Create header row with day names
		for (let i = 0; i < 7; i++) {
			const dayIndex = (i + firstDayOfWeek) % 7;
			gridEl.createDiv({
				cls: 'event-calendar-mini-cell event-calendar-mini-day-name',
				text: dayNameAbbrev[dayIndex]
			});
		}
		
		// Get first day of the month
		const firstDayOfMonth = new Date(year, month, 1);
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		
		// Calculate the first day's position in the week (0-6)
		const firstDayPosition = (firstDayOfMonth.getDay() - firstDayOfWeek + 7) % 7;
		
		// Track which week we're in
		let currentWeek = 0;
		let currentDay = 0;
		
		// Create empty cells for days before the first of the month
		for (let i = 0; i < firstDayPosition; i++) {
			gridEl.createDiv({
				cls: 'event-calendar-mini-cell event-calendar-mini-empty-cell'
			});
			currentDay++;
		}
		
		// Create cells for each day in the month
		for (let day = 1; day <= daysInMonth; day++) {
			const date = new Date(year, month, day);
			const dayCell = gridEl.createDiv({
				cls: 'event-calendar-mini-cell'
			});
			
			// Add the day number
			dayCell.setText(day.toString());
			
			// Check if this day has events
			const eventsForDay = this.getEventsForDay(date);
			if (eventsForDay.length > 0) {
				dayCell.addClass('event-calendar-mini-has-events');
				
				// Use the color of the first event for this day
				if (eventsForDay[0].color) {
					dayCell.style.backgroundColor = eventsForDay[0].color;
				}
				
				// If multiple events, add a small indicator
				if (eventsForDay.length > 1) {
					dayCell.setAttribute('title', `${eventsForDay.length} events`);
					
					// Make click open the first event's note
					dayCell.addEventListener('click', async (e) => {
						e.preventDefault();
						e.stopPropagation();
						await this.app.workspace.getLeaf().openFile(eventsForDay[0].note);
					});
				} else {
					const event = eventsForDay[0];
					// Show days until in the tooltip if it's a future event
					const today = new Date();
					today.setHours(0, 0, 0, 0);
					const eventStart = new Date(event.startDate);
					eventStart.setHours(0, 0, 0, 0);
					
					if (eventStart.getTime() > today.getTime()) {
						const daysUntil = this.getDaysUntilStart(event);
						// Only show positive days
						if (daysUntil > 0) {
							dayCell.setAttribute('title', `${event.title} - ${daysUntil} day${daysUntil !== 1 ? 's' : ''} until start`);
						} else {
							dayCell.setAttribute('title', event.title);
						}
					} else {
						dayCell.setAttribute('title', event.title);
					}
					
					// Make click open the event's note
					dayCell.addEventListener('click', async (e) => {
						e.preventDefault();
						e.stopPropagation();
						await this.app.workspace.getLeaf().openFile(event.note);
					});
				}
			} else {
				// If no events, clicking still switches to agenda view
				dayCell.addEventListener('click', () => {
					this.monthDate = new Date(year, month, 1);
					this.plugin.settings.defaultView = 'agenda';
					this.plugin.saveSettings();
					this.renderCalendar();
				});
			}
			
			// Move to the next position
			currentDay++;
			
			// Start a new week if needed
			if (currentDay % 7 === 0) {
				currentWeek++;
			}
		}
		
		// If we want to display a fixed number of weeks (usually 6)
		// We can add empty cells for days after the end of the month
		// But for now we'll leave it as is
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

	// Generate a set of rainbow colors
	generateRainbowColors(count: number): string[] {
		const colors: string[] = [];
		for (let i = 0; i < count; i++) {
			// Calculate hue (0-360) to get full spectrum
			const hue = (i * 360 / count) % 360;
			// Use pastel colors by reducing saturation and increasing lightness
			const saturation = 50; // Reduced saturation for pastel effect
			const lightness = 85; // Increased lightness for pastel effect
			colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
		}
		return colors;
	}

	// Render a collapsible legend at the bottom
	renderCollapsibleLegend(containerEl: HTMLElement) {
		// Get events for the current view
		const visibleEvents = this.getVisibleEvents();
		
		// Skip legend if no events
		if (visibleEvents.length === 0) return;
		
		// Create a collapsible container
		const legendContainer = containerEl.createDiv({
			cls: 'event-calendar-legend event-calendar-legend-collapsible'
		});
		
		// Create the header with collapse toggle
		const legendHeader = legendContainer.createDiv({
			cls: 'event-calendar-legend-header'
		});
		
		// Add expand/collapse icon
		const collapseIcon = legendHeader.createSpan({
			cls: 'event-calendar-legend-collapse-icon'
		});
		collapseIcon.setText('▼');
		
		// Add title
		legendHeader.createSpan({
			text: 'Events Legend',
			cls: 'event-calendar-legend-title'
		});
		
		// Create the collapsible content
		const legendContent = legendContainer.createDiv({
			cls: 'event-calendar-legend-content-wrapper'
		});
		
		// Get unique events by title and sort them by start date
		const uniqueEvents = new Map<string, Event>();
		visibleEvents.forEach(event => {
			if (!uniqueEvents.has(event.title)) {
				uniqueEvents.set(event.title, event);
			}
		});
		
		// Convert to array and sort by start date
		const sortedEvents = Array.from(uniqueEvents.values()).sort((a, b) => {
			return a.startDate.getTime() - b.startDate.getTime();
		});
		
		// Create the legend items
		const legendList = legendContent.createDiv({
			cls: 'event-calendar-legend-list'
		});
		
		// Get today's date for time comparisons
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		sortedEvents.forEach(event => {
			const legendItem = legendList.createDiv({
				cls: 'event-calendar-legend-item'
			});
			
			const colorSwatch = legendItem.createDiv({
				cls: 'event-calendar-legend-swatch'
			});
			colorSwatch.style.backgroundColor = event.color;
			
			const legendItemContent = legendItem.createDiv({
				cls: 'event-calendar-legend-item-content'
			});
			
			legendItemContent.createDiv({
				text: event.title,
				cls: 'event-calendar-legend-label'
			});
			
			// Add days info: days until start or days since end
			const eventStart = new Date(event.startDate);
			eventStart.setHours(0, 0, 0, 0);
			
			if (eventStart.getTime() > today.getTime()) {
				// Future event: show days until start
				const daysUntil = this.getDaysUntilStart(event);
				if (daysUntil > 0) {
					legendItemContent.createDiv({
						text: `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until start`,
						cls: 'event-calendar-legend-days-until'
					});
				}
			} else {
				// Past event or ongoing event
				const eventEnd = event.endDate ? new Date(event.endDate) : new Date(eventStart);
				eventEnd.setHours(0, 0, 0, 0);
				
				if (eventEnd.getTime() >= today.getTime()) {
					// Ongoing event
					legendItemContent.createDiv({
						text: 'Ongoing',
						cls: 'event-calendar-legend-ongoing'
					});
				} else {
					// Past event: show days since end
					const daysSince = Math.ceil((today.getTime() - eventEnd.getTime()) / (1000 * 3600 * 24));
					legendItemContent.createDiv({
						text: `${daysSince} day${daysSince !== 1 ? 's' : ''} ago`,
						cls: 'event-calendar-legend-days-ago'
					});
				}
			}
			
			// Make clicking on legend items open the note
			legendItem.addEventListener('click', async () => {
				await this.app.workspace.getLeaf().openFile(event.note);
			});
		});
		
		// Toggle collapse on click
		legendHeader.addEventListener('click', () => {
			const isCollapsed = legendContent.hasClass('collapsed');
			legendContent.toggleClass('collapsed', !isCollapsed);
			collapseIcon.setText(isCollapsed ? '▼' : '▶');
		});
		
		// Initialize as collapsed
		legendContent.addClass('collapsed');
		collapseIcon.setText('▶');
	}
	
	// Get events visible in the current view (agenda or year)
	getVisibleEvents(): Event[] {
		let visibleEvents: Event[];
		
		if (this.plugin.settings.defaultView === 'agenda') {
			// For agenda view, return all events - we'll filter them in renderAgendaView
			visibleEvents = [...this.events];
		} else {
			// For year view, show only events in the currently displayed year
			const year = this.monthDate.getFullYear();
			
			visibleEvents = this.events.filter(event => {
				// Check if event start date or end date falls within this year
				const startYear = event.startDate.getFullYear();
				const endYear = event.endDate ? event.endDate.getFullYear() : startYear;
				
				// Event is visible if any part of it falls within the displayed year
				return (startYear <= year && endYear >= year);
			});
		}
		
		// Reassign colors based on the current view
		this.assignColorsToVisibleEvents(visibleEvents);
		
		return visibleEvents;
	}
	
	// Assign colors to events based on the current view
	assignColorsToVisibleEvents(events: Event[]): void {
		// Group events by year
		const eventsByYear = new Map<number, Event[]>();
		
		events.forEach(event => {
			const year = event.startDate.getFullYear();
			if (!eventsByYear.has(year)) {
				eventsByYear.set(year, []);
			}
			eventsByYear.get(year)?.push(event);
		});
		
		// Assign colors for each year group
		eventsByYear.forEach((yearEvents, year) => {
			// Get unique titles in this year
			const uniqueTitles = new Set<string>();
			yearEvents.forEach(event => uniqueTitles.add(event.title));
			
			// Create an array from the unique titles to assign rainbow colors
			const uniqueTitlesArray = Array.from(uniqueTitles);
			const rainbowColors = this.generateRainbowColors(uniqueTitlesArray.length);
			
			// Create a map of title -> color for this year
			const colorMap = new Map<string, string>();
			uniqueTitlesArray.forEach((title, index) => {
				colorMap.set(title, rainbowColors[index]);
			});
			
			// Assign colors to all events in this year
			yearEvents.forEach(event => {
				event.color = colorMap.get(event.title) || '#1976d2'; // Use the mapped color or fallback
			});
		});
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
				.addOption('agenda', 'Agenda')
				.addOption('year', 'Year')
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
