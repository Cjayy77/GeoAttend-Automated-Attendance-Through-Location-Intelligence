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
let currentGeolocationTimeout = null;

// Device and browser detection
const deviceInfo = {
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
  isAndroid: /Android/.test(navigator.userAgent),
  isMobile: /iPad|iPhone|iPod|Android/.test(navigator.userAgent),
  isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
  isChrome: /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor),
  isFirefox: /Firefox/.test(navigator.userAgent),
  isEdge: /Edg/.test(navigator.userAgent),
  isWebView: /AppleWebKit/.test(navigator.userAgent) && /Version/.test(navigator.userAgent) && !/Safari/.test(navigator.userAgent)
};

console.log('[Device] Detection:', {
  isIOS: deviceInfo.isIOS,
  isAndroid: deviceInfo.isAndroid,
  isMobile: deviceInfo.isMobile,
  isSafari: deviceInfo.isSafari,
  isChrome: deviceInfo.isChrome,
  isFirefox: deviceInfo.isFirefox,
  isEdge: deviceInfo.isEdge,
  isWebView: deviceInfo.isWebView,
  userAgent: navigator.userAgent
});

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

  // Set up logout - RESET MODULE STATE for next login
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    attendanceRecorded = false;
    studentInitialized = false;
    currentSession = null;
    if (pollingInterval) clearInterval(pollingInterval);
    if (currentGeolocationTimeout) clearTimeout(currentGeolocationTimeout);
    console.log('[Student] Module state reset before logout');
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

    // Filter out expired sessions (endTime has passed)
    const now = new Date();
    let validSession = null;
    for (const sessionDoc of snapshot.docs) {
      const sessionData = sessionDoc.data();
      const endTime = sessionData.endTime?.toDate?.() || new Date(sessionData.endTime);
      if (endTime > now) {
        validSession = sessionDoc;
        break;
      } else {
        console.warn('[Student] Session expired:', sessionDoc.id, 'endTime:', endTime);
      }
    }

    if (!validSession) {
      showLoading(false);
      showNoSessionUI();
      return;
    }

    // Get the first active, non-expired session
    const sessionData = validSession.data();
    currentSession = {
      id: validSession.id,
      ...sessionData
    };

    // CRITICAL FIX: Reset attendanceRecorded for NEW SESSION to prevent ghost attendance
    attendanceRecorded = false;
    console.log('[Student] New session loaded, attendanceRecorded reset to false');

    // Check if already attended this session
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('sessionId', '==', currentSession.id),
      where('studentId', '==', user.uid)
    );

    const attendanceSnapshot = await getDocs(attendanceQuery);
    attendanceRecorded = !attendanceSnapshot.empty;
    console.log('[Student] Attendance check:', attendanceRecorded ? 'Already attended' : 'Not attended yet');

    showLoading(false);

    if (attendanceRecorded) {
      showAlreadyAttendedUI();
    } else if (currentSession.geoEnabled) {
      // Show geolocation UI with START ATTENDANCE button - DO NOT auto-start
      showGeoattendanceUI(user, userProfile);
      console.log('[Geolocation] Session has geolocation enabled - waiting for user to start attendance');
    } else if (currentSession.qrOnly) {
      showQROnlyUI();
    }
  } catch (error) {
    showLoading(false);
    showError('Error checking for active session: ' + error.message);
  }
}

// This is now called ONLY from button click handler, not auto-triggered
function startGeolocationPolling(user, userProfile) {
  if (!navigator.geolocation) {
    console.error('[Geolocation] NOT SUPPORTED by browser');
    showError('Geolocation is not supported by your browser. Using QR code instead.');
    showQROnlyUI();
    return;
  }

  // iOS non-Safari browsers have restricted geolocation but we still try
  let isRestrictedBrowser = false;
  if (deviceInfo.isIOS && !deviceInfo.isSafari) {
    console.warn('[Geolocation] iOS non-Safari browser detected (Chrome, Firefox, Edge on iOS)');
    console.warn('[Geolocation] These browsers have restricted geolocation access on iOS - will show warning after timeout');
    isRestrictedBrowser = true;
  }

  console.log('[Geolocation] User clicked START ATTENDANCE - requesting geolocation permission');
  updateGeoStatus('Requesting location...');

  // Request permission explicitly (especially for iOS) - triggered by user click
  requestGeolocationPermissionWithFallback(user, userProfile, isRestrictedBrowser);
}

