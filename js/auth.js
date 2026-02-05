// Authentication functions
import { auth, db, waitForUser } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Create new user account
export async function registerUser(email, password, name, role, level = null) {
  try {
    // Create auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Debug logs
    console.log("[DEBUG] Auth.currentUser UID:", auth.currentUser?.uid);
    console.log("[DEBUG] User UID from credential:", user.uid);
    console.log("[DEBUG] Project IDs:", auth.app.options.projectId, db.app.options.projectId);

    // Force ID token generation and synchronization
    await user.getIdToken(true);

    // Update display name
    await updateProfile(user, { displayName: name });

    // Wait for authenticated user before Firestore write
    const authenticatedUser = await waitForUser();

    // Create user profile in Firestore
    const userData = {
      role: role,
      name: name,
      email: email,
      createdAt: serverTimestamp()  // Use Firestore serverTimestamp instead of new Date()
    };

    if (role === 'student' && level) {
      userData.level = level;
    }

    console.log("SIGNUP PROFILE WRITE ATTEMPT", {
      uid: authenticatedUser.uid,  // Use authenticated user UID
      authUid: authenticatedUser.uid,
      role: userData.role,
      roleType: typeof userData.role,
      email: userData.email,
      emailType: typeof userData.email,
      name: userData.name,
      nameType: typeof userData.name,
      level: userData.level,
      data: userData
    });

    // Write to Firestore using authenticated user UID
    await setDoc(doc(db, 'users', authenticatedUser.uid), userData);
    console.log("[AUTH] Signup profile write SUCCESS");

    return user;
  } catch (error) {
    console.error('SIGNUP PROFILE WRITE FAILED:', error.code, error.message);
    console.error('[AUTH] Full error:', error);
    throw error;
  }
}

// Login user
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Logout user
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

// Get user profile
export async function getUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

// Update user profile (for first login if needed)
export async function updateUserProfile(uid, data) {
  try {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Verify that user's role matches the selected role (role gateway protection)
export async function verifyRoleMatch(uid, selectedRole) {
  try {
    const userProfile = await getUserProfile(uid);
    if (!userProfile) {
      return false;
    }
    return userProfile.role === selectedRole;
  } catch (error) {
    console.error('Error verifying role match:', error);
    throw error;
  }
}
// Temporary for debugging in browser console
window.debugAuth = auth;
window.debugDB = db;
