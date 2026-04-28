import requests
import json
from pathlib import Path

# Test the backend API
BACKEND_URL = 'http://localhost:8000'


def test_health():
    """Test health endpoint."""
    try:
        response = requests.get(f'{BACKEND_URL}/health')
        print(f"Health check: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error checking health: {e}")


def test_config():
    """Test config endpoint — also confirms model_loaded status."""
    try:
        response = requests.get(f'{BACKEND_URL}/config')
        print(f"Config check: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error checking config: {e}")


def test_predict_with_file(image_path):
    """Test prediction with a real image file."""
    try:
        with open(image_path, 'rb') as f:
            files = {'files': f}
            response = requests.post(f'{BACKEND_URL}/predict', files=files)
        print(f"Prediction: {response.status_code}")
        data = response.json()
        # Print without base64 blobs for readability
        for pred in data.get('predictions', []):
            pred.pop('visualizations', None)
            pred.pop('images', None)
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Error during prediction: {e}")


if __name__ == '__main__':
    print("Testing Backend API")
    print("-" * 50)

    print("\n1. Testing health endpoint...")
    test_health()

    print("\n2. Testing config endpoint...")
    test_config()

    print("\n3. Testing predict endpoint...")
    print("Provide an image path, e.g.:")
    print("  test_predict_with_file('path/to/face.jpg')")