function requestGeolocationPermissionWithFallback(user, userProfile, isRestrictedBrowser) {
  console.log('[Geolocation] Requesting permission from user' + (isRestrictedBrowser ? ' (restricted browser)' : ''));
  
  // Make the actual request - browser will show permission dialog
  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('[Geolocation] Permission granted, starting polling');
      // Permission granted, start polling
      startGeolocationPollingInternal(user, userProfile);
    },
    (error) => {
      console.error('[Geolocation] Permission request error:', error.code, error.message);
      
      // On iOS non-Safari, even "success" may return cached data
      // So we should not rely on geolocation alone
      if (error.code === error.PERMISSION_DENIED) {
        console.warn('[Geolocation] PERMISSION DENIED by user on first request');
        updateGeoStatus('❌ Location access denied. Using QR code instead.');
        showQROnlyUI();
      } else if (isRestrictedBrowser) {
        // For restricted browsers, warn user but don't force QR
        console.warn('[Geolocation] iOS non-Safari restricted access - falling back to QR');
        updateGeoStatus('⚠️ Location access limited. Use QR code to mark attendance.');
        showQROnlyUI();
      } else {
        // Try again with polling
        console.log('[Geolocation] Attempting to start polling despite initial error');
        startGeolocationPollingInternal(user, userProfile);
      }
    },
    {
      timeout: 8000,
      enableHighAccuracy: false,
      maximumAge: 5000
    }
  );
}

function startGeolocationPollingInternal(user, userProfile) {
  console.log('[Geolocation] Setting up polling interval');
  
  // Initial location request
  requestLocationAndMarkAttendance(user, userProfile);

  // Poll every 15 seconds
  pollingInterval = setInterval(() => {
    requestLocationAndMarkAttendance(user, userProfile);
  }, 15000);
}

function requestLocationAndMarkAttendance(user, userProfile) {
  // Request location directly - rely on options.timeout only (no wrapper timeout)
  // This prevents the dual-timeout race condition on iOS Safari

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const distance = calculateDistance(
        latitude,
        longitude,
        currentSession.latitude,
        currentSession.longitude
      );

      console.log('[Geolocation] Position received: distance=', distance.toFixed(2), 'radius=', currentSession.radius);
      updateGeoStatus(`Distance: ${distance.toFixed(2)}m (Radius: ${currentSession.radius}m)`);

      if (distance <= currentSession.radius && !attendanceRecorded) {
        console.log('[Geolocation] Within radius! Marking attendance.');
        markAttendance(user, userProfile, 'Geo');
      }
    },
    (error) => {
      console.error('[Geolocation] ERROR code:', error.code, 'message:', error.message);
      
      // Handle different error types
      if (error.code === error.PERMISSION_DENIED) {
        console.warn('[Geolocation] PERMISSION DENIED by user');
        updateGeoStatus('❌ Location access denied. Using QR code instead.');
        // Clear polling and switch to QR-only
        if (pollingInterval) clearInterval(pollingInterval);
        showQROnlyUI();
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        console.warn('[Geolocation] POSITION UNAVAILABLE - auto-switching to QR code');
        updateGeoStatus('❌ Position unavailable on this device. Switching to QR code...');
        // AUTO-FALLBACK on position unavailable (Safari on iOS returns this frequently)
        if (pollingInterval) clearInterval(pollingInterval);
        setTimeout(() => {
          console.log('[Geolocation] Showing QR-only UI after position unavailable');
          showQROnlyUI();
        }, 500);
      } else if (error.code === error.TIMEOUT) {
        console.warn('[Geolocation] TIMEOUT from getCurrentPosition');
        updateGeoStatus('⏱️ Location request timed out. Retrying...');
        // Retry continues at next polling interval (15 seconds)
      } else {
        console.warn('[Geolocation] Unknown error:', error.message);
        updateGeoStatus('❌ Location error: ' + error.message);
      }
    },
    {
      timeout: 8000,  // 8-second timeout for getCurrentPosition (iOS requirement)
      enableHighAccuracy: false,  // Faster on mobile
      maximumAge: 0  // CHANGED: Don't accept cached positions (prevents stale data)
    }
  );
}

