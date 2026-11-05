import { Card } from '@/components/ui/card';
import { Sparkles, FileText, ListChecks, HelpCircle } from 'lucide-react';

interface ExamplePromptsProps {
  onPromptSelect: (prompt: string) => void;
}

const EXAMPLE_PROMPTS = [
  {
    title: 'DJI Drone Compass Calibration',
    description: 'Steps to calibrate compass on DJI Mavic 3',
    prompt: 'How do I calibrate the compass on a DJI Mavic drone?',
    icon: Sparkles,
  },
  {
    title: '.NET Developer Role',
    description: 'Core skills and responsibilities in IT',
    prompt: 'What are the main responsibilities of a .NET Software Developer?',
    icon: FileText,
  },
  {
    title: 'Scrum Product Owner Rules',
    description: 'Accountabilities defined in Scrum Guide 2020',
    prompt: 'What are the accountabilities of a Product Owner according to the Scrum Guide?',
    icon: ListChecks,
  },
  {
    title: 'CCNA 200-301 Exam Domains',
    description: 'Key network topics and scoring weight',
    prompt: 'What are the major domains covered in the CCNA 200-301 exam?',
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
