import {
  getWritingStyleMatrixForConnectionId,
  type WritingStyleMatrix,
} from '../../../services/writing-style-service';
import { escapeXml } from '../../../thread-workflow-utils/workflow-utils';
import { StyledEmailAssistantSystemPrompt } from '../../../lib/prompts';
import { webSearch } from '../../../routes/agent/tools';
import { activeConnectionProcedure } from '../../trpc';
import { getPrompt } from '../../../lib/brain';
import { stripHtml } from 'string-strip-html';
import { EPrompts } from '../../../types';
import { env } from '../../../env';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';

type ComposeEmailInput = {
  prompt: string;
  emailSubject?: string;
  to?: string[];
  cc?: string[];
  threadMessages?: Array<{
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
  }>;
  username: string;
  connectionId: string;
};

export async function composeEmail(input: ComposeEmailInput) {
  const { prompt, threadMessages = [], cc, emailSubject, to, username, connectionId } = input;

  const writingStyleMatrix = await getWritingStyleMatrixForConnectionId({
    connectionId,
  });

  const systemPrompt = await getPrompt(
    `${connectionId}-${EPrompts.Compose}`,
    StyledEmailAssistantSystemPrompt(),
  );
  const userPrompt = EmailAssistantPrompt({
    currentSubject: emailSubject,
    recipients: [...(to ?? []), ...(cc ?? [])],
    prompt,
    username,
    styleProfile: writingStyleMatrix?.style as WritingStyleMatrix,
  });

  const threadUserMessages = threadMessages.map((message) => ({
    role: 'user' as const,
    content: MessagePrompt({
      ...message,
      body: stripHtml(message.body).result,
    }),
  }));

  const messages =
    threadMessages.length > 0
      ? [
          {
            role: 'user' as const,
            content: "I'm going to give you the current email thread replies one by one.",
          } as const,
          {
            role: 'assistant' as const,
            content: 'Got it. Please proceed with the thread replies.',
          } as const,
          ...threadUserMessages,
          {
            role: 'assistant' as const,
            content: 'Got it. Please proceed with the email composition prompt.',
          },
        ]
      : [
          {
            role: 'user' as const,
            content: 'Now, I will give you the prompt to write the email.',
          },
          {
            role: 'assistant' as const,
            content: 'Ok, please continue with the email composition prompt.',
          },
        ];

  const { text } = await generateText({
    model: openai(env.OPENAI_MINI_MODEL || 'gpt-4o-mini'),
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    maxSteps: 10,
    maxTokens: 2_000,
    temperature: 0.35,
    frequencyPenalty: 0.2,
    presencePenalty: 0.1,
    maxRetries: 1,
    tools: {
      webSearch: webSearch(),
    },
  });

  return text;
}

