import numpy as np
import cv2
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.layers import TimeDistributed
from pathlib import Path
import logging
import base64
from io import BytesIO
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score, average_precision_score

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# Custom Keras layers — must match the saved model exactly
# ══════════════════════════════════════════════════════════════════════════════

class SEBlock(keras.layers.Layer):
    """Squeeze-and-Excitation block. build() required for Keras 3 serialization."""

    def __init__(self, channels: int, reduction: int = 16, **kwargs):
        super().__init__(**kwargs)
        self.channels  = channels
        self.reduction = reduction

    def build(self, input_shape):
        self.gap = keras.layers.GlobalAveragePooling2D()
        self.fc1 = keras.layers.Dense(self.channels // self.reduction, use_bias=False, activation='relu')
        self.fc2 = keras.layers.Dense(self.channels, use_bias=False, activation='sigmoid')
        super().build(input_shape)

    def call(self, x, training=False):
        s = self.gap(x)
        s = self.fc1(s)
        s = self.fc2(s)
        s = tf.reshape(s, [tf.shape(x)[0], 1, 1, self.channels])
        return x * s

    def get_config(self):
        cfg = super().get_config()
        cfg.update({'channels': self.channels, 'reduction': self.reduction})
        return cfg


class SpatialAttention(keras.layers.Layer):
    """Spatial attention via channel-wise avg+max → Conv2D. build() for Keras 3."""

    def __init__(self, kernel_size: int = 7, **kwargs):
        super().__init__(**kwargs)
        self.kernel_size = kernel_size

    def build(self, input_shape):
        self.conv = keras.layers.Conv2D(
            1, self.kernel_size, padding='same', use_bias=False, activation='sigmoid'
        )
        super().build(input_shape)

    def call(self, x, training=False):
        avg = tf.reduce_mean(x, axis=-1, keepdims=True)
        mx  = tf.reduce_max(x,  axis=-1, keepdims=True)
        att = self.conv(tf.concat([avg, mx], axis=-1))
        return x * att

    def get_config(self):
        cfg = super().get_config()
        cfg.update({'kernel_size': self.kernel_size})
        return cfg


class TemporalAttention(keras.layers.Layer):
    """
    Additive temporal attention over BiLSTM outputs.
    Uses tanh projection before scoring.
    build() is mandatory — without it Keras 3 deserialization crashes with
    'can only concatenate list (not tuple) to list'.
    """

    def __init__(self, hidden_dim: int = 512, **kwargs):
        super().__init__(**kwargs)
        self.hidden_dim = hidden_dim
        self.attn_proj  = keras.layers.Dense(hidden_dim, use_bias=True, activation='tanh')
        self.attn_score = keras.layers.Dense(1, use_bias=False)

    def build(self, input_shape):
        # input_shape may arrive as a list during deserialization — convert to tuple first
        input_shape = tuple(input_shape)
        self.attn_proj.build(input_shape)
        proj_shape = input_shape[:-1] + (self.hidden_dim,)
        self.attn_score.build(proj_shape)
        super().build(input_shape)

    def call(self, lstm_out, training=False):
        # lstm_out: (B, T, H*2)
        proj    = self.attn_proj(lstm_out)                   # (B, T, hidden_dim)
        scores  = self.attn_score(proj)                      # (B, T, 1)
        weights = tf.nn.softmax(scores, axis=1)              # (B, T, 1)
        context = tf.reduce_sum(weights * lstm_out, axis=1)  # (B, H*2)
        return context, tf.squeeze(weights, axis=-1)         # (B, H*2), (B, T)

    def get_config(self):
        cfg = super().get_config()
        cfg.update({'hidden_dim': self.hidden_dim})
        return cfg


class FocalBCE(keras.losses.Loss):
    """
    Focal Binary Cross-Entropy used during training.
    Required as a custom object for model deserialization even though
    compile=False means it is never called during inference.
    """

    def __init__(self, pos_weight: float = 1.0, gamma: float = 2.0,
                 smoothing: float = 0.05, **kwargs):
        super().__init__(**kwargs)
        self.pos_weight = pos_weight
        self.gamma      = gamma
        self.smoothing  = smoothing

    def call(self, y_true, y_pred):
        y_true   = tf.cast(y_true, tf.float32)
        y_pred   = tf.cast(tf.squeeze(y_pred, axis=-1), tf.float32)
        y_smooth = y_true * (1 - self.smoothing) + self.smoothing / 2
        p        = tf.sigmoid(y_pred)
        p_t      = y_true * p + (1 - y_true) * (1 - p)
        focal_wt = tf.pow(1.0 - p_t, self.gamma)
        bce      = tf.nn.weighted_cross_entropy_with_logits(y_smooth, y_pred, self.pos_weight)
        return tf.reduce_mean(focal_wt * bce)

    def get_config(self):
        cfg = super().get_config()
        cfg.update({'pos_weight': self.pos_weight, 'gamma': self.gamma, 'smoothing': self.smoothing})
        return cfg


class LabelSmoothingBCE(keras.losses.Loss):
    """Legacy loss kept for backward compatibility with older saved models."""

    def __init__(self, smoothing: float = 0.05, pos_weight: float = 1.0, **kwargs):
        super().__init__(**kwargs)
        self.smoothing  = smoothing
        self.pos_weight = pos_weight

    def call(self, y_true, y_pred):
        y_true   = tf.cast(y_true, tf.float32)
        y_pred   = tf.cast(tf.squeeze(y_pred, axis=-1), tf.float32)
        y_smooth = y_true * (1 - self.smoothing) + self.smoothing / 2
        return tf.reduce_mean(
            tf.nn.weighted_cross_entropy_with_logits(y_smooth, y_pred, self.pos_weight)
        )

    def get_config(self):
        cfg = super().get_config()
        cfg.update({'smoothing': self.smoothing, 'pos_weight': self.pos_weight})
        return cfg


# Shared custom-objects dict used by every load_model call in this file
_CUSTOM_OBJECTS = {
    'SEBlock'          : SEBlock,
    'SpatialAttention' : SpatialAttention,
    'TemporalAttention': TemporalAttention,
    'FocalBCE'         : FocalBCE,
    'LabelSmoothingBCE': LabelSmoothingBCE,
    'TimeDistributed'  : TimeDistributed,
}


# ══════════════════════════════════════════════════════════════════════════════
# Image detector (unchanged from original — kept for completeness)
# ══════════════════════════════════════════════════════════════════════════════

class DeepfakeDetector:
    """
    Image deepfake detector.
    Label mapping: {'Fake': 0, 'Real': 1}
    model output = P(Real)  →  fake_score = 1 - output
    """

    def __init__(self, model_path):
        self.model        = None
        self.face_cascade = None
        self.img_height   = 128
        self.img_width    = 128
        self.img_channels = 3
        self.threshold    = 0.5
        self.model_loaded = False
        self.model_path   = model_path
        self.model_type   = 'video' if 'video' in str(model_path).lower() else 'image'
        self.initialize()

    def initialize(self):
        try:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            if self.face_cascade.empty():
                logger.warning("[MODEL] Face cascade empty")
                self.face_cascade = None
        except Exception as e:
            logger.warning(f"[MODEL] Cascade load failed: {e}")
            self.face_cascade = None

        self._load_keras_model()

    def _load_keras_model(self):
        model_path = Path(self.model_path)
        if not model_path.exists():
            logger.error(f"[MODEL] Not found: {model_path}")
            return
        try:
            self.model = keras.models.load_model(
                str(model_path), custom_objects=_CUSTOM_OBJECTS, compile=False
            )
            self.model_loaded = True
            logger.info(f"[MODEL] Loaded {model_path.name} | input={self.model.input_shape}")
        except Exception as e:
            logger.error(f"[MODEL] Load failed: {e}", exc_info=True)

    def detect_and_extract_face(self, image_path):
        try:
            img = cv2.imread(str(image_path))
            if img is None:
                return None, None, None
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            if self.face_cascade is not None:
                gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                faces = self.face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
                if len(faces) > 0:
                    x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
                    margin = int(0.2 * max(w, h))
                    x = max(0, x - margin); y = max(0, y - margin)
                    w = min(img_rgb.shape[1] - x, w + 2 * margin)
                    h = min(img_rgb.shape[0] - y, h + 2 * margin)
                    return img_rgb[y:y+h, x:x+w], img_rgb, (x, y, w, h)
            return img_rgb, img_rgb, None
        except Exception as e:
            logger.error(f"[PREPROCESS] {e}")
            return None, None, None

    def preprocess_image(self, image_array):
        try:
            resized    = cv2.resize(image_array, (self.img_width, self.img_height))
            normalized = resized.astype(np.float32) / 255.0
            return normalized, np.expand_dims(normalized, axis=0)
        except Exception as e:
            logger.error(f"[PREPROCESS] {e}")
            return None, None

    def predict_image(self, image_array):
        if not self.model_loaded:
            return None
        try:
            _, batch      = self.preprocess_image(image_array)
            raw           = self.model.predict(batch, verbose=0)
            real_score    = float(raw[0][0])
            fake_score    = 1.0 - real_score
            prediction    = 'Real' if real_score > self.threshold else 'Fake'
            confidence    = max(fake_score, real_score)
            features      = self.extract_features(image_array)
            return {
                'fake_score': round(fake_score, 4),
                'real_score': round(real_score, 4),
                'confidence': round(confidence, 4),
                'prediction': prediction,
                'features'  : features,
            }
        except Exception as e:
            logger.error(f"[PREDICT-IMAGE] {e}", exc_info=True)
            return None

    # Alias so main.py can call either name
    def predict(self, image_array, image_uint8=None):
        """Alias for predict_image() — main.py calls detector.predict()."""
        return self.predict_image(image_array)

    def generate_gradcam(self, image_array, image_uint8):
        """
        Generate Grad-CAM heatmap for image-based deepfake detection.
        
        Properly selects the last convolutional layer, computes gradients 
        with respect to the fake class output, and generates a meaningful heatmap.
        
        Args:
            image_array: Preprocessed image (H, W, 3) float32, ImageNet-normalized
            image_uint8: Original image (H, W, 3) uint8 RGB
            
        Returns:
            overlay: (H, W, 3) uint8 RGB with Grad-CAM heatmap blended
        """
        if not self.model_loaded:
            return None
        try:
            # Find the last convolutional layer in the model
            # This is typically where the most meaningful spatial information is
            last_conv = None
            for layer in reversed(self.model.layers):
                # Look for the last Conv2D layer (4D output)
                if hasattr(layer, 'output') and len(layer.output.shape) == 4:
                    # Skip attention layers that might be added after conv
                    if 'conv' in layer.name.lower() or 'activation' in layer.name.lower():
                        last_conv = layer
                        break
            
            if last_conv is None:
                logger.warning("[GRADCAM] No suitable convolutional layer found")
                return None
            
            logger.debug(f"[GRADCAM] Using layer: {last_conv.name}")
            
            # Build gradient model: inputs → conv layer output & model output
            grad_model = keras.Model(
                inputs=self.model.inputs,
                outputs=[last_conv.output, self.model.output]
            )
            
            # Prepare input
            img_t = tf.constant(np.expand_dims(image_array, 0), dtype=tf.float32)
            
            # Compute gradients with respect to the model output
            with tf.GradientTape() as tape:
                conv_out, predictions = grad_model(img_t, training=False)
                tape.watch(conv_out)
                
                # Convert to tensor if needed
                if isinstance(predictions, (list, tuple)):
                    predictions = tf.convert_to_tensor(predictions, dtype=tf.float32)
                elif isinstance(predictions, np.ndarray):
                    predictions = tf.convert_to_tensor(predictions, dtype=tf.float32)
                
                # Handle different output shapes:
                # The model might return scalar (single prob), 1D, or 2D output
                # Model output is P(Real), so fake_score = 1 - output
                # For Grad-CAM, we compute gradients of (1 - output) to highlight "Fake" regions
                
                # First, ensure we have a tensor
                if not isinstance(predictions, tf.Tensor):
                    predictions = tf.convert_to_tensor(predictions, dtype=tf.float32)
                
                # Squeeze to remove batch dimension if it's there
                if len(predictions.shape) > 0:
                    pred_squeezed = tf.squeeze(predictions)
                else:
                    pred_squeezed = predictions
                
                # Compute fake_score = 1 - P(Real)
                # Use this for Grad-CAM to highlight regions supporting "Fake" prediction
                fake_class_output = 1.0 - pred_squeezed
            
            # Compute gradients of fake class with respect to conv layer output
            grads = tape.gradient(fake_class_output, conv_out)
            
            if grads is None:
                logger.warning("[GRADCAM] Gradients computation failed")
                return None
            
            # Global Average Pooling of gradients: (batch, H, W, C) → (C,)
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2)).numpy()
            
            # Get convolutional feature maps
            conv_outputs = conv_out[0].numpy()  # (H, W, C)
            
            # Compute weighted sum of feature maps using pooled gradients
            # This highlights which feature maps are important for the fake prediction
            heatmap = np.zeros((conv_outputs.shape[0], conv_outputs.shape[1]), dtype=np.float32)
            for i, grad_weight in enumerate(pooled_grads):
                heatmap += grad_weight * conv_outputs[:, :, i]
            
            # Apply ReLU to keep only positive contributions (features that push towards "Fake")
            heatmap = np.maximum(heatmap, 0)
            
            # Normalize to [0, 1]
            max_val = np.max(heatmap)
            if max_val > 1e-8:
                heatmap = heatmap / max_val
            else:
                logger.warning("[GRADCAM] Heatmap is all zeros or near-zero")
                return None
            
            # Resize heatmap to match original image dimensions
            # Using INTER_LINEAR for smooth interpolation
            heatmap_resized = cv2.resize(heatmap, (self.img_width, self.img_height), interpolation=cv2.INTER_LINEAR)
            
            # Normalize again after resizing (in case resizing affected values)
            heatmap_resized = np.clip(heatmap_resized, 0, 1)
            
            # Apply jet colormap: blue (low activation) → red (high activation)
            heatmap_rgb = cv2.cvtColor(
                cv2.applyColorMap((heatmap_resized * 255).astype(np.uint8), cv2.COLORMAP_JET),
                cv2.COLOR_BGR2RGB
            )
            
            # Blend original image with heatmap
            # 0.5 image + 0.5 heatmap = good visibility of both
            overlay = cv2.addWeighted(image_uint8, 0.5, heatmap_rgb, 0.5, 0)
            
            logger.debug(f"[GRADCAM] Successfully generated heatmap (max: {np.max(heatmap):.4f}, mean: {np.mean(heatmap):.4f})")
            return overlay
            
        except Exception as e:
            logger.error(f"[GRADCAM] {e}", exc_info=True)
            return None

    def generate_image_comparison(self, original_image, gradcam_image=None):
        try:
            fig, axes = plt.subplots(1, 2, figsize=(14, 6))
            axes[0].imshow(original_image); axes[0].set_title('Original'); axes[0].axis('off')
            if gradcam_image is not None:
                axes[1].imshow(gradcam_image)
                axes[1].set_title('Grad-CAM')
            else:
                axes[1].imshow(original_image, alpha=0.3)
                axes[1].text(0.5, 0.5, 'Grad-CAM unavailable',
                             ha='center', va='center', transform=axes[1].transAxes,
                             fontsize=11, color='white',
                             bbox=dict(boxstyle='round', facecolor='black', alpha=0.6))
                axes[1].set_title('Grad-CAM', color='gray')
            axes[1].axis('off')
            plt.tight_layout()
            buf = BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            plt.close(fig); buf.seek(0)
            return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
        except Exception as e:
            logger.error(f"[VIZ] {e}")
            return None

    def extract_features(self, image_array):
        """Extract visual features from a normalised [0,1] float32 image for visualization."""
        try:
            img_uint8 = (image_array * 255).astype(np.uint8)
            color_mean = np.mean(image_array, axis=(0, 1)).tolist()
            color_std  = np.std(image_array,  axis=(0, 1)).tolist()
            if len(image_array.shape) == 3 and image_array.shape[2] == 3:
                img_gray = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2GRAY)
            else:
                img_gray = img_uint8
            edges             = cv2.Canny(img_gray, 100, 200)
            edge_density      = float(np.sum(edges > 0) / edges.size)
            laplacian         = cv2.Laplacian(img_gray, cv2.CV_64F)
            frequency_amplitude = float(np.mean(np.abs(laplacian)))
            if len(image_array.shape) == 3 and image_array.shape[2] == 3:
                img_hsv    = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2HSV)
                saturation = float(np.mean(img_hsv[:, :, 1]) / 255.0)
            else:
                saturation = 0.5
            return {
                'color_mean'          : color_mean,
                'color_std'           : color_std,
                'edge_density'        : edge_density,
                'frequency_amplitude' : frequency_amplitude,
                'saturation'          : saturation,
            }
        except Exception as e:
            logger.error(f"[FEATURE] {e}")
            return {}

    def get_feature_data(self, features):
        """Return feature data in JSON format for Recharts visualization."""
        try:
            color_mean = features.get('color_mean', [0, 0, 0])
            color_std  = features.get('color_std',  [0, 0, 0])
            return {
                'colorMean': [
                    {'name': 'Red',   'value': float(color_mean[0]) if color_mean else 0},
                    {'name': 'Green', 'value': float(color_mean[1]) if len(color_mean) > 1 else 0},
                    {'name': 'Blue',  'value': float(color_mean[2]) if len(color_mean) > 2 else 0},
                ],
                'colorStd': [
                    {'name': 'Red',   'value': float(color_std[0]) if color_std else 0},
                    {'name': 'Green', 'value': float(color_std[1]) if len(color_std) > 1 else 0},
                    {'name': 'Blue',  'value': float(color_std[2]) if len(color_std) > 2 else 0},
                ],
                'textureMetrics': [
                    {'name': 'Edge Density',   'value': float(features.get('edge_density', 0))},
                    {'name': 'Frequency Amp',  'value': float(min(1.0, features.get('frequency_amplitude', 0) / 255.0))},
                ],
                'saturation': float(features.get('saturation', 0)),
            }
        except Exception as e:
            logger.error(f"[FEATURE] {e}")
            return {
                'colorMean'     : [{'name': c, 'value': 0} for c in ('Red', 'Green', 'Blue')],
                'colorStd'      : [{'name': c, 'value': 0} for c in ('Red', 'Green', 'Blue')],
                'textureMetrics': [{'name': m, 'value': 0} for m in ('Edge Density', 'Frequency Amp')],
                'saturation'    : 0,
            }

    def get_prediction_data(self, result):
        return [
            {'name': 'Fake', 'value': float(result['fake_score']), 'fill': '#ff6b6b'},
            {'name': 'Real', 'value': float(result['real_score']), 'fill': '#51cf66'},
        ]

    def get_metrics_data(self, metrics):
        return [
            {'name': k, 'value': float(v),
             'fill': '#4ecdc4' if v >= 0.8 else '#ffa502' if v >= 0.6 else '#ff6b6b'}
            for k, v in metrics.items()
        ]


