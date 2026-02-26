import { ref, uploadBytes, getDownloadURL, listAll, getMetadata } from 'firebase/storage';
import { storage, auth } from '../firebase';
import type { UploadedFile } from '../components/PhotoUploader';

/**
 * Uploads a file to Firebase Storage under photos/{uid}/{localId}.
 * Stores the original filename in custom metadata so it can be recovered on reload.
 */
export async function uploadToStorage(
  file: File,
  localId: string
): Promise<{ storagePath: string; url: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to upload');

  const storagePath = `photos/${user.uid}/${localId}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: { originalName: file.name },
  });
  const url = await getDownloadURL(storageRef);
  return { storagePath, url };
}

/**
 * Lists all photos previously uploaded by the current user and returns them
 * as UploadedFile objects ready to populate the gallery.
 */
export async function loadUserFiles(uid: string): Promise<UploadedFile[]> {
  const listRef = ref(storage, `photos/${uid}`);
  const result = await listAll(listRef);

  const files = await Promise.all(
    result.items.map(async (item) => {
      const [url, meta] = await Promise.all([
        getDownloadURL(item),
        getMetadata(item),
      ]);
      return {
        id: item.name,
        name: meta.customMetadata?.originalName ?? item.name,
        url,
        storagePath: item.fullPath,
        uploadState: 'done' as const,
      };
    })
  );

  return files;
}
