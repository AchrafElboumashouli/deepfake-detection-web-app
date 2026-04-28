import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

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

export async function POST(request: NextRequest) {
  try {
    console.log('[LOG] POST /api/predict called');
    
    const formData = await request.formData();
    const files = formData.getAll('files');

    console.log(`[LOG] Received ${files.length} files`);

    if (!files || files.length === 0) {
      console.log('[LOG] No files provided');
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Proxy to Flask backend
    console.log(`[LOG] Proxying to Flask backend: ${BACKEND_URL}/predict`);
    
    const backendFormData = new FormData();
    for (const file of files) {
      if (file instanceof File) {
        backendFormData.append('files', file);
      }
    }

    const backendResponse = await fetch(`${BACKEND_URL}/predict`, {
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
    console.log(`[LOG] Returning ${data.predictions?.length || 0} predictions`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[LOG] Prediction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
