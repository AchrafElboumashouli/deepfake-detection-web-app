'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DocumentationPage() {
  return (
    <main className="min-h-screen bg-background py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-4 text-balance">
            Understanding Deepfakes
          </h1>
          <p className="text-xl text-muted-foreground">
            Learn about deepfake technology, how to detect it, and best practices for using our detector.
          </p>
        </div>

        {/* Section 1: What is a Deepfake */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">What is a Deepfake?</h2>
          
          <Card className="p-8 mb-6 border-border">
            <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
              A <strong>deepfake</strong> is a synthetic media file (image or video) where a person's likeness has been digitally altered or replaced using artificial intelligence. The term comes from <strong>"deep learning" + "fake."</strong>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div>
                <h3 className="font-semibold text-foreground mb-3">How Deepfakes Are Created</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-primary">→</span>
                    <span><strong>Face Swapping:</strong> Replacing one person's face with another</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">→</span>
                    <span><strong>Face Reenactment:</strong> Animating a face with different expressions</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">→</span>
                    <span><strong>Lip Syncing:</strong> Matching lips to a different voice</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">→</span>
                    <span><strong>Full Video Generation:</strong> Creating entirely synthetic video</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-3">Why They're Dangerous</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-destructive">●</span>
                    <span><strong>Misinformation:</strong> Spread false information at scale</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-destructive">●</span>
                    <span><strong>Reputation Damage:</strong> Harm individuals' reputation</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-destructive">●</span>
                    <span><strong>Fraud & Crime:</strong> Used for blackmail or financial fraud</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-destructive">●</span>
                    <span><strong>Trust Erosion:</strong> Undermine trust in media</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </section>

        {/* Section 2: How Our Detector Works */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">How Our Detector Works</h2>

          <Card className="p-8 mb-6 border-border">
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Our deepfake detector uses a <strong>Convolutional Neural Network (CNN) with attention mechanisms</strong> to identify synthetic faces. Here's the step-by-step process:
            </p>

            <div className="space-y-6">
              {[
                {
                  step: 1,
                  title: 'Face Detection',
                  desc: 'The system locates and extracts faces from your image using advanced face detection algorithms.'
                },
                {
                  step: 2,
                  title: 'Preprocessing',
                  desc: 'The extracted face is normalized and resized to a standard size for the neural network.'
                },
                {
                  step: 3,
                  title: 'Neural Network Analysis',
                  desc: 'A trained CNN with attention mechanisms analyzes the face pixels to detect artifacts and inconsistencies that indicate synthetic generation.'
                },
                {
                  step: 4,
                  title: 'Confidence Scoring',
                  desc: 'The network produces two scores: probability the face is REAL vs. FAKE.'
                },
                {
                  step: 5,
                  title: 'Grad-CAM Visualization',
                  desc: 'We generate a heatmap showing which areas of the face the network focused on for its decision.'
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 pb-6 border-b border-border/50 last:border-b-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <span className="font-bold text-primary">{item.step}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                    <p className="text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">Grad-CAM Explained</h4>
                <p className="text-muted-foreground text-sm">
                  Grad-CAM (Gradient-weighted Class Activation Mapping) highlights regions of the image that the neural network considers most important for its prediction. Darker areas = more important for the decision.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Limitations */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Important Limitations</h2>

          <Card className="p-8 border-border">
            <p className="text-muted-foreground mb-6 leading-relaxed">
              While our detector is highly accurate, it's important to understand its limitations for credibility and responsible use:
            </p>

            <div className="space-y-4">
              {[
                {
                  title: 'Not 100% Accurate',
                  desc: 'No deepfake detector is perfect. The model has a threshold accuracy rate, and edge cases can be misclassified.'
                },
                {
                  title: 'Image Quality Dependent',
                  desc: 'Low resolution, heavily compressed, or blurry images may produce unreliable results.'
                },
                {
                  title: 'Training Data Limitations',
                  desc: 'The model was trained on specific types of deepfake generation methods. New techniques may evade detection.'
                },
                {
                  title: 'Extreme Cases',
                  desc: 'Very realistic deepfakes created with state-of-the-art methods may not be detected.'
                },
                {
                  title: 'Face Detection Requirement',
                  desc: 'The detector requires a clear, visible face to analyze. Extreme angles or obstructions may fail.'
                },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-foreground">{item.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Section 4: Best Practices */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Best Practices for Users</h2>

          <Card className="p-8 border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  icon: CheckCircle,
                  title: 'Use Clear Images',
                  desc: 'Upload high-resolution, well-lit images for best detection accuracy.'
                },
                {
                  icon: CheckCircle,
                  title: 'Frontal Faces',
                  desc: 'Best results when faces are frontal or near-frontal. Extreme angles may fail.'
                },
                {
                  icon: CheckCircle,
                  title: 'Avoid Heavy Blur',
                  desc: 'While the system can handle some blur, avoid heavily blurred or obscured faces.'
                },
                {
                  icon: CheckCircle,
                  title: 'Single Faces',
                  desc: 'Best results with one clear face per image. Multiple faces may affect accuracy.'
                },
                {
                  icon: CheckCircle,
                  title: 'Consider Context',
                  desc: 'Use detection as part of a broader verification process, not as the sole truth.'
                },
                {
                  icon: CheckCircle,
                  title: 'Report Anomalies',
                  desc: 'If results seem incorrect, document the image and report for model improvement.'
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex gap-3">
                    <Icon className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        {/* CTA */}
        <section className="text-center py-12 border-t border-border mt-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Try It Out?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Now that you understand how deepfakes work and how our detector functions, test it with your own images.
          </p>
          <Link href="/#detector">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Start Detection
            </Button>
          </Link>
        </section>
      </div>
    </main>
  );
}
