# GeoAttend - Geolocation + QR Attendance System

A complete, fully functional web-based attendance system that combines geolocation and QR code-based marking.

## Features

✅ **Authentication**
- Email/password registration and login
- Role-based access (Student/Lecturer)
- Firebase Authentication

✅ **Lecturer Features**
- Create attendance sessions
- Set attendance radius (10-1000m)
- Set session duration
- Real-time geolocation support
- QR code generation and display
- Live attendance list with real-time updates
- Session countdown timer

✅ **Student Features**
- Automatic active session detection
- Geolocation-based attendance (Haversine distance)
- QR code scanning
- Real-time attendance confirmation
- Duplicate prevention

✅ **Technical**
- Client-side only (Firebase backend)
- No Node.js required
- HTTPS compatible
- Responsive design
- Modular JavaScript
- Real-time Firestore updates

## Project Structure

```
GeoAttend/
├── index.html              # Login/Signup page
├── lecturer.html           # Lecturer dashboard
├── student.html            # Student dashboard
├── css/
│   └── style.css          # All styling
├── js/
│   ├── firebase.js        # Firebase initialization
│   ├── auth.js            # Authentication functions
│   ├── lecturer.js        # Lecturer logic
│   ├── student.js         # Student logic
│   └── qr.js              # QR code generation
├── FIREBASE_CONFIG_TEMPLATE.md  # Setup instructions
└── FIRESTORE_RULES.txt         # Security rules
```

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (name it "GeoAttend" or similar)
3. Wait for project creation to complete

### 2. Enable Authentication

1. Navigate to **Authentication** (left sidebar)
2. Click **Sign-in method**
3. Enable **Email/Password**
4. Save

### 3. Create Firestore Database

1. Navigate to **Firestore Database** (left sidebar)
2. Click **Create database**
3. Choose **Start in production mode**
4. Select a region (closest to you)
5. Click **Enable**

### 4. Get Firebase Config

1. Go to **Project Settings** (gear icon, top-left)
2. Under **General** tab, find **Your apps** section
3. If no app exists, click **Add app** → **Web**
4. Register your app
5. Copy the Firebase config object

### 5. Add Security Rules

1. In **Firestore Database**, click **Rules** tab
2. Replace all content with the rules from `FIRESTORE_RULES.txt`
3. Click **Publish**

### 6. Update Firebase Config

1. Open `js/firebase.js`
2. Replace the placeholder values:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY_HERE",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID_HERE",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
     appId: "YOUR_APP_ID_HERE"
   };
   ```

## Local Development

### Using Firebase Emulator

```bash
npm install -g firebase-tools
firebase login
firebase init
firebase emulators:start
```

### Using Python HTTP Server (Simple)

```bash
cd c:\Users\hp\Desktop\GeoAttend
python -m http.server 8000
```

Then visit `http://localhost:8000`

**Note:** Geolocation requires HTTPS, so testing on localhost is fine, but on production you MUST use HTTPS.

### Using Live Server (VS Code)

1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

## Deployment

