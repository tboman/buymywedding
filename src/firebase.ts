// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// TO GET THIS CONFIG:
// 1. Go to your Firebase project console.
// 2. In the left-hand menu, click on the gear icon next to "Project Overview".
// 3. Click on "Project settings".
// 4. In the "General" tab, scroll down to the "Your apps" section.
// 5. Click on the "</>" icon to see the web app configuration.
const firebaseConfig = {
  apiKey: "TODO: REPLACE WITH YOUR API KEY",
  authDomain: "TODO: REPLACE WITH YOUR AUTH DOMAIN",
  projectId: "TODO: REPLACE WITH YOUR PROJECT ID",
  storageBucket: "TODO: REPLACE WITH YOUR STORAGE BUCKET",
  messagingSenderId: "TODO: REPLACE WITH YOUR MESSAGING SENDER ID",
  appId: "TODO: REPLACE WITH YOUR APP ID",
  measurementId: "TODO: REPLACE WITH YOUR MEASUREMENT ID"
};

export const googleDriveClientId = "TODO: REPLACE WITH YOUR GOOGLE DRIVE CLIENT ID";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
