'use client';

import { AlertCircle, CheckCircle2, TrendingUp, Image as ImageIcon, Zap, Palette, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FeatureStatCard } from '@/components/ui/feature-stat-card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart as HorizontalBarChart } from 'recharts';

interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
}

interface FeatureData {
  colorMean: ChartDataPoint[];
  colorStd: ChartDataPoint[];
  textureMetrics: ChartDataPoint[];
  saturation: number;
}

interface Visualizations {
  image_comparison?: string;
  featuresData?: FeatureData;
  predictionData?: ChartDataPoint[];
  metricsData?: ChartDataPoint[];
}

interface Metadata {
  face_detected?: boolean;
  preprocessed_shape?: number[];
  model_used?: string;
}

interface PredictionResult {
  filename: string;
  prediction: string;
  confidence: number;
  fake_score: number;
  real_score: number;
  features?: Record<string, any>;
  visualizations?: Visualizations;
  images?: {
    original?: string;
  };
  metadata?: Metadata;
}

interface ResultsDisplayProps {
  results: PredictionResult[];
}

export function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (results.length === 0) return null;

  const fakeCount = results.filter((r) => r.prediction === 'Fake').length;
  const realCount = results.filter((r) => r.prediction === 'Real').length;

  const confidenceData = results.map((r) => ({
    filename: r.filename.slice(0, 20),
    confidence: Math.round(r.confidence * 100),
    prediction: r.prediction,
  }));

  const chartData = [
    { name: 'Fake', value: fakeCount, fill: 'hsl(0, 84.2%, 60.2%)' },
    { name: 'Real', value: realCount, fill: 'hsl(120, 100%, 45%)' },
  ];

  const avgConfidence =
    results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  return (
    <div className="w-full space-y-8">
      {/* Summary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/60 p-6 hover:bg-card/80 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Analyzed</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {results.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">images</p>
            </div>
            <ImageIcon className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="bg-card/60 p-6 hover:bg-card/80 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Detected Fake</p>
              <p className="mt-2 text-3xl font-bold text-red-500">
                {fakeCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {results.length > 0 ? Math.round((fakeCount / results.length) * 100) : 0}%
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="bg-card/60 p-6 hover:bg-card/80 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Verified Real</p>
              <p className="mt-2 text-3xl font-bold text-green-500">
                {realCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {results.length > 0 ? Math.round((realCount / results.length) * 100) : 0}%
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="bg-card/60 p-6 hover:bg-card/80 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Confidence</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {Math.round(avgConfidence * 100)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">detection</p>
            </div>
            <Zap className="h-8 w-8 text-amber-500" />
          </div>
        </Card>
      </div>

      {results.length > 1 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-card/60 p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Classification Overview
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="bg-card/60 p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Confidence Scores
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 20%)" />
                <XAxis dataKey="filename" stroke="hsl(0, 0%, 70%)" fontSize={12} />
                <YAxis stroke="hsl(0, 0%, 70%)" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(15, 25%, 12%)',
                    border: '1px solid hsl(220, 15%, 20%)',
                  }}
                />
                <Bar dataKey="confidence" fill="hsl(200, 100%, 50%)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Detailed Results</h3>
        {results.map((result, index) => (
          <Card key={index} className="bg-card/60 p-6">
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex-1">
                  <p className="font-medium text-foreground truncate">
                    {result.filename}
                  </p>
                  {result.metadata?.face_detected !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Face detected: {result.metadata.face_detected ? 'Yes' : 'No'}
                    </p>
                  )}
                </div>
                <div
                  className={`inline-block rounded-full px-4 py-2 text-sm font-semibold ${
                    result.prediction === 'Fake'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {result.prediction}
                </div>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fake Score</p>
                  <p className="text-2xl font-bold text-red-400">
                    {Math.round(result.fake_score * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Real Score</p>
                  <p className="text-2xl font-bold text-green-400">
                    {Math.round(result.real_score * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {Math.round(result.confidence * 100)}%
                  </p>
                </div>
              </div>

              {/* Original vs Grad-CAM Comparison */}
              {result.visualizations?.image_comparison && (
                <div className="border border-border rounded-lg p-3 bg-background/50 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Original vs Grad-CAM Analysis
                    </p>
                    {result.metadata?.model_used && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                        {result.metadata.model_used}
                      </span>
                    )}
                  </div>
                  <img
                    src={result.visualizations.image_comparison}
                    alt="Image Comparison"
                    className="w-full h-auto rounded border border-border"
                  />
                </div>
              )}

              {/* Visualization Charts Grid */}
              {result.visualizations && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Prediction Scores */}
                  {result.visualizations.predictionData && result.visualizations.predictionData.length > 0 && (
                    <Card className="bg-card/60 rounded-2xl shadow-md border-border/50">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold">Prediction Scores</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[320px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={result.visualizations.predictionData}>
                              <CartesianGrid strokeDasharray="4 2" stroke="hsl(220, 13%, 25%)" strokeOpacity={0.6} />
                              <XAxis 
                                dataKey="name" 
                                stroke="hsl(0, 0%, 60%)"
                                fontSize={12}
                              />
                              <YAxis 
                                stroke="hsl(0, 0%, 60%)" 
                                domain={[0, 1]}
                                fontSize={12}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(15, 25%, 12%)',
                                  border: '1px solid hsl(220, 15%, 25%)',
                                  borderRadius: '8px',
                                }}
                                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                              />
                              <Bar 
                                dataKey="value" 
                                fill="hsl(200, 100%, 50%)" 
                                radius={[6, 6, 0, 0]}
                                animationDuration={600}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                 {/* Performance Metrics */}
{result.visualizations.metricsData && result.visualizations.metricsData.length > 0 && (
  <Card className="bg-card/60 rounded-2xl shadow-md border-border/50">
    
    {/* Header */}
    <CardHeader className="pb-2">
      <CardTitle className="text-lg font-semibold">
        Performance Metrics
      </CardTitle>
    </CardHeader>

    {/* Content */}
    <CardContent className="pt-0">
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={result.visualizations.metricsData}
            layout="vertical"
            margin={{ top: 30, right: 24, left: 70, bottom: 10 }} // ✅ FIXED
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 13%, 25%)"
              strokeOpacity={0.5}
            />

            <XAxis
              type="number"
              domain={[0, 1]}
              stroke="hsl(0, 0%, 60%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              dataKey="name"
              type="category"
              stroke="hsl(0, 0%, 60%)"
              width={30} // ✅ FIXED (was too big)
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(15, 25%, 12%)",
                border: "1px solid hsl(220, 15%, 25%)",
                borderRadius: "10px",
              }}
              cursor={{ fill: "rgba(59, 130, 246, 0.08)" }}
              formatter={(value: number | string) =>
  `${(Number(value) * 100).toFixed(2)}%`
}
            />

            <Bar
              dataKey="value"
              fill="hsl(200, 100%, 50%)"
              radius={[0, 8, 8, 0]}
              barSize={46} // ✅ more professional thickness
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
)}

                  {/* Feature Analysis */}
                  {result.visualizations.featuresData && (
                    <Card className="bg-card/60 rounded-2xl shadow-md border-border/50 md:col-span-2">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold">Feature Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Color Mean */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">Color Mean</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={result.visualizations.featuresData.colorMean}>
                              <CartesianGrid strokeDasharray="4 2" stroke="hsl(220, 13%, 25%)" strokeOpacity={0.6} />
                              <XAxis dataKey="name" stroke="hsl(0, 0%, 60%)" fontSize={12} />
                              <YAxis stroke="hsl(0, 0%, 60%)" domain={[0, 1]} fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(15, 25%, 12%)',
                                  border: '1px solid hsl(220, 15%, 25%)',
                                  borderRadius: '8px',
                                }}
                                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                              />
                              <Bar dataKey="value" fill="hsl(200, 100%, 50%)" radius={[6, 6, 0, 0]} animationDuration={600} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Color Std Dev */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">Color Std Dev</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={result.visualizations.featuresData.colorStd}>
                              <CartesianGrid strokeDasharray="4 2" stroke="hsl(220, 13%, 25%)" strokeOpacity={0.6} />
                              <XAxis dataKey="name" stroke="hsl(0, 0%, 60%)" fontSize={12} />
                              <YAxis stroke="hsl(0, 0%, 60%)" fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(15, 25%, 12%)',
                                  border: '1px solid hsl(220, 15%, 25%)',
                                  borderRadius: '8px',
                                }}
                                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                              />
                              <Bar dataKey="value" fill="hsl(280, 100%, 50%)" radius={[6, 6, 0, 0]} animationDuration={600} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Texture Metrics */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">Texture Metrics</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={result.visualizations.featuresData.textureMetrics}>
                              <CartesianGrid strokeDasharray="4 2" stroke="hsl(220, 13%, 25%)" strokeOpacity={0.6} />
                              <XAxis dataKey="name" stroke="hsl(0, 0%, 60%)" fontSize={12} />
                              <YAxis stroke="hsl(0, 0%, 60%)" domain={[0, 1]} fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(15, 25%, 12%)',
                                  border: '1px solid hsl(220, 15%, 25%)',
                                  borderRadius: '8px',
                                }}
                                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                              />
                              <Bar dataKey="value" fill="hsl(30, 100%, 50%)" radius={[6, 6, 0, 0]} animationDuration={600} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Saturation */}
                        <div className="space-y-3 flex flex-col justify-center">
                          <p className="text-sm font-semibold text-foreground">Color Saturation</p>
                          <div className="space-y-2">
                            <Progress
                              value={result.visualizations.featuresData.saturation * 100}
                              className="h-2"
                            />
                            <p className="text-sm font-bold text-primary">
                              {(result.visualizations.featuresData.saturation * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Feature Details */}
              {result.features && Object.keys(result.features).length > 0 && (
                <div className="border-t border-border pt-6 mt-6">
                  <h4 className="text-lg font-semibold text-foreground mb-4">
                    Extracted Features
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {result.features.edge_density !== undefined && (
                      <FeatureStatCard
                        label="Edge Density"
                        value={result.features.edge_density * 100}
                        icon={Zap}
                      />
                    )}
                    {result.features.saturation !== undefined && (
                      <FeatureStatCard
                        label="Color Saturation"
                        value={result.features.saturation * 100}
                        icon={Palette}
                      />
                    )}
                    {result.features.frequency_amplitude !== undefined && (
                      <FeatureStatCard
                        label="Frequency Amplitude"
                        value={Math.min(100, (result.features.frequency_amplitude / 255) * 100)}
                        icon={Activity}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
