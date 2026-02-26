import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../firebase';

/**
 * Uploads a file to Firebase Storage under photos/{uid}/{localId}
 * and returns the permanent download URL.
 */
export async function uploadToStorage(
  file: File,
  localId: string
): Promise<{ storagePath: string; url: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to upload');

  const storagePath = `photos/${user.uid}/${localId}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { storagePath, url };
}
