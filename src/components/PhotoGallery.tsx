import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

interface PhotoGalleryProps {
  files: any[]; // TODO: Define a more specific type for Drive files
}

interface Tag {
  id?: string; // Firestore document ID
  x: number;
  y: number;
  description: string;
  craigslistUrl?: string; // New field for Craigslist URL
  userId: string; // Add userId
  imageId: string; // Add imageId
}

// Omit 'id' for new tags before saving to Firestore
type NewTagData = Omit<Tag, 'id'>;

interface ImageTags {
  [imageId: string]: Tag[];
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ files }) => {
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [imageTags, setImageTags] = useState<ImageTags>({});
  const [newTagPosition, setNewTagPosition] = useState<{ x: number; y: number } | null>(null);
  const [newTagDescription, setNewTagDescription] = useState<string>('');
  const [newTagCraigslistUrl, setNewTagCraigslistUrl] = useState<string>(''); // New state for Craigslist URL
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Load tags when selectedImage changes
    const fetchTags = async () => {
      if (selectedImage && auth.currentUser) {
        const tagsRef = collection(db, 'tags');
        const q = query(
          tagsRef,
          where('userId', '==', auth.currentUser.uid),
          where('imageId', '==', selectedImage.id)
        );
        const querySnapshot = await getDocs(q);
        const fetchedTags: Tag[] = [];
        querySnapshot.forEach((doc) => {
          fetchedTags.push({ id: doc.id, ...doc.data() } as Tag);
        });
        setImageTags((prevTags) => ({
          ...prevTags,
          [selectedImage.id]: fetchedTags,
        }));
      }
    };
    fetchTags();
  }, [selectedImage, auth.currentUser]); // Re-fetch when selectedImage or user changes

  const handleImageClick = (file: any) => {
    setSelectedImage(file);
    setNewTagPosition(null); // Clear any pending new tag
    setNewTagDescription('');
    setNewTagCraigslistUrl('');
    console.log('Selected image for tagging:', file.id);
  };

  const handleImageClickForTagging = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedImage || !imageRef.current) return;

    const imageRect = imageRef.current.getBoundingClientRect();
    const x = event.clientX - imageRect.left;
    const y = event.clientY - imageRect.top;

    setNewTagPosition({ x, y });
    setNewTagDescription('');
    setNewTagCraigslistUrl('');
  };

  const addTag = async () => {
    if (!selectedImage || !newTagPosition || !newTagDescription.trim() || !auth.currentUser) return;

    const newTagData: NewTagData = {
      userId: auth.currentUser.uid,
      imageId: selectedImage.id,
      x: newTagPosition.x,
      y: newTagPosition.y,
      description: newTagDescription.trim(),
      craigslistUrl: newTagCraigslistUrl.trim() || undefined, // Add Craigslist URL
    };

    try {
      const docRef = await addDoc(collection(db, 'tags'), newTagData);
      const newTagWithId: Tag = { id: docRef.id, ...newTagData };

      setImageTags((prevTags) => ({
        ...prevTags,
        [selectedImage.id]: [...(prevTags[selectedImage.id] || []), newTagWithId],
      }));

      setNewTagPosition(null);
      setNewTagDescription('');
      setNewTagCraigslistUrl(''); // Clear Craigslist URL input
    } catch (e) {
      console.error('Error adding document: ', e);
    }
  };

  const handleTagClick = (tag: Tag) => {
    if (tag.craigslistUrl) {
      window.open(tag.craigslistUrl, '_blank');
    } else {
      alert(`Tag: ${tag.description}`);
    }
  };

  return (
    <div>
      <h3>Your Selected Photos</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {files.length === 0 ? (
          <p>No photos selected yet.</p>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              style={{
                border: selectedImage?.id === file.id ? '2px solid blue' : '1px solid #ccc',
                padding: '5px',
                cursor: 'pointer',
              }}
              onClick={() => handleImageClick(file)}
            >
              <img src={file.thumbnailLink} alt={file.name} style={{ maxWidth: '200px', maxHeight: '200px' }} />
              <p>{file.name}</p>
            </div>
          ))
        )}
      </div>

      {selectedImage && (
        <div style={{ marginTop: '20px', border: '1px solid green', padding: '10px' }}>
          <h4>Tagging for: {selectedImage.name}</h4>
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '100%',
              border: '1px solid red',
            }}
            onClick={handleImageClickForTagging}
          >
            <img
              src={selectedImage.webContentLink || selectedImage.thumbnailLink}
              alt={selectedImage.name}
              style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
              ref={imageRef}
            />
            {imageTags[selectedImage.id]?.map((tag, index) => (
              <div
                key={tag.id || index} // Use tag.id if available, otherwise index
                style={{
                  position: 'absolute',
                  left: `${tag.x}px`,
                  top: `${tag.y}px`,
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 0, 0, 0.7)',
                  color: 'white',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transform: 'translate(-50%, -50%)', // Center the tag
                }}
                title={tag.description}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent image click from firing
                  handleTagClick(tag);
                }}
              >
                {index + 1}
              </div>
            ))}
          </div>

          {newTagPosition && (
            <div
              style={{
                position: 'absolute',
                left: `${newTagPosition.x}px`,
                top: `${newTagPosition.y}px`,
                backgroundColor: 'white',
                border: '1px solid black',
                padding: '5px',
                zIndex: 10,
              }}
            >
              <input
                type="text"
                placeholder="Item description"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
              />
              <input
                type="text"
                placeholder="Craigslist URL (optional)"
                value={newTagCraigslistUrl}
                onChange={(e) => setNewTagCraigslistUrl(e.target.value)}
              />
              <button onClick={addTag}>Add Tag</button>
              <button onClick={() => setNewTagPosition(null)}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
