// Firebase initialization with modular SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
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