### Option 1: Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Select your project
# Set public directory to current directory
firebase deploy
```

### Option 2: Vercel

1. Push this repository to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your GitHub repository
4. Deploy (automatically serves as static)

## Usage Guide

### For Lecturers

1. **Login** with lecturer email/password
2. **Set Parameters:**
   - Attendance Radius: Distance students must be within (meters)
   - Session Duration: How long the session runs (minutes)
3. **Click Start Session:**
   - System requests your location
   - If granted: Creates geolocation + QR session
   - If denied: Creates QR-only session
4. **Share QR Code** with students
5. **Monitor** real-time attendance list
6. **End Session** when done

### For Students

1. **Login** with student email/password
2. **Auto-detection:** Active session automatically shows on dashboard
3. **If Geolocation Session:**
   - System requests permission
   - Device location checked every 15 seconds
   - Marked present when within radius
4. **If QR-Only Session:**
   - Click "Scan QR Code"
   - Scan lecturer's QR code
   - Or manually enter session ID
5. **Confirmation:** See "Attendance Recorded" message

## Key Algorithms

### Haversine Distance Formula

Calculates distance between two geographic coordinates:

```
Distance (meters) = 2 * R * arcsin(√(sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)))
```

Where:
- R = Earth's radius (6,371,000 meters)
- φ = latitude
- λ = longitude

### Duplicate Prevention

Attendance documents use composite ID:
```
docId = ${sessionId}_${studentId}
```

This ensures one attendance record per student per session.

## Firestore Data Structure

### `users` collection

```
{
  role: "student" | "lecturer",
  name: string,
  level: string (students only),
  email: string,
  createdAt: timestamp
}
```

### `sessions` collection

```
{
  lecturerId: uid,
  lecturerName: string,
  startTime: timestamp,
  endTime: timestamp,
  latitude: number | null,
  longitude: number | null,
  radius: number,
  active: boolean,
  geoEnabled: boolean,
  qrOnly: boolean,
  qrValue: string (= sessionId)
}
```

### `attendance` collection

```
{
  sessionId: string,
  studentId: uid,
  name: string,
  level: string,
  timestamp: timestamp,
  method: "Geo" | "QR"
}
```

## Security Features

✅ **Authentication**
- Firebase Auth handles password hashing
- Email verification optional (can be added)

✅ **Database Rules**
- Users read only own profile
- Students write only own attendance
- Lecturers create only own sessions
- Attendance records immutable

✅ **Privacy**
- Student coordinates NOT stored
- Only lecturer coordinates stored (once per session)
- Attendance records show only name, level, method, time

✅ **HTTPS Required**
- Geolocation API requires secure context
- Deploy with HTTPS only

## Troubleshooting

### Geolocation Not Working

**Problem:** "Waiting for location..." never resolves
- **Cause:** User denied permission or browser blocking
- **Solution:** 
  - Check browser location permissions
  - Use HTTPS connection
  - Try QR-only mode as alternative

### QR Code Not Displaying

**Problem:** Empty container where QR should be
- **Cause:** qrcode.js library not loaded
- **Solution:** 
  - Check internet connection (CDN access)
  - Check browser console for errors
  - Verify session ID is valid

### Students Not Appearing in Attendance List

**Problem:** Students marked present but not showing
- **Cause:** Real-time listener not subscribed
- **Solution:**
  - Check Firestore rules applied correctly
  - Verify student wrote to correct session ID
  - Check browser console for errors

### "No active session" on Student Dashboard

**Problem:** Lecturer created session but student sees nothing
- **Cause:** 
  - Query timeout or network issue
  - Session not marked as active
- **Solution:**
  - Refresh page
  - Verify lecturer session shows "Active"
  - Check Firestore database for session document

## Browser Compatibility

### Desktop

| Browser | Geolocation | QR Camera | Overall | Notes |
|---------|-------------|-----------|---------|-------|
| Chrome  | ✅ Full | ✅ Full | ✅ Full | Recommended, works perfectly |
| Firefox | ✅ Full | ✅ Full | ✅ Full | Works perfectly |
| Safari  | ✅ Full | ✅ Full | ✅ Full | Works perfectly |
| Edge    | ✅ Full | ✅ Full | ✅ Full | Works perfectly |
| IE 11   | ❌ None | ❌ None | ❌ None | Not supported |

**Requirements:** HTTPS for geolocation and camera access (localhost allowed for dev)

### Android

| Browser | Geolocation | QR Camera | Overall | Notes |
|---------|-------------|-----------|---------|-------|
| Chrome  | ✅ Full | ✅ Full | ✅ Full | Recommended |
| Firefox | ✅ Full | ✅ Full | ✅ Full | Works great |
| Samsung Internet | ✅ Full | ✅ Full | ✅ Full | Works great |
| Edge    | ✅ Full | ✅ Full | ✅ Full | Works great |
| Opera   | ✅ Full | ✅ Full | ✅ Full | Works great |
| Chrome Lite | ⚠️ Limited | ✅ Full | ⚠️ Limited | Geolocation may not work |

**Requirements:** HTTPS, Android 5.0+ recommended

### iOS (Apple devices)

| Browser | Geolocation | QR Camera | Overall | Notes |
|---------|-------------|-----------|---------|-------|
| Safari  | ✅ Full | ✅ Full | ✅ **Recommended** | Full native API access |
| Chrome  | ❌ Restricted | ⚠️ Limited | ❌ **Not Recommended** | Uses WebKit (Apple requirement) with restricted APIs |
| Firefox | ❌ Restricted | ⚠️ Limited | ❌ **Not Recommended** | Uses WebKit (Apple requirement) with restricted APIs |
| Edge    | ❌ Restricted | ⚠️ Limited | ❌ **Not Recommended** | Uses WebKit (Apple requirement) with restricted APIs |
| Opera   | ❌ Restricted | ⚠️ Limited | ❌ **Not Recommended** | Uses WebKit (Apple requirement) with restricted APIs |

**Key Points:**
- **Safari on iOS:** ✅ Full support - can use geolocation and camera normally
- **All other browsers on iOS:** ❌ Have restricted geolocation (returns cached/fake data due to Apple's WebKit requirement)
- **Fallback:** Non-Safari iOS browsers automatically detect restriction and switch to QR code instead
- **Manual Entry:** If camera also fails, users can manually enter session ID (always available as fallback)

**Requirements:** HTTPS, iOS 12+ recommended

### Fallback Strategy

The system automatically handles all scenarios:

```
Geolocation-based session?
├─ YES → Try geolocation
│  ├─ Success → Use geolocation
│  ├─ Permission denied → Switch to QR
│  ├─ Location unavailable → Retry or switch to QR
│  └─ Non-Safari iOS → Show warning, switch to QR
│
└─ NO → Use QR code directly