# ══════════════════════════════════════════════════════════════════════════════
# Video detector — updated for the new 3-output model
# ══════════════════════════════════════════════════════════════════════════════

class VideoDeepfakeDetector(DeepfakeDetector):
    """
    Video deepfake detector using the fixed CNN-LSTM model.

    ╔══════════════════════════════════════════════════════════════════╗
    ║  MODEL: videos_model_final.keras                                 ║
    ║  Architecture: ResNet-50 + SE + SpatialAttn + BiLSTM x2          ║
    ║                + TemporalAttention                                ║
    ║                                                                  ║
    ║  Input : (B, 16, 224, 224, 3)                                    ║
    ║  Output: THREE tensors                                           ║
    ║    [0] logit        (B, 1)    raw logit  → sigmoid = P(fake)     ║
    ║    [1] attn_weights (B, 16)   temporal attention per frame       ║
    ║    [2] frame_scores (B, 16, 1) per-frame P(fake), already sigmoid║
    ║                                                                  ║
    ║  Label: 0 = Real, 1 = Fake                                       ║
    ║  Threshold: optimal_threshold from training (default 0.45)       ║
    ║                                                                  ║
    ║  Preprocessing per frame:                                        ║
    ║    1. Face detect + crop (Haar cascade, 30% margin)              ║
    ║    2. Resize to 224×224                                           ║
    ║    3. / 255.0  →  [0, 1]                                         ║
    ║    4. ImageNet normalisation: (x - MEAN) / STD                   ║
    ╚══════════════════════════════════════════════════════════════════╝
    """

    NUM_FRAMES    = 16
    FRAME_SIZE    = 224
    FACE_MARGIN   = 0.3
    IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def __init__(self, model_path, threshold: float = 0.45):
        # threshold = optimal_threshold saved from training notebook
        self.threshold = threshold
        super().__init__(model_path)

    # ── Model loading ──────────────────────────────────────────────────────────
    def _load_keras_model(self):
        """Load with all required custom objects including FocalBCE."""
        model_path = Path(self.model_path)
        if not model_path.exists():
            logger.error(f"[VIDEO-MODEL] Not found: {model_path}")
            return
        try:
            logger.info(f"[VIDEO-MODEL] Loading {model_path.name} "
                        f"({model_path.stat().st_size / 1e6:.1f} MB)…")
            self.model = keras.models.load_model(
                str(model_path), custom_objects=_CUSTOM_OBJECTS, compile=False
            )
            self.model_loaded = True
            n_outputs = len(self.model.outputs)
            logger.info(f"[VIDEO-MODEL] Loaded OK — {n_outputs} output(s): "
                        f"{[str(o.shape) for o in self.model.outputs]}")
            if n_outputs != 3:
                logger.warning(
                    f"[VIDEO-MODEL] Expected 3 outputs (logit, attn, frame_scores) "
                    f"but got {n_outputs}. Per-frame scores will be estimated."
                )
        except Exception as e:
            logger.error(f"[VIDEO-MODEL] Load failed: {e}", exc_info=True)

    # ── Frame preprocessing ───────────────────────────────────────────────��────
    def _preprocess_frame(self, frame_rgb: np.ndarray) -> np.ndarray:
        """
        Single frame: face-detect → crop → resize 224×224 → /255 → ImageNet norm.
        Falls back to centre-crop when no face is detected.
        Returns float32 (224, 224, 3).
        """
        h, w    = frame_rgb.shape[:2]
        face    = None

        if self.face_cascade is not None:
            try:
                gray  = cv2.cvtColor(
                    cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2GRAY
                )
                faces = self.face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
                if len(faces) > 0:
                    x, y, fw, fh = max(faces, key=lambda r: r[2] * r[3])
                    mx = int(max(fw, fh) * self.FACE_MARGIN)
                    x1, y1 = max(0, x - mx), max(0, y - mx)
                    x2, y2 = min(w, x + fw + mx), min(h, y + fh + mx)
                    face = frame_rgb[y1:y2, x1:x2]
            except Exception:
                pass

        if face is None or face.size == 0:
            s = min(h, w)
            y0, x0 = (h - s) // 2, (w - s) // 2
            face = frame_rgb[y0:y0+s, x0:x0+s]

        resized = cv2.resize(face, (self.FRAME_SIZE, self.FRAME_SIZE))
        normed  = resized.astype(np.float32) / 255.0
        return ((normed - self.IMAGENET_MEAN) / self.IMAGENET_STD).astype(np.float32)

    # ── Frame extraction ───────────────────────────────────────────────────────
    def _extract_uniform_frames(self, video_path: str):
        """
        Extract exactly NUM_FRAMES frames with uniform temporal stride.
        Returns list of (frame_rgb_uint8, timestamp_sec) or None on error.
        """
        try:
            cap = cv2.VideoCapture(str(video_path))
            if not cap.isOpened():
                logger.error(f"[VIDEO] Cannot open: {video_path}")
                return None

            total   = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps     = cap.get(cv2.CAP_PROP_FPS) or 25.0
            if total < 1:
                cap.release()
                return None

            indices = np.linspace(0, total - 1, self.NUM_FRAMES, dtype=int)
            frames  = []

            for idx in indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
                ret, frame = cap.read()
                if ret:
                    frames.append((
                        cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
                        float(idx) / fps
                    ))

            cap.release()

            # Pad with last frame if video is shorter than NUM_FRAMES
            while len(frames) < self.NUM_FRAMES:
                frames.append(frames[-1] if frames else
                               (np.zeros((self.FRAME_SIZE, self.FRAME_SIZE, 3), np.uint8), 0.0))

            logger.info(f"[VIDEO] Extracted {len(frames)} frames from {Path(video_path).name}")
            return frames

        except Exception as e:
            logger.error(f"[VIDEO] Frame extraction error: {e}", exc_info=True)
            return None

    # ── Inference ────────────�����─────────────────────────────────────────────────
    def _run_model(self, video_tensor: np.ndarray):
        """
        Run model on (1, T, H, W, 3) tensor.
        Returns (p_fake, attn_weights, frame_scores) where:
          p_fake       : float in [0, 1]
          attn_weights : list[float] length T   — temporal attention
          frame_scores : list[float] length T   — per-frame P(fake)

        Handles all three model variants:
          - 3 outputs: logit + attn + frame_scores  ← new fixed model
          - 2 outputs: logit + attn                 ← old model
          - 1 output : logit only                   ← single-output wrapper
        """
        outputs = self.model.predict(video_tensor, verbose=0)
        n_out   = len(outputs) if isinstance(outputs, (list, tuple)) else 1

        logger.debug(f"[INFERENCE] Model returned {n_out} output(s)")

        if n_out >= 3:
            # ── New 3-output model (fixed notebook) ───────────────────────────
            logit_raw    = float(outputs[0][0][0])
            attn_weights = outputs[1][0].tolist()           # (T,)
            frame_scores = outputs[2][0, :, 0].tolist()     # (T,) already sigmoid
            p_fake       = float(1.0 / (1.0 + np.exp(-logit_raw)))
            logger.debug("[INFERENCE] 3-output model: using real frame_scores")

        elif n_out == 2:
            # ── Old 2-output model: estimate per-frame scores from attn ───────
            logit_raw    = float(outputs[0][0][0])
            attn_weights = outputs[1][0].tolist()
            p_fake       = float(1.0 / (1.0 + np.exp(-logit_raw)))
            # Scale video-level score by attention to approximate per-frame variation
            frame_scores = [
                float(np.clip(p_fake * w * self.NUM_FRAMES, 0.0, 1.0))
                for w in attn_weights
            ]
            logger.warning("[INFERENCE] 2-output model — per-frame scores estimated from attention")

        else:
            # ── Single-output model (logit only) ──────────────────────────────
            logit_raw    = float(outputs[0][0]) if hasattr(outputs[0], '__len__') else float(outputs[0])
            p_fake       = float(1.0 / (1.0 + np.exp(-logit_raw)))
            attn_weights = [1.0 / self.NUM_FRAMES] * self.NUM_FRAMES
            frame_scores = [p_fake] * self.NUM_FRAMES
            logger.warning("[INFERENCE] Single-output model — uniform attn and frame scores")

        return p_fake, attn_weights, frame_scores

    # ── GradCAM for video ─────────────────────────────────────��────────────────
    def compute_gradcam_intensity(self, frame_norm: np.ndarray) -> float:
        """
        Compute Grad-CAM intensity (mean of normalized heatmap) for a frame.
        Uses the same proper Grad-CAM computation as generate_video_gradcam.

        Args:
            frame_norm: (H, W, 3) float32, ImageNet-normalised

        Returns:
            intensity: float in [0, 1], mean activation of the heatmap
        """
        if not self.model_loaded:
            return 0.0
        try:
            # Get CNN sub-model from TimeDistributed wrapper
            cnn = self.model.get_layer('time_distributed_cnn').layer

            # Find the last convolutional layer
            last_conv = None
            for layer in reversed(cnn.layers):
                if hasattr(layer, 'output') and len(layer.output.shape) == 4:
                    if 'conv' in layer.name.lower() or 'activation' in layer.name.lower():
                        last_conv = layer
                        break

            if last_conv is None:
                logger.warning("[GRADCAM-INTENSITY] No suitable convolutional layer found")
                return 0.0

            grad_model = keras.Model(
                inputs=cnn.inputs,
                outputs=[last_conv.output, cnn.output],
                name='gradcam_intensity'
            )

            frame_t = tf.constant(np.expand_dims(frame_norm, 0), dtype=tf.float32)

            with tf.GradientTape() as tape:
                conv_out, model_output = grad_model(frame_t, training=False)
                tape.watch(conv_out)
                
                # Convert to tensor if needed
                if isinstance(model_output, (list, tuple)):
                    model_output = tf.convert_to_tensor(model_output, dtype=tf.float32)
                elif isinstance(model_output, np.ndarray):
                    model_output = tf.convert_to_tensor(model_output, dtype=tf.float32)
                
                # Ensure we have a tensor
                if not isinstance(model_output, tf.Tensor):
                    model_output = tf.convert_to_tensor(model_output, dtype=tf.float32)
                
                # Squeeze to handle batch dimension
                if len(model_output.shape) > 0:
                    output_squeezed = tf.squeeze(model_output)
                else:
                    output_squeezed = model_output
                
                # Compute gradient for fake class
                fake_class_output = 1.0 - output_squeezed
            
            grads = tape.gradient(fake_class_output, conv_out)

            if grads is None:
                return 0.0

            # Global Average Pooling of gradients
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2)).numpy()
            
            # Get feature maps
            conv_outputs = conv_out[0].numpy()
            
            # Weighted sum
            heatmap = np.zeros((conv_outputs.shape[0], conv_outputs.shape[1]), dtype=np.float32)
            for i, grad_weight in enumerate(pooled_grads):
                heatmap += grad_weight * conv_outputs[:, :, i]
            
            # ReLU and normalize
            heatmap = np.maximum(heatmap, 0)
            max_val = np.max(heatmap)
            if max_val > 1e-8:
                heatmap = heatmap / max_val
            else:
                return 0.0
            
            # Return mean intensity
            intensity = float(np.mean(heatmap))
            return intensity

        except Exception as e:
            logger.error(f"[GRADCAM-INTENSITY] {e}", exc_info=True)
            return 0.0

    def generate_video_gradcam(self, frame_norm: np.ndarray) -> np.ndarray:
        """
        Generate Grad-CAM heatmap for a single video frame.
        Properly computes gradients for the fake class and creates meaningful activation maps.

        Args:
            frame_norm: (H, W, 3) float32, ImageNet-normalised

        Returns:
            overlay: (H, W, 3) uint8 RGB with jet heatmap blended, or None on error
        """
        if not self.model_loaded:
            return None
        try:
            # Get the CNN sub-model from TimeDistributed wrapper
            cnn = self.model.get_layer('time_distributed_cnn').layer

            # Find the last convolutional layer (most spatially informative)
            last_conv = None
            for layer in reversed(cnn.layers):
                if hasattr(layer, 'output') and len(layer.output.shape) == 4:
                    if 'conv' in layer.name.lower() or 'activation' in layer.name.lower():
                        last_conv = layer
                        break
            
            if last_conv is None:
                logger.warning("[GRADCAM-VIDEO] No suitable convolutional layer found")
                return None

            # Build gradient model
            grad_model = keras.Model(
                inputs=cnn.inputs,
                outputs=[last_conv.output, cnn.output],
                name='gradcam_video'
            )

            # Prepare frame as batch
            frame_t = tf.constant(np.expand_dims(frame_norm, 0), dtype=tf.float32)

            # Compute gradients of fake class output with respect to conv layer
            with tf.GradientTape() as tape:
                conv_out, model_output = grad_model(frame_t, training=False)
                tape.watch(conv_out)
                
                # Convert to tensor if needed
                if isinstance(model_output, (list, tuple)):
                    model_output = tf.convert_to_tensor(model_output, dtype=tf.float32)
                elif isinstance(model_output, np.ndarray):
                    model_output = tf.convert_to_tensor(model_output, dtype=tf.float32)
                
                # Ensure we have a tensor
                if not isinstance(model_output, tf.Tensor):
                    model_output = tf.convert_to_tensor(model_output, dtype=tf.float32)
                
                # Squeeze to handle batch dimension
                if len(model_output.shape) > 0:
                    output_squeezed = tf.squeeze(model_output)
                else:
                    output_squeezed = model_output
                
                # Model returns P(Real), so fake = 1 - P(Real)
                # Grad-CAM for "Fake" decision = gradient w.r.t (1 - output)
                fake_class_output = 1.0 - output_squeezed
            
            grads = tape.gradient(fake_class_output, conv_out)

            if grads is None:
                logger.warning("[GRADCAM-VIDEO] Gradients computation failed")
                return None

            # Global Average Pooling: (1, H, W, C) → (C,)
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2)).numpy()
            
            # Get feature maps
            conv_outputs = conv_out[0].numpy()  # (H, W, C)
            
            # Weighted sum of feature maps
            cam = np.zeros((conv_outputs.shape[0], conv_outputs.shape[1]), dtype=np.float32)
            for i, grad_weight in enumerate(pooled_grads):
                cam += grad_weight * conv_outputs[:, :, i]
            
            # ReLU activation (keep positive contributions)
            cam = np.maximum(cam, 0)
            
            # Normalize
            max_val = np.max(cam)
            if max_val > 1e-8:
                cam = cam / max_val
            else:
                logger.warning("[GRADCAM-VIDEO] Heatmap is all zeros")
                return None

            # Resize to frame size
            cam_resized = cv2.resize(cam, (self.FRAME_SIZE, self.FRAME_SIZE), interpolation=cv2.INTER_LINEAR)
            cam_resized = np.clip(cam_resized, 0, 1)

            # Apply jet colormap
            heatmap_rgb = cv2.cvtColor(
                cv2.applyColorMap((cam_resized * 255).astype(np.uint8), cv2.COLORMAP_JET),
                cv2.COLOR_BGR2RGB
            )

            # Reconstruct original image from normalized frame
            frame_disp = np.clip(
                frame_norm * self.IMAGENET_STD + self.IMAGENET_MEAN, 0.0, 1.0
            )
            frame_uint8 = (frame_disp * 255).astype(np.uint8)

            # Blend: 50% frame + 50% heatmap for good visibility
            overlay = cv2.addWeighted(frame_uint8, 0.5, heatmap_rgb, 0.5, 0)
            
            logger.debug(f"[GRADCAM-VIDEO] Generated heatmap (max: {np.max(cam):.4f}, mean: {np.mean(cam):.4f})")
            return overlay

        except Exception as e:
            logger.error(f"[GRADCAM-VIDEO] {e}", exc_info=True)
            return None

    def generate_video_analysis_chart(self, result: dict) -> str:
        """
        Generate Grad-CAM visualization for the 4 most suspicious frames only.
        """
        try:
            agg         = result['aggregated']
            frame_preds = result['frame_predictions']
            n_frames    = len(frame_preds)

            frame_scores = [fp['frame_score'] for fp in frame_preds]

            # ── Figure (single panel) ───────────────────────────────────────────
            fig = plt.figure(figsize=(16, 5))
            gs  = gridspec.GridSpec(1, 1, figure=fig)

            ax = fig.add_subplot(gs[0, 0])
            ax.axis('off')

            # ── Select top-4 frames ─────────────────────────────────────────────
            top4_idx = sorted(
                range(n_frames),
                key=lambda i: frame_scores[i],
                reverse=True
            )[:4]

            top4_idx = sorted(top4_idx)  # keep chronological order

            # ── Grad-CAM display ────────────────────────────────────────────────
            if 'preprocessed_frames' in result:
                inner_gs = gridspec.GridSpecFromSubplotSpec(
                    1, 4, subplot_spec=gs[0, 0], wspace=0.1
                )

                for col, fi in enumerate(top4_idx):
                    ax_sub = fig.add_subplot(inner_gs[col])

                    overlay = self.generate_video_gradcam(
                        result['preprocessed_frames'][fi]
                    )

                    if overlay is not None:
                        ax_sub.imshow(overlay)
                    else:
                        ax_sub.imshow(
                            np.zeros((self.FRAME_SIZE, self.FRAME_SIZE, 3), np.uint8)
                        )

                    fs_val = frame_scores[fi]

                    ax_sub.set_title(
                        f'F{fi}  p={fs_val:.2f}',
                        fontsize=10,
                        fontweight='bold',
                        color='#e74c3c' if fs_val >= self.threshold else '#27ae60'
                    )

                    ax_sub.axis('off')

            else:
                ax.text(
                    0.5, 0.5,
                    'Grad-CAM unavailable (missing preprocessed_frames)',
                    ha='center', va='center',
                    fontsize=12, color='gray',
                    transform=ax.transAxes
                )

            # ── Title ──────────────────────────────────────────────────────────
            verdict     = agg['prediction']
            p_fake      = agg['fake_score']
            verdict_col = '#e74c3c' if verdict == 'Fake' else '#2ecc71'

            fig.suptitle(
                f'Grad-CAM Analysis | Verdict: {verdict} | P(Fake)={p_fake:.3f}',
                fontsize=14,
                fontweight='bold',
                color=verdict_col
            )

            # ── Export ─────────────────────────────────────────────────────────
            buf = BytesIO()
            plt.savefig(buf, format='png', dpi=130, bbox_inches='tight')
            plt.close(fig)
            buf.seek(0)

            return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"

        except Exception as e:
            logger.error(f"[VIZ-VIDEO] Chart generation failed: {e}", exc_info=True)
            return None

    # ── Main entry point ───────────────────────────────────────────────────────
    def process_video(self, video_path, generate_gradcam=True, sampling_rate=None, max_frames=None):
        """
        Full video deepfake detection pipeline.

        Steps:
          1. Extract NUM_FRAMES=16 frames (uniform temporal stride)
          2. Per-frame: face-detect → crop → 224×224 → /255 → ImageNet norm
          3. Stack → (1, 16, 224, 224, 3)
          4. model.predict → [logit, attn_weights, frame_scores]
          5. P(fake) = sigmoid(logit), threshold to get verdict
          6. Per-frame breakdown using the real frame_scores (not replicated!)
          7. Optional Grad-CAM overlay generation

        Args:
            video_path    : path to video file
            generate_gradcam : whether to store preprocessed frames for Grad-CAM

        Returns:
            dict with keys: video_metadata, frame_predictions, aggregated,
                            [preprocessed_frames], [analysis_chart]
        """
        if not self.model_loaded or self.model is None:
            logger.error("[VIDEO] Model not loaded")
            return None

        try:
            logger.info(f"[VIDEO] Processing: {video_path}")

            # ── Step 1: Extract frames ────────────────────────────────────────
            frames = self._extract_uniform_frames(str(video_path))
            if not frames:
                logger.error("[VIDEO] Frame extraction failed")
                return None

            # ── Step 2: Preprocess each frame ─────────────────────────────────
            preprocessed = []
            for frame_rgb, _ in frames:
                preprocessed.append(self._preprocess_frame(frame_rgb))

            unique_frames = len({hash(p.tobytes()[:512]) for p in preprocessed})
            if unique_frames < len(preprocessed):
                logger.warning(f"[VIDEO] Only {unique_frames}/{len(preprocessed)} unique preprocessed frames")

            # ── Step 3: Build video tensor (1, T, H, W, 3) ────────────────────
            video_tensor = np.expand_dims(np.stack(preprocessed, axis=0), axis=0)
            logger.debug(f"[VIDEO] Tensor shape: {video_tensor.shape}, "
                         f"range=[{video_tensor.min():.3f}, {video_tensor.max():.3f}]")

            # ── Step 4: Inference ─────────────────────────────────────────────
            p_fake, attn_weights, frame_scores = self._run_model(video_tensor)

            # ── Step 5: Video-level decision ──────────────────────────────────
            p_real      = 1.0 - p_fake
            prediction  = 'Fake' if p_fake >= self.threshold else 'Real'
            confidence  = p_fake if prediction == 'Fake' else p_real

            logger.info(
                f"[VIDEO] {prediction} | P(fake)={p_fake:.4f} | "
                f"threshold={self.threshold:.2f} | "
                f"unique_frame_scores={len(set(round(s,3) for s in frame_scores))}/{self.NUM_FRAMES}"
            )

            # ── Step 6: Per-frame breakdown ───────────────────────────────────
            frame_predictions = []
            gradcam_data = []  # Structured Grad-CAM data per frame
            
            for i, ((frame_rgb, timestamp), attn_w, fs) in enumerate(
                zip(frames, attn_weights, frame_scores)
            ):
                frame_verdict = 'Fake' if fs >= self.threshold else 'Real'
                frame_predictions.append({
                    'frame_index'     : i,
                    'timestamp'       : round(timestamp, 2),
                    'attention_weight': round(float(attn_w), 4),
                    'frame_score'     : round(float(fs), 4),      # ← real per-frame score
                    'fake_score'      : round(float(fs), 4),      # alias for UI compatibility
                    'real_score'      : round(1.0 - float(fs), 4),
                    'confidence'      : round(max(float(fs), 1.0 - float(fs)), 4),
                    'prediction'      : frame_verdict,
                })
                
                # Compute Grad-CAM intensity for explainability
                gradcam_intensity = 0.0
                if generate_gradcam and i < len(preprocessed):
                    gradcam_intensity = self.compute_gradcam_intensity(preprocessed[i])
                
                # Structured Grad-CAM data
                gradcam_data.append({
                    'frame_index'     : i,
                    'fake_score'      : round(float(fs), 4),
                    'attention_weight': round(float(attn_w), 4),
                    'gradcam_intensity': round(float(gradcam_intensity), 4),
                })

            unique_scores       = len(set(round(fp['frame_score'], 3) for fp in frame_predictions))
            most_suspicious_idx = int(np.argmax(frame_scores))
            most_attended_idx   = int(np.argmax(attn_weights))

            # Extra stats the frontend reads
            max_fake_score = float(max(frame_scores))
            min_fake_score = float(min(frame_scores))
            max_fake_frame = int(np.argmax(frame_scores))
            min_fake_frame = int(np.argmin(frame_scores))

            # ── Assemble result ───────────────────────────────────────────────
            result = {
                'video_metadata': {
                    'total_frames'    : len(frames),
                    'processed_frames': self.NUM_FRAMES,
                    'frame_size'      : self.FRAME_SIZE,
                    'model_outputs'   : len(self.model.outputs) if self.model_loaded else 'unknown',
                },
                'frame_predictions': frame_predictions,
                'gradcam_data'     : gradcam_data,  # Structured Grad-CAM per-frame metrics
                'aggregated': {
                    'prediction'              : prediction,
                    'fake_score'              : round(p_fake, 4),
                    'real_score'              : round(p_real, 4),
                    'confidence'              : round(confidence, 4),
                    'threshold'               : self.threshold,
                    'attention_weights'       : [round(w, 4) for w in attn_weights],
                    'frame_scores'            : [round(s, 4) for s in frame_scores],
                    'unique_frame_scores'     : unique_scores,
                    'has_per_frame_scores'    : unique_scores > 1,
                    # Legacy field name kept for frontend compatibility
                    'has_per_frame_predictions': unique_scores > 1,
                    'most_suspicious_frame'   : most_suspicious_idx,
                    'most_attended_frame'     : most_attended_idx,
                    'attention_is_uniform'    : len(set(round(w, 4) for w in attn_weights)) == 1,
                    # Fields read by frontend Peak Scores panel
                    'max_fake_score'          : round(max_fake_score, 4),
                    'min_fake_score'          : round(min_fake_score, 4),
                    'max_fake_frame'          : max_fake_frame,
                    'min_fake_frame'          : min_fake_frame,
                },
            }

            # ── Step 7: Optional Grad-CAM Chart ──────────────────────────────────────
            # Generate matplotlib visualization with frame Grad-CAM overlays for explainability
            if generate_gradcam:
                try:
                    # Store preprocessed frames temporarily for chart generation only.
                    # They are numpy arrays and MUST NOT be included in the final dict
                    # that Flask will JSON-serialize — that would cause a TypeError crash.
                    result['preprocessed_frames'] = preprocessed
                    result['analysis_chart']       = self.generate_video_analysis_chart(result)
                    # Remove numpy arrays before returning — not JSON-serializable
                    del result['preprocessed_frames']
                except Exception as e:
                    logger.warning(f"[VIDEO] Grad-CAM chart generation failed: {e}")
                    result['analysis_chart'] = None
            else:
                result['analysis_chart'] = None
                
            # Log Grad-CAM data for verification
            if result.get('gradcam_data'):
                logger.info(f"[VIDEO] Grad-CAM data generated: {len(result['gradcam_data'])} frames")
                if len(result['gradcam_data']) > 0:
                    logger.debug(f"[VIDEO] Sample Grad-CAM frame: {result['gradcam_data'][0]}")

            return result

        except Exception as e:
            logger.error(f"[VIDEO] process_video error: {e}", exc_info=True)
            return None

    # ── Recharts-compatible helpers ────────────────────────────────────────────
    def get_frame_score_data(self, result: dict) -> list:
        """
        Return per-frame scores in Recharts format.
        Uses real frame_scores from the model (not replicated video-level score).
        """
        return [
            {
                'frame'    : fp['frame_index'],
                'timestamp': fp['timestamp'],
                'fakeScore': fp['fake_score'],
                'realScore': fp['real_score'],
                'attention': fp['attention_weight'],
                'verdict'  : fp['prediction'],
            }
            for fp in result['frame_predictions']
        ]

    def get_attention_chart_data(self, result: dict) -> list:
        """Return attention weights in Recharts bar-chart format."""
        return [
            {'frame': fp['frame_index'], 'attention': fp['attention_weight']}
            for fp in result['frame_predictions']
        ]


# ══════════════════════════════════════════════════════════════════════════════
# Singletons
# ══════════════════════════════════════════════════════════════════════════════

_detector       = None
_video_detector = None


def get_detector():
    global _detector
    if _detector is None:
        _detector = DeepfakeDetector(model_path='./models/images_model.keras')
    return _detector


def get_video_detector():
    """
    Returns the singleton VideoDeepfakeDetector.
    Update model_path to point to your trained videos_model.keras.
    threshold should match optimal_threshold from the training notebook.
    """
    global _video_detector
    if _video_detector is None:
        _video_detector = VideoDeepfakeDetector(
            model_path='./models/videos_model.keras',
            threshold=0.45          # ← replace with optimal_threshold from training
        )
    return _video_detector
