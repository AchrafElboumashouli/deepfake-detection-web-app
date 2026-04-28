import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

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
  confidence: number;
  face_detected: boolean;
  attention_weight: number;
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
  frame_predictions: FramePrediction[];
  gradcam_data?: GradCAMFrame[];
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

export async function POST(request: NextRequest) {
  try {
    console.log('[LOG] POST /api/predict-video called');
    
    const formData = await request.formData();
    const files = formData.getAll('files');

    console.log(`[LOG] Received ${files.length} video files`);

    if (!files || files.length === 0) {
      console.log('[LOG] No files provided');
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Proxy to Flask backend
    console.log(`[LOG] Proxying to Flask backend: ${BACKEND_URL}/predict-video`);
    
    const backendFormData = new FormData();
    for (const file of files) {
      if (file instanceof File) {
        backendFormData.append('files', file);
      }
    }

    const backendResponse = await fetch(`${BACKEND_URL}/predict-video`, {
      method: 'POST',
      body: backendFormData,
    });

    console.log(`[LOG] Backend response status: ${backendResponse.status}`);

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ 
        error: backendResponse.statusText 
      }));
      console.error('[LOG] Backend error:', errorData);
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    const data = await backendResponse.json();
    console.log(`[LOG] Returning ${data.predictions?.length || 0} video predictions`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[LOG] Video prediction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
