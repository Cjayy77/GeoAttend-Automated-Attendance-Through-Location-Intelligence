/**
 * FIREBASE CONFIGURATION TEMPLATE
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project
 * 3. Enable Authentication (Email/Password)
 * 4. Create a Firestore Database
 * 5. Enable Hosting (optional, for deployment)
 * 6. Go to Project Settings > General
 * 7. Copy your Firebase config
 * 8. Replace the values below with your config
 * 9. Save this file as firebase.js in the /js directory
 */

// Replace these values with your Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

/**
 * FIRESTORE SECURITY RULES
 * 
 * Copy the rules below and paste them in Firebase Console:
 * Firestore Database > Rules
 */

/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - users can only read their own profile
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow create: if request.auth.uid == userId && request.resource.data.role in ['student', 'lecturer'];
      allow update: if request.auth.uid == userId;
      allow delete: if false;
    }
    
    // Sessions collection - lecturers can create, students can read
    match /sessions/{sessionId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'lecturer' &&
                       request.resource.data.lecturerId == request.auth.uid;
      allow update: if request.auth != null &&
                       get(/databases/$(database)/documents/sessions/$(sessionId)).data.lecturerId == request.auth.uid;
      allow delete: if false;
    }
    
    // Attendance collection - students write their own, lecturers read
    match /attendance/{attendanceId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null &&
                       request.resource.data.studentId == request.auth.uid;
      allow update: if false;
      allow delete: if false;
    }
  }
}
*/

/**
 * DEPLOYMENT CHECKLIST
 * 
 * Before deploying to production:
 * 
 * 1. HTTPS REQUIREMENT
 *    - Geolocation API requires HTTPS
 *    - Use Firebase Hosting or Vercel (both provide HTTPS)
 *    - For local testing, use http://localhost
 * 
 * 2. FIREBASE CONFIG
 *    - Replace all YOUR_* placeholders with actual values
 *    - Never commit real credentials to version control
 *    - Use environment variables for production
 * 
 * 3. SECURITY
 *    - Apply the security rules shown above
 *    - Test rules in Firebase Console
 *    - Verify email authentication is enabled
 * 
 * 4. CORS & HOSTING
 *    - For Firebase Hosting: Use 'firebase deploy'
 *    - For Vercel: Push to GitHub and connect to Vercel
 *    - Static files work on both platforms
 * 
 * 5. TESTING
 *    - Test on HTTPS connection (browser won't request geolocation on HTTP)
 *    - Test on mobile device for accurate geolocation
 *    - Test QR scanning functionality
 * 
 * DEPLOYMENT WITH FIREBASE HOSTING:
 * 
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Initialize: firebase init
 * 3. Set public directory to root (where your HTML files are)
 * 4. Configure database as Firestore
 * 5. Deploy: firebase deploy
 * 
 * DEPLOYMENT WITH VERCEL:
 * 
 * 1. Push this project to GitHub
 * 2. Go to vercel.com
 * 3. Import your GitHub repository
 * 4. Deploy (Vercel will automatically serve as static)
 * 5. Update firebaseConfig with your real values in source
 * 6. Redeploy
 */
