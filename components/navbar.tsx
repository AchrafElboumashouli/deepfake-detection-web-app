'use client';

import Link from 'next/link';
import { Shield, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:inline">
              DeepFake Detector
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documentation">Learn</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/about">About</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 hover:bg-card rounded-lg transition-colors"
          >
            {isOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>

          {/* CTA Button */}
          <Link href="/#detector">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Start Detection
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-sm">
          <div className="px-4 py-4 space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              asChild
              onClick={() => setIsOpen(false)}
            >
              <Link href="/">Home</Link>
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              asChild
              onClick={() => setIsOpen(false)}
            >
              <Link href="/documentation">Learn</Link>
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              asChild
              onClick={() => setIsOpen(false)}
            >
              <Link href="/about">About</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
