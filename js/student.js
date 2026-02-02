// Student dashboard logic
import { auth, db } from './firebase.js';
import { logoutUser, getUserProfile } from './auth.js';
import {
  collection,
  addDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let attendanceRecorded = false;
let pollingInterval = null;
let currentSession = null;
let studentInitialized = false;

// Initialize student dashboard
export async function initStudentDashboard() {
  console.log('[Student] initStudentDashboard called, initialized:', studentInitialized);
  
  if (studentInitialized) {
    console.log('[Student] Already initialized, returning early');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.log('[Student] No user found, redirecting to /');
    window.location.href = '/';
    return;
  }

  console.log('[Student] User found:', user.uid);
  studentInitialized = true;

  // Fetch and display user info
  const userProfile = await getUserProfile(user.uid);
  if (!userProfile) {
    console.log('[Student] No profile found, redirecting to /');
    window.location.href = '/';
    return;
  }

  console.log('[Student] Profile loaded:', userProfile.name);
  document.getElementById('studentName').textContent = userProfile.name;
  document.getElementById('studentLevel').textContent = userProfile.level;

  // Set up logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logoutUser();
    window.location.href = '/';
  });

  // Check for active session on load
  await checkForActiveSession(user, userProfile);

  // Load attendance history
  await loadAttendanceHistory(user.uid);
}

async function checkForActiveSession(user, userProfile) {
  try {
    showLoading(true);

    // Query for active session
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('active', '==', true)
    );

    const snapshot = await getDocs(sessionsQuery);

    if (snapshot.empty) {
      showLoading(false);
      showNoSessionUI();
      return;
    }

    // Get the first active session
    const sessionDoc = snapshot.docs[0];
    const sessionData = sessionDoc.data();
    currentSession = {
      id: sessionDoc.id,
      ...sessionData
    };

    // Check if already attended this session
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('sessionId', '==', currentSession.id),
      where('studentId', '==', user.uid)
    );

    const attendanceSnapshot = await getDocs(attendanceQuery);
    attendanceRecorded = !attendanceSnapshot.empty;

    showLoading(false);

    if (attendanceRecorded) {
      showAlreadyAttendedUI();
    } else if (currentSession.geoEnabled) {
      // Start geolocation polling
      showGeoattendanceUI(user, userProfile);
      startGeolocationPolling(user, userProfile);
    } else if (currentSession.qrOnly) {
      showQROnlyUI();
    }
  } catch (error) {
    showLoading(false);
    showError('Error checking for active session: ' + error.message);
  }
}

function startGeolocationPolling(user, userProfile) {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser');
    return;
  }

  // Initial location request
  requestLocationAndMarkAttendance(user, userProfile);

  // Poll every 15 seconds
  pollingInterval = setInterval(() => {
    requestLocationAndMarkAttendance(user, userProfile);
  }, 15000);
}

function requestLocationAndMarkAttendance(user, userProfile) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const distance = calculateDistance(
        latitude,
        longitude,
        currentSession.latitude,
        currentSession.longitude
      );

      document.getElementById('geoStatus').textContent = 
        `Distance: ${distance.toFixed(2)}m (Radius: ${currentSession.radius}m)`;

      if (distance <= currentSession.radius && !attendanceRecorded) {
        markAttendance(user, userProfile, 'Geo');
      }
    },
    (error) => {
      console.warn('Geolocation error:', error);
      showGeoStatusWarning();
    }
  );
}

