// Authentication functions
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Create new user account
export async function registerUser(email, password, name, role, level = null) {
  try {
    // Check if user already exists
    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
    const existingUsers = await getDocs(usersQuery);
    if (!existingUsers.empty) {
      throw new Error('User with this email already exists');
    }

    // Create auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName: name });

    // Create user profile in Firestore
    const userData = {
      role: role,
      name: name,
      email: email,
      createdAt: new Date()
    };

    if (role === 'student' && level) {
      userData.level = level;
    }

    await setDoc(doc(db, 'users', user.uid), userData);

    return user;
  } catch (error) {
    console.error('Registration error:', error);
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
