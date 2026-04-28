'use client';

import { useState } from 'react';
import { UploadSection } from '@/components/upload-section';
import { ResultsDisplay } from '@/components/results-display';
import { VideoResultsDisplay } from '@/components/video-results-display';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';
import { Hero } from '@/components/hero';
import { Features } from '@/components/features';
import { HowItWorks } from '@/components/how-it-works';
import { Button } from '@/components/ui/button';

interface PredictionResult {
  filename: string;
  prediction: string;
  confidence: number;
  fake_score: number;
  real_score: number;
  features?: Record<string, any>;
  visualizations?: {
    feature_plot?: string;
    prediction_chart?: string;
  };
  metadata?: {
    face_detected?: boolean;
    preprocessed_shape?: number[];
  };
  error?: string;
}

interface VideoResult {
  filename: string;
  is_video: boolean;
  prediction: string;
  confidence: number;
  fake_score: number;
  real_score: number;
  video_metadata: {
    total_frames: number;
    processed_frames: number;
    sampling_rate: number;
  };
  frame_predictions: Array<{
    frame_index: number;
    timestamp: number;
    prediction: string;
    fake_score: number;
    real_score: number;
    confidence: number;
    face_detected: boolean;
  }>;
  aggregated: {
    prediction: string;
    fake_score: number;
    real_score: number;
    confidence: number;
    max_fake_score: number;
    max_real_score: number;
  };
  metadata?: {
    model_used?: string;
  };
  error?: string;
}

export default function Home() {
  const [imageResults, setImageResults] = useState<PredictionResult[]>([]);
  const [videoResults, setVideoResults] = useState<VideoResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = async (files: File[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to analyze images');
      }

      const data = await response.json();
      setImageResults(data.predictions || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while analyzing images';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoUpload = async (files: File[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/predict-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to analyze videos');
      }

      const data = await response.json();
      setVideoResults(data.predictions || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while analyzing videos';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (imageResults.length > 0 || videoResults.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {error && (
            <Alert variant="destructive" className="mb-8">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results Sections */}
          <div className="space-y-12">
            {imageResults.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Image Analysis Results ({imageResults.length})
                </h2>
                <ResultsDisplay results={imageResults} />
              </div>
            )}
            
            {videoResults.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Video Analysis Results ({videoResults.length})
                </h2>
                <VideoResultsDisplay results={videoResults} />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => {
                setImageResults([]);
                setVideoResults([]);
              }} 
              size="lg"
              className="px-8"
            >
              Analyze More Files
            </Button>
            <Button 
              onClick={() => {
                setImageResults([]);
                setVideoResults([]);
              }} 
              variant="outline" 
              size="lg"
              className="px-8"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Features />
      <HowItWorks />

      {/* Detection Section */}
      <section id="detector" className="py-20 sm:py-32 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
              Start Detecting Now
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your images or videos and get instant AI-powered deepfake detection results.
            </p>
          </div>

          {/* Info Alert */}
          <div className="mb-8 max-w-3xl mx-auto">
            <Alert className="border-primary/50 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                Upload images (PNG, JPG) or videos (MP4 max 500MB). The AI will analyze and provide confidence scores with detailed visualizations.
              </AlertDescription>
            </Alert>
          </div>

          {/* Upload Section */}
          <div className="max-w-3xl mx-auto">
            <UploadSection 
              onImageUpload={handleImageUpload} 
              onVideoUpload={handleVideoUpload}
              isLoading={isLoading} 
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-8 max-w-3xl mx-auto">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
