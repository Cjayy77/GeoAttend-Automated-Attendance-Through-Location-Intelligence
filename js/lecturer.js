// Lecturer dashboard logic with session management
import { auth, db } from './firebase.js';
import { logoutUser, getUserProfile } from './auth.js';
import { generateQRCode, displayQRCodeWithText } from './qr.js';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  getDocs,
  Timestamp,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentSession = null;
let attendanceUnsubscribe = null;
let currentViewUser = null;
let allSessions = [];
let lecturerInitialized = false;

// Device and browser detection (same as student.js)
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

console.log('[Lecturer Device] Detection:', {
  isIOS: deviceInfo.isIOS,
  isAndroid: deviceInfo.isAndroid,
  isMobile: deviceInfo.isMobile,
  isSafari: deviceInfo.isSafari,
  isChrome: deviceInfo.isChrome,
  isFirefox: deviceInfo.isFirefox,
  isEdge: deviceInfo.isEdge,
  userAgent: navigator.userAgent
});

// Initialize lecturer dashboard
export async function initLecturerDashboard() {
  console.log('[Lecturer] initLecturerDashboard called, initialized:', lecturerInitialized);
  
  if (lecturerInitialized) {
    console.log('[Lecturer] Already initialized, returning early');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.log('[Lecturer] No user found, redirecting to /');
    window.location.href = '/';
    return;
  }

  console.log('[Lecturer] User found:', user.uid);
  lecturerInitialized = true;

  currentViewUser = user;

  // Fetch and display user info
  const userProfile = await getUserProfile(user.uid);
  if (!userProfile) {
    console.log('[Lecturer] No profile found, redirecting to /');
    window.location.href = '/';
    return;
  }

  console.log('[Lecturer] Profile loaded:', userProfile.name);
  document.getElementById('lecturerName').textContent = userProfile.name;

  // Set up logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logoutUser();
    window.location.href = '/';
  });

  // Setup navigation
  setupNavigation();

  // Set up form handlers
  setupFormHandlers(user);

  // Load sessions
  loadAllSessions(user.uid);
}

function setupNavigation() {
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
      
      // Update active state
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Setup view buttons
  document.getElementById('backToListBtn').addEventListener('click', () => {
    switchView('sessions-list');
    document.querySelector('[data-view="sessions-list"]').classList.add('active');
    document.querySelector('[data-view="start-session"]').classList.remove('active');
  });
}

function switchView(viewName) {
  // Hide all views
  document.querySelectorAll('.view-panel').forEach(view => {
    view.classList.remove('active');
  });

  // Show selected view
  if (viewName === 'start-session') {
    document.getElementById('startSessionView').classList.add('active');
  } else if (viewName === 'sessions-list') {
    document.getElementById('sessionsListView').classList.add('active');
  } else if (viewName === 'session-details') {
    document.getElementById('sessionDetailsView').classList.add('active');
  }
}