export const compose = activeConnectionProcedure
  .input(
    z.object({
      prompt: z.string(),
      emailSubject: z.string().optional(),
      to: z.array(z.string()).optional(),
      cc: z.array(z.string()).optional(),
      threadMessages: z
        .array(
          z.object({
            from: z.string(),
            to: z.array(z.string()),
            cc: z.array(z.string()).optional(),
            subject: z.string(),
            body: z.string(),
          }),
        )
        .optional()
        .default([]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { sessionUser, activeConnection } = ctx;

    const newBody = await composeEmail({
      ...input,
      username: sessionUser.name,
      connectionId: activeConnection.id,
    });

    return { newBody };
  });

export const generateEmailSubject = activeConnectionProcedure
  .input(
    z.object({
      message: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { activeConnection } = ctx;
    const { message } = input;

    const writingStyleMatrix = await getWritingStyleMatrixForConnectionId({
      connectionId: activeConnection.id,
    });

    const subject = await generateSubject(message, writingStyleMatrix?.style as WritingStyleMatrix);

    return {
      subject,
    };
  });

const MessagePrompt = ({
  from,
  to,
  cc,
  body,
  subject,
}: {
  from: string;
  to: string[];
  cc?: string[];
  body: string;
  subject: string;
}) => {
  const parts: string[] = [];
  parts.push(`From: ${from}`);
  parts.push(`To: ${to.join(', ')}`);
  if (cc && cc.length > 0) {
    parts.push(`CC: ${cc.join(', ')}`);
  }
  parts.push(`Subject: ${subject}`);
  parts.push('');
  parts.push(`Body: ${body}`);

  return parts.join('\n');
};

const EmailAssistantPrompt = ({
  currentSubject,
  recipients,
  prompt,
  username,
  styleProfile,
}: {
  currentSubject?: string;
  recipients?: string[];
  prompt: string;
  username: string;
  styleProfile?: WritingStyleMatrix | null;
}) => {
  const parts: string[] = [];

  parts.push('# Email Composition Task');
  if (styleProfile) {
    parts.push('## Style Profile');
    parts.push(`\`\`\`json
  ${JSON.stringify(styleProfile, null, 2)}
  \`\`\``);
  }

  parts.push('## Email Context');

  if (currentSubject) {
    parts.push('## The current subject is:');
    parts.push(escapeXml(currentSubject));
    parts.push('');
  }

  if (recipients && recipients.length > 0) {
    parts.push('## The recipients are:');
    parts.push(recipients.join('\n'));
    parts.push('');
  }

  parts.push(
    '## This is a prompt from the user that could be empty, a rough email, or an instruction to write an email.',
  );
  parts.push(escapeXml(prompt));
  parts.push('');

  parts.push("##This is the user's name:");
  parts.push(escapeXml(username));
  parts.push('');

  parts.push(
    'Please write an email using this context and instruction. If there are previous messages in the thread use those for more context.',
    'Make sure to examine all context in this conversation to ALWAYS generate some sort of reply.',
    'Do not include ANYTHING other than the body of the email you write.',
  );

  return parts.join('\n\n');
};

const generateSubject = async (message: string, styleProfile?: WritingStyleMatrix | null) => {
  const parts: string[] = [];

  parts.push('# Email Subject Generation Task');
  if (styleProfile) {
    parts.push('## Style Profile');
    parts.push(`\`\`\`json
  ${JSON.stringify(styleProfile, null, 2)}
  \`\`\``);
  }

  parts.push('## Email Content');
  parts.push(escapeXml(message));
  parts.push('');
  parts.push(
    'Generate a concise, clear subject line that summarizes the main point of the email. The subject should be professional and under 100 characters.',
  );

  const { text } = await generateText({
    model: openai(env.OPENAI_MODEL || 'gpt-4o'),
    messages: [
      {
        role: 'system',
        content:
          'You are an email subject line generator. Generate a concise, clear subject line that summarizes the main point of the email. The subject should be professional and under 100 characters.',
      },
      {
        role: 'user',
        content: parts.join('\n\n'),
      },
    ],
    maxTokens: 50,
    temperature: 0.3,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    maxRetries: 1,
  });

  return text.trim();
};

export const transformEmailTone = activeConnectionProcedure
  .input(
    z.object({
      message: z.string(),
      tone: z.enum(['formal', 'casual', 'persuasive']),
      subject: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { activeConnection } = ctx;
    const { message, tone, subject } = input;

    const writingStyleMatrix = await getWritingStyleMatrixForConnectionId({
      connectionId: activeConnection.id,
    });

    const transformedMessage = await transformTone(
      message, 
      tone, 
      writingStyleMatrix?.style as WritingStyleMatrix,
      subject
    );

    return {
      transformedMessage,
    };
  });

const transformTone = async (
  message: string, 
  tone: 'formal' | 'casual' | 'persuasive',
  styleProfile?: WritingStyleMatrix | null,
  subject?: string
) => {
  const toneDescriptions = {
    formal: 'professional, polite, and respectful. Use proper grammar, avoid contractions, and maintain a business-appropriate tone',
    casual: 'friendly, relaxed, and conversational. Use contractions, simple language, and a warm, approachable tone',
    persuasive: 'compelling, convincing, and influential. Use strong action words, clear benefits, and persuasive language techniques'
  };

  const parts: string[] = [];
  
  parts.push('# Email Tone Transformation Task');
  
  if (styleProfile) {
    parts.push('## User Style Profile');
    parts.push(`\`\`\`json
${JSON.stringify(styleProfile, null, 2)}
\`\`\``);
  }

  if (subject) {
    parts.push('## Email Subject');
    parts.push(escapeXml(subject));
  }

  parts.push('## Current Email Content');
  parts.push(escapeXml(message));
  parts.push('');
  
  parts.push(`## Transformation Instructions`);
  parts.push(`Transform the above email content to have a ${tone} tone that is ${toneDescriptions[tone]}.`);
  parts.push('');
  parts.push('## Requirements:');
  parts.push('- Keep the core message and meaning intact');
  parts.push('- Only change the tone, style, and word choice');
  parts.push('- Maintain all important information and details');
  parts.push('- Return ONLY the transformed email body, no additional text');
  parts.push(`- Ensure the tone is clearly ${tone} throughout the entire message`);
  
  if (styleProfile) {
    parts.push('- Incorporate the user\'s writing style preferences where appropriate');
  }

  const { text } = await generateText({
    model: openai(env.OPENAI_MODEL || 'gpt-4o'),
    messages: [
      {
        role: 'system',
        content: `You are an expert email tone transformer. Your job is to rewrite emails to match a specific tone while preserving the original meaning and intent. Always maintain the core message while adapting the style, formality level, and word choice to match the requested tone.`,
      },
      {
        role: 'user',
        content: parts.join('\n\n'),
      },
    ],
    maxTokens: 1500,
    temperature: 0.4,
    frequencyPenalty: 0.2,
    presencePenalty: 0.1,
    maxRetries: 1,
  });

  return text.trim();
};