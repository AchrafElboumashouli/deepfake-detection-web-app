'use client';

import { Card } from '@/components/ui/card';
import { Upload, Zap, BarChart3, CheckCircle } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: Upload,
    title: 'Upload Image',
    description: 'Select one or multiple images to analyze. Supports PNG, JPG, GIF, BMP, and TIFF formats.',
  },
  {
    number: '2',
    icon: Zap,
    title: 'Face Detection',
    description: 'Our system automatically detects and extracts faces from your images.',
  },
  {
    number: '3',
    icon: BarChart3,
    title: 'AI Analysis',
    description: 'Advanced CNN with attention mechanisms analyzes the face for authenticity.',
  },
  {
    number: '4',
    icon: CheckCircle,
    title: 'Get Results',
    description: 'Receive confidence score, predictions, and detailed Grad-CAM visualizations.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 sm:py-32 bg-card/30 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
            How It Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A simple 4-step process to detect deepfakes and synthetic media.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[calc(100%+12px)] w-12 h-0.5 bg-gradient-to-r from-primary/50 to-transparent"></div>
                )}

                <Card className="p-6 border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    {step.number}
                  </div>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
