import React, { useState, useEffect } from 'react';
import { googleDriveClientId, auth } from '../firebase';
import type { User } from 'firebase/auth';

declare global {
  var gapi: any;
  var google: any;
}

interface DrivePickerProps {
  onFilesSelected: (files: any[]) => void;
}

const DrivePicker: React.FC<DrivePickerProps> = ({ onFilesSelected }) => {
  const [user, setUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const developerKey = 'YOUR_DEVELOPER_KEY'; // TODO: Replace with your actual Developer Key

  useEffect(() => {
    // Get the current user from Firebase Auth
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult(true);
        setGoogleAccessToken(tokenResult.token);
      } else {
        setGoogleAccessToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadApis = () => {
    if (user && googleAccessToken) { // Ensure user and accessToken are available
      gapi.load('client:picker', {
        callback: () => {
          gapi.client.init({
            apiKey: developerKey, // Not strictly needed for client.drive but good practice
            clientId: googleDriveClientId,
            scope: 'https://www.googleapis.com/auth/drive.readonly', // Request read-only access to Drive
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'], // Use Drive API v3
          }).then(() => {
            console.log('gapi client initialized');
          }).catch((error: any) => {
            console.error('Error initializing gapi client:', error);
          });
        },
        onerror: (error: any) => {
          console.error('Error loading gapi client or picker:', error);
        },
      });
    }
  };

  const createPicker = async () => {
    if (!user) {
      console.log('User not authenticated.');
      return;
    }

    const tokenResult = await user.getIdTokenResult(true);
    const accessToken = tokenResult.token;

    if (!accessToken) {
      console.log('Access token not available.');
      return;
    }

    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes('image/png,image/jpeg,image/jpg'); // Only show images

    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(developerKey)
      .setAppId(googleDriveClientId.split('-')[0]) // App ID is usually the first part of the client ID
      .addView(view)
      .setCallback(pickerCallback)
      .build();

    picker.setVisible(true);
  };

  const pickerCallback = (data: any) => {
    if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
      const files = data[google.picker.Response.DOCUMENTS];
      onFilesSelected(files); // Call the prop function with selected files
    }
  };

  useEffect(() => {
    // Load the Google API client library
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = loadApis; // Call loadApis after gapi script is loaded
    document.body.appendChild(script);

    // Also load the Google Picker API
    const pickerScript = document.createElement('script');
    pickerScript.src = 'https://www.google.com/js/api.js'; // This is also needed for google.picker
    document.body.appendChild(pickerScript);


    return () => {
      document.body.removeChild(script);
      document.body.removeChild(pickerScript);
    };
  }, [user, googleAccessToken]); // Re-run effect if user or token changes

  return (
    <div>
      <button onClick={createPicker} disabled={!user || !googleAccessToken}>Select Photos from Google Drive</button>
    </div>
  );
};

export default DrivePicker;