function updateGeoStatus(message) {
  // Show status section when updating status
  const statusSection = document.getElementById('geoStatusSection');
  const loadingIndicator = document.getElementById('geoLoadingIndicator');
  const startBtn = document.getElementById('startAttendanceBtn');
  
  if (statusSection) {
    statusSection.style.display = 'block';
  }
  if (loadingIndicator) {
    loadingIndicator.style.display = 'block';
  }
  if (startBtn) {
    startBtn.style.display = 'none';
  }
  
  const statusEl = document.getElementById('geoStatus');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = message.includes('❌') || message.includes('error') ? '#e74c3c' : '#f39c12';
  }
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
  console.log('[QR] Setting up QR scanning buttons');
  const scanButton = document.getElementById('scanQRBtn');
  if (scanButton) {
    scanButton.addEventListener('click', async () => {
      if (!currentSession) {
        console.log('[QR] No active session, showing error');
        showError('No active session at the moment. Please ask your lecturer to start a session.');
        return;
      }
      console.log('[QR] scanQRBtn clicked, opening scanner');
      openQRScanner();
    });
  } else {
    console.warn('[QR] scanQRBtn element not found in DOM');
  }

  // Setup QR scan button in geolocation section (fallback for when geo fails)
  const scanGeoBtn = document.getElementById('scanQRBtnGeo');
  if (scanGeoBtn) {
    scanGeoBtn.addEventListener('click', async () => {
      if (!currentSession) {
        console.log('[QR] No active session, showing error');
        showError('No active session at the moment. Please ask your lecturer to start a session.');
        return;
      }
      console.log('[QR] scanQRBtnGeo clicked (from geo section), opening scanner');
      // Stop polling if it was running
      if (pollingInterval) {
        clearInterval(pollingInterval);
        console.log('[Geolocation] Polling stopped, switching to QR');
      }
      openQRScanner();
    });
  }

  // Setup quick QR scan button (always available)
  const quickScanBtn = document.getElementById('quickScanQRBtn');
  if (quickScanBtn) {
    quickScanBtn.addEventListener('click', async () => {
      if (!currentSession) {
        console.log('[QR] No active session (quick scan), showing error');
        showError('No active session at the moment. Please ask your lecturer to start a session.');
        return;
      }
      console.log('[QR] quickScanQRBtn clicked, opening scanner');
      openQRScanner();
    });
  } else {
    console.warn('[QR] quickScanQRBtn element not found in DOM');
  }
}

let html5QrcodeScanner = null;
let qrScannerOpen = false;

