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

// Your VPS Push Endpoint & Public VAPID Key
const VPS_API_BASE = 'https://bubu.arnavcloud.co.in';
const PUBLIC_VAPID_KEY = 'BIGU4TdmKPx9RsHIzMBE6TnX0DE-749m07zGeIXT_ZROr89gTAyjT8BovtUjRWsRmAv8wZiDER4tcBN0-7FcJQ0';

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

// Request Notification Permission and register with VPS Web Push
export async function registerPushWithVPS(role) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push messaging is not supported on this browser/environment');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    // Send subscription to VPS backend
    await fetch(`${VPS_API_BASE}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        subscription,
      }),
    });

    console.log(`✅ Push subscription registered with VPS for role: ${role}`);
    return true;
  } catch (err) {
    console.warn('Push registration note:', err);
    return false;
  }
}

// Dispatch Apple Web Push via VPS to partner
export async function dispatchVPSPush(targetRole, title, body) {
  try {
    await fetch(`${VPS_API_BASE}/api/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole,
        title,
        body,
      }),
    });
    console.log(`⚡ Dispatched push to ${targetRole} via VPS`);
  } catch (err) {
    console.warn('VPS push dispatch note:', err);
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

// Send a new cute ping to Firestore & VPS Push
export async function sendPingToFirestore(ping) {
  try {
    const docRef = doc(db, COLLECTION, ping.id);
    await setDoc(docRef, ping);

    // Also trigger VPS Apple Web Push to Arnav!
    dispatchVPSPush(
      'arnav',
      `🌸 Zenah Spotted Something Cute! (${ping.emoji})`,
      ping.message
    );
    return true;
  } catch (err) {
    console.error('Error sending ping to Firestore:', err);
    return false;
  }
}

// React to a ping & trigger VPS Push to Zenah
export async function reactToPingInFirestore(pingId, reaction) {
  try {
    const docRef = doc(db, COLLECTION, pingId);
    await updateDoc(docRef, {
      reaction,
      reactionTimestamp: new Date().toISOString(),
    });

    // Also trigger VPS Apple Web Push to Zenah!
    dispatchVPSPush(
      'zenah',
      '💖 Arnav Replied to Your Ping!',
      `Your husband reacted: ${reaction}`
    );
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
      list.push({ id: doc.id, ...doc.data() });
    });
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    callback(list);
  }, (err) => {
    console.warn('Firestore snapshot notice:', err);
  });
}
