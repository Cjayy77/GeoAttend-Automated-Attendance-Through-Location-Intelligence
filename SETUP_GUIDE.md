# GeoAttend Setup & Testing Guide

## 📋 Pre-Setup Checklist

Before you begin, ensure you have:
- [ ] A Google account (for Firebase)
- [ ] Internet connection
- [ ] A modern web browser (Chrome, Firefox, Safari, Edge)
- [ ] A text editor or VS Code
- [ ] (Optional) Python 3 for local testing, or Node.js with npm

---

## 🔧 Part 1: Firebase Project Setup (10 minutes)

### Step 1: Create Firebase Project

1. Go to **[Firebase Console](https://console.firebase.google.com)**
2. Click **"Add project"**
3. Project name: Enter `GeoAttend` (or any name)
4. Accept terms and continue
5. Choose default settings (or customize if needed)
6. Click **"Create project"**
7. Wait for creation to complete (1-2 minutes)

### Step 2: Enable Authentication

1. In left sidebar, click **"Build"** → **"Authentication"**
2. Click **"Get started"**
3. Click the **"Email/Password"** provider
4. Toggle **"Enable"** ON
5. Click **"Save"**

You should see a green check mark.

### Step 3: Create Firestore Database

1. In left sidebar, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"**
4. Click **"Next"**
5. Select a region (closest to you, e.g., `us-central1`)
6. Click **"Enable"**

Database will be created (1-2 minutes).

### Step 4: Get Firebase Configuration

1. Click the **⚙️ gear icon** (top-left) → **"Project Settings"**
2. Scroll down to **"Your apps"** section
3. Look for a web app (if none exists):
   - Click **"</>"** (Add web app)
   - Enter app nickname: `GeoAttend`
   - Click **"Register app"**
4. You'll see your Firebase config - **COPY IT**

The config looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "geoattend-123.firebaseapp.com",
  projectId: "geoattend-123",
  storageBucket: "geoattend-123.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def"
};
```

### Step 5: Add Security Rules

1. Go back to **"Firestore Database"**
2. Click the **"Rules"** tab
3. Click **"Edit rules"**
4. **DELETE** the existing text (starting with `match /`)
5. **COPY** the entire content of `FIRESTORE_RULES.txt` from your project folder
6. **PASTE** it into the editor
7. Click **"Publish"**

You should see ✅ "Rules published successfully"

---

## 🔑 Part 2: Configure Your Project (5 minutes)

### Step 1: Find the firebase.js File

In your project folder (`c:\Users\hp\Desktop\GeoAttend\`), open:
```
js/firebase.js
```

### Step 2: Update Firebase Config

Find this section (around line 6-15):
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Replace with your actual config from Step 4.

### Step 3: Save the File

Save `js/firebase.js` (Ctrl+S)

---

## 🧪 Part 3: Test Locally (5 minutes)

### Option A: Using Python (Easiest)

1. Open PowerShell or Command Prompt
2. Navigate to your project:
   ```powershell
   cd "c:\Users\hp\Desktop\GeoAttend"
   ```
3. Start local server:
   ```powershell
   python -m http.server 8000
   ```
4. Open browser and go to: **http://localhost:8000**

### Option B: Using Node.js

```powershell
npm install -g http-server
cd "c:\Users\hp\Desktop\GeoAttend"
http-server -p 8000
```

Then open: **http://localhost:8000**

### Option C: Using VS Code Live Server

1. Install VS Code extension: **"Live Server"**
2. Right-click on `index.html`
3. Select **"Open with Live Server"**
4. Browser opens automatically

---

## 👤 Part 4: Create Test Accounts (2 minutes)

You need 2 accounts to test the system.

### Create Lecturer Account

1. You're on **http://localhost:8000**
2. Click **"Sign Up"** link
3. Fill in:
   - Email: `lecturer@test.com`
   - Password: `Password123` (6+ chars)
   - Confirm Password: `Password123`
   - Full Name: `Prof. Smith`
   - Role: **"Lecturer"** (select from dropdown)
4. Click **"Sign Up"**
5. Wait for redirect (auto-redirects to lecturer dashboard)
6. Click **"Logout"** (top right)

### Create Student Account

1. You're back on login page
2. Click **"Sign Up"** link
3. Fill in:
   - Email: `student@test.com`
   - Password: `Password123`
   - Confirm Password: `Password123`
   - Full Name: `John Doe`
   - Role: **"Student"** (select from dropdown)
   - Level: **"Level 100"** (select from dropdown)
4. Click **"Sign Up"**
5. Wait for redirect (auto-redirects to student dashboard)
6. Click **"Logout"**

---

## 🎮 Part 5: Test the System (10 minutes)

### Scenario: Lecturer Creates Session

**Browser 1 (Lecturer):**

1. Go to **http://localhost:8000**
2. Login with: `lecturer@test.com` / `Password123`
3. You're on **Lecturer Dashboard**
4. Set values:
   - Attendance Radius: `50` meters
   - Session Duration: `5` minutes
5. Click **"Start Session"**
6. Browser asks for location permission - Click **"Allow"**
7. Wait 2 seconds...
8. You see:
   - ✅ QR code displayed
   - ✅ Session ID shown
   - ✅ Timer counting down (5:00 → 4:59 → ...)
   - ✅ "Waiting for attendance..." table

### Scenario: Student Marks Attendance

**Browser 2 (Student):**

1. Go to **http://localhost:8000** in a new tab/window
2. Login with: `student@test.com` / `Password123`
3. You're on **Student Dashboard**
4. You see:
   - ✅ **"Active Session"** section (not "No Active Attendance")
   - ✅ Lecturer name shown
   - ✅ "Location Status" showing distance check
5. In about 15 seconds, system gets your location:
   - ✅ Shows: "Distance: X.XXm (Radius: 50m)"
   - ✅ If distance ≤ 50m → Attendance recorded automatically
6. You see: **"✓ Attendance Recorded"** with "Geo" as method

### Verify Results

**Back to Browser 1 (Lecturer):**

1. Check the **Student Attendance** table
2. You should see:
   - ✅ Row with "John Doe" (student name)
   - ✅ Level: "100"
   - ✅ Method: "Geo"
   - ✅ Time: Current time
   - ✅ Attendance Count: "1"

---

## ❌ If Geolocation Doesn't Work

This is NORMAL on first test - geolocation may be slow.

### Fallback: Test with QR Code

1. **Lecturer Dashboard:** Stop the session (click **"End Session"**)
2. Start a new session
3. Browser asks for location → Click **"Block"** or wait 10 seconds
4. Modal appears: **"Continue (QR-Only)"** button
5. Click **"Continue (QR-Only)"**
6. Now it's QR-only mode
7. On student side: Button **"Scan QR Code"** appears
8. Click it → Enter the **Session ID** from lecturer page
9. Attendance recorded with method: **"QR"**

---

## 🌍 Test on Mobile (Optional)

To test geolocation more accurately:

1. Deploy locally to your computer's IP:
   ```powershell
   python -m http.server 8000 --bind 192.168.x.x
   ```
   (Replace with your computer's IP)

2. On mobile phone:
   - Connect to same WiFi
   - Go to: `http://192.168.x.x:8000`
   - Test geolocation (works better on mobile)

