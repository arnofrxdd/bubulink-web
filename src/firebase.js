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

// Request Notification Permission on Browser / iOS Safari
export async function requestNotificationPermission() {
  if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

// Show a system notification (works in iOS Safari when installed to home screen & Android/PC)
export function showSystemNotification(title, body, icon = '🦢') {
  if ('Notification' in window && Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: '/bubulink-web/icon-192.png',
          badge: '/bubulink-web/icon-192.png',
          vibrate: [200, 100, 200],
        });
      });
    } else {
      new Notification(title, {
        body,
        icon: '/bubulink-web/icon-192.png',
      });
    }
  }

  // Also trigger haptic vibration if supported
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
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