/**
 * Haversine formula to calculate distance between two coordinates
 * Returns distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function markAttendance(user, userProfile, method) {
  try {
    if (attendanceRecorded) return;

    attendanceRecorded = true;

    // Stop polling if geolocation
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Write attendance record
    const attendanceData = {
      sessionId: currentSession.id,
      studentId: user.uid,
      name: userProfile.name,
      level: userProfile.level,
      timestamp: serverTimestamp(),
      method: method
    };

    // Use composite doc ID to prevent duplicates
    const docId = `${currentSession.id}_${user.uid}`;
    await addDoc(collection(db, 'attendance'), {
      ...attendanceData,
      _docId: docId // Add reference for duplicate prevention
    });

    showAttendanceRecordedUI(method);
    
    // Reload attendance history after a short delay to show toast
    setTimeout(() => {
      loadAttendanceHistory(user.uid);
    }, 1500);
  } catch (error) {
    attendanceRecorded = false;
    if (pollingInterval) clearInterval(pollingInterval);
    showError('Failed to record attendance: ' + error.message);
  }
}

// Handle QR code scanning
export function setupQRScanning() {
  const scanButton = document.getElementById('scanQRBtn');
  if (scanButton) {
    scanButton.addEventListener('click', async () => {
      if (!currentSession) {
        console.log('[QR] No active session, showing toast');
        showError('No active session at the moment. Please ask your lecturer to start a session.');
        return;
      }
      openQRScanner();
    });
  }

  // Setup quick QR scan button (always available)
  const quickScanBtn = document.getElementById('quickScanQRBtn');
  if (quickScanBtn) {
    quickScanBtn.addEventListener('click', async () => {
      if (!currentSession) {
        console.log('[QR] No active session, showing toast');
        showError('No active session at the moment. Please ask your lecturer to start a session.');
        return;
      }
      openQRScanner();
    });
  }
}

let html5QrcodeScanner = null;

function openQRScanner() {
  console.log('[QR] Opening QR scanner');
  const modal = document.getElementById('qrScannerModal');
  if (!modal) {
    console.error('[QR] Modal element not found');
    showError('Scanner not available. Please refresh the page.');
    return;
  }
  
  modal.style.display = 'flex';

  // Initialize scanner
  if (!html5QrcodeScanner) {
    console.log('[QR] Initializing html5-qrcode library');
    html5QrcodeScanner = new Html5Qrcode("qr_reader", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE
      ]
    });
  }

  // Start scanning
  html5QrcodeScanner
    .start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      async (decodedText, decodedResult) => {
        // QR code scanned successfully
        console.log('[QR] Code detected:', decodedText);
        await handleQRCodeScanned(decodedText);
        closeQRScannerInternal();
      },
      (errorMessage) => {
        // Errors here are very common, ignore them
      }
    )
    .catch((error) => {
      console.error('[QR] Camera access error:', error?.message);
      // Show manual entry option instead
      const qrContainer = document.getElementById('qr_reader');
      if (qrContainer) {
        qrContainer.innerHTML = `
          <div style="padding: 20px; text-align: center;">
            <p style="color: #c33; margin-bottom: 16px;">📷 Camera not available on this device</p>
            <p style="margin-bottom: 16px;">You can manually enter the Session ID below:</p>
            <input type="text" id="manualSessionId" placeholder="Enter Session ID" 
                   style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 14px; margin-bottom: 12px;">
            <button onclick="submitManualSessionId()" class="btn btn-primary" style="width: 100%;">Submit</button>
          </div>
        `;
      }
    });
}

function closeQRScannerInternal() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      const modal = document.getElementById('qrScannerModal');
      if (modal) {
        modal.style.display = 'none';
      }
    }).catch((error) => {
      console.error('Error stopping scanner:', error);
    });
  }
}

async function handleQRCodeScanned(decodedText) {
  console.log('[QR] Handling scanned code:', decodedText);
  console.log('[QR] Current session ID:', currentSession?.id);
  
  // Validate that code matches current session
  if (!currentSession) {
    console.error('[QR] ERROR: currentSession is null');
    showError('No active session. Please refresh the page.');
    return;
  }
  
  if (decodedText !== currentSession.id) {
    console.warn('[QR] Code mismatch - expected:', currentSession.id, 'got:', decodedText);
    showError('Invalid QR code. This code does not match the current session.');
    // Reopen scanner for retry
    setTimeout(() => {
      console.log('[QR] Reopening scanner for retry');
      openQRScanner();
    }, 2000);
    return;
  }

  console.log('[QR] Code validated, marking attendance');
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[QR] ERROR: No authenticated user');
      showError('Authentication error. Please refresh the page.');
      return;
    }
    
    const profile = await getUserProfile(user.uid);
    if (!profile) {
      console.error('[QR] ERROR: User profile not found');
      showError('Profile error. Please refresh the page.');
      return;
    }
    
    console.log('[QR] User profile found:', profile.name);
    await markAttendance(user, profile, 'QR');
    console.log('[QR] Attendance marked successfully');
    closeQRScannerInternal();
  } catch (error) {
    console.error('[QR] ERROR marking attendance:', error?.message);
    showError('Failed to mark attendance. Please try again.');
  }
}

function showNoSessionUI() {
  document.getElementById('noSessionContainer').style.display = 'block';
  document.getElementById('geoattendanceContainer').style.display = 'none';
  document.getElementById('qrOnlyContainer').style.display = 'none';
  document.getElementById('attendanceRecordedContainer').style.display = 'none';
}

// Manual session ID submission (for devices without camera)
window.submitManualSessionId = async function() {
  console.log('[QR] Manual submission initiated');
  const input = document.getElementById('manualSessionId');
  const sessionId = input?.value?.trim();
  
  if (!sessionId) {
    console.warn('[QR] WARN: Empty session ID');
    showError('Please enter a Session ID');
    return;
  }
  
  console.log('[QR] Manual ID submitted:', sessionId);
  await handleQRCodeScanned(sessionId);
  closeQRScannerInternal();
};

function showGeoattendanceUI(user, userProfile) {
  document.getElementById('noSessionContainer').style.display = 'none';
  document.getElementById('geoattendanceContainer').style.display = 'block';
  document.getElementById('qrOnlyContainer').style.display = 'none';
  document.getElementById('attendanceRecordedContainer').style.display = 'none';

  document.getElementById('sessionIdGeo').textContent = currentSession.id;
  document.getElementById('lecturerNameGeo').textContent = currentSession.lecturerName;
}

function showQROnlyUI() {
  document.getElementById('noSessionContainer').style.display = 'none';
  document.getElementById('geoattendanceContainer').style.display = 'none';
  document.getElementById('qrOnlyContainer').style.display = 'block';
  document.getElementById('attendanceRecordedContainer').style.display = 'none';

  document.getElementById('sessionIdQR').textContent = currentSession.id;
  document.getElementById('lecturerNameQR').textContent = currentSession.lecturerName;

  setupQRScanning();
}

function showAttendanceRecordedUI(method) {
  document.getElementById('noSessionContainer').style.display = 'none';
  document.getElementById('geoattendanceContainer').style.display = 'none';
  document.getElementById('qrOnlyContainer').style.display = 'none';
  document.getElementById('attendanceRecordedContainer').style.display = 'block';

  document.getElementById('recordedMethod').textContent = method;
  document.getElementById('recordedTime').textContent = new Date().toLocaleTimeString();

  showSuccess('Attendance recorded successfully!');
}

function showAlreadyAttendedUI() {
  document.getElementById('noSessionContainer').style.display = 'block';
  document.getElementById('noSessionMessage').textContent =
    'You have already marked attendance for the current session.';
  document.getElementById('geoattendanceContainer').style.display = 'none';
  document.getElementById('qrOnlyContainer').style.display = 'none';
  document.getElementById('attendanceRecordedContainer').style.display = 'none';
}

function showGeoStatusWarning() {
  const statusEl = document.getElementById('geoStatus');
  if (statusEl) {
    statusEl.textContent = 'Waiting for location...';
    statusEl.style.color = '#f39c12';
  }
}

function showLoading(show) {
  document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.getElementById('successMessage');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 3000);
}

// Load attendance history
async function loadAttendanceHistory(studentId) {
  try {
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('studentId', '==', studentId)
    );

    const attendanceSnapshot = await getDocs(attendanceQuery);
    const attendanceRecords = [];

    // Fetch session details for each attendance record
    for (const attendanceDoc of attendanceSnapshot.docs) {
      const attendanceData = attendanceDoc.data();
      const sessionDoc = await getDocs(
        query(
          collection(db, 'sessions'),
          where('__name__', '==', attendanceData.sessionId)
        )
      );

      if (!sessionDoc.empty) {
        const sessionData = sessionDoc.docs[0].data();
        attendanceRecords.push({
          id: attendanceDoc.id,
          ...attendanceData,
          session: sessionData
        });
      } else {
        // Even if session is deleted, show the record
        attendanceRecords.push({
          id: attendanceDoc.id,
          ...attendanceData,
          session: null
        });
      }
    }

    // Sort by timestamp (newest first)
    attendanceRecords.sort((a, b) => {
      const dateA = a.timestamp?.toDate?.() || new Date(0);
      const dateB = b.timestamp?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    displayAttendanceHistory(attendanceRecords);
  } catch (error) {
    console.error('Error loading attendance history:', error);
  }
}

function displayAttendanceHistory(records) {
  const container = document.getElementById('attendanceHistoryList');
  container.innerHTML = '';

  if (records.length === 0) {
    container.innerHTML = '<p class="empty-text">No attendance records yet</p>';
    return;
  }

  records.forEach(record => {
    const item = createAttendanceHistoryItem(record);
    container.appendChild(item);
  });
}

function createAttendanceHistoryItem(record) {
  const item = document.createElement('div');
  item.className = 'attendance-history-item';

  const timestamp = record.timestamp?.toDate?.() || new Date();
  const lecturerName = record.session?.lecturerName || 'Unknown Lecturer';
  const method = record.method || 'Unknown';

  item.innerHTML = `
    <div class="history-item-content">
      <div class="history-item-lecturer">
        <strong>${lecturerName}</strong>
      </div>
      <div class="history-item-details">
        <small>${timestamp.toLocaleDateString()}</small>
        <span class="history-item-method">${method}</span>
      </div>
    </div>
    <button class="history-item-delete" onclick="event.stopPropagation()" data-record-id="${record.id}">
      ✕
    </button>
  `;

  // Add delete button handler
  const deleteBtn = item.querySelector('.history-item-delete');
  deleteBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete this attendance record?')) {
      await deleteAttendanceRecord(record.id);
    }
  });

  return item;
}

async function deleteAttendanceRecord(recordId) {
  try {
    showLoading(true);
    await deleteDoc(doc(db, 'attendance', recordId));
    showLoading(false);
    showSuccess('Attendance record deleted');
    // Reload history
    const user = auth.currentUser;
    await loadAttendanceHistory(user.uid);
  } catch (error) {
    showLoading(false);
    showError('Failed to delete record: ' + error.message);
  }
}

