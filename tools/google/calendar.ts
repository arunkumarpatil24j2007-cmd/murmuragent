// tools/google/calendar.ts — Google Calendar Integration Tools
// Direct integration with official Google Calendar API v3 using authenticated OAuth2Client.
// Schedules, inspects, and manages events on the user's authentic Google Calendar.

import { google } from 'googleapis';
import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from '../registry';
import { getAuthenticatedGoogleClient } from '@/lib/google-auth';
import { logger } from '@/lib/logger';

// MARK: - Tool Definitions

const calendarListEvents: ToolDefinition = {
  name: 'calendar.listEvents',
  description:
    'List scheduled events and meetings from Google Calendar. Can query by search term, or list upcoming events for today, tomorrow, or a date window.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'Optional free-text search term to filter events by summary, description, or attendee',
      required: false,
    },
    {
      name: 'timeMin',
      type: 'string',
      description: 'ISO string lower bound for an event\'s end time to filter by (defaults to current time if omitted)',
      required: false,
    },
    {
      name: 'timeMax',
      type: 'string',
      description: 'ISO string upper bound for an event\'s start time to filter by',
      required: false,
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of events to return (default: 10, max: 50)',
      required: false,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const calendarCreateEvent: ToolDefinition = {
  name: 'calendar.createEvent',
  description:
    'Schedule a new meeting or event on Google Calendar. Automatically parses start and end times, adds attendees, and returns the direct clickable Google Calendar event link.',
  parameters: [
    {
      name: 'summary',
      type: 'string',
      description: 'Title or subject of the meeting / event (e.g. "Product Sync", "Sync with John")',
      required: true,
    },
    {
      name: 'startTime',
      type: 'string',
      description:
        'ISO 8601 string or date-time of when the meeting starts (e.g. "2026-09-14T17:00:00+05:30" or "2026-09-14T17:00:00Z")',
      required: true,
    },
    {
      name: 'endTime',
      type: 'string',
      description:
        'ISO 8601 string or date-time of when the meeting ends. If omitted, defaults to 30 minutes after startTime.',
      required: false,
    },
    {
      name: 'description',
      type: 'string',
      description: 'Agenda, notes, or description for the calendar event',
      required: false,
    },
    {
      name: 'location',
      type: 'string',
      description: 'Physical location or virtual meeting URL (Google Meet / Zoom)',
      required: false,
    },
    {
      name: 'attendees',
      type: 'array',
      description: 'List of email addresses of attendees to invite to the event',
      required: false,
    },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const calendarDeleteEvent: ToolDefinition = {
  name: 'calendar.deleteEvent',
  description: 'Delete or cancel an existing event on Google Calendar by event ID.',
  parameters: [
    {
      name: 'eventId',
      type: 'string',
      description: 'The unique ID of the Google Calendar event to delete',
      required: true,
    },
  ],
  permission: PermissionLevel.DANGEROUS,
  source: 'api',
};

// MARK: - Registration

export function registerCalendarTools(): void {
  // 1. calendar.listEvents
  toolRegistry.register(calendarListEvents, async (args) => {
    const auth = await getAuthenticatedGoogleClient();
    if (!auth) {
      return {
        success: false,
        error:
          'Google Workspace is not connected. Please click [Connect Google] in the Connectors tab to authorize Google Calendar.',
      };
    }

    try {
      const calendar = google.calendar({ version: 'v3', auth });

      const now = new Date();
      const timeMin = args.timeMin ? String(args.timeMin) : now.toISOString();
      const timeMax = args.timeMax ? String(args.timeMax) : undefined;
      const maxResults = Math.min(Number(args.maxResults) || 10, 50);
      const query = args.query ? String(args.query) : undefined;

      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        q: query,
      });

      const items = res.data.items || [];
      const formattedEvents = items.map((ev) => ({
        id: ev.id,
        summary: ev.summary || '(No title)',
        description: ev.description || '',
        start: ev.start?.dateTime || ev.start?.date,
        end: ev.end?.dateTime || ev.end?.date,
        location: ev.location || '',
        htmlLink: ev.htmlLink,
        status: ev.status,
        attendees: ev.attendees?.map((a) => a.email).filter(Boolean) || [],
      }));

      return {
        success: true,
        count: formattedEvents.length,
        events: formattedEvents,
      };
    } catch (err) {
      logger.error('CalendarTools', 'Failed to list calendar events', { error: String(err) });
      return {
        success: false,
        error: `Failed to list calendar events: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  // 2. calendar.createEvent
  toolRegistry.register(calendarCreateEvent, async (args) => {
    const auth = await getAuthenticatedGoogleClient();
    if (!auth) {
      return {
        success: false,
        error:
          'Google Workspace is not connected. Please click [Connect Google] in the Connectors tab to authorize Google Calendar.',
      };
    }

    try {
      const calendar = google.calendar({ version: 'v3', auth });

      const summary = String(args.summary || 'Meeting');
      const startTimeStr = String(args.startTime);

      // Parse start and end times
      const startDateTime = new Date(startTimeStr);
      let endDateTime: Date;

      if (args.endTime) {
        endDateTime = new Date(String(args.endTime));
      } else {
        // Default 30 minutes duration
        endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);
      }

      // Handle attendees
      let attendeesList: Array<{ email: string }> | undefined;
      if (args.attendees && Array.isArray(args.attendees)) {
        attendeesList = args.attendees.map((email: unknown) => ({ email: String(email).trim() }));
      }

      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary,
          description: args.description ? String(args.description) : undefined,
          location: args.location ? String(args.location) : undefined,
          start: {
            dateTime: startDateTime.toISOString(),
          },
          end: {
            dateTime: endDateTime.toISOString(),
          },
          attendees: attendeesList,
        },
      });

      const event = res.data;
      const htmlLink = event.htmlLink || `https://calendar.google.com/calendar/u/0/r/eventedit/${event.id}`;

      return {
        success: true,
        event: {
          id: event.id,
          summary: event.summary,
          start: event.start?.dateTime,
          end: event.end?.dateTime,
          htmlLink,
          status: event.status,
          markdownLink: `[${event.summary || 'Google Calendar Event'}](${htmlLink})`,
        },
      };
    } catch (err) {
      logger.error('CalendarTools', 'Failed to create calendar event', { error: String(err) });
      return {
        success: false,
        error: `Failed to create calendar event: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  // 3. calendar.deleteEvent
  toolRegistry.register(calendarDeleteEvent, async (args) => {
    const auth = await getAuthenticatedGoogleClient();
    if (!auth) {
      return {
        success: false,
        error:
          'Google Workspace is not connected. Please click [Connect Google] in the Connectors tab to authorize Google Calendar.',
      };
    }

    try {
      const calendar = google.calendar({ version: 'v3', auth });
      const eventId = String(args.eventId);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });

      return {
        success: true,
        message: `Event ${eventId} deleted successfully.`,
      };
    } catch (err) {
      logger.error('CalendarTools', 'Failed to delete calendar event', { error: String(err) });
      return {
        success: false,
        error: `Failed to delete calendar event: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  logger.info('CalendarTools', 'Google Calendar tools registered (listEvents, createEvent, deleteEvent)');
}