async function loadAllSessions(lecturerId) {
  try {
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('lecturerId', '==', lecturerId)
    );

    const snapshot = await getDocs(sessionsQuery);
    allSessions = [];

    snapshot.forEach(docSnapshot => {
      allSessions.push({
        id: docSnapshot.id,
        ...docSnapshot.data()
      });
    });

    // Sort by start time (newest first)
    allSessions.sort((a, b) => {
      const dateA = a.startTime?.toDate?.() || new Date(0);
      const dateB = b.startTime?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    displaySessions();
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
}

function displaySessions() {
  const container = document.getElementById('allSessionsList');
  const sidebarContainer = document.getElementById('sidebarSessionsList');

  // Clear containers
  container.innerHTML = '';
  sidebarContainer.innerHTML = '';

  if (allSessions.length === 0) {
    container.innerHTML = '<p class="empty-text">No sessions yet</p>';
    sidebarContainer.innerHTML = '<p class="empty-text">No sessions yet</p>';
    return;
  }

  // Display in main area
  allSessions.forEach(session => {
    const card = createSessionCard(session);
    container.appendChild(card);
  });

  // Display in sidebar (limited to 5)
  allSessions.slice(0, 5).forEach(session => {
    const item = createSessionSidebarItem(session);
    sidebarContainer.appendChild(item);
  });

  // Show sidebar section if there are sessions
  if (allSessions.length > 0) {
    document.getElementById('sessionsListSidebar').style.display = 'block';
  }
}

function createSessionCard(session) {
  const card = document.createElement('div');
  card.className = 'session-card';

  const startDate = session.startTime?.toDate?.() || new Date();
  const attendanceCount = session.attendanceCount || 0;

  card.innerHTML = `
    <div class="session-card-header">
      <div>
        <div class="session-card-title">Session ${session.id.slice(0, 8)}</div>
        <div class="session-card-date">${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString()}</div>
      </div>
    </div>
    <div class="session-card-info">
      <p>Radius: <strong>${session.radius}m</strong></p>
      <p>Type: <strong>${session.geoEnabled ? 'Geolocation' : 'QR Only'}</strong></p>
      <p>Attended: <span class="session-card-count">${attendanceCount}</span> students</p>
    </div>
  `;

  card.addEventListener('click', () => viewSessionDetails(session));

  return card;
}

function createSessionSidebarItem(session) {
  const item = document.createElement('button');
  item.className = 'session-item-sidebar';

  const startDate = session.startTime?.toDate?.() || new Date();
  const attendanceCount = session.attendanceCount || 0;

  item.innerHTML = `
    <strong>${startDate.toLocaleDateString()}</strong><br>
    <small>${attendanceCount} students</small>
  `;

  item.addEventListener('click', (e) => {
    e.stopPropagation();
    viewSessionDetails(session);
  });

  return item;
}

async function viewSessionDetails(session) {
  try {
    // Fetch attendance records for this session
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('sessionId', '==', session.id)
    );

    const attendanceSnapshot = await getDocs(attendanceQuery);
    const attendanceRecords = [];

    attendanceSnapshot.forEach(doc => {
      attendanceRecords.push(doc.data());
    });

    // Display details
    const startDate = session.startTime?.toDate?.() || new Date();
    
    document.getElementById('detailsSessionId').textContent = session.id;
    document.getElementById('detailsSessionDate').textContent = startDate.toLocaleString();
    document.getElementById('detailsAttendanceCount').textContent = attendanceRecords.length;

    // Display QR code
    const qrContainer = document.getElementById('detailsQrCodeContainer');
    qrContainer.innerHTML = '';
    generateQRCode(session.id, 'detailsQrCodeContainer');

    // Display attendance table
    const attendanceList = document.getElementById('detailsAttendanceList');
    attendanceList.innerHTML = '';

    if (attendanceRecords.length === 0) {
      attendanceList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No attendance records</td></tr>';
    } else {
      attendanceRecords.forEach(record => {
        const row = document.createElement('tr');
        const timestamp = record.timestamp?.toDate?.() || new Date();
        row.innerHTML = `
          <td>${record.name}</td>
          <td>${record.level}</td>
          <td>${record.method}</td>
          <td>${timestamp.toLocaleTimeString()}</td>
        `;
        attendanceList.appendChild(row);
      });
    }

    // Setup buttons
    document.getElementById('deleteSessionBtn').onclick = async () => {
      if (confirm('Are you sure you want to delete this session? This cannot be undone.')) {
        await deleteSession(session.id);
      }
    };

    document.getElementById('exportPdfBtn').onclick = () => {
      exportSessionToPDF(session, attendanceRecords);
    };

    // Store current session for deletion
    window.currentViewingSession = session;

    // Switch to details view
    switchView('session-details');
  } catch (error) {
    console.error('Error loading session details:', error);
    showError('Failed to load session details');
  }
}

async function deleteSession(sessionId) {
  try {
    showLoading(true);

    // Delete session
    await deleteDoc(doc(db, 'sessions', sessionId));

    showLoading(false);
    showSuccess('Session deleted successfully');

    // Reload and return to list
    await loadAllSessions(currentViewUser.uid);
    switchView('sessions-list');
  } catch (error) {
    showLoading(false);
    showError('Failed to delete session: ' + error.message);
  }
}

function exportSessionToPDF(session, attendanceRecords) {
  const startDate = session.startTime?.toDate?.() || new Date();
  const element = document.createElement('div');
  
  element.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px;">
      <h1>Attendance Report</h1>
      <p><strong>Session ID:</strong> ${session.id}</p>
      <p><strong>Date:</strong> ${startDate.toLocaleString()}</p>
      <p><strong>Attendance Type:</strong> ${session.geoEnabled ? 'Geolocation-based' : 'QR Code-based'}</p>
      <p><strong>Total Students:</strong> ${attendanceRecords.length}</p>
      
      <h2>Attendance List</h2>
      <table border="1" cellpadding="10" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #2d5016; color: white;">
            <th>Student Name</th>
            <th>Level</th>
            <th>Method</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${attendanceRecords.map(record => {
            const timestamp = record.timestamp?.toDate?.() || new Date();
            return `
              <tr>
                <td>${record.name}</td>
                <td>${record.level}</td>
                <td>${record.method}</td>
                <td>${timestamp.toLocaleTimeString()}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `attendance_${session.id}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };

  html2pdf().set(opt).from(element).save();
}

function setupFormHandlers(user) {
  document.getElementById('sessionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (currentSession && currentSession.active) {
      showError('An active session is already running. End it first.');
      return;
    }

    const radius = parseInt(document.getElementById('radiusInput').value);
    const duration = parseInt(document.getElementById('durationInput').value);

    if (radius < 1 || radius > 1000) {
      showError('Radius must be between 1 and 1000 meters');
      return;
    }

    if (duration < 1 || duration > 480) {
      showError('Duration must be between 1 and 480 minutes');
      return;
    }

    // Request geolocation
    requestLocation(user, radius, duration);
  });
}

// Check geolocation permission state before requesting
async function checkGeoPermission() {
  if (!navigator.permissions) {
    console.log('[Lecturer Geo] Permissions API not available');
    return 'unknown';
  }
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    console.log('[Lecturer Geo] Permission state:', result.state);
    return result.state; // 'granted' | 'prompt' | 'denied'
  } catch (error) {
    console.warn('[Lecturer Geo] Could not query permission:', error.message);
    return 'unknown';
  }
}

