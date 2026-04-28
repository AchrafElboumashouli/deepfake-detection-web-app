import os
from pathlib import Path

# Backend configuration
BACKEND_HOST = os.getenv('BACKEND_HOST', 'localhost')
BACKEND_PORT = int(os.getenv('BACKEND_PORT', 8000))
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# File upload configuration
UPLOAD_FOLDER = Path(__file__).parent / 'uploads'
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB for images
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB for videos
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4'}
ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS  # Combined for backward compatibility

# Video processing configuration
VIDEO_FRAME_SAMPLING_RATE = 1  # Extract 1 frame per second (in Hz)
VIDEO_MAX_FRAMES = 300  # Maximum frames to process from a video (to prevent OOM)
VIDEO_PROCESSING_TIMEOUT = 300  # Timeout in seconds for video processing

# Model configuration
# models.Model(inputs, outputs, name='DeepfakeDetector')
MODEL_NAME = 'DeepfakeDetector'
MODEL_VERSION = '1.0.0'
