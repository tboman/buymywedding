import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import DrivePicker from './components/DrivePicker';
import PhotoGallery from './components/PhotoGallery'; // Import PhotoGallery
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]); // State to hold selected files

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth).catch((error) => {
      console.error('Logout Error:', error);
    });
  };

  const handleFilesSelected = (files: any[]) => {
    setSelectedFiles(files);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Buy My Wedding</h1>
        {user ? (
          <div>
            <img src={user.photoURL || ''} alt={user.displayName || ''} width="50" height="50" />
            <span>Welcome, {user.displayName}</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <Login />
        )}
      </header>
      <main>
        {user ? (
          <div>
            <h2>Your Photo Gallery</h2>
            <DrivePicker onFilesSelected={handleFilesSelected} /> {/* Pass the callback */}
            <PhotoGallery files={selectedFiles} /> {/* Render PhotoGallery with selected files */}
          </div>
        ) : (
          <p>Please log in to manage your photos.</p>
        )}
      </main>
    </div>
  );
}

export default App;
