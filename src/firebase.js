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

// Web Audio API Chime Generator (Guaranteed sound on all browsers)
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
  } catch (e) {
    console.log('Audio chime note:', e);
  }
}

// Request Notification Permission
export async function requestNotificationPermission() {
  if ('Notification' in window) {
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch (e) {
      return false;
    }
  }
  return false;
}

// Show guaranteed notification (System Push + In-App Toast Banner + Audio Chime + Haptics)
export function showSystemNotification(title, body) {
  // 1. Play Sound & Haptics immediately
  playChimeSound();
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

  // 2. Dispatch custom in-app floating banner event
  window.dispatchEvent(
    new CustomEvent('bubulink_alert', {
      detail: { title, body }
    })
  );

  // 3. Trigger OS / Lock-screen notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: './icon-192.png',
            badge: './icon-192.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
          });
        }).catch(() => {
          try {
            new Notification(title, { body, icon: './icon-192.png' });
          } catch (_) {}
        });
      } else {
        new Notification(title, { body, icon: './icon-192.png' });
      }
    } catch (e) {
      console.log('Native notification fallback:', e);
    }
  }
}

// Send a new cute ping to Firestore
export async function sendPingToFirestore(ping) {
  try {
    const docRef = doc(db, COLLECTION, ping.id);
    await setDoc(docRef, ping);
    return true;
  } catch (err) {
    console.error('Error sending ping to Firestore:', err);
    return false;
  }
}

// React to a ping
export async function reactToPingInFirestore(pingId, reaction) {
  try {
    const docRef = doc(db, COLLECTION, pingId);
    await updateDoc(docRef, {
      reaction,
      reactionTimestamp: new Date().toISOString(),
    });
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
    // Sort in memory by timestamp descending
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    callback(list);
  }, (err) => {
    console.warn('Firestore snapshot notice:', err);
  });
}
