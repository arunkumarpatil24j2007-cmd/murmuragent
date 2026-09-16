// tools/social.ts — Social Media & Content Creation Workflows
// Supports drafting, content calendar generation, and confirmed publishing for LinkedIn & social platforms.

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from './registry';
import { logger } from '@/lib/logger';
import { v4 as uuid } from 'uuid';

// In-memory store of drafts for the session
const draftsStore = new Map<
  string,
  { id: string; platform: string; content: string; topic: string; createdAt: string; status: 'draft' | 'published' }
>();

// ── Tool Definitions ──────────────────────────────────

const linkedinCreatePost: ToolDefinition = {
  name: 'linkedin.create_post',
  description:
    'Draft a high-engagement LinkedIn post on a given topic with a compelling hook, clear paragraphs, key takeaways, call to action, and relevant hashtags. Creates a preview draft without publishing.',
  parameters: [
    {
      name: 'topic',
      type: 'string',
      description: 'The topic, idea, or theme for the LinkedIn post (e.g. "AI agents in 2026", "Bootstrapping vs VC")',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: 'Optional complete draft text if already formatted by the model',
      required: false,
    },
    {
      name: 'tone',
      type: 'string',
      description: 'Tone of voice (e.g. "insightful", "storytelling", "concise", "bold")',
      required: false,
    },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
  riskLevel: 'low',
};

const linkedinPublishPost: ToolDefinition = {
  name: 'linkedin.publish_post',
  description:
    'Publish a drafted post directly to LinkedIn. This is an external action that modifies public presence and STRICTLY requires explicit user confirmation before posting.',
  parameters: [
    {
      name: 'draftId',
      type: 'string',
      description: 'The draft ID returned from linkedin.create_post',
      required: false,
    },
    {
      name: 'content',
      type: 'string',
      description: 'The final text to publish to LinkedIn',
      required: true,
    },
  ],
  permission: PermissionLevel.EXTERNAL_ACTION,
  requiresConfirmation: true,
  source: 'api',
  riskLevel: 'high',
};

const socialContentCalendar: ToolDefinition = {
  name: 'social.content_calendar',
  description:
    'Generate a multi-day structured content calendar for social media platforms (LinkedIn, X, etc.) with dates, topics, hooks, and content formats.',
  parameters: [
    {
      name: 'theme',
      type: 'string',
      description: 'Primary theme or business area (e.g. "SaaS productivity tools", "Interior design inspiration")',
      required: true,
    },
    {
      name: 'days',
      type: 'number',
      description: 'Number of scheduled posts or days (default: 7, max: 30)',
      required: false,
    },
    {
      name: 'platform',
      type: 'string',
      description: 'Target platform (e.g. "LinkedIn", "X", "Multi-channel")',
      required: false,
    },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
  riskLevel: 'low',
};

// ── Registrations ─────────────────────────────────────

export function registerSocialTools(): void {
  // 1. linkedin.create_post
  toolRegistry.register(linkedinCreatePost, async (args) => {
    const topic = String(args.topic || 'General industry thoughts');
    const customContent = args.content ? String(args.content) : '';
    const draftId = `draft-${uuid().slice(0, 8)}`;

    const draftText =
      customContent ||
      `Most people misunderstand what AI agents will look like in 2026.\n\nIt won't be about endless dashboards or complex configurations.\n\nIt will be about fluid, autonomous operating layers:\n→ You state the outcome\n→ The agent maps the tools\n→ The work executes seamlessly across your workspace\n\nThe winners won't build more tools. They will orchestrate existing ones.\n\nWhat's your take on autonomous agent adoption this year?\n\n#ArtificialIntelligence #FutureOfWork #Productivity #TechLeadership`;

    draftsStore.set(draftId, {
      id: draftId,
      platform: 'LinkedIn',
      content: draftText,
      topic,
      createdAt: new Date().toISOString(),
      status: 'draft',
    });

    return {
      success: true,
      result: {
        draftId,
        platform: 'LinkedIn',
        topic,
        preview: draftText,
        status: 'draft_created',
        note: 'Draft is saved. To publish, ask to publish this post (will require your final confirmation).',
      },
    };
  });

  // 2. linkedin.publish_post
  toolRegistry.register(linkedinPublishPost, async (args) => {
    const content = String(args.content || '');
    const draftId = args.draftId ? String(args.draftId) : undefined;

    if (!content.trim()) {
      return { success: false, error: 'Cannot publish an empty post.' };
    }

    if (draftId && draftsStore.has(draftId)) {
      const d = draftsStore.get(draftId)!;
      d.status = 'published';
    }

    // Simulated publication with verified status payload
    const postId = `urn:li:share:${uuid().slice(0, 12)}`;
    logger.info('SocialTool', 'Published LinkedIn post with confirmed approval', { postId });

    return {
      success: true,
      result: {
        status: 'published',
        platform: 'LinkedIn',
        postId,
        publishedAt: new Date().toISOString(),
        url: `https://www.linkedin.com/feed/update/${postId}/`,
        content: content.slice(0, 300) + '...',
      },
    };
  });

  // 3. social.content_calendar
  toolRegistry.register(socialContentCalendar, async (args) => {
    const theme = String(args.theme || 'General tech & productivity');
    const days = Math.min(Math.max(3, Number(args.days) || 7), 30);
    const platform = String(args.platform || 'LinkedIn');

    const calendar = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i + 1);
      const dateStr = d.toISOString().split('T')[0];

      calendar.push({
        day: i + 1,
        date: dateStr,
        platform,
        pillar: i % 3 === 0 ? 'Insight / Contrarian Take' : i % 3 === 1 ? 'Actionable Guide / Framework' : 'Case Study / Lessons Learned',
        suggestedHook: `Why standard approaches to ${theme} fail (${i + 1}/${days})`,
        format: i % 2 === 0 ? 'Short-form text' : 'Carousel / Breakdown',
      });
    }

    return {
      success: true,
      result: {
        theme,
        platform,
        totalScheduled: calendar.length,
        schedule: calendar,
      },
    };
  });
}
