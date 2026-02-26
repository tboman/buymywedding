import { useRef, useState, useCallback } from 'react';
import './PhotoUploader.css';

export interface UploadedFile {
  id: string;
  name: string;
  url: string; // object URL
}

interface PhotoUploaderProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  existingFiles: UploadedFile[];
}

function fileToUploaded(file: File): UploadedFile {
  // Stable-ish id from name + size + lastModified
  const id = `${file.name}-${file.size}-${file.lastModified}`;
  return { id, name: file.name, url: URL.createObjectURL(file) };
}

export default function PhotoUploader({ onFilesSelected, existingFiles }: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      const existingIds = new Set(existingFiles.map((f) => f.id));
      const newFiles: UploadedFile[] = [];
      for (const file of Array.from(incoming)) {
        if (!file.type.startsWith('image/')) continue;
        const uploaded = fileToUploaded(file);
        if (!existingIds.has(uploaded.id)) {
          newFiles.push(uploaded);
        }
      }
      if (newFiles.length > 0) {
        onFilesSelected([...existingFiles, ...newFiles]);
      }
    },
    [existingFiles, onFilesSelected]
  );

  const removeFile = (id: string) => {
    const file = existingFiles.find((f) => f.id === id);
    if (file) URL.revokeObjectURL(file.url);
    onFilesSelected(existingFiles.filter((f) => f.id !== id));
  };

  // Drag & drop handlers
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="uploader">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => addFiles(e.target.files)}
      />

      {/* Drop zone */}
      <div
        className={`uploader__dropzone${dragging ? ' uploader__dropzone--active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Upload photos"
      >
        <div className="uploader__dropzone-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p className="uploader__dropzone-text">Drag photos here, or click to browse</p>
        <p className="uploader__dropzone-sub">PNG, JPG, WEBP supported</p>
      </div>

      {/* Action buttons */}
      <div className="uploader__actions">
        <button
          type="button"
          className="uploader__btn"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Choose from device
        </button>
        <button
          type="button"
          className="uploader__btn"
          onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Take a photo
        </button>
      </div>

      {/* Thumbnail strip */}
      {existingFiles.length > 0 && (
        <div className="uploader__thumbnails">
          {existingFiles.map((file) => (
            <div key={file.id} className="uploader__thumb">
              <img src={file.url} alt={file.name} className="uploader__thumb-img" />
              <button
                type="button"
                className="uploader__thumb-remove"
                onClick={() => removeFile(file.id)}
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
