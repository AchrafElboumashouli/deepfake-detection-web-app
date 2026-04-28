from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
import logging
from pathlib import Path
from model_handler import get_detector, get_video_detector
import base64
from io import BytesIO
from PIL import Image
import numpy as np
from config import (BACKEND_HOST, BACKEND_PORT, DEBUG, UPLOAD_FOLDER, ALLOWED_EXTENSIONS, 
                   MAX_FILE_SIZE, MAX_VIDEO_SIZE, ALLOWED_IMAGE_EXTENSIONS, ALLOWED_VIDEO_EXTENSIONS,
                   VIDEO_FRAME_SAMPLING_RATE, VIDEO_MAX_FRAMES)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE


def allowed_file(filename):
    """Check if file extension is allowed (image or video)."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def is_video_file(filename):
    """Check if file is a video file."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS

def is_image_file(filename):
    """Check if file is an image file."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


@app.route('/predict', methods=['POST'])
def predict():
    """Enhanced prediction endpoint for IMAGE detection with model validation."""
    try:
        print("\n" + "="*80)
        print("[FLASK] API /predict ENDPOINT CALLED (IMAGE DETECTION)")
        print("="*80)
        logger.info("[ENDPOINT] Image prediction request received")

        # STRICT MODEL VALIDATION
        detector = get_detector()
        if not detector.model_loaded or detector.model is None:
            print("[FLASK] ✗ CRITICAL ERROR: Image model not loaded")
            print("[FLASK] Image predictions require images_model.keras")
            print("[FLASK] NO FALLBACK: Rejecting image prediction request")
            logger.error("[ENDPOINT] Image model not loaded. Rejecting prediction request.")
            return jsonify({'error': 'Image model not loaded. Model required: images_model.keras'}), 503

        if 'files' not in request.files:
            print("[FLASK] ✗ No files found in request")
            logger.warning("[ENDPOINT] No files in request")
            return jsonify({'error': 'No files provided'}), 400

        files = request.files.getlist('files')
        if not files:
            print("[FLASK] ✗ Empty file list")
            logger.warning("[ENDPOINT] Empty file list")
            return jsonify({'error': 'No files selected'}), 400

        print(f"[FLASK] ✓ Received {len(files)} file(s) for processing")
        logger.info(f"[ENDPOINT] Processing {len(files)} file(s)")

        predictions = []

        for idx, file in enumerate(files, 1):
            # FIX: initialise filepath to None before the try block so the
            # finally clause can safely check it regardless of where an
            # exception might be raised.
            filepath = None
            print(f"\n[FLASK] ─────────────────────────────────────────────────────────")
            print(f"[FLASK] File {idx}/{len(files)}: {file.filename}")
            print(f"[FLASK] ─────────────────────────────────────────────────────────")
            logger.info(f"[ENDPOINT] Processing file {idx}/{len(files)}: {file.filename}")

            if file.filename == '':
                print(f"[FLASK] ✗ Empty filename")
                logger.warning(f"[ENDPOINT] File {idx} has empty filename")
                continue

            if not allowed_file(file.filename):
                print(f"[FLASK] ✗ Invalid file extension (allowed: {', '.join(ALLOWED_EXTENSIONS)})")
                logger.warning(f"[ENDPOINT] File {file.filename} has invalid extension")
                predictions.append({
                    'filename': file.filename,
                    'error': 'File type not allowed. Use: png, jpg, jpeg, gif, bmp, tiff'
                })
                continue

            try:
                # Save file temporarily
                filename = secure_filename(file.filename)
                filepath = UPLOAD_FOLDER / filename
                file.save(str(filepath))
                print(f"[FLASK] ✓ File saved to {filepath}")
                print(f"[FLASK] ✓ File size: {filepath.stat().st_size / (1024**2):.2f} MB")
                logger.debug(f"[ENDPOINT] File saved to {filepath}")

                # Detect and extract face
                print(f"[FLASK] Running face detection...")
                face_img, original_img, face_bounds = detector.detect_and_extract_face(filepath)

                if face_img is None:
                    print(f"[FLASK] ✗ Face detection failed")
                    logger.error(f"[ENDPOINT] Could not process image: {file.filename}")
                    predictions.append({
                        'filename': file.filename,
                        'error': 'Could not read image file'
                    })
                    continue
                
                print(f"[FLASK] ✓ Face extracted: {face_img.shape}")
                print(f"[FLASK] Face bounds: {face_bounds}")

                # Preprocess image — returns (normalised HWC, batched NHWC)
                print(f"[FLASK] Preprocessing image...")
                preprocessed, batch = detector.preprocess_image(face_img)
                if preprocessed is None:
                    print(f"[FLASK] ✗ Preprocessing failed")
                    logger.error(f"[ENDPOINT] Preprocessing failed for {file.filename}")
                    predictions.append({
                        'filename': file.filename,
                        'error': 'Image preprocessing failed'
                    })
                    continue
                
                print(f"[FLASK] ✓ Preprocessing complete")
                print(f"[FLASK]   - Normalized image shape: {preprocessed.shape}")
                print(f"[FLASK]   - Normalized dtype: {preprocessed.dtype}")
                print(f"[FLASK]   - Value range: [{preprocessed.min():.4f}, {preprocessed.max():.4f}]")

                # uint8 version used for Grad-CAM overlay and display
                preprocessed_uint8 = (preprocessed * 255).astype(np.uint8)

                # Make prediction
                print(f"[FLASK] Running model inference...")
                result = detector.predict(preprocessed, preprocessed_uint8)
                if result is None:
                    print(f"[FLASK] ✗ Model prediction returned None")
                    logger.error(f"[ENDPOINT] Prediction failed for {file.filename}")
                    predictions.append({
                        'filename': file.filename,
                        'error': 'Prediction model error'
                    })
                    continue
                
                print(f"[FLASK] ✓ Prediction result received:")
                print(f"[FLASK]   - Prediction: {result['prediction']}")
                print(f"[FLASK]   - Real score: {result['real_score']}")
                print(f"[FLASK]   - Fake score: {result['fake_score']}")
                print(f"[FLASK]   - Confidence: {result['confidence']}")

                # Generate Grad-CAM visualization
                gradcam_image = detector.generate_gradcam(preprocessed, preprocessed_uint8)

                # Generate image comparison (base64 image)
                image_comparison = detector.generate_image_comparison(preprocessed_uint8, gradcam_image)

                # Get structured data for Recharts visualizations
                features_data = detector.get_feature_data(result.get('features', {}))
                prediction_data = detector.get_prediction_data(result)
                
                # Per-image metrics (confidence, fake_score, real_score)
                metrics = {
                    'confidence': result['confidence'],
                    'fake_score': result['fake_score'],
                    'real_score': result['real_score']
                }
                metrics_data = detector.get_metrics_data(metrics)

                # Convert original image to base64 for display
                original_pil = Image.fromarray(original_img.astype(np.uint8))
                original_buffer = BytesIO()
                original_pil.save(original_buffer, format='PNG')
                original_buffer.seek(0)
                original_base64 = base64.b64encode(original_buffer.getvalue()).decode()

                # Compile final result
                final_result = {
                    'filename': file.filename,
                    'prediction': result['prediction'],
                    'fake_score': result['fake_score'],
                    'real_score': result['real_score'],
                    'confidence': result['confidence'],
                    'features': result.get('features', {}),
                    'visualizations': {
                        'image_comparison': image_comparison,  # Keep base64 image
                        'featuresData': features_data,          # JSON for Recharts
                        'predictionData': prediction_data,      # JSON for Recharts
                        'metricsData': metrics_data              # JSON for Recharts
                    },
                    'images': {
                        'original': f"data:image/png;base64,{original_base64}"
                    },
                    'metadata': {
                        'face_detected': face_bounds is not None,
                        'preprocessed_shape': list(preprocessed.shape),
                        # Reports which inference path was taken
                        'model_used': 'keras' if detector.model_loaded else 'feature-based'
                    }
                }

                predictions.append(final_result)
                print(f"[FLASK] ✓ All visualizations generated")
                print(f"[FLASK] ✓ File {idx}/{len(files)} complete: {result['prediction']} ({result['confidence'] * 100:.1f}%)")
                logger.info(
                    f"[ENDPOINT] Prediction complete for {file.filename}: "
                    f"{result['prediction']} ({result['confidence'] * 100:.1f}%)"
                )

            except Exception as e:
                print(f"[FLASK] ✗ ERROR: {type(e).__name__}: {str(e)}")
                print("[FLASK] Traceback:")
                import traceback
                traceback.print_exc()
                logger.error(f"[ENDPOINT] Error processing {file.filename}: {e}", exc_info=True)
                predictions.append({
                    'filename': file.filename,
                    'error': f'Processing error: {str(e)}'
                })

            finally:
                # FIX: filepath is a Path object or None; guard before calling .exists()
                if filepath is not None and filepath.exists():
                    filepath.unlink()
                    logger.debug(f"[ENDPOINT] Cleaned up {filepath}")

        print(f"\n[FLASK] ═════════════════════════════════════════════════════════════")
        print(f"[FLASK] SENDING RESPONSE TO FRONTEND")
        print(f"[FLASK] ═════════════════════════════════════════════════════════════")
        print(f"[FLASK] Total predictions: {len(predictions)}")
        for i, pred in enumerate(predictions, 1):
            if 'error' in pred:
                print(f"[FLASK]   [{i}] {pred['filename']}: ERROR - {pred['error']}")
            else:
                print(f"[FLASK]   [{i}] {pred['filename']}: {pred['prediction']} (confidence: {pred['confidence']:.4f})")
        print(f"[FLASK] ═════════════════════════════════════════════════════════════\n")
        logger.info(f"[ENDPOINT] Returning {len(predictions)} results")
        return jsonify({'predictions': predictions})

    except Exception as e:
        print(f"\n[FLASK] ✗ CRITICAL ERROR IN /predict ENDPOINT")
        print(f"[FLASK] Exception: {type(e).__name__}")
        print(f"[FLASK] Message: {str(e)}")
        print("[FLASK] Full traceback:")
        import traceback
        traceback.print_exc()
        print(f"[FLASK] ═════════════════════════════════════════════════════════════\n")
        logger.error(f"[ENDPOINT] Critical error in predict: {e}", exc_info=True)
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/predict-video', methods=['POST'])
def predict_video():
    """Video deepfake detection endpoint with frame-by-frame analysis."""
    try:
        print("\n" + "="*80)
        print("[FLASK] API /predict-video ENDPOINT CALLED (VIDEO DETECTION)")
        print("="*80)
        logger.info("[ENDPOINT] Video prediction request received")

        # STRICT MODEL VALIDATION
        video_detector = get_video_detector()
        if not video_detector.model_loaded or video_detector.model is None:
            print("[FLASK] ✗ CRITICAL ERROR: Video model not loaded")
            print("[FLASK] Video predictions require videos_model.h5")
            print("[FLASK] NO FALLBACK: Rejecting video prediction request")
            logger.error("[ENDPOINT] Video model not loaded. Rejecting prediction request.")
            return jsonify({'error': 'Video model not loaded. Model required: videos_model.h5'}), 503

        if 'files' not in request.files:
            print("[FLASK] ✗ No files found in request")
            logger.warning("[ENDPOINT] No files in request")
            return jsonify({'error': 'No files provided'}), 400

        files = request.files.getlist('files')
        if not files:
            print("[FLASK] ✗ Empty file list")
            logger.warning("[ENDPOINT] Empty file list")
            return jsonify({'error': 'No files selected'}), 400

        print(f"[FLASK] ✓ Received {len(files)} file(s) for video processing")
        logger.info(f"[ENDPOINT] Processing {len(files)} video file(s)")

        predictions = []

        for idx, file in enumerate(files, 1):
            filepath = None
            print(f"\n[FLASK] ─────────────────────────────────────────────────────────")
            print(f"[FLASK] Video {idx}/{len(files)}: {file.filename}")
            print(f"[FLASK] ─────────────────────────────────────────────────────────")
            logger.info(f"[ENDPOINT] Processing video {idx}/{len(files)}: {file.filename}")

            if file.filename == '':
                print(f"[FLASK] ✗ Empty filename")
                logger.warning(f"[ENDPOINT] Video {idx} has empty filename")
                continue

            if not is_video_file(file.filename):
                print(f"[FLASK] ✗ Invalid video file extension (allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)})")
                logger.warning(f"[ENDPOINT] File {file.filename} is not a video")
                predictions.append({
                    'filename': file.filename,
                    'error': f'File type not allowed. Use: {", ".join(ALLOWED_VIDEO_EXTENSIONS)}'
                })
                continue

            try:
                # Save file temporarily
                filename = secure_filename(file.filename)
                filepath = UPLOAD_FOLDER / filename
                file.save(str(filepath))
                print(f"[FLASK] ✓ File saved to {filepath}")
                print(f"[FLASK] ✓ File size: {filepath.stat().st_size / (1024**2):.2f} MB")
                logger.debug(f"[ENDPOINT] Video saved to {filepath}")

                # Check file size
                file_size = filepath.stat().st_size
                if file_size > MAX_VIDEO_SIZE:
                    print(f"[FLASK] ✗ Video file exceeds max size ({MAX_VIDEO_SIZE // (1024**2)} MB)")
                    logger.error(f"[ENDPOINT] Video {file.filename} exceeds max size")
                    predictions.append({
                        'filename': file.filename,
                        'error': f'Video file too large. Maximum: {MAX_VIDEO_SIZE // (1024**2)} MB'
                    })
                    continue

                # Process video
                print(f"[FLASK] Processing video (sampling_rate={VIDEO_FRAME_SAMPLING_RATE}fps, max_frames={VIDEO_MAX_FRAMES})...")
                result = video_detector.process_video(
                    filepath,
                    sampling_rate=VIDEO_FRAME_SAMPLING_RATE,
                    max_frames=VIDEO_MAX_FRAMES
                )

                if result is None:
                    print(f"[FLASK] ✗ Video processing failed")
                    logger.error(f"[ENDPOINT] Video processing failed for {file.filename}")
                    predictions.append({
                        'filename': file.filename,
                        'error': 'Video processing failed'
                    })
                    continue

                print(f"[FLASK] ✓ Video processed successfully:")
                print(f"[FLASK]   - Total frames: {result['video_metadata']['total_frames']}")
                print(f"[FLASK]   - Processed frames: {result['video_metadata']['processed_frames']}")
                print(f"[FLASK]   - Aggregated prediction: {result['aggregated']['prediction']}")
                print(f"[FLASK]   - Aggregated confidence: {result['aggregated']['confidence']:.4f}")
                print(f"[FLASK]   - Fake score: {result['aggregated']['fake_score']:.4f}")
                print(f"[FLASK]   - Real score: {result['aggregated']['real_score']:.4f}")
                
                # Verify per-frame predictions
                if result['frame_predictions']:
                    frame_fake_scores = [f['fake_score'] for f in result['frame_predictions']]
                    unique_scores = len(set([round(s, 4) for s in frame_fake_scores]))
                    print(f"[FLASK]   - Per-frame fake scores: {[round(s, 4) for s in frame_fake_scores[:3]]} ... "
                          f"(total {len(frame_fake_scores)} frames)")
                    print(f"[FLASK]   - Unique per-frame scores: {unique_scores}/{len(frame_fake_scores)}")
                    if unique_scores == 1:
                        print(f"[FLASK]   ✓ CORRECT: All frames have SAME prediction")
                        print(f"[FLASK]   - This is expected - model outputs VIDEO-LEVEL prediction")
                        print(f"[FLASK]   - Timeline will show flat line with value: {frame_fake_scores[0]:.4f}")
                    else:
                        print(f"[FLASK]   - Score range: {min(frame_fake_scores):.4f} - {max(frame_fake_scores):.4f}")
                        print(f"[FLASK]   - Frame predictions are VARYING (unexpected for this model)")
                
                # Model analysis
                if result['aggregated'].get('attention_is_uniform'):
                    print(f"[FLASK]   - ANALYSIS: Attention weights are UNIFORM (1/{len(result['aggregated']['attention_weights'])})")
                    print(f"[FLASK]   - CONCLUSION: Model does NOT perform frame-level analysis")
                    print(f"[FLASK]   - RECOMMENDATION: Retrain model for temporal learning if frame-level needed")

                # Compile final result
                final_result = {
                    'filename'        : file.filename,
                    'is_video'        : True,
                    'prediction'      : result['aggregated']['prediction'],
                    'fake_score'      : result['aggregated']['fake_score'],
                    'real_score'      : result['aggregated']['real_score'],
                    'confidence'      : result['aggregated']['confidence'],
                    'video_metadata'  : result['video_metadata'],
                    'frame_predictions': result['frame_predictions'],
                    'gradcam_data'    : result.get('gradcam_data', []),  # Structured Grad-CAM metrics
                    'aggregated'      : result['aggregated'],
                    # GradCAM multi-panel chart (base64 PNG) — None if generation failed
                    'analysis_chart'  : result.get('analysis_chart'),
                    'metadata': {
                        'model_used': 'keras' if video_detector.model_loaded else 'feature-based'
                    }
                }

                predictions.append(final_result)
                print(f"[FLASK] ✓ Video {idx}/{len(files)} complete: {result['aggregated']['prediction']} "
                      f"({result['aggregated']['confidence'] * 100:.1f}%)")
                logger.info(
                    f"[ENDPOINT] Video processing complete for {file.filename}: "
                    f"{result['aggregated']['prediction']} ({result['aggregated']['confidence'] * 100:.1f}%)"
                )

            except Exception as e:
                print(f"[FLASK] ✗ ERROR: {type(e).__name__}: {str(e)}")
                print("[FLASK] Traceback:")
                import traceback
                traceback.print_exc()
                logger.error(f"[ENDPOINT] Error processing {file.filename}: {e}", exc_info=True)
                predictions.append({
                    'filename': file.filename,
                    'error': f'Processing error: {str(e)}'
                })

            finally:
                if filepath is not None and filepath.exists():
                    filepath.unlink()
                    logger.debug(f"[ENDPOINT] Cleaned up {filepath}")

        print(f"\n[FLASK] ═════════════════════════════════════════════════════════════")
        print(f"[FLASK] SENDING VIDEO RESPONSE TO FRONTEND")
        print(f"[FLASK] ═════════════════════════════════════════════════════════════")
        print(f"[FLASK] Total predictions: {len(predictions)}")
        for i, pred in enumerate(predictions, 1):
            if 'error' in pred:
                print(f"[FLASK]   [{i}] {pred['filename']}: ERROR - {pred['error']}")
            else:
                print(f"[FLASK]   [{i}] {pred['filename']}: {pred['prediction']} (confidence: {pred['confidence']:.4f})")
        print(f"[FLASK] ═════════════════════════════════════════════════════════════\n")
        logger.info(f"[ENDPOINT] Returning {len(predictions)} video results")
        return jsonify({'predictions': predictions})

    except Exception as e:
        print(f"\n[FLASK] ✗ CRITICAL ERROR IN /predict-video ENDPOINT")
        print(f"[FLASK] Exception: {type(e).__name__}")
        print(f"[FLASK] Message: {str(e)}")
        print("[FLASK] Full traceback:")
        import traceback
        traceback.print_exc()
        print(f"[FLASK] ═════════════════════════════════════════════════════════════\n")
        logger.error(f"[ENDPOINT] Critical error in predict-video: {e}", exc_info=True)
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    logger.debug("[HEALTH] Health check requested")
    return jsonify({
        'status': 'ok',
        'service': 'deepfake-detector',
        'version': '2.0.0'
    })


@app.route('/config', methods=['GET'])
def config_endpoint():
    """Return service configuration."""
    detector = get_detector()
    return jsonify({
        'image_size': [detector.img_height, detector.img_width],
        'channels': detector.img_channels,
        'threshold': detector.threshold,
        'allowed_formats': list(ALLOWED_EXTENSIONS),
        'max_file_size_mb': MAX_FILE_SIZE // (1024 * 1024),
        'model_loaded': detector.model_loaded
    })


if __name__ == '__main__':
    print("\n" + "="*80)
    print("[SERVER] DEEPFAKE DETECTION API - STARTING UP")
    print("="*80)
    logger.info("[SERVER] Starting Deepfake Detection API Server")
    
    print("[SERVER] Mode: DEBUG" if DEBUG else "[SERVER] Mode: PRODUCTION")
    print(f"[SERVER] Configured host: {BACKEND_HOST}")
    print(f"[SERVER] Configured port: {BACKEND_PORT}")
    
    print("\n[SERVER] Initializing detector and loading Keras model...")
    print("[SERVER] ─────────────────────────────────────────────────────────")
    logger.info("[SERVER] Initializing detector model...")
    detector = get_detector()
    
    print("[SERVER] ─────────────────────────────────────────────────────────")
    print(f"[SERVER] Model loaded status: {'YES' if detector.model_loaded else 'NO (using fallback)'}")
    print(f"[SERVER] Image dimensions: {detector.img_height}x{detector.img_width}")
    print(f"[SERVER] Detection threshold: {detector.threshold}")
    print(f"[SERVER] Upload folder: {UPLOAD_FOLDER}")
    print(f"[SERVER] Max file size: {MAX_FILE_SIZE // (1024**2)} MB")
    
    # Use BACKEND_HOST only in debug mode; bind to 0.0.0.0 in production
    host = BACKEND_HOST if DEBUG else '0.0.0.0'
    print("\n[SERVER] ═════════════════════════════════════════════════════════")
    print(f"[SERVER] API Server ready!")
    print(f"[SERVER] Listening on {host}:{BACKEND_PORT}")
    print("[SERVER] Endpoints:")
    print("[SERVER]   POST   /predict          - Run image deepfake detection")
    print("[SERVER]   POST   /predict-video    - Run video deepfake detection")
    print("[SERVER]   GET    /health           - Health check")
    print("[SERVER]   GET    /config           - Service configuration")
    print("[SERVER] ═════════════════════════════════════════════════════════\n")
    logger.info(f"[SERVER] Detector ready. Listening on {host}:{BACKEND_PORT}")
    app.run(debug=DEBUG, host=host, port=BACKEND_PORT, use_reloader=False)
