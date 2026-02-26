import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import PhotoUploader, { type UploadedFile } from './components/PhotoUploader';
import PhotoGallery from './components/PhotoGallery';
import LandingPage from './components/LandingPage';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth).catch((error) => {
      console.error('Logout Error:', error);
    });
  };

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <a href="/" className="site-nav__logo">
            Buy My <span>Wedding</span>
          </a>
          <div className="site-nav__actions">
            {user ? (
              <div className="user-menu">
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

      {user ? (
        <main className="dashboard">
          <h2 className="dashboard__title">
            Your <span>Photo Gallery</span>
          </h2>
          <PhotoUploader files={selectedFiles} onChange={setSelectedFiles} />
          <PhotoGallery files={selectedFiles} />
        </main>
      ) : (
        <LandingPage />
      )}
    </>
  );
}

export default App;