function requestLocation(user, radius, duration) {
  showLoading(true);

  if (!navigator.geolocation) {
    console.error('[Lecturer Geo] Geolocation NOT SUPPORTED by browser');
    showLoading(false);
    showError('Geolocation is not supported by your browser. Using QR-only mode.');
    // Automatically create QR-only session
    createSession(user, radius, duration, null, null, true);
    return;
  }

  console.log('[Lecturer Geo] Browser supports geolocation, checking permission state...');
  
  // Check permission before requesting
  checkGeoPermission().then((permissionState) => {
    console.log('[Lecturer Geo] Permission state before request:', permissionState);
    
    if (permissionState === 'denied') {
      console.warn('[Lecturer Geo] Geolocation permission previously denied');
      showLoading(false);
      showLocationErrorModal(
        'Location permission denied. Enable location in browser settings.',
        () => {
          createSession(user, radius, duration, null, null, true);
        }
      );
      return;
    }
    
    // Optimal geolocation options for iOS reliability
    const geoOptions = {
      enableHighAccuracy: true,  // REQUIRED for iOS to activate GPS hardware
      timeout: 20000,            // Allow cold start (up to 20 seconds)
      maximumAge: 0              // Force fresh reading, do NOT use cached
    };
    
    console.log('[Lecturer Geo] Requesting position with optimized options');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        showLoading(false);
        console.log('[Lecturer Geo] Position obtained successfully');
        const { latitude, longitude } = position.coords;
        createSession(user, radius, duration, latitude, longitude, false);
      },
      (error) => {
        showLoading(false);
        console.error('[Lecturer Geo] Geolocation error code:', error.code, 'Message:', error.message);
        
        // Differentiated error handling
        if (error.code === error.PERMISSION_DENIED) {
          console.error('[Lecturer Geo] PERMISSION_DENIED');
          showLocationErrorModal(
            'Location permission denied. Enable location in browser settings.',
            () => {
              createSession(user, radius, duration, null, null, true);
            }
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.warn('[Lecturer Geo] POSITION_UNAVAILABLE - attempting QR fallback');
          showLocationErrorModal(
            'Location unavailable. Move outdoors or enable Precise Location.',
            () => {
              createSession(user, radius, duration, null, null, true);
            }
          );
        } else if (error.code === error.TIMEOUT) {
          console.warn('[Lecturer Geo] TIMEOUT - location request took too long');
          showLocationErrorModal(
            'Location request timed out. Retry or continue with QR.',
            () => {
              createSession(user, radius, duration, null, null, true);
            }
          );
        } else {
          console.error('[Lecturer Geo] UNKNOWN ERROR');
          showLocationErrorModal(
            'Unexpected location error. Using QR code mode.',
            () => {
              createSession(user, radius, duration, null, null, true);
            }
          );
        }
      },
      geoOptions
    );
  }).catch((err) => {
    console.error('[Lecturer Geo] Error checking permission:', err.message);
    showLoading(false);
    showLocationErrorModal(
      'Could not verify location permission. Continuing...',
      () => {
        createSession(user, radius, duration, null, null, true);
      }
    );
  });
}

