'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Zap, Lock } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
  return (
    <section className="hero-gradient relative overflow-hidden py-20 sm:py-32">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/10 blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-8 lg:space-y-10">
          {/* Badge */}
          <div className="inline-block">
            <div className="glass-effect px-4 py-2 rounded-full border border-border/50">
              <p className="text-sm font-medium text-primary">
                 Advanced AI Detection Technology
              </p>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground text-balance leading-tight">
              Detect 
              <span className="text-primary"> AI-Manipulated Media</span>
              <br />in Seconds
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto text-balance leading-relaxed">
              DeepFake Detector uses advanced CNN with attention mechanisms to identify synthetic content with high accuracy. Protect yourself from misinformation.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/#detector">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground group">
                Start Detection
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/documentation">
              <Button size="lg" variant="outline">
                Learn How It Works
              </Button>
            </Link>
          </div>

          {/* Feature Highlight */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-8">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <Zap className="h-5 w-5 text-secondary" />
              <span className="text-sm font-medium text-foreground">Fast Analysis</span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <Lock className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">Secure Processing</span>
            </div>
            <div className="flex items-center gap-2 justify-center sm:justify-end">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">AI-Powered</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