---

## 🚀 Deploy to Production (5 minutes)

### Option 1: Firebase Hosting (Recommended)

```powershell
npm install -g firebase-tools
firebase login
cd "c:\Users\hp\Desktop\GeoAttend"
firebase init hosting
# Select your project
# Set public directory to "." (current folder)
firebase deploy
```

Your app will be live at: **https://YOUR-PROJECT-ID.web.app**

### Option 2: Vercel (Simplest)

1. Create GitHub account (if needed)
2. Push your project to GitHub
3. Go to **https://vercel.com**
4. Click **"New Project"**
5. Import from GitHub
6. Click **"Deploy"**

Your app will be live at a Vercel URL (auto-generated)

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Firebase project created
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Security rules published
- [ ] Firebase config updated in `js/firebase.js`
- [ ] Local server running (localhost:8000)
- [ ] Lecturer account created
- [ ] Student account created
- [ ] Lecturer can start session
- [ ] QR code displays
- [ ] Student dashboard shows active session
- [ ] Attendance recorded (visible in attendance list)

---

## 🆘 Troubleshooting

### Problem: "Invalid Firebase Config"

**Solution:**
1. Go back to Firebase Console
2. Copy the config again (more carefully)
3. Make sure ALL values are copied, not partial
4. Check for missing commas or quotes

### Problem: "No active session" on student side

**Solution:**
1. Verify lecturer session shows "Active"
2. Check Firestore console for session document
3. Refresh student page (F5)
4. Try creating a new session

### Problem: Geolocation "not working"

**Solution:**
1. It might just be slow - wait 15 seconds
2. Check browser permissions (address bar)
3. Allow location access when prompted
4. Use QR-only mode as backup

### Problem: "Cannot read property of undefined"

**Solution:**
1. Open browser console (F12)
2. Look for error message
3. Check if `js/firebase.js` has correct config
4. Verify rules are published in Firestore

### Problem: Firestore rules error

**Solution:**
1. Go to Firestore Database → Rules tab
2. Click "Edit rules"
3. Look for syntax errors (red squiggly)
4. Re-paste all content from `FIRESTORE_RULES.txt`
5. Click "Publish"

---

## 📞 Getting Help

### Error in Browser Console?

1. Press **F12** to open Developer Tools
2. Go to **"Console"** tab
3. Look for red error messages
4. Copy the error and search online or:
   - Check README.md
   - Check QUICKSTART.html
   - Check Firebase docs

### Still Stuck?

1. Verify all setup steps above
2. Check project structure matches provided files
3. Ensure Firebase config is correct
4. Try on a different browser
5. Check internet connection

---

## 🎓 Next: Understanding the System

Once everything works:

1. **Read `README.md`** for detailed documentation
2. **Check `VERIFICATION.md`** for feature checklist
3. **Review code** in `/js/` folder
4. **Customize** colors in `/css/style.css`
5. **Deploy** to production

---

## 🎉 You're Done!

Congratulations! You now have a fully functional attendance system.

### What Can You Do Now?

✅ Create attendance sessions
✅ Mark students present via geolocation
✅ Mark students present via QR code
✅ See real-time attendance list
✅ Deploy to production
✅ Customize for your needs

---

**Start here:** Double-check all setup steps
**Then test:** Follow the testing workflow
**Finally:** Deploy using Firebase or Vercel

Good luck! 🚀