async function createSession(user, radius, duration, latitude, longitude, qrOnly) {
  try {
    console.log('[Lecturer] Creating session - Radius:', radius, 'Duration:', duration, 'QR-only:', qrOnly);
    showLoading(true);

    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + duration);

    const userProfile = await getUserProfile(user.uid);
    if (!userProfile) {
      console.error('[Lecturer] ERROR: Profile not found');
      throw new Error('User profile not found');
    }

    console.log('[Lecturer] Creating session for:', userProfile.name);
    
    const sessionData = {
      lecturerId: user.uid,
      lecturerName: userProfile.name || 'Unknown',
      startTime: serverTimestamp(),
      endTime: Timestamp.fromDate(endTime),
      latitude: latitude || null,
      longitude: longitude || null,
      radius: radius,
      active: true,
      geoEnabled: !qrOnly && latitude !== null,
      qrOnly: qrOnly,
      attendanceCount: 0
    };

    const docRef = await addDoc(collection(db, 'sessions'), sessionData);
    const sessionId = docRef.id;
    
    console.log('[Lecturer] Session created with ID:', sessionId);

    // Add qrValue field
    await updateDoc(docRef, { qrValue: sessionId });

    currentSession = {
      id: sessionId,
      ...sessionData,
      qrValue: sessionId
    };

    console.log('[Lecturer] Session data saved to Firestore');
    showLoading(false);
    displaySessionUI(sessionId, duration);
    setupAttendanceListener(sessionId);
    showSuccess('Session started successfully!');
  } catch (error) {
    console.error('[Lecturer] ERROR creating session:', error?.message);
    showLoading(false);
    // Only show user-friendly message, not technical errors
    showError('Failed to start session. Please check your settings and try again.');
  }
}

function displaySessionUI(sessionId, duration) {
  document.getElementById('sessionForm').style.display = 'none';

  const sessionPanel = document.getElementById('sessionPanel');
  sessionPanel.style.display = 'block';

  displayQRCodeWithText(sessionId, 'qrCodeContainer', 'Scan to mark attendance');

  document.getElementById('sessionId').textContent = sessionId;
  document.getElementById('sessionStatus').textContent = 'Active';
  document.getElementById('sessionStatus').style.color = '#2d5016';

  startCountdownTimer(duration);

  document.getElementById('endSessionBtn').onclick = async () => {
    await endSession();
  };
}

