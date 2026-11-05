import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { graph as retrievalGraph } from './retrieval_graph/graph.js';
import { graph as ingestionGraph } from './ingestion_graph/graph.js';

dotenv.config();

const PORT = process.env.PORT || 2024;

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Health check
  if (pathname === '/ok' || pathname === '/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'Manu AI Chatbot Agent API' }));
    return;
  }

  // Create thread: POST /threads
  if (req.method === 'POST' && pathname === '/threads') {
    const threadId = uuidv4();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ thread_id: threadId, created_at: new Date().toISOString() }));
    return;
  }

  // Stream run: POST /threads/:thread_id/runs/stream
  const streamMatch = pathname.match(/^\/threads\/([^/]+)\/runs\/stream/);
  if (req.method === 'POST' && streamMatch) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const query = payload?.input?.query || payload?.input?.message || '';

        console.log(`[Stream Run] Query: "${query}"`);

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        });

        // Execute retrieval graph
        const result = await retrievalGraph.invoke({
          query: query,
          messages: [],
        });

        // 1. Send retrieved documents event (proper SSE event format)
        if (result.documents && result.documents.length > 0) {
          res.write(
            `event: updates\ndata: ${JSON.stringify({
              retrieveDocuments: {
                documents: result.documents,
              },
            })}\n\n`,
          );
        }

        // 2. Stream answer text in chunks to provide streaming effect
        const fullAnswer =
          result.messages[result.messages.length - 1]?.content ||
          'No answer generated.';

        const chunkSize = 35;
        for (let i = 0; i < fullAnswer.length; i += chunkSize) {
          const partial = fullAnswer.slice(0, i + chunkSize);
          res.write(
            `event: messages/partial\ndata: ${JSON.stringify([
              {
                type: 'ai',
                content: partial,
              },
            ])}\n\n`,
          );
          await new Promise((r) => setTimeout(r, 10));
        }

        // Ensure complete text is delivered in the final frame
        res.write(
          `event: messages/partial\ndata: ${JSON.stringify([
            {
              type: 'ai',
              content: fullAnswer,
            },
          ])}\n\n`,
        );

        res.end();
      } catch (err: any) {
        console.error('Error in stream run:', err);
        res.write(
          `event: messages/partial\ndata: ${JSON.stringify([
            {
              type: 'ai',
              content:
                'Sorry, an error occurred while generating the answer: ' +
                err.message,
            },
          ])}\n\n`,
        );
        res.end();
      }
    });
    return;
  }

  // Ingest wait run: POST /threads/:thread_id/runs/wait
  const waitMatch = pathname.match(/^\/threads\/([^/]+)\/runs\/wait/);
  if (req.method === 'POST' && waitMatch) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const docs = payload?.input?.docs || [];

        console.log(`[Ingest Wait] Received ${docs.length} documents.`);

        const result = await ingestionGraph.invoke({
          docs: docs,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', result }));
      } catch (err: any) {
        console.error('Error in wait run:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404 for other endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  🤖 Manu AI Chatbot Agent Server Live!`);
  console.log(`  🚀 Port: http://localhost:${PORT}`);
  console.log(`  📚 23 PDF Documents Indexed & Ready`);
  console.log(`  ⚡ Engine: Groq Free LLM (qwen/qwen3.8-27b)`);
  console.log(`==================================================\n`);
});
