'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Github, Mail } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-4 text-balance">
            About DeepFake Detector
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Advanced AI research meets practical security. Built for academic excellence and real-world impact.
          </p>
        </div>

        {/* Project Overview */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-6">Project Overview</h2>
          <Card className="p-8 border-border">
            <div className="space-y-4">
              <p className="text-lg text-muted-foreground leading-relaxed">
                DeepFake Detector is an <strong>AI-powered detection system</strong> built for research and academic purposes. Our mission is to help identify and combat deepfake content that threatens digital trust and information integrity.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                This final-year project (PFE) demonstrates the practical application of deep learning in cybersecurity and digital forensics. The system uses state-of-the-art CNN architectures with attention mechanisms to achieve high accuracy in detecting synthetic faces.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                By providing an intuitive interface and transparent decision-making (via Grad-CAM visualizations), we enable security professionals, researchers, and informed citizens to understand and verify media authenticity.
              </p>
            </div>

            {/* Goals */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold text-foreground mb-2">🎓 Academic Excellence</h4>
                <p className="text-sm text-muted-foreground">Demonstrate advanced understanding of deep learning and computer vision.</p>
              </div>
              <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
                <h4 className="font-semibold text-foreground mb-2">🛡️ Security Impact</h4>
                <p className="text-sm text-muted-foreground">Provide practical tools to combat misinformation and fraud.</p>
              </div>
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold text-foreground mb-2">🔬 Research Contribution</h4>
                <p className="text-sm text-muted-foreground">Contribute to the fight against synthetic media and deepfakes.</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Technologies */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-6">Technologies Used</h2>
          <Card className="p-8 border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-foreground mb-4">Backend</h3>
                <div className="space-y-3">
                  {['Flask', 'TensorFlow/Keras', 'OpenCV', 'Python'].map((tech) => (
                    <div key={tech} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      <span className="text-muted-foreground">{tech}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-4">Frontend</h3>
                <div className="space-y-3">
                  {['Next.js 16', 'React 19', 'Tailwind CSS', 'TypeScript'].map((tech) => (
                    <div key={tech} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-secondary"></div>
                      <span className="text-muted-foreground">{tech}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-muted/30 rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-4">Key Algorithms & Techniques</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-primary mb-1">CNN Architecture</p>
                  <p className="text-sm text-muted-foreground">Convolutional Neural Networks with attention mechanisms for feature extraction</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary mb-1">Grad-CAM</p>
                  <p className="text-sm text-muted-foreground">Gradient-weighted Class Activation Mapping for model interpretability</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary mb-1">Face Detection</p>
                  <p className="text-sm text-muted-foreground">Automated face extraction and preprocessing</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary mb-1">Transfer Learning</p>
                  <p className="text-sm text-muted-foreground">Leveraging pre-trained models for improved performance</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Team */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-6">Project Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                name: 'Project Lead',
                role: 'AI/ML Engineer',
                desc: 'Responsible for model architecture, training, and optimization.'
              },
              {
                name: 'Lead Developer',
                role: 'Full Stack Engineer',
                desc: 'Backend and frontend implementation, API design, integration.'
              },
            ].map((member, idx) => (
              <Card key={idx} className="p-6 border-border">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-primary">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{member.name}</h3>
                    <Badge className="mt-2">{member.role}</Badge>
                    <p className="text-sm text-muted-foreground mt-3">{member.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

         
        </section>

        {/* Metrics */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-6">Project Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Model Accuracy', value: '85%+' },
              { label: 'Processing Time', value: '<2s' },
              { label: 'Supported Formats', value: '6+' },
              { label: 'Batch Size', value: 'Unlimited' },
            ].map((metric, idx) => (
              <Card key={idx} className="p-6 border-border text-center">
                <p className="text-3xl font-bold text-primary mb-2">{metric.value}</p>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Future Roadmap */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-6">Future Roadmap</h2>
          <Card className="p-8 border-border">
            <div className="space-y-4">
              {[
                'Video deepfake detection',
                'Real-time webcam analysis',
                'Mobile app deployment',

                'Blockchain verification integration',
                'Advanced model refinement with new datasets',
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 pb-4 border-b border-border/50 last:border-b-0">
                  <span className="text-primary font-bold">→</span>
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Contact & Links */}
        <section className="text-center py-12 border-t border-border mt-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Get In Touch</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Have questions about the project or the technology? We'd love to hear from you.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="mailto:contact@example.com">
              <Button variant="outline" size="lg">
                <Mail className="h-5 w-5 mr-2" />
                Contact Us
              </Button>
            </a>
            <a href="#" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg">
                <Github className="h-5 w-5 mr-2" />
                GitHub
              </Button>
            </a>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 pt-12 border-t border-border">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-foreground mb-4">Ready to Test Our Technology?</h3>
            <Link href="/#detector">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Start Detection
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