function startCountdownTimer(minutes) {
  let remaining = minutes * 60;
  const timerElement = document.getElementById('timerDisplay');

  const countdown = setInterval(() => {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    remaining--;

    if (remaining < 0) {
      clearInterval(countdown);
      endSession();
    }
  }, 1000);

  timerElement.dataset.intervalId = countdown;
}

let currentAttendanceData = [];

function setupAttendanceListener(sessionId) {
  if (attendanceUnsubscribe) {
    attendanceUnsubscribe();
  }

  const attendanceQuery = query(
    collection(db, 'attendance'),
    where('sessionId', '==', sessionId)
  );

  attendanceUnsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
    currentAttendanceData = [];

    if (snapshot.empty) {
      currentAttendanceData = [];
      displayAttendanceList([]);
      return;
    }

    snapshot.forEach((doc) => {
      const attendance = doc.data();
      currentAttendanceData.push({
        ...attendance,
        timestamp: attendance.timestamp?.toDate?.() || new Date()
      });
    });

    // Sort by time (first attended) by default
    sortAttendanceList('time');
    document.getElementById('attendanceCount').textContent = currentAttendanceData.length;
  });

  // Setup sort dropdown listener
  const sortDropdown = document.getElementById('sortDropdown');
  if (sortDropdown) {
    sortDropdown.addEventListener('change', (e) => {
      sortAttendanceList(e.target.value);
    });
  }
}

function sortAttendanceList(sortBy) {
  let sorted = [...currentAttendanceData];

  if (sortBy === 'alphabetical') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // Sort by time (first attended first)
    sorted.sort((a, b) => a.timestamp - b.timestamp);
  }

  displayAttendanceList(sorted);
}

function displayAttendanceList(attendanceData) {
  const attendanceList = document.getElementById('attendanceList');
  attendanceList.innerHTML = '';

  if (attendanceData.length === 0) {
    attendanceList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Waiting for attendance...</td></tr>';
    return;
  }

  attendanceData.forEach((attendance) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${attendance.name}</td>
      <td>${attendance.level}</td>
      <td>${attendance.method}</td>
      <td>${attendance.timestamp.toLocaleTimeString()}</td>
    `;
    attendanceList.appendChild(row);
  });
}


async function endSession() {
  try {
    if (!currentSession) return;

    showLoading(true);

    const timerElement = document.getElementById('timerDisplay');
    if (timerElement.dataset.intervalId) {
      clearInterval(parseInt(timerElement.dataset.intervalId));
    }

    // Get final attendance count
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('sessionId', '==', currentSession.id)
    );
    const attendanceSnapshot = await getDocs(attendanceQuery);

    await updateDoc(doc(db, 'sessions', currentSession.id), {
      active: false,
      endTime: serverTimestamp(),
      attendanceCount: attendanceSnapshot.size
    });

    if (attendanceUnsubscribe) {
      attendanceUnsubscribe();
    }

    currentSession = null;
    showLoading(false);

    showSuccess('Session ended successfully');

    setTimeout(() => {
      document.getElementById('sessionPanel').style.display = 'none';
      document.getElementById('sessionForm').style.display = 'block';
      document.getElementById('sessionForm').reset();
      
      // Reload sessions
      loadAllSessions(currentViewUser.uid);
    }, 1500);
  } catch (error) {
    showLoading(false);
    showError('Failed to end session: ' + error.message);
  }
}

function showLocationErrorModal(message, onContinue) {
  const modal = document.getElementById('locationModal');
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Location Error</h2>
      <p>${message}</p>
      <div class="modal-buttons">
        <button id="continueQRBtn" class="btn btn-secondary">Continue with QR Code</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';

  document.getElementById('continueQRBtn').onclick = () => {
    modal.style.display = 'none';
    onContinue();
  };
}

function showLoading(show) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) {
    spinner.style.display = show ? 'flex' : 'none';
  }
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

function showSuccess(message) {
  const successDiv = document.getElementById('successMessage');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 3000);
  }
}
