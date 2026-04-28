'use client';

import { Card } from '@/components/ui/card';
import { Zap, Brain, BarChart3, Eye } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Advanced Neural Network',
    description: 'State-of-the-art CNN with attention mechanisms for superior detection accuracy.',
  },
  {
    icon: Zap,
    title: 'Fast Detection',
    description: 'Analyze images in seconds with optimized inference pipeline.',
  },
  {
    icon: BarChart3,
    title: 'Detailed Analysis',
    description: 'Get confidence scores, Grad-CAM visualizations, and feature breakdowns.',
  },
  {
    icon: Eye,
    title: 'Face Detection',
    description: 'Automatic face extraction and verification for accurate analysis.',
  },
];

export function Features() {
  return (
    <section className="py-20 sm:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
            Powerful Features
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to detect synthetic media with confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="p-6 border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
