'use client';

import type React from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Paperclip,
  ArrowUp,
  Loader2,
  Bot,
  Sparkles,
  RotateCcw,
  FileText,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ExamplePrompts } from '@/components/example-prompts';
import { ChatMessage } from '@/components/chat-message';
import { FilePreview } from '@/components/file-preview';
import { client } from '@/lib/langgraph-client';
import {
  PDFDocument,
  RetrieveDocumentsNodeUpdates,
} from '@/types/graphTypes';

export default function Home() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      sources?: PDFDocument[];
    }>
  >([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastRetrievedDocsRef = useRef<PDFDocument[]>([]);

  const initThread = async () => {
    try {
      const thread = await client.createThread();
      setThreadId(thread.thread_id);
      return thread.thread_id;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast({
        title: 'Connection Notice',
        description:
          'Could not connect to LangGraph backend. Ensure the backend server is running on http://localhost:2024.',
        variant: 'destructive',
      });
      return null;
    }
  };

  useEffect(() => {
    if (!threadId) {
      initThread();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleResetChat = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setFiles([]);
    setInput('');
    setIsLoading(false);
    lastRetrievedDocsRef.current = [];
    const newThreadId = await initThread();
    if (newThreadId) {
      toast({
        title: 'New Session Started',
        description: 'Conversation context and documents reset.',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId || isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, sources: undefined },
      { role: 'assistant', content: '', sources: undefined },
    ]);
    setInput('');
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastRetrievedDocsRef.current = [];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          threadId,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value);
        const lines = chunkStr.split('\n').filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const sseString = line.slice('data: '.length);
          let sseEvent: any;
          try {
            sseEvent = JSON.parse(sseString);
          } catch (err) {
            console.error('Error parsing SSE line:', err, line);
            continue;
          }

          const { event, data } = sseEvent;

          if (event === 'messages/partial') {
            if (Array.isArray(data)) {
              const lastObj = data[data.length - 1];
              if (lastObj?.type === 'ai') {
                const partialContent = lastObj.content ?? '';

                if (
                  typeof partialContent === 'string' &&
                  !partialContent.startsWith('{')
                ) {
                  setMessages((prev) => {
                    const newArr = [...prev];
                    if (
                      newArr.length > 0 &&
                      newArr[newArr.length - 1].role === 'assistant'
                    ) {
                      newArr[newArr.length - 1].content = partialContent;
                      newArr[newArr.length - 1].sources =
                        lastRetrievedDocsRef.current;
                    }
                    return newArr;
                  });
                }
              }
            }
          } else if (event === 'updates' && data) {
            if (
              data &&
              typeof data === 'object' &&
              'retrieveDocuments' in data &&
              data.retrieveDocuments &&
              Array.isArray(data.retrieveDocuments.documents)
            ) {
              const retrievedDocs = (data as RetrieveDocumentsNodeUpdates)
                .retrieveDocuments.documents as PDFDocument[];
              lastRetrievedDocsRef.current = retrievedDocs;
            } else {
              lastRetrievedDocsRef.current = [];
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description:
          'Failed to send message. Please ensure the backend is running.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
      setMessages((prev) => {
        const newArr = [...prev];
        if (newArr.length > 0 && newArr[newArr.length - 1].role === 'assistant') {
          newArr[newArr.length - 1].content =
            'Sorry, there was an error processing your message. Please check the backend connection and try again.';
        }
        return newArr;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const nonPdfFiles = selectedFiles.filter(
      (file) => file.type !== 'application/pdf',
    );
    if (nonPdfFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF files only.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload files');
      }

      setFiles((prev) => [...prev, ...selectedFiles]);
      toast({
        title: 'Document Ingestion Complete',
        description: `${selectedFiles.length} file${
          selectedFiles.length > 1 ? 's' : ''
        } indexed into vector store.`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Upload failed',
        description:
          'Failed to upload files. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles(files.filter((file) => file !== fileToRemove));
    toast({
      title: 'File removed',
      description: `${fileToRemove.name} removed from active session`,
      variant: 'default',
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-foreground">
                  Manu AI Chatbot
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  RAG Agent
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <span
                className={`h-2 w-2 rounded-full ${
                  threadId ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>{threadId ? 'Agent Ready' : 'Connecting...'}</span>
            </div>

            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetChat}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Chat
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Chat Content */}
      <main className="flex-1 flex flex-col items-center p-4 md:p-8 max-w-5xl mx-auto w-full pb-36">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Next-Gen Document Intelligence</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground max-w-xl">
              Ask Anything About Your Documents
            </h1>

            <p className="mt-3 text-muted-foreground text-sm md:text-base max-w-lg leading-relaxed">
              Upload your PDF documents to ask in-depth questions with verified citations,
              or chat directly with the AI agent.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-md font-medium">
                <FileText className="h-3 w-3 text-blue-500" /> PDF Parsing
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-md font-medium">
                <Zap className="h-3 w-3 text-amber-500" /> Real-Time Streaming
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-md font-medium">
                <ShieldCheck className="h-3 w-3 text-emerald-500" /> Source Citations
              </span>
            </div>

            <ExamplePrompts onPromptSelect={setInput} />
          </div>
        ) : (
          <div className="w-full space-y-4 mb-4">
            {messages.map((message, i) => (
              <ChatMessage key={i} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Fixed Bottom Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent backdrop-blur-sm z-30">
        <div className="max-w-4xl mx-auto space-y-3">
          {files.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {files.map((file, index) => (
                <FilePreview
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() => handleRemoveFile(file)}
                />
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-2 border border-border/80 rounded-2xl p-1.5 shadow-sm bg-card transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Attach PDF Document"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isUploading
                    ? 'Uploading and indexing PDF...'
                    : 'Ask Manu AI anything or explore your documents...'
                }
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 bg-transparent text-sm"
                disabled={isUploading || isLoading || !threadId}
              />

              <Button
                type="submit"
                size="icon"
                className="rounded-xl h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-40"
                disabled={
                  !input.trim() || isUploading || isLoading || !threadId
                }
                title="Send Message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>

          <p className="text-[11px] text-center text-muted-foreground">
            Manu AI Chatbot orchestrates multi-agent RAG retrieval with vector embeddings to cite verified sources.
          </p>
        </div>
      </div>
    </div>
  );
}
