import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { initChatModel } from 'langchain/chat_models/universal';
import { ChatOpenAI } from '@langchain/openai';

const SUPPORTED_PROVIDERS = [
  'openai',
  'anthropic',
  'azure_openai',
  'cohere',
  'google-vertexai',
  'google-vertexai-web',
  'google-genai',
  'ollama',
  'together',
  'fireworks',
  'mistralai',
  'groq',
  'bedrock',
  'cerebras',
  'deepseek',
  'xai',
] as const;

/**
 * Load a chat model from a fully specified name.
 * Supports Groq natively via OpenAI-compatible API without extra dependencies.
 * @param fullySpecifiedName - String in the format 'provider/model'
 * @returns A Promise that resolves to a BaseChatModel instance.
 */
export async function loadChatModel(
  fullySpecifiedName: string,
  temperature: number = 0.2,
): Promise<BaseChatModel> {
  // If Groq is explicitly requested OR if GROQ_API_KEY is available and no OPENAI_API_KEY is configured
  const isGroq =
    fullySpecifiedName.startsWith('groq') ||
    Boolean(process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY);

  if (isGroq) {
    let modelName = 'qwen/qwen3.8-27b';
    if (fullySpecifiedName.startsWith('groq/')) {
      modelName = fullySpecifiedName.replace('groq/', '');
    } else if (process.env.GROQ_MODEL) {
      modelName = process.env.GROQ_MODEL;
    }
    return new ChatOpenAI({
      apiKey: process.env.GROQ_API_KEY,
      model: modelName,
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
      },
      temperature: temperature,
    });
  }

  const index = fullySpecifiedName.indexOf('/');
  if (index === -1) {
    if (
      !SUPPORTED_PROVIDERS.includes(
        fullySpecifiedName as (typeof SUPPORTED_PROVIDERS)[number],
      )
    ) {
      throw new Error(`Unsupported model: ${fullySpecifiedName}`);
    }
    return await initChatModel(fullySpecifiedName, {
      temperature: temperature,
    });
  } else {
    const provider = fullySpecifiedName.slice(0, index);
    const model = fullySpecifiedName.slice(index + 1);
    if (
      !SUPPORTED_PROVIDERS.includes(
        provider as (typeof SUPPORTED_PROVIDERS)[number],
      )
    ) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return await initChatModel(model, {
      modelProvider: provider,
      temperature: temperature,
    });
  }
}
