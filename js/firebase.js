// Firebase initialization with modular SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, setLogLevel } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

setLogLevel("debug");

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAa0LtvaK5-Cozx-4IbkseRWa6_A9fdgQE",
  authDomain: "geoattend-2c72b.firebaseapp.com",
  projectId: "geoattend-2c72b",
  storageBucket: "geoattend-2c72b.firebasestorage.app",
  messagingSenderId: "514786308530",
  appId: "1:514786308530:web:932fe865c67b0203b634ab",
  measurementId: "G-BSVYFFN9GP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Function to wait for authenticated user
export function waitForUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe(); // Unsubscribe after user is found
        resolve(user);
      }
    });
  });
}

// Auth state listener for auto-redirect
export function setupAuthListener(onUserChange) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in, fetch role and redirect
      try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          onUserChange(user, userData.role);
        } else {
          // User document doesn't exist yet (during signup race condition)
          console.warn('User profile not ready yet, waiting...');
          onUserChange(user, null);
        }
      } catch (error) {
        console.warn('Error fetching user role (may not exist yet):', error.message);
        onUserChange(user, null);
      }
    } else {
      // User is signed out
      onUserChange(null, null);
    }
  });
}

// Utility to get current user
export async function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}
