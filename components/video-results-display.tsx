'use client';

import { AlertCircle, CheckCircle2, TrendingUp, Film, Play } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, ComposedChartProps } from 'recharts';
import { useState } from 'react';

interface GradCAMFrame {
  frame_index: number;
  fake_score: number;
  attention_weight: number;
  gradcam_intensity: number;
}

interface FramePrediction {
  frame_index: number;
  timestamp: number;
  prediction: string;
  fake_score: number;
  real_score: number;
  frame_score: number;        // per-frame P(fake) from model output[2]
  confidence: number;
  face_detected?: boolean;
  attention_weight: number;   // always present in new model handler
}

interface VideoMetadata {
  total_frames: number;
  processed_frames: number;
  frame_size?: number;
  sampling_rate?: number;
  model_type?: string;
}

interface AggregatedResult {
  prediction: string;
  fake_score: number;
  real_score: number;
  confidence: number;
  threshold?: number;
  max_fake_score?: number;
  min_fake_score?: number;
  min_fake_frame?: number;
  max_fake_frame?: number;
  most_suspicious_frame?: number;
  most_attended_frame?: number;
  unique_frame_scores?: number;
  logit?: number;
  attention_weights?: number[];
  frame_scores?: number[];
  attention_is_uniform?: boolean;
  has_per_frame_scores?: boolean;       // new field name
  has_per_frame_predictions?: boolean;  // legacy alias — both sent by backend
  note?: string;
}

interface VideoResult {
  filename: string;
  is_video: boolean;
  prediction: string;
  confidence: number;
  fake_score: number;
  real_score: number;
  video_metadata: VideoMetadata;
  frame_predictions: FramePrediction[];
  gradcam_data?: GradCAMFrame[];  // Structured Grad-CAM metrics per frame
  aggregated: AggregatedResult;
  analysis_chart?: string | null;  // base64 PNG from backend GradCAM chart
  metadata?: {
    model_used?: string;
  };
  error?: string;
}

interface VideoResultsDisplayProps {
  results: VideoResult[];
}

