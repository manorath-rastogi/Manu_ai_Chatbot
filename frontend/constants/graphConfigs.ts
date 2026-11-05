import { AgentConfiguration, IndexConfiguration } from '@/types/graphTypes';

type StreamConfigurables = AgentConfiguration;
type IndexConfigurables = IndexConfiguration;

export const retrievalAssistantStreamConfig: StreamConfigurables = {
  queryModel: 'groq/qwen/qwen3.8-27b',
  retrieverProvider: 'local',
  k: 4,
};

/**
 * The configuration for the indexing/ingestion process.
 */
export const indexConfig: IndexConfigurables = {
  useSampleDocs: false,
  retrieverProvider: 'local',
};
