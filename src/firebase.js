import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCJwnKmNl9_0_1XalchOUpVU2yTtLkOb9k',
  appId: '1:572246591048:web:fa68fa0ddae19b4516fa7d',
  messagingSenderId: '572246591048',
  projectId: 'api-fr-dbaac',
  authDomain: 'api-fr-dbaac.firebaseapp.com',
  databaseURL: 'https://api-fr-dbaac-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: 'api-fr-dbaac.firebasestorage.app',
  measurementId: 'G-Y5R5EB3EMW',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const COLLECTION = 'pings';
const NOTES_DOC = 'daily_note';

// Your VPS Push Endpoint & Public VAPID Key
export const VPS_API_BASE = 'https://bubu.arnavcloud.co.in';
export const PUBLIC_VAPID_KEY = 'BIGU4TdmKPx9RsHIzMBE6TnX0DE-749m07zGeIXT_ZROr89gTAyjT8BovtUjRWsRmAv8wZiDER4tcBN0-7FcJQ0';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Web Audio API Chime Generator
export function playChimeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.28); // D6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch (e) {}
}

// Register Apple Web Push subscription with VPS
export async function registerPushWithVPS(role) {
  if (!('serviceWorker' in navigator)) {
    return { success: false, reason: 'ServiceWorker not supported in this browser' };
  }

  try {
    // 1. Get or register ServiceWorker directly
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    }

    // Safety timeout: never hang forever waiting for ready
    const readyRegistration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker timeout')), 3500))
    ]).catch(() => registration);

    const targetReg = readyRegistration || registration;

    if (!('PushManager' in window)) {
      const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
      if (!isStandalone) {
        return { 
          success: false, 
          reason: 'Apple requires opening from Home Screen. Tap Safari Share (⬆️) > Add to Home Screen!' 
        };
      }
      return { success: false, reason: 'PushManager is not available on this device' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { 
        success: false, 
        reason: 'Notification permission not granted. Please allow notifications in iPhone Settings > Notifications > BubuLink.' 
      };
    }

    let subscription = await targetReg.pushManager.getSubscription();
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
      subscription = await targetReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    // Post subscription to VPS backend
    const res = await fetch(`${VPS_API_BASE}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        subscription,
      }),
    });

    const data = await res.json();
    console.log(`✅ [BubuLink] Push registered on VPS for ${role}:`, data);
    return { success: true, role };
  } catch (err) {
    console.error('Push registration error:', err);
    return { success: false, reason: err.message || 'Push registration failed' };
  }
}

// Dispatch Apple Web Push via VPS to target
export async function dispatchVPSPush(targetRole, title, body) {
  try {
    const res = await fetch(`${VPS_API_BASE}/api/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole,
        title,
        body,
      }),
    });
    const result = await res.json();
    console.log(`⚡ Dispatched push to ${targetRole} via VPS:`, result);
    return result;
  } catch (err) {
    console.warn('VPS push dispatch notice:', err);
    return { error: err.message };
  }
}

// Show in-app toast / banner + sound
export function showSystemNotification(title, body) {
  playChimeSound();
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

  window.dispatchEvent(
    new CustomEvent('bubulink_alert', {
      detail: { title, body }
    })
  );
}

// Send a new ping to Firestore & trigger VPS Push to partner
export async function sendPingToFirestore(ping) {
  try {
    const docRef = doc(db, COLLECTION, ping.id);
    await setDoc(docRef, ping);

    const targetRole = ping.sender === 'zenah' ? 'arnav' : 'zenah';
    const senderName = ping.sender === 'zenah' ? 'Zenah' : 'Arnav';
    const title = `${ping.emoji} ${senderName}: ${ping.tag}`;
    const body = ping.message || 'Sent you a love ping!';

    // Dispatch real lock-screen push to partner
    dispatchVPSPush(targetRole, title, body);
    return true;
  } catch (err) {
    console.error('Error sending ping to Firestore:', err);
    return false;
  }
}

// React to a ping & trigger VPS Push back to original sender
export async function reactToPingInFirestore(pingId, reaction, responderRole, originalSender) {
  try {
    const docRef = doc(db, COLLECTION, pingId);
    await updateDoc(docRef, {
      reaction,
      responderRole,
      reactionTimestamp: new Date().toISOString(),
    });

    const targetRole = originalSender || (responderRole === 'arnav' ? 'zenah' : 'arnav');
    const responderName = responderRole === 'arnav' ? 'Arnav' : 'Zenah';
    const title = `💖 ${responderName} Replied!`;
    const body = `${responderName}: ${reaction}`;

    dispatchVPSPush(targetRole, title, body);
    return true;
  } catch (err) {
    console.error('Error reacting in Firestore:', err);
    return false;
  }
}

// Listen to live pings in real-time
export function subscribeToPings(callback) {
  const colRef = collection(db, COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      // Don't include the daily_note document in the pings list
      if (doc.id !== NOTES_DOC) {
        list.push({ id: doc.id, ...doc.data() });
      }
    });
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    callback(list);
  }, (err) => {
    console.warn('Firestore pings snapshot notice:', err);
  });
}

// Daily Sticky Love Note listener
export function subscribeToDailyNote(callback) {
  const docRef = doc(db, COLLECTION, NOTES_DOC);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn('Firestore note snapshot notice:', err);
  });
}

// Update Daily Sticky Love Note
export async function saveDailyNote(noteData) {
  try {
    const docRef = doc(db, COLLECTION, NOTES_DOC);
    await setDoc(docRef, noteData, { merge: true });

    const targetRole = noteData.author === 'zenah' ? 'arnav' : 'zenah';
    const authorName = noteData.author === 'zenah' ? 'Zenah' : 'Arnav';
    dispatchVPSPush(
      targetRole,
      `💌 New Love Note from ${authorName}`,
      noteData.content
    );
    return true;
  } catch (err) {
    console.error('Error saving daily note:', err);
    return false;
  }
}

// Heart the Daily Note
export async function heartDailyNote(readerRole) {
  try {
    const docRef = doc(db, COLLECTION, NOTES_DOC);
    await updateDoc(docRef, {
      lovedBy: readerRole,
      lovedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('Error hearting note:', err);
    return false;
  }
}

// Image compression utility for photos (keeps Firestore docs tiny & fast < 100KB)
export function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
