import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseRetriever } from '@langchain/core/retrievers';
import { Document } from '@langchain/core/documents';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PageChunk {
  source: string;
  pageNumber: number;
  content: string;
}

let cachedIndex: PageChunk[] | null = null;

export function resolveIndexPath(): string | null {
  const candidatePaths = [
    path.resolve(process.cwd(), 'backend/data/document_index.json'),
    path.resolve(process.cwd(), 'data/document_index.json'),
    path.resolve(__dirname, '../../../data/document_index.json'),
    path.resolve(__dirname, '../../data/document_index.json'),
    path.resolve(__dirname, '../data/document_index.json'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidatePaths[0];
}

export function getDocumentIndex(): PageChunk[] {
  if (cachedIndex && cachedIndex.length > 0) {
    return cachedIndex;
  }

  const indexPath = resolveIndexPath();
  if (indexPath && fs.existsSync(indexPath)) {
    try {
      const data = fs.readFileSync(indexPath, 'utf-8');
      cachedIndex = JSON.parse(data) as PageChunk[];
      return cachedIndex;
    } catch (e) {
      console.error('Error reading document index from', indexPath, e);
    }
  }

  return [];
}

const STOP_WORDS = new Set([
  'how',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'have',
  'has',
  'are',
  'was',
  'were',
  'can',
  'you',
  'your',
  'about',
  'into',
  'over',
  'after',
]);

export class LocalDocumentRetriever extends BaseRetriever {
  lc_namespace = ['manu', 'retrievers'];
  k: number;
  filterKwargs: Record<string, any>;

  constructor(fields?: { k?: number; filterKwargs?: Record<string, any> }) {
    super();
    this.k = fields?.k || 6;
    this.filterKwargs = fields?.filterKwargs || {};
  }

  async addDocuments(docs: Document[]): Promise<string[]> {
    const index = getDocumentIndex();
    const newChunks: PageChunk[] = [];

    for (const doc of docs) {
      const source =
        (doc.metadata?.source || doc.metadata?.filename || 'uploaded.pdf') as string;
      const pageNumber =
        (doc.metadata?.loc?.pageNumber || 1) as number;

      newChunks.push({
        source,
        pageNumber,
        content: doc.pageContent,
      });
      index.push({
        source,
        pageNumber,
        content: doc.pageContent,
      });
    }

    const indexPath = resolveIndexPath() || path.resolve(process.cwd(), 'backend/data/document_index.json');
    try {
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
      cachedIndex = index;
    } catch (e) {
      console.error('Failed to save updated document index:', e);
    }

    return docs.map((_, i) => String(i));
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const index = getDocumentIndex();
    if (!index || index.length === 0) {
      console.warn('Document index is empty. No documents found.');
      return [];
    }

    const queryTerms = query
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    if (queryTerms.length === 0) {
      return [];
    }

    const scored: Array<PageChunk & { score: number; termMatches: number }> = [];

    for (let i = 0; i < index.length; i++) {
      const item = index[i];

      // Optional document name filter
      if (
        this.filterKwargs?.source &&
        item.source !== this.filterKwargs.source
      ) {
        continue;
      }

      const textLower = item.content.toLowerCase();
      const sourceLower = item.source.toLowerCase();

      let score = 0;
      let termMatches = 0;

      for (const t of queryTerms) {
        let matched = false;
        if (sourceLower.includes(t)) {
          score += 20;
          matched = true;
        }
        if (textLower.includes(t)) {
          const count = textLower.split(t).length - 1;
          score += Math.min(count, 5) * 3;
          matched = true;
        }
        if (matched) termMatches++;
      }

      // High boost when multiple distinct query terms co-occur on the same page
      score += Math.pow(termMatches, 2) * 5;

      if (score > 0) {
        scored.push({ ...item, score, termMatches });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    // Limit at most 2 pages per document to prevent any single large PDF from crowding out others
    const docPageCount: Record<string, number> = {};
    const topResults: Array<PageChunk & { score: number }> = [];

    for (const item of scored) {
      const cleanSource = item.source.replace(/\s*\(\d+\)/g, '');
      docPageCount[cleanSource] = (docPageCount[cleanSource] || 0) + 1;
      if (docPageCount[cleanSource] <= 2) {
        topResults.push(item);
        if (topResults.length >= this.k) {
          break;
        }
      }
    }

    return topResults.map(
      (item) =>
        new Document({
          pageContent: item.content,
          metadata: {
            source: item.source,
            filename: item.source,
            loc: {
              pageNumber: item.pageNumber,
            },
            score: item.score,
          },
        }),
    );
  }
}
