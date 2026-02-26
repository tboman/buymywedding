import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import type { UploadedFile } from './PhotoUploader';
import './PhotoGallery.css';

interface PhotoGalleryProps {
  files: UploadedFile[];
}

interface Tag {
  id?: string;
  x: number;
  y: number;
  description: string;
  price?: string;
  userId: string;
  imageId: string;
}

type NewTagData = Omit<Tag, 'id'>;

interface ImageTags {
  [imageId: string]: Tag[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ files }) => {
  const [selectedImage, setSelectedImage] = useState<UploadedFile | null>(null);
  const [imageTags, setImageTags] = useState<ImageTags>({});
  const [newTagPosition, setNewTagPosition] = useState<{ x: number; y: number } | null>(null);
  const [newTagDescription, setNewTagDescription] = useState('');
  const [newTagPrice, setNewTagPrice] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const fetchTags = async () => {
      if (selectedImage && auth.currentUser) {
        const q = query(
          collection(db, 'tags'),
          where('userId', '==', auth.currentUser.uid),
          where('imageId', '==', selectedImage.id)
        );
        const snapshot = await getDocs(q);
        const fetched: Tag[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Tag));
        setImageTags((prev) => ({ ...prev, [selectedImage.id]: fetched }));
      }
    };
    fetchTags();
  }, [selectedImage]);

  // Deselect if the selected image is removed
  useEffect(() => {
    if (selectedImage && !files.find((f) => f.id === selectedImage.id)) {
      setSelectedImage(null);
    }
  }, [files, selectedImage]);

  const handleImageClick = (file: UploadedFile) => {
    setSelectedImage(file);
    setNewTagPosition(null);
    setNewTagDescription('');
    setNewTagPrice('');
  };

  const handleImageClickForTagging = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedImage || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    setNewTagPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setNewTagDescription('');
    setNewTagPrice('');
  };

  const addTag = async () => {
    if (!selectedImage || !newTagPosition || !newTagDescription.trim() || !auth.currentUser) return;
    const data: NewTagData = {
      userId: auth.currentUser.uid,
      imageId: selectedImage.id,
      x: newTagPosition.x,
      y: newTagPosition.y,
      description: newTagDescription.trim(),
      price: newTagPrice.trim() || undefined,
    };
    try {
      const docRef = await addDoc(collection(db, 'tags'), data);
      setImageTags((prev) => ({
        ...prev,
        [selectedImage.id]: [...(prev[selectedImage.id] || []), { id: docRef.id, ...data }],
      }));
      setNewTagPosition(null);
      setNewTagDescription('');
      setNewTagPrice('');
    } catch (e) {
      console.error('Error saving tag:', e);
    }
  };

  if (files.length === 0) return null;

  return (
    <div className="gallery">
      {/* Thumbnail strip */}
      <div className="gallery__strip">
        {files.map((file) => (
          <div
            key={file.id}
            className={`gallery__strip-item${selectedImage?.id === file.id ? ' gallery__strip-item--active' : ''}`}
            onClick={() => handleImageClick(file)}
          >
            <img src={file.url} alt={file.name} className="gallery__strip-thumb" />
          </div>
        ))}
      </div>

      {/* Full-size tagging view */}
      {selectedImage && (
        <div className="gallery__tagger">
          <p className="gallery__tagger-hint">Click anywhere on the image to tag an item for sale</p>
          <div
            className="gallery__tagger-canvas"
            onClick={handleImageClickForTagging}
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.name}
              className="gallery__tagger-img"
              ref={imageRef}
            />

            {/* Existing tags */}
            {imageTags[selectedImage.id]?.map((tag, i) => (
              <div
                key={tag.id || i}
                className="gallery__tag"
                style={{ left: tag.x, top: tag.y }}
                title={tag.price ? `${tag.description} — ${tag.price}` : tag.description}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="gallery__tag-dot">{i + 1}</span>
                <div className="gallery__tag-tooltip">
                  <strong>{tag.description}</strong>
                  {tag.price && <span>{tag.price}</span>}
                </div>
              </div>
            ))}

            {/* New tag popover */}
            {newTagPosition && (
              <div
                className="gallery__tag-form"
                style={{ left: newTagPosition.x, top: newTagPosition.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  className="gallery__tag-input"
                  type="text"
                  placeholder="Item name"
                  value={newTagDescription}
                  onChange={(e) => setNewTagDescription(e.target.value)}
                  autoFocus
                />
                <input
                  className="gallery__tag-input"
                  type="text"
                  placeholder="Price (e.g. £120)"
                  value={newTagPrice}
                  onChange={(e) => setNewTagPrice(e.target.value)}
                />
                <div className="gallery__tag-form-actions">
                  <button className="gallery__tag-save" onClick={addTag}>Save tag</button>
                  <button className="gallery__tag-cancel" onClick={() => setNewTagPosition(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