export function VideoResultsDisplay({ results }: VideoResultsDisplayProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  if (results.length === 0) return null;

  const validResults = results.filter(r => !r.error);
  const fakeCount = validResults.filter((r) => r.aggregated.prediction === 'Fake').length;
  const realCount = validResults.filter((r) => r.aggregated.prediction === 'Real').length;
  
  const avgConfidence = validResults.length > 0
    ? validResults.reduce((sum, r) => sum + r.aggregated.confidence, 0) / validResults.length
    : 0;

  // Summary logged - detailed logs are in each section below

  return (
    <div className="w-full space-y-6">
      {/* Per-Video Results */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Video Analysis Results</h2>
        {results.map((result, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
          <Card key={idx} className="bg-card/60 overflow-hidden">
            <button
              onClick={() => {
                const newIndex = expandedIndex === idx ? null : idx;
                setExpandedIndex(newIndex);
              }}
              className="w-full text-left p-6 hover:bg-card/80 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Film className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground truncate">
                      {result.filename}
                    </h3>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Prediction</p>
                      <p className={`font-bold ${
                        result.aggregated.prediction === 'Fake' ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {result.aggregated.prediction}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className="font-bold text-foreground">
                        {Math.round(result.aggregated.confidence * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Frames Processed</p>
                      <p className="font-bold text-foreground">
                        {result.video_metadata.processed_frames}/{result.video_metadata.total_frames}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-bold text-foreground">
                        {result.frame_predictions.length > 0 
                          ? `${result.frame_predictions[result.frame_predictions.length - 1].timestamp.toFixed(1)}s`
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </div>
                <Play className={`h-5 w-5 text-muted-foreground transition-transform ${
                  expandedIndex === idx ? 'rotate-90' : ''
                }`} />
              </div>
            </button>

            {/* Expanded Details */}
            {expandedIndex === idx && (
              <div className="border-t border-border/50 p-6 space-y-6">
                {/* Score Distribution */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Aggregated Scores</h4>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Fake Score</span>
                          <span className="font-bold text-red-500">
                            {(result.aggregated.fake_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={result.aggregated.fake_score * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Real Score</span>
                          <span className="font-bold text-green-500">
                            {(result.aggregated.real_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={result.aggregated.real_score * 100} className="h-2" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Peak Scores</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Fake Score</span>
                        <span className="font-bold text-red-500">
                          {result.aggregated.max_fake_score !== undefined && isFinite(result.aggregated.max_fake_score * 100)
                            ? (result.aggregated.max_fake_score * 100).toFixed(1)
                            : (result.aggregated.fake_score * 100).toFixed(1)
                          }%
                          {result.aggregated.max_fake_frame !== undefined && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Frame {result.aggregated.max_fake_frame})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min Fake Score</span>
                        <span className="font-bold text-green-500">
                          {result.aggregated.min_fake_score !== undefined && isFinite(result.aggregated.min_fake_score * 100)
                            ? (result.aggregated.min_fake_score * 100).toFixed(1)
                            : (result.aggregated.fake_score * 100).toFixed(1)
                          }%
                          {result.aggregated.min_fake_frame !== undefined && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Frame {result.aggregated.min_fake_frame})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model Used</span>
                        <span className="font-bold text-foreground">
                          {result.metadata?.model_used || 'unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline Chart */}
                {result.frame_predictions.length > 0 && (
                  <div>
                    {(() => {
                      // Check if we have variation in frame scores
                      const frameScores = result.frame_predictions.map(f => f.fake_score);
                      const uniqueFrameScores = new Set(frameScores.map(s => s.toFixed(4))).size;
                      const hasFrameVariation = uniqueFrameScores > 1;
                      
                      const noteText = hasFrameVariation
                        ? `Frame-level prediction detected. Timeline shows ${uniqueFrameScores} distinct per-frame scores across ${result.frame_predictions.length} frames.`
                        : "All frames have the same prediction (model outputs video-level decision only).";
                      
                      return (
                        <div>
                        </div>
                      );
                    })()}
                    <h4 className="font-semibold text-foreground mb-3">Confidence Timeline (Per-Frame)</h4>
                    {(() => {
                      const chartData = result.frame_predictions.map(f => {
                        // FIX: Use actual per-frame scores, handle NaN/null values className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900"
                        const fakeScore = isFinite(f.fake_score) ? Math.round(f.fake_score * 100) : 0;
                        const realScore = isFinite(f.real_score) ? Math.round(f.real_score * 100) : 0;
                        const confidence = isFinite(f.confidence) ? Math.round(f.confidence * 100) : 0;
                        
                        return {
                          timestamp: f.timestamp.toFixed(1),
                          fake: fakeScore,
                          real: realScore,
                          confidence: confidence,
                          attention: isFinite(f.attention_weight) ? Math.round(f.attention_weight * 100) : 5,
                          frameIndex: f.frame_index
                        };
                      });
                      
                      // Debug timeline data
                      const fakeValues = chartData.map(d => d.fake);
                      const realValues = chartData.map(d => d.real);
                      const uniqueFakeValues = new Set(fakeValues).size;
                      const uniqueRealValues = new Set(realValues).size;
                      const fakeMin = Math.min(...fakeValues);
                      const fakeMax = Math.max(...fakeValues);
                      const fakeRange = fakeMax - fakeMin;
                      
                      console.log(`[LOG] Timeline chart for ${result.filename}:`);
                      console.log("[LOG]   Total data points:", chartData.length);
                      console.log("[LOG]   Fake score range:", fakeMin + "% - " + fakeMax + "% (variance: " + fakeRange + "%)");
                      console.log("[LOG]   Real score range:", Math.min(...realValues) + "% - " + Math.max(...realValues) + "%");
                      console.log("[LOG]   Unique fake values:", uniqueFakeValues);
                      console.log("[LOG]   Unique real values:", uniqueRealValues);
                      console.log("[LOG]   First 5 points:", chartData.slice(0, 5).map(d => ({ ts: d.timestamp, fake: d.fake, real: d.real })));
                      console.log("[LOG]   Last 5 points:", chartData.slice(-5).map(d => ({ ts: d.timestamp, fake: d.fake, real: d.real })));
                      
                      return (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="timestamp" 
                              tick={{ fontSize: 12 }}
                              label={{ value: 'Time (seconds)', position: 'insideBottomRight', offset: -5 }}
                            />
                            <YAxis 
                              tick={{ fontSize: 12 }}
                              label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }}
                              domain={[0, 100]}
                            />
                            <Tooltip 
                              formatter={(value) => `${value}%`}
                              labelFormatter={(label) => `${label}s`}
                              contentStyle={{
                                backgroundColor: '#1f2937',
                                border: '1px solid #374151',
                                borderRadius: '6px'
                              }}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="fake" 
                              stroke="#ff6b6b" 
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                              name="Fake Score"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="real" 
                              stroke="#51cf66" 
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                              name="Real Score"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                )}

                {/* Grad-CAM Intensity Analysis */}
                {result.gradcam_data && result.gradcam_data.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Grad-CAM Intensity & Explainability</h4>
                    {(() => {
                      const gradcamChartData = result.gradcam_data.map(g => ({
                        frame: g.frame_index,
                        intensity: Math.round(g.gradcam_intensity * 100),
                        fakeScore: Math.round(g.fake_score * 100),
                        attention: Math.round(g.attention_weight * 100),
                      }));
                      
                      return (
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Grad-CAM Intensity Bar Chart */}
                          <div>
                            <h5 className="text-sm font-medium text-muted-foreground mb-2">Model Attention Heatmap Intensity</h5>
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={gradcamChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                  dataKey="frame" 
                                  tick={{ fontSize: 12 }}
                                  label={{ value: 'Frame', position: 'insideBottomRight', offset: -5 }}
                                />
                                <YAxis 
                                  tick={{ fontSize: 12 }}
                                  label={{ value: 'Intensity (%)', angle: -90, position: 'insideLeft' }}
                                  domain={[0, 100]}
                                />
                                <Tooltip 
                                  formatter={(value) => `${value}%`}
                                  contentStyle={{
                                    backgroundColor: '#1f2937',
                                    border: '1px solid #374151',
                                    borderRadius: '6px'
                                  }}
                                />
                                <Bar 
                                  dataKey="intensity" 
                                  fill="#8884d8" 
                                  radius={[4, 4, 0, 0]}
                                  name="Intensity"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-muted-foreground mt-2">
                              Shows the mean activation strength of the model's attention regions (Grad-CAM heatmap).
                            </p>
                          </div>

                          {/* Attention vs Intensity Comparison */}
                          <div>
                            <h5 className="text-sm font-medium text-muted-foreground mb-2">Attention Weight vs Grad-CAM Intensity</h5>
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={gradcamChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                  dataKey="frame" 
                                  tick={{ fontSize: 12 }}
                                  label={{ value: 'Frame', position: 'insideBottomRight', offset: -5 }}
                                />
                                <YAxis 
                                  tick={{ fontSize: 12 }}
                                  label={{ value: 'Value (%)', angle: -90, position: 'insideLeft' }}
                                  domain={[0, 100]}
                                />
                                <Tooltip 
                                  formatter={(value) => `${value}%`}
                                  contentStyle={{
                                    backgroundColor: '#1f2937',
                                    border: '1px solid #374151',
                                    borderRadius: '6px'
                                  }}
                                />
                                <Legend />
                                <Line 
                                  type="monotone" 
                                  dataKey="attention" 
                                  stroke="#fbbf24" 
                                  strokeWidth={2}
                                  dot={false}
                                  isAnimationActive={false}
                                  name="Temporal Attention"
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="intensity" 
                                  stroke="#8884d8" 
                                  strokeWidth={2}
                                  dot={false}
                                  isAnimationActive={false}
                                  name="Grad-CAM Intensity"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-muted-foreground mt-2">
                              Compares temporal attention weights with spatial gradient attention from Grad-CAM.
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Multi-Signal Overlay Chart */}
                {result.gradcam_data && result.gradcam_data.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Multi-Signal Analysis (Fake Score, Attention, Grad-CAM)</h4>
                    {(() => {
                      const multiSignalData = result.gradcam_data.map(g => ({
                        frame: g.frame_index,
                        fakeScore: Math.round(g.fake_score * 100),
                        attention: Math.round(g.attention_weight * 100),
                        gradcam: Math.round(g.gradcam_intensity * 100),
                      }));
                      
                      return (
                        <div>
                          <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={multiSignalData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="frame" 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'Frame Index', position: 'insideBottomRight', offset: -5 }}
                              />
                              <YAxis 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'Value (%)', angle: -90, position: 'insideLeft' }}
                                domain={[0, 100]}
                              />
                              <Tooltip 
                                formatter={(value) => `${value}%`}
                                contentStyle={{
                                  backgroundColor: '#1f2937',
                                  border: '1px solid #374151',
                                  borderRadius: '6px'
                                }}
                              />
                              <Legend />
                              <Area 
                                type="monotone" 
                                dataKey="fakeScore" 
                                fill="#ef4444" 
                                stroke="#dc2626"
                                fillOpacity={0.3}
                                name="Fake Score"
                                isAnimationActive={false}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="attention" 
                                stroke="#f59e0b" 
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                                name="Temporal Attention"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="gradcam" 
                                stroke="#06b6d4" 
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                                name="Grad-CAM Intensity"
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                          <p className="text-xs text-muted-foreground mt-2">
                            Unified view showing correlation between model prediction (red area), temporal attention (orange line), and spatial attention Grad-CAM (cyan line). Peaks indicate frames that influence the final decision.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Frame Importance Ranking */}
                {result.gradcam_data && result.gradcam_data.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Frame Importance Ranking</h4>
                    {(() => {
                      const importanceData = result.gradcam_data
                        .map(g => ({
                          frame: g.frame_index,
                          importance: Math.round(
                            (g.fake_score * g.attention_weight * g.gradcam_intensity) * 1000
                          ) / 10, // percentage with one decimal
                          fakeScore: g.fake_score,
                          attention: g.attention_weight,
                          gradcam: g.gradcam_intensity,
                        }))
                        .sort((a, b) => b.importance - a.importance);

                      return (
                        <div>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart 
                              data={importanceData} 
                              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="frame" 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'Frame (ranked by importance)', position: 'insideBottomRight', offset: -5 }}
                              />
                              <YAxis 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'Importance Score', angle: -90, position: 'insideLeft' }}
                              />
                              <Tooltip 
                                formatter={(value) => `${value.toFixed(1)}`}
                                contentStyle={{
                                  backgroundColor: '#1f2937',
                                  border: '1px solid #374151',
                                  borderRadius: '6px'
                                }}
                                cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                              />
                              <Bar 
                                dataKey="importance" 
                                fill="#8b5cf6" 
                                radius={[4, 4, 0, 0]}
                                name="Importance"
                              >
                                {importanceData.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`}
                                    fill={entry.importance > 5 ? '#7c3aed' : entry.importance > 2 ? '#a78bfa' : '#ddd6fe'}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <p className="text-xs text-muted-foreground mt-2">
                            Computed as: fake_score × attention_weight × gradcam_intensity. Darker bars indicate frames with highest influence on the final prediction.
                          </p>
                          
                          <div className="mt-3 grid gap-2 text-sm">
                            <div><strong>Top 3 Most Important Frames:</strong></div>
                            {importanceData.slice(0, 3).map((frame, idx) => (
                              <div key={idx} className="text-muted-foreground">
                                Frame {frame.frame}: {frame.importance.toFixed(1)}% (Fake: {(frame.fakeScore * 100).toFixed(1)}%, Attn: {(frame.attention * 100).toFixed(1)}%, Grad-CAM: {(frame.gradcam * 100).toFixed(1)}%)
                              </div>
                            ))}
                          </div>
                          {/* GradCAM Analysis Chart — Spatial Attention Visualization */}
                          {result.analysis_chart && (
                            <div className="border-t pt-6">
                              <h4 className="font-semibold text-foreground mb-2">
                                Spatial Attention Heatmaps (Grad-CAM)
                              </h4>
                              <p className="text-xs text-muted-foreground mb-3">
                                Frame-by-frame visualization showing where the model focuses its attention. Warm colors (red/yellow) indicate high activation regions; cool colors (blue) indicate low activation.
                              </p>
                              <img
                                src={result.analysis_chart}
                                alt="Grad-CAM frame-by-frame heatmap visualization"
                                className="w-full rounded-lg border border-border shadow-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-3">
                                These visualizations overlay the model's spatial attention (Grad-CAM) on each analyzed frame, helping to interpret which facial regions contributed to the deepfake detection decision.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Heatmap Timeline */}
                {result.gradcam_data && result.gradcam_data.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Frame Risk Heatmap Timeline</h4>
                    {(() => {
                      const heatmapData = result.gradcam_data.map(g => ({
                        frame: g.frame_index,
                        risk: g.fake_score, // 0-1 scale
                      }));

                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1">
                              <div className="flex h-12 rounded-lg overflow-hidden border border-border">
                                {heatmapData.map((item, idx) => {
                                  const risk = item.risk;
                                  let bgColor = 'bg-green-700'; // Very safe
                                  
                                  if (risk > 0.8) bgColor = 'bg-red-700';
                                  else if (risk > 0.65) bgColor = 'bg-red-600';
                                  else if (risk > 0.5) bgColor = 'bg-red-500';
                                  else if (risk > 0.35) bgColor = 'bg-yellow-500';
                                  else if (risk > 0.2) bgColor = 'bg-green-600';

                                  return (
                                    <div
                                      key={idx}
                                      className={`flex-1 ${bgColor} hover:opacity-80 transition-opacity cursor-pointer`}
                                      title={`Frame ${item.frame}: ${(risk * 100).toFixed(1)}% fake`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Frame 0</span>
                            <span>Safe ← Risk → Suspicious</span>
                            <span>Frame {heatmapData.length - 1}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Color-coded timeline showing frame-by-frame risk assessment. Green = confident real, Red = confident fake.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Frame Distribution */}
                {result.frame_predictions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">
                      Frame-by-Frame Distribution
                    </h4>
                    <div className="space-y-3 text-sm">
                      {(() => {
                        const framePredictions = result.frame_predictions;
                        const predictions = framePredictions.map(f => f.prediction);
                        const uniquePredictions = new Set(predictions).size;
                        const fakeScores = framePredictions.map(f => f.fake_score);
                        const uniqueScores = new Set(fakeScores.map(s => s.toFixed(4))).size;
                        const fakeScoreRange = {
                          min: Math.min(...fakeScores),
                          max: Math.max(...fakeScores)
                        };
                        
                        // Helper function: Get color intensity based on fake score (0-1 range)
                        // Professional gradient: dark green (0% fake) → green (0-50%) → orange (50-65%) → red (65-100% fake)
                        const getFrameColor = (fakeScore: number) => {
                          if (fakeScore < 0.1) return 'bg-emerald-700';      // Very confident real (0-10%)
                          if (fakeScore < 0.2) return 'bg-emerald-600';      // Confident real (10-20%)
                          if (fakeScore < 0.3) return 'bg-green-600';        // Real (20-30%)
                          if (fakeScore < 0.4) return 'bg-green-500';        // Real (30-40%)
                          if (fakeScore < 0.5) return 'bg-lime-500';         // Leaning real (40-50%)
                          if (fakeScore < 0.65) return 'bg-amber-500';       // Suspicious/Borderline (50-65%)
                          if (fakeScore < 0.8) return 'bg-orange-500';       // Likely fake (65-80%)
                          return 'bg-red-600';                               // Very confident fake (80-100%)
                        };
                        
                        // Identify suspicious frames (fake_score > 10%)
                        const suspiciousFrames = framePredictions
                          .map((f, i) => ({ i, frame: f }))
                          .filter(x => x.frame.fake_score > 0.1);
                        
                        return (
                          <div>
                            <div>
                              <p className="text-muted-foreground mb-2">
                                Frames per prediction ({framePredictions.length} total) — Color intensity reflects confidence:
                              </p>
                              <div className="flex gap-1 flex-wrap">
                                {framePredictions.slice(0, 20).map((f, i) => {
                                  const isSuspicious = f.fake_score > 0.1;
                                  const bgColor = getFrameColor(f.fake_score);
                                  
                                  return (
                                    <div
                                      key={i}
                                      className={`h-8 w-8 rounded-sm flex items-center justify-center text-xs font-bold transition-all ${
                                        isSuspicious 
                                          ? 'ring-2 ring-orange-500 text-white ' + bgColor
                                          : 'text-white ' + bgColor
                                      }`}
                                      title={`Frame ${f.frame_index}: ${f.prediction} (Fake score: ${(f.fake_score * 100).toFixed(1)}%, Confidence: ${(f.confidence * 100).toFixed(0)}%)${isSuspicious ? ' ⚠️ Suspicious' : ''}`}
                                    >
                                      {i + 1}
                                    </div>
                                  );
                                })}
                                {framePredictions.length > 20 && (
                                  <div className="h-8 w-8 rounded-sm flex items-center justify-center text-xs font-bold text-muted-foreground bg-muted">
                                    +{framePredictions.length - 20}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Legend and additional info */}
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground mb-2">Color Scale:</p>
                              <div className="text-xs">
                                <p className="text-muted-foreground font-medium mb-2">Confidence Gradient:</p>
                                <div className="flex gap-0.5 h-6 rounded-lg overflow-hidden border border-border">
                                  <div className="flex-1 bg-emerald-700" title="0-10% fake: Very confident real"></div>
                                  <div className="flex-1 bg-emerald-600" title="10-20% fake: Confident real"></div>
                                  <div className="flex-1 bg-green-600" title="20-30% fake: Real"></div>
                                  <div className="flex-1 bg-green-500" title="30-40% fake: Real"></div>
                                  <div className="flex-1 bg-lime-500" title="40-50% fake: Leaning real"></div>
                                  <div className="flex-1 bg-amber-500" title="50-65% fake: Suspicious"></div>
                                  <div className="flex-1 bg-orange-500" title="65-80% fake: Likely fake"></div>
                                  <div className="flex-1 bg-red-600" title="80-100% fake: Very confident fake"></div>
                                </div>
                                <div className="flex justify-between mt-1 px-1">
                                  <span className="text-muted-foreground text-xs">0% (Real)</span>
                                  <span className="text-muted-foreground text-xs">50% (Borderline)</span>
                                  <span className="text-muted-foreground text-xs">100% (Fake)</span>
                                </div>
                              </div>
                              
                              {/*{suspiciousFrames.length > 0 && (
                                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                                  <p className="text-orange-900 font-medium">
                                    ⚠️ {suspiciousFrames.length} frame{suspiciousFrames.length === 1 ? '' : 's'} with fake score &gt; 10%: Frame{suspiciousFrames.length === 1 ? '' : 's'} {suspiciousFrames.map(x => x.frame.frame_index).join(', ')}
                                  </p>
                                </div>
                              )}*/}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                

                {/* Most suspicious frame callout */}
                {result.aggregated.most_suspicious_frame !== undefined && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-900">
                    <strong>Most suspicious frame:</strong> Frame {result.aggregated.most_suspicious_frame}
                    {result.aggregated.most_attended_frame !== undefined &&
                      result.aggregated.most_attended_frame !== result.aggregated.most_suspicious_frame && (
                      <span className="ml-3">
                        | <strong>Highest attention:</strong> Frame {result.aggregated.most_attended_frame}
                      </span>
                    )}
                    {result.aggregated.unique_frame_scores !== undefined && (
                      <span className="ml-3">
                        | <strong>Unique frame scores:</strong> {result.aggregated.unique_frame_scores}/16
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
        })}
      </div>
    </div>
  );
}
