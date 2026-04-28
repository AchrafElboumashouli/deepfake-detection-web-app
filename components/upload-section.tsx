'use client';

import React from "react"

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface UploadSectionProps {
  onImageUpload: (files: File[]) => Promise<void>;
  onVideoUpload: (files: File[]) => Promise<void>;
  isLoading: boolean;
}

export function UploadSection({ onImageUpload, onVideoUpload, isLoading }: UploadSectionProps) {
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedVideoFiles, setSelectedVideoFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState('images');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isImageType = (file: File) => file.type.startsWith('image/');
  const isVideoType = (file: File) => file.type.startsWith('video/');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(isImageType);
    if (droppedFiles.length > 0) {
      setSelectedImageFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(isVideoType);
    if (droppedFiles.length > 0) {
      setSelectedVideoFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(isImageType);
    if (files.length > 0) {
      setSelectedImageFiles((prev) => [...prev, ...files]);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(isVideoType);
    if (files.length > 0) {
      setSelectedVideoFiles((prev) => [...prev, ...files]);
    }
  };

  const removeImageFile = (index: number) => {
    setSelectedImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVideoFile = (index: number) => {
    setSelectedVideoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageUpload = async () => {
    if (selectedImageFiles.length > 0) {
      try {
        console.log('[LOG] Starting image upload with', selectedImageFiles.length, 'files');
        await onImageUpload(selectedImageFiles);
        setSelectedImageFiles([]);
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
        }
      } catch (error) {
        console.error('[LOG] Image upload error:', error);
      }
    }
  };

  const handleVideoUpload = async () => {
    if (selectedVideoFiles.length > 0) {
      try {
        console.log('[LOG] Starting video upload with', selectedVideoFiles.length, 'files');
        await onVideoUpload(selectedVideoFiles);
        setSelectedVideoFiles([]);
        if (videoInputRef.current) {
          videoInputRef.current.value = '';
        }
      } catch (error) {
        console.error('[LOG] Video upload error:', error);
      }
    }
  };

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-4">
          <Card className="border-2 border-dashed border-primary/50 bg-card/50 p-8 transition-all hover:border-primary hover:bg-card/80">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleImageDrop}
              className={`text-center transition-colors ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Upload className="mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Drop images here or click to browse
              </h3>
              <p className="mb-4 text-sm">
                Supports JPG, PNG, and other common image formats
              </p>
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                onClick={() => imageInputRef.current?.click()}
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
              >
                Select Images
              </Button>
            </div>
          </Card>

          {selectedImageFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Selected Images ({selectedImageFiles.length})
              </h3>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {selectedImageFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-card/60 px-4 py-2"
                  >
                    <span className="text-sm text-muted-foreground truncate">
                      {file.name}
                    </span>
                    <button
                      onClick={() => removeImageFile(index)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleImageUpload}
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Images...
                  </>
                ) : (
                  `Analyze ${selectedImageFiles.length} Image${selectedImageFiles.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <Card className="border-2 border-dashed border-primary/50 bg-card/50 p-8 transition-all hover:border-primary hover:bg-card/80">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleVideoDrop}
              className={`text-center transition-colors ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Film className="mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Drop videos here or click to browse
              </h3>
              <p className="mb-4 text-sm">
                Supports MP4 video format (max 500MB)
              </p>
              <input
                ref={videoInputRef}
                type="file"
                multiple
                accept="video/*"
                onChange={handleVideoSelect}
                className="hidden"
              />
              <Button
                onClick={() => videoInputRef.current?.click()}
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
              >
                Select Videos
              </Button>
            </div>
          </Card>

          {selectedVideoFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Selected Videos ({selectedVideoFiles.length})
              </h3>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {selectedVideoFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-card/60 px-4 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-muted-foreground truncate block">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground/70">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <button
                      onClick={() => removeVideoFile(index)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleVideoUpload}
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Videos...
                  </>
                ) : (
                  `Analyze ${selectedVideoFiles.length} Video${selectedVideoFiles.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
