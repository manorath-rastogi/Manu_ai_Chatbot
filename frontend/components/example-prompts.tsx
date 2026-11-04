import { Card } from '@/components/ui/card';
import { Sparkles, FileText, ListChecks, HelpCircle } from 'lucide-react';

interface ExamplePromptsProps {
  onPromptSelect: (prompt: string) => void;
}

const EXAMPLE_PROMPTS = [
  {
    title: 'Summarize Key Insights',
    description: 'Extract core takeaways and main findings from uploaded documents',
    prompt: 'Can you provide a comprehensive summary of key insights from the document?',
    icon: Sparkles,
  },
  {
    title: 'Executive Overview',
    description: 'Generate a high-level briefing tailored for stakeholders',
    prompt: 'Please provide an executive summary highlighting the main points.',
    icon: FileText,
  },
  {
    title: 'Action Items & Next Steps',
    description: 'Highlight key recommendations and actionable decisions',
    prompt: 'What are the main action items and next steps outlined here?',
    icon: ListChecks,
  },
  {
    title: 'Deep Analytical Q&A',
    description: 'Ask deep factual questions backed by verified document sources',
    prompt: 'Explain the core methodology and evidence supporting the document conclusions.',
    icon: HelpCircle,
  },
];

export function ExamplePrompts({ onPromptSelect }: ExamplePromptsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mt-4">
      {EXAMPLE_PROMPTS.map((item, i) => {
        const Icon = item.icon;
        return (
          <Card
            key={i}
            className="p-3.5 cursor-pointer border border-border/60 hover:border-primary/50 hover:bg-muted/40 transition-all duration-200 group text-left"
            onClick={() => onPromptSelect(item.prompt)}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {item.description}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
