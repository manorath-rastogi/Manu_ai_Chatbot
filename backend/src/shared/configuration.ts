/**
 * Define the configurable parameters for the agent.
 */

import { Annotation } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';

/**
 * Base configuration state for indexing and retrieval operations.
 */
export const BaseConfigurationAnnotation = Annotation.Root({
  /**
   * The retriever provider to use for retrieval.
   * Options: 'local' (zero-database local file search) or 'supabase' (pgvector cloud)
   */
  retrieverProvider: Annotation<'supabase' | 'local'>,

  /**
   * Additional keyword arguments to pass to the search function of the retriever for filtering.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterKwargs: Annotation<Record<string, any>>,

  /**
   * The number of documents to retrieve.
   */
  k: Annotation<number>,
});

/**
 * Create a BaseConfiguration State instance from a RunnableConfig object.
 *
 * @param config - The configuration object to use.
 * @returns An instance of BaseConfiguration State with the specified configuration.
 */
export function ensureBaseConfiguration(
  config: RunnableConfig,
): typeof BaseConfigurationAnnotation.State {
  const configurable = (config?.configurable || {}) as Partial<
    typeof BaseConfigurationAnnotation.State
  >;
  return {
    retrieverProvider:
      configurable.retrieverProvider ||
      (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? 'supabase'
        : 'local'),
    filterKwargs: configurable.filterKwargs || {},
    k: configurable.k || 4,
  };
}