function openQRScanner() {
  // Prevent multiple simultaneous scanner opens
  if (qrScannerOpen) {
    console.warn('[QR] Scanner already opening, ignoring duplicate request');
    return;
  }
  qrScannerOpen = true;

  console.log('[QR] Opening QR scanner - device:', {
    platform: deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'Desktop',
    browser: deviceInfo.isSafari ? 'Safari' : deviceInfo.isChrome ? 'Chrome' : deviceInfo.isFirefox ? 'Firefox' : deviceInfo.isEdge ? 'Edge' : 'Other'
  });

  const modal = document.getElementById('qrScannerModal');
  if (!modal) {
    console.error('[QR] FATAL: Modal element not found');
    showError('Scanner not available. Please refresh the page.');
    qrScannerOpen = false;
    return;
  }
  
  const qrReader = document.getElementById('qr_reader');
  if (!qrReader) {
    console.error('[QR] FATAL: qr_reader element not found');
    showError('Scanner component not available. Please refresh the page.');
    qrScannerOpen = false;
    return;
  }

  console.log('[QR] Opening modal and initializing scanner');
  modal.style.display = 'flex';

  // Clear previous content
  qrReader.innerHTML = '';

  // Initialize scanner if not already done
  if (!html5QrcodeScanner) {
    console.log('[QR] Creating new Html5Qrcode instance');
    try {
      const config = {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };
      
      // Add iOS/mobile optimizations
      if (deviceInfo.isMobile) {
        config.willReadFrequently = true;  // iOS optimization
      }
      
      // Android Chrome needs different config
      if (deviceInfo.isAndroid && deviceInfo.isChrome) {
        config.useBarCodeDetectorIfAvailable = true;
      }

      html5QrcodeScanner = new Html5Qrcode("qr_reader", config);
      console.log('[QR] Html5Qrcode instance created successfully');
    } catch (error) {
      console.error('[QR] FATAL: Failed to create Html5Qrcode instance:', error?.message);
      showError('Failed to initialize scanner. Please refresh the page.');
      modal.style.display = 'none';
      return;
    }
  }

  console.log('[QR] Requesting camera access (this will show permission dialog on iOS)...');
  
  // Start scanning with proper error handling
  html5QrcodeScanner
    .start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        disableFlip: false,
        aspectRatio: 1.0
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
      console.error('[QR] CRITICAL: Camera access failed');
      console.error('[QR] Error message:', error?.message || String(error));
      console.error('[QR] Full error:', error);
      
      // Check if it's a permission error
      const errorStr = String(error).toLowerCase();
      const isPermissionError = errorStr.includes('permission') || 
                                errorStr.includes('denied') || 
                                errorStr.includes('notallowed') ||
                                errorStr.includes('user denied') ||
                                errorStr.includes('not allowed');
      
      console.log('[QR] Is permission error:', isPermissionError);
      console.log('[QR] Device/Browser:', deviceInfo);
      
      // Show manual entry option instead
      const qrContainer = document.getElementById('qr_reader');
      if (qrContainer) {
        let instructionText = '';
        
        if (isPermissionError) {
          if (deviceInfo.isIOS && !deviceInfo.isSafari) {
            instructionText = 'Please enable camera access:<br/>Settings > ' + document.title + ' > Camera';
          } else if (deviceInfo.isIOS) {
            instructionText = 'Please enable camera access:<br/>Settings > Safari > Camera';
          } else if (deviceInfo.isAndroid) {
            instructionText = 'Please enable camera access in app settings';
          } else {
            instructionText = 'Please enable camera access in browser settings';
          }
        } else {
          instructionText = 'You can manually enter the Session ID below:';
        }
        
        qrContainer.innerHTML = `
          <div style="padding: 20px; text-align: center;">
            <p style="color: #c33; margin-bottom: 16px;">📷 Camera not available</p>
            <p style="margin-bottom: 16px;">
              ${instructionText}
            </p>
            <input type="text" id="manualSessionId" placeholder="Enter Session ID" 
                   style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 14px; margin-bottom: 12px;">
            <button onclick="submitManualSessionId()" class="btn btn-primary" style="width: 100%;">Submit</button>
          </div>
        `;
        showError('Camera access failed. Please use manual entry.');
      }
    });
}

function closeQRScannerInternal() {
  qrScannerOpen = false;
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      const modal = document.getElementById('qrScannerModal');
      if (modal) {
        modal.style.display = 'none';
      }
    }).catch((error) => {
      console.error('Error stopping scanner:', error);
      qrScannerOpen = false;
    });
  }
}

// Export for use in HTML
export { closeQRScannerInternal };

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
    console.warn('[QR] WARN: Empty session ID submitted');
    showError('Please enter a session ID');
    return;
  }

  console.log('[QR] Manual session ID entered:', sessionId);
  
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
    
    console.log('[QR] Calling handleQRCodeScanned with manual ID');
    await handleQRCodeScanned(sessionId);
    closeQRScannerInternal();
  } catch (error) {
    console.error('[QR] ERROR during manual submission:', error?.message);
    showError('Error submitting session ID: ' + error.message);
  }
};

function showGeoattendanceUI(user, userProfile) {
  document.getElementById('noSessionContainer').style.display = 'none';
  document.getElementById('geoattendanceContainer').style.display = 'block';
  document.getElementById('qrOnlyContainer').style.display = 'none';
  document.getElementById('attendanceRecordedContainer').style.display = 'none';

  document.getElementById('sessionIdGeo').textContent = currentSession.id;
  document.getElementById('lecturerNameGeo').textContent = currentSession.lecturerName;

  // Setup START ATTENDANCE button to trigger geolocation on user click
  const startGeoBtn = document.getElementById('startAttendanceBtn');
  if (startGeoBtn) {
    startGeoBtn.onclick = async () => {
      console.log('[Geolocation] User clicked START ATTENDANCE');
      // Disable button during geolocation request
      startGeoBtn.disabled = true;
      startGeoBtn.textContent = 'Requesting location...';
      startGeolocationPolling(auth.currentUser, userProfile);
    };
  } else {
    console.warn('[Student] START ATTENDANCE button not found in DOM');
  }

  // CRITICAL FIX: Setup QR scanning for geolocation sessions too (as fallback)
  console.log('[Student] Setting up QR as fallback for geo session');
  setupQRScanning();
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

