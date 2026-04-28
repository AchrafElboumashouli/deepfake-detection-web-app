/**
 * Environment Configuration
 * Backend API endpoints and configuration
 */

// Get the API base URL from environment variable or default to localhost
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// API Endpoints
export const API_ENDPOINTS = {
  PREDICT: `${API_BASE_URL}/predict`,
  HEALTH: `${API_BASE_URL}/health`,
  CONFIG: `${API_BASE_URL}/config`,
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg'];

// Max file size (in bytes) - 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Configuration
export const CONFIG = {
  maxRetries: 3,
  timeout: 30000, // 30 seconds
  uploadTimeout: 60000, // 60 seconds for large files
} as const;