QR Camera?
├─ Success → Scan QR code
├─ Permission denied → Show manual entry form
├─ Camera unavailable → Show manual entry form
└─ Any error → Manual entry form (always available)

Manual Entry?
└─ Always works → User enters session ID manually
```

## Performance Tips

1. **Reduce Polling Interval:** Change 15s to 30s in `student.js` for less battery drain
2. **Optimize QR Size:** Adjust in `qr.js` for faster scanning
3. **Database Indexes:** Consider adding composite indexes for common queries
4. **Cache Authentication:** Tokens cached automatically by Firebase SDK
5. **iOS Recommendation:** Use Safari for best geolocation experience

## Future Enhancements

- Real-time notifications for students
- SMS alerts
- Face recognition
- Multiple attendance methods per session
- Offline support
- Analytics dashboard
- Export attendance to CSV/PDF

## License

MIT

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Verify Firebase configuration
4. Check Firestore rules are applied

## API Reference

### `firebase.js`
- `setupAuthListener(callback)` - Listen to auth state changes
- `getCurrentUser()` - Get current user async

### `auth.js`
- `registerUser(email, password, name, role, level)` - Create account
- `loginUser(email, password)` - Sign in
- `logoutUser()` - Sign out
- `getUserProfile(uid)` - Fetch user data
- `updateUserProfile(uid, data)` - Update user data

### `lecturer.js`
- `initLecturerDashboard()` - Initialize lecturer page

### `student.js`
- `initStudentDashboard()` - Initialize student page
- `setupQRScanning()` - Setup QR scanning button

### `qr.js`
- `generateQRCode(text, elementId)` - Generate QR code
- `displayQRCodeWithText(sessionId, elementId, text)` - Display with label
- `downloadQRCode(filename)` - Download as PNG

---

**Status:** ✅ Production Ready
**Last Updated:** January 2026
**Version:** 1.0.0
README generated by Artificial Intelligence, after prompt from User.
