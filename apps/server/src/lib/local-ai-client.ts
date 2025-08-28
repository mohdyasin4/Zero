// Local AI client for LM Studio integration
export interface LocalAIConfig {
  baseURL: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LocalAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LocalAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class LocalAIClient {
  private config: LocalAIConfig;

  constructor(config: LocalAIConfig) {
    this.config = {
      baseURL: config.baseURL || 'http://localhost:1234',
      model: config.model || 'local-model',
      temperature: config.temperature || 0.4,
      maxTokens: config.maxTokens || 1500,
      ...config,
    };
  }

  async generateChatCompletion(messages: LocalAIMessage[]): Promise<string> {
    try {
      const response = await fetch(`${this.config.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Local AI request failed: ${response.status} ${response.statusText}`);
      }

      const data: LocalAIResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from local AI model');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Local AI client error:', error);
      throw new Error(
        error instanceof Error 
          ? `Local AI generation failed: ${error.message}`
          : 'Local AI generation failed with unknown error'
      );
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Create client instance with environment variables
export const createLMStudioClient = (config?: Partial<LocalAIConfig>) => {
  return new LocalAIClient({
    baseURL: config?.baseURL || 'http://localhost:1234',
    model: config?.model || 'qwen/qwen2.5-coder-14b',
    temperature: config?.temperature || 0.4,
    maxTokens: config?.maxTokens || 1500,
  });
};

