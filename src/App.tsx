import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import PhotoUploader, { type UploadedFile } from './components/PhotoUploader';
import PhotoGallery from './components/PhotoGallery';
import LandingPage from './components/LandingPage';
import { loadUserFiles, deleteFromStorage } from './lib/storageUpload';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [view, setView] = useState<'home' | 'dashboard'>('home');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoadingFiles(true);
        try {
          const files = await loadUserFiles(currentUser.uid);
          setSelectedFiles(files);
        } catch (err) {
          console.error('Failed to load files:', err);
        } finally {
          setLoadingFiles(false);
        }
      } else {
        setSelectedFiles([]);
        setView('home');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = (file: UploadedFile) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (file.storagePath) {
      deleteFromStorage(file.storagePath).catch((err) =>
        console.error('Storage delete failed:', err)
      );
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => {
      console.error('Logout Error:', error);
    });
  };

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <button className="site-nav__logo" onClick={() => setView('home')}>
            Buy My <span>Wedding</span>
          </button>
          <div className="site-nav__actions">
            {user ? (
              <div className="user-menu">
                <button
                  className={`nav-link${view === 'dashboard' ? ' nav-link--active' : ''}`}
                  onClick={() => setView('dashboard')}
                >
                  My Listings
                </button>
                {user.photoURL && (
                  <img
                    className="user-avatar"
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    width="36"
                    height="36"
                  />
                )}
                <span className="user-name">{user.displayName}</span>
                <button className="btn-logout" onClick={handleLogout}>
                  Sign out
                </button>
              </div>
            ) : (
              <Login />
            )}
          </div>
        </div>
      </nav>

      {view === 'dashboard' && user ? (
        <main className="dashboard">
          <h2 className="dashboard__title">
            Your <span>Photo Gallery</span>
          </h2>
          {loadingFiles ? (
            <p className="dashboard__loading">Loading your photos…</p>
          ) : (
            <>
              <PhotoUploader files={selectedFiles} onChange={setSelectedFiles} />
              <PhotoGallery files={selectedFiles} onDelete={handleDelete} />
            </>
          )}
        </main>
      ) : (
        <LandingPage />
      )}
    </>
  );
}

export default App;
