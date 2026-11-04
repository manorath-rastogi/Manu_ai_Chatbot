import type React from 'react';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Toaster } from '@/components/ui/toaster';

import './globals.css';

export const metadata: Metadata = {
  title: 'Manu AI Chatbot | Intelligent Document Assistant',
  description:
    'High-performance AI Chatbot powered by LangGraph, LangChain, Next.js, and RAG document intelligence.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
