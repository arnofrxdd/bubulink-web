import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Heart, 
  Bell, 
  RefreshCw, 
  X, 
  Edit3, 
  CheckCircle2, 
  ChevronUp, 
  ChevronDown,
  Share,
  PlusSquare,
  Sparkles,
  Send,
  Clock
} from 'lucide-react';
import { 
  sendPingToFirestore, 
  reactToPingInFirestore, 
  subscribeToPings, 
  subscribeToDailyNote,
  saveDailyNote,
  heartDailyNote,
  showSystemNotification,
  playChimeSound,
  registerPushWithVPS
} from './firebase';

const VIBE_OPTIONS = [
  { 
    id: 'thinking', 
    emoji: '💖', 
    label: 'Thinking of You', 
    msg: "Just wanted to remind you how deeply I love you. You're always on my mind ❤️" 
  },
  { 
    id: 'missing', 
    emoji: '🥺', 
    label: 'Missing You', 
    msg: "Missing your warmth, your voice, and holding you close to me right now." 
  },
  { 
    id: 'hug', 
    emoji: '🫂', 
    label: 'Need a Hug', 
    msg: "Sending you the warmest, tightest hug. Wish I could hold you in my arms right now." 
  },
  { 
    id: 'call', 
    emoji: '📞', 
    label: 'Call Me Soon', 
    msg: "Call me whenever you're free, I'd love to hear your voice." 
  },
  { 
    id: 'night', 
    emoji: '🌙', 
    label: 'Goodnight', 
    msg: "Goodnight my love. Rest peacefully, you're the last thing on my mind tonight 🌙❤️" 
  },
  { 
    id: 'morning', 
    emoji: '☀️', 
    label: 'Good Morning', 
    msg: "Good morning sunshine! Hope your day is as bright and lovely as you are ☀️🌸" 
  },
];

const QUICK_REPLIES = [
  { emoji: '💖', label: 'Love you forever' },
  { emoji: '📞', label: 'Calling right now' },
  { emoji: '🫂', label: 'Holding you close' },
  { emoji: '🥰', label: 'You made my day' },
];

export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem('bubulink_role'));
  const [notifGranted, setNotifGranted] = useState(false);
  const [pings, setPings] = useState([]);
  const [dailyNote, setDailyNote] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [toastAlert, setToastAlert] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [updateNotice, setUpdateNotice] = useState(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // iOS Safari Standalone Detection Gate
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissInstallGate, setDismissInstallGate] = useState(false);

  // Gesture state for Center Smart Heart
  const [isHolding, setIsHolding] = useState(false);
  const [selectedVibeIndex, setSelectedVibeIndex] = useState(0);
  const [heartPulsing, setHeartPulsing] = useState(false);

  const holdTimerRef = useRef(null);
  const isHoldingRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const dockElemRef = useRef(null);
  const lastPingIdRef = useRef(null);
  const lastReactionRef = useRef(null);

  const partnerRole = role === 'zenah' ? 'arnav' : 'zenah';
  const partnerName = role === 'zenah' ? 'Arnav' : 'Zenah';
  const myName = role === 'zenah' ? 'Zenah' : 'Arnav';

  // ================= 1. BULLETPROOF AUTO-UPDATE ENGINE =================
  const checkForUpdates = async (isManual = false) => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      const res = await fetch(`./version.json?_t=${Date.now()}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      if (res.ok) {
        const data = await res.json();
        const storedBuild = localStorage.getItem('bubulink_build_id');
        
        if (storedBuild && data.build && Number(data.build) > Number(storedBuild)) {
          setUpdateNotice('Updating to latest version... ✨');
          localStorage.setItem('bubulink_build_id', String(data.build));
          
          // Purge CacheStorage caches
          if ('caches' in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((key) => caches.delete(key)));
          }

          // Invalidate Service Worker
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
              if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              await reg.update();
            }
          }

          // Reload with fresh timestamp parameter
          setTimeout(() => {
            window.location.replace(window.location.pathname + '?_v=' + data.build);
          }, 800);
          return;
        } else if (data.build && !storedBuild) {
          localStorage.setItem('bubulink_build_id', String(data.build));
        }

        if (isManual) {
          setToastAlert({ title: '✨ App Up to Date', body: `Running latest version (${data.version || '2.0'}).` });
          setTimeout(() => setToastAlert(null), 3000);
        }
      }
    } catch (err) {
      console.warn('Update check error:', err);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    // Check immediately on app boot
    checkForUpdates();

    // Check periodically every 20 seconds
    const interval = setInterval(() => {
      checkForUpdates();
    }, 20000);

    // Check whenever app resumes from background / phone is unlocked
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // Reload if service worker updates controller
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  // iOS Standalone Detection on mount
  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standaloneMode = window.navigator.standalone === true || 
      window.matchMedia('(display-mode: standalone)').matches;

    if (isIOSDevice && !standaloneMode) {
      setIsStandalone(false);
    } else {
      setIsStandalone(true);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      setNotifGranted(true);
    }

    const handleAlert = (e) => {
      const { title, body } = e.detail;
      setToastAlert({ title, body, id: Date.now() });
      setTimeout(() => setToastAlert(null), 4000);
    };

    window.addEventListener('bubulink_alert', handleAlert);
    return () => window.removeEventListener('bubulink_alert', handleAlert);
  }, []);

  // Real-time listener for daily sticky note
  useEffect(() => {
    const unsub = subscribeToDailyNote((note) => setDailyNote(note));
    return () => unsub();
  }, []);

  // Real-time listener for Firestore pings
  useEffect(() => {
    const unsubscribe = subscribeToPings((list) => {
      if (list && list.length > 0) {
        const top = list[0];
        const currentRole = localStorage.getItem('bubulink_role');

        if (currentRole && top.sender !== currentRole) {
          if (lastPingIdRef.current && lastPingIdRef.current !== top.id) {
            showSystemNotification(
              `${top.emoji} ${top.sender === 'zenah' ? 'Zenah' : 'Arnav'}: ${top.tag}`,
              top.message
            );
          }
          lastPingIdRef.current = top.id;
        }

        if (currentRole && top.sender === currentRole && top.reaction) {
          const reactionKey = `${top.id}_${top.reaction}`;
          if (lastReactionRef.current && lastReactionRef.current !== reactionKey) {
            showSystemNotification(
              `💖 ${top.responderRole === 'arnav' ? 'Arnav' : 'Zenah'} Replied!`,
              `Reacted: ${top.reaction}`
            );
          }
          lastReactionRef.current = reactionKey;
        }
      }
      setPings(list);
    });

    return () => unsubscribe();
  }, []);

  // Auto-sync push registration when role changes
  useEffect(() => {
    const currentRole = localStorage.getItem('bubulink_role');
    if (currentRole) {
      registerPushWithVPS(currentRole).then((res) => {
        if (res.success) setNotifGranted(true);
      });
    }
  }, [role]);

  const handleSelectRole = async (selectedRole) => {
    localStorage.setItem('bubulink_role', selectedRole);
    setRole(selectedRole);
    setShowRoleModal(false);
    playChimeSound();
    const res = await registerPushWithVPS(selectedRole);
    if (res.success) setNotifGranted(true);
  };

  const handleEnableNotifs = async () => {
    playChimeSound();
    setIsSubscribing(true);
    const currentRole = localStorage.getItem('bubulink_role') || role || 'arnav';

    if ('Notification' in window && Notification.permission === 'denied') {
      setIsSubscribing(false);
      alert('⚠️ Notifications are blocked in your iPhone Settings!\n\nPlease open iPhone Settings > Notifications > BubuLink and turn "Allow Notifications" ON.');
      return;
    }

    try {
      const res = await registerPushWithVPS(currentRole);
      setIsSubscribing(false);
      if (res.success) {
        setNotifGranted(true);
        confetti({ particleCount: 40, spread: 60 });
        showSystemNotification('🔔 Alerts Active!', `Your phone is now registered as ${currentRole === 'zenah' ? 'Zenah' : 'Arnav'}!`);
      } else {
        alert(res.reason || 'Please tap Allow when iOS prompts for notifications.');
      }
    } catch (err) {
      setIsSubscribing(false);
      alert('Error: ' + err.message);
    }
  };

  // SEND 1-TAP DEFAULT HEARTBEAT (Instant Click)
  const fireHeartbeatPing = async () => {
    if (!role) return;

    if (!notifGranted) {
      registerPushWithVPS(role).then((res) => {
        if (res.success) setNotifGranted(true);
      });
    }

    setHeartPulsing(true);
    setTimeout(() => setHeartPulsing(false), 800);

    if (navigator.vibrate) {
      navigator.vibrate([40, 50, 40]);
    }
    playChimeSound();

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.55 },
      colors: ['#FF3366', '#FF758F', '#FFB3C1', '#FFFFFF', '#D4AF37'],
    });

    const ping = {
      id: Date.now().toString(),
      sender: role,
      recipient: partnerRole,
      tag: 'Heartbeat',
      emoji: '💖',
      message: 'Sent you my heartbeat ❤️ Thinking of you.',
      timestamp: new Date().toISOString(),
      reaction: null,
      responderRole: null,
      reactionTimestamp: null,
    };

    await sendPingToFirestore(ping);
    showSystemNotification('💖 Heartbeat Sent!', `Delivered to ${partnerName}'s lock screen!`);
  };

  // SEND VIBE PING (Selected via Action Ribbon)
  const fireVibePing = async (vibe) => {
    if (!role || !vibe) return;

    if (!notifGranted) {
      registerPushWithVPS(role).then((res) => {
        if (res.success) setNotifGranted(true);
      });
    }

    if (navigator.vibrate) {
      navigator.vibrate([60, 70, 60]);
    }
    playChimeSound();

    confetti({
      particleCount: 60,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#FF3366', '#D4AF37', '#FF758F', '#FFFFFF'],
    });

    const ping = {
      id: Date.now().toString(),
      sender: role,
      recipient: partnerRole,
      tag: vibe.label,
      emoji: vibe.emoji,
      message: vibe.msg,
      timestamp: new Date().toISOString(),
      reaction: null,
      responderRole: null,
      reactionTimestamp: null,
    };

    await sendPingToFirestore(ping);
    showSystemNotification(`${vibe.emoji} Sent!`, `Alert delivered to ${partnerName}!`);
  };

  // Quick Reply to partner's latest ping
  const handleReact = async (pingId, replyLabel, originalSender) => {
    await reactToPingInFirestore(pingId, replyLabel, role, originalSender);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.25 } });
    playChimeSound();
  };

  // Save Daily Note
  const handleSaveDailyNote = async () => {
    if (!newNoteText.trim()) return;
    await saveDailyNote({
      content: newNoteText.trim(),
      author: role,
      updatedAt: new Date().toISOString(),
      lovedBy: null,
    });
    setNewNoteText('');
    setShowNoteModal(false);
    playChimeSound();
    confetti({ particleCount: 35, spread: 50 });
  };

  const handleHeartNote = async () => {
    await heartDailyNote(role);
    confetti({ particleCount: 25, spread: 45 });
    playChimeSound();
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ================= APPLE-GRADE SMART GESTURE LOGIC =================
  const handleTouchStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isHoldingRef.current = false;

    // 240ms threshold for press-and-hold vs tap
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setIsHolding(true);
      setSelectedVibeIndex(0);
      if (navigator.vibrate) navigator.vibrate(35);
    }, 240);
  };

  const handleTouchMove = (e) => {
    if (!isHoldingRef.current) return;

    const touch = e.touches ? e.touches[0] : e;
    
    // Calculate drag progress horizontally across the action ribbon
    if (dockElemRef.current) {
      const rect = dockElemRef.current.getBoundingClientRect();
      const relativeX = touch.clientX - rect.left;
      const progress = Math.max(0, Math.min(1, relativeX / rect.width));
      const targetIndex = Math.min(
        VIBE_OPTIONS.length - 1,
        Math.floor(progress * VIBE_OPTIONS.length)
      );

      if (targetIndex !== selectedVibeIndex) {
        setSelectedVibeIndex(targetIndex);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    }
  };

  const handleTouchEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isHoldingRef.current) {
      // User held and released on a vibe
      if (selectedVibeIndex !== null && VIBE_OPTIONS[selectedVibeIndex]) {
        fireVibePing(VIBE_OPTIONS[selectedVibeIndex]);
      }
      setIsHolding(false);
      isHoldingRef.current = false;
    } else {
      // User quick-tapped (< 240ms)
      fireHeartbeatPing();
    }
  };

  // 1. SAFARI INSTALLATION GATE (Shown only when in iOS Safari browser)
  if (!isStandalone && !dismissInstallGate) {
    return (
      <div className="install-gate-overlay">
        <div className="install-gate-card animate-slide-in">
          <div className="app-icon-preview-glow">
            <img src="./apple-touch-icon.png" alt="BubuLink" className="app-icon-preview" />
          </div>
          <h2>Install BubuLink on iPhone 📱</h2>
          <p className="install-gate-desc">
            Apple requires adding this app to your Home Screen for lock-screen alerts to work!
          </p>

          <div className="install-steps-list">
            <div className="install-step-item">
              <span className="step-num">1</span>
              <div className="step-text">
                Tap Safari <strong>Share</strong> button <Share size={15} className="inline-icon" /> at the bottom
              </div>
            </div>
            <div className="install-step-item">
              <span className="step-num">2</span>
              <div className="step-text">
                Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={15} className="inline-icon" />
              </div>
            </div>
            <div className="install-step-item">
              <span className="step-num">3</span>
              <div className="step-text">
                Open <strong>BubuLink</strong> from your Home Screen! ✨
              </div>
            </div>
          </div>

          <div className="bouncing-arrow">⬇️</div>

          <button 
            className="skip-install-btn"
            onClick={() => setDismissInstallGate(true)}
          >
            Continue in browser anyway
          </button>
        </div>
      </div>
    );
  }

  // 2. ONBOARDING (Role select if first time)
  if (!role) {
    return (
      <div className="app-container onboarding-screen">
        <div className="onboarding-card animate-slide-in">
          <div className="app-icon-preview-glow">
            <img src="./apple-touch-icon.png" alt="BubuLink" className="app-icon-preview" />
          </div>
          <h1 className="brand-title">BubuLink</h1>
          <p className="onboarding-sub">Who is using this phone?</p>

          <div className="role-cards-grid">
            <button 
              className="role-card zenah-card"
              onClick={() => handleSelectRole('zenah')}
            >
              <div className="role-avatar">🌸</div>
              <div className="role-info">
                <h2>I'm the Wife</h2>
                <p>Zenah 👑</p>
              </div>
            </button>

            <button 
              className="role-card arnav-card"
              onClick={() => handleSelectRole('arnav')}
            >
              <div className="role-avatar">💍</div>
              <div className="role-info">
                <h2>I'm the Husband</h2>
                <p>Arnav 💖</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const latestPartnerPing = pings.find(p => p.sender === partnerRole);
  const activeVibe = VIBE_OPTIONS[selectedVibeIndex] || VIBE_OPTIONS[0];

  return (
    <div className="app-container smart-screen">
      {/* Auto-Update Live Banner */}
      {updateNotice && (
        <div className="update-floating-notice animate-bounce-in">
          <Sparkles size={14} className="sparkle-spin" />
          <span>{updateNotice}</span>
        </div>
      )}

      {/* Floating In-App Toast */}
      {toastAlert && (
        <div className="toast-floating-banner animate-bounce-in" onClick={() => setToastAlert(null)}>
          <div className="toast-icon">✨</div>
          <div className="toast-text">
            <strong>{toastAlert.title}</strong>
            <p>{toastAlert.body}</p>
          </div>
          <button className="toast-close"><X size={14} /></button>
        </div>
      )}

      {/* ULTRA-MINIMAL REFINED TOP BAR */}
      <header className="minimal-header">
        <button 
          className="user-pill-btn"
          onClick={() => setShowRoleModal(true)}
        >
          <span className="user-pill-avatar">{role === 'zenah' ? '🌸' : '💍'}</span>
          <span className="user-pill-name">{myName}</span>
          <ChevronDown size={13} className="switch-icon" />
        </button>

        {/* Sync / Update Button */}
        <button 
          className={`sync-pill-btn ${isCheckingUpdate ? 'rotating' : ''}`}
          onClick={() => checkForUpdates(true)}
          title="Check for Updates"
        >
          <RefreshCw size={13} />
        </button>

        <button 
          className={`notif-pill-btn ${notifGranted ? 'active' : ''}`}
          onClick={handleEnableNotifs}
          title="Notification Status"
        >
          <Bell size={13} />
          <span>{notifGranted ? 'Alerts ON' : 'Enable'}</span>
        </button>
      </header>

      {/* PROMINENT NOTIFICATION BANNER IF NOT YET GRANTED */}
      {!notifGranted && (
        <button 
          className="activate-alerts-banner animate-bounce-in" 
          onClick={handleEnableNotifs}
          disabled={isSubscribing}
        >
          <span className="banner-bell-icon">🔔</span>
          <div className="banner-bell-text">
            <strong>{isSubscribing ? 'Connecting...' : 'Tap to Enable Notifications ⚡'}</strong>
            <small>Required to get {partnerName}'s lock-screen pings</small>
          </div>
          <span className="banner-tap-arrow">{isSubscribing ? '⏳' : 'Allow'}</span>
        </button>
      )}

      {/* PARTNER'S LATEST INCOMING PING (Refined Floating Card with 2x2 Grid) */}
      {latestPartnerPing && (
        <div className="incoming-ping-pill animate-slide-in">
          <div className="incoming-ping-top">
            <span className="incoming-emoji">{latestPartnerPing.emoji}</span>
            <div className="incoming-text">
              <strong>{partnerName}: {latestPartnerPing.tag}</strong>
              <small>{formatTime(latestPartnerPing.timestamp)}</small>
            </div>
            {latestPartnerPing.reaction && (
              <span className="incoming-reacted-badge">
                Replied: {latestPartnerPing.reaction}
              </span>
            )}
          </div>

          {/* Quick 2x2 Clean Reply Grid (Zero horizontal clipping!) */}
          <div className="quick-replies-grid">
            {QUICK_REPLIES.map((r) => {
              const isSelected = latestPartnerPing.reaction === r.label;
              return (
                <button
                  key={r.label}
                  className={`reply-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleReact(latestPartnerPing.id, r.label, latestPartnerPing.sender)}
                >
                  <span className="chip-emoji">{r.emoji}</span>
                  <span className="chip-label">{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= CENTER STAGE: SCULPTED 3D HEART & ACTION DOCK ================= */}
      <div className="center-stage">
        
        {/* Apple Smart Action Ribbon (Blooms UPWARD above the heart into open space!) */}
        {isHolding && (
          <div className="action-dock-container animate-spring-up">
            {/* Live Message Preview Card */}
            <div className="vibe-preview-card">
              <span className="preview-emoji">{activeVibe.emoji}</span>
              <div className="preview-text-block">
                <strong>{activeVibe.label}</strong>
                <p>“{activeVibe.msg}”</p>
              </div>
            </div>

            {/* Glowing Frosted Glass Action Ribbon */}
            <div ref={dockElemRef} className="action-dock-bar">
              {VIBE_OPTIONS.map((v, i) => {
                const isTargeted = selectedVibeIndex === i;
                return (
                  <div
                    key={v.id}
                    className={`dock-vibe-item ${isTargeted ? 'targeted' : ''}`}
                  >
                    <span className="dock-emoji">{v.emoji}</span>
                  </div>
                );
              })}
            </div>
            <div className="dock-drag-hint">Slide finger across • Release to send</div>
          </div>
        )}

        {/* The Sculpted 3D Glowing Living Heart */}
        <div
          className={`pure-heart-btn ${heartPulsing ? 'pulse-burst' : ''} ${isHolding ? 'holding-glow' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
        >
          {/* Ambient layered atmospheric glows */}
          <div className="heart-ambient-light"></div>
          <div className="heart-core-bloom"></div>

          <svg 
            className="pure-heart-svg" 
            viewBox="0 0 200 185" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="heartDeepBody" cx="35%" cy="32%" r="72%">
                <stop offset="0%" stopColor="#FFA1B5" />
                <stop offset="18%" stopColor="#FF3366" />
                <stop offset="55%" stopColor="#D90449" />
                <stop offset="90%" stopColor="#80062C" />
                <stop offset="100%" stopColor="#4A0218" />
              </radialGradient>

              <linearGradient id="heartSpecularSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.25" />
                <stop offset="85%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="heartSubtleRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFC2D1" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FF3366" stopOpacity="0.1" />
              </linearGradient>

              <filter id="heartShadowFilter" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="20" stdDeviation="28" floodColor="#FF3366" floodOpacity="0.65" />
                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#FF758F" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Glowing Deep Aura Silhouette */}
            <path
              d="M100 168 C100 168 16 112 16 58 C16 26 38 8 70 8 C88 8 96 18 100 24 C104 18 112 8 130 8 C162 8 184 26 184 58 C184 112 100 168 100 168 Z"
              fill="url(#heartDeepBody)"
              filter="url(#heartShadowFilter)"
            />

            {/* Sculpted 3D Vector Heart Body */}
            <path
              d="M100 164 C100 164 20 110 20 58 C20 28 42 10 70 10 C86 10 95 19 100 25 C105 19 114 10 130 10 C158 10 180 28 180 58 C180 110 100 164 100 164 Z"
              fill="url(#heartDeepBody)"
            />

            {/* Silky Left Lobe Curvature Highlight */}
            <path
              d="M70 13 C46 13 26 29 26 54 C26 80 52 114 82 136 C62 112 38 82 38 56 C38 34 52 21 70 21 C82 21 90 27 95 33 C93 25 84 13 70 13 Z"
              fill="url(#heartSpecularSheen)"
            />

            {/* Specular Crest Reflection */}
            <ellipse 
              cx="66" 
              cy="28" 
              rx="22" 
              ry="9" 
              transform="rotate(-22 66 28)"
              fill="url(#heartSubtleRim)" 
            />
          </svg>
        </div>

        {/* Subtle Gesture Guidance (Visible only when not holding) */}
        {!isHolding && (
          <div className="gesture-hint-text">
            <span>Tap for heartbeat</span>
            <span className="dot-divider">•</span>
            <span>Hold for vibes</span>
          </div>
        )}
      </div>

      {/* ================= BOTTOM DRAWER TRIGGER ================= */}
      <footer className="bottom-drawer-trigger">
        <button 
          className="drawer-pill-btn"
          onClick={() => setShowDrawer(true)}
        >
          <ChevronUp size={15} />
          <span>Love Note & Moments 💌</span>
        </button>
      </footer>

      {/* ================= SLIDE-UP DRAWER (Note & Moments Feed) ================= */}
      {showDrawer && (
        <div className="drawer-overlay" onClick={() => setShowDrawer(false)}>
          <div className="drawer-sheet animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar">
              <span className="drawer-notch"></span>
            </div>

            <div className="drawer-header">
              <h3>Love Space & Memories 💌</h3>
              <button className="drawer-close-btn" onClick={() => setShowDrawer(false)}>
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Daily Love Note Card */}
            <div className="drawer-note-card">
              <div className="drawer-note-top">
                <span className="note-badge">TODAY'S NOTE</span>
                <button 
                  className="note-edit-icon-btn"
                  onClick={() => {
                    setNewNoteText(dailyNote?.content || '');
                    setShowNoteModal(true);
                  }}
                >
                  <Edit3 size={13} />
                  <span>{dailyNote ? 'Edit' : 'Write'}</span>
                </button>
              </div>

              <p className="drawer-note-text">
                {dailyNote?.content || 'Leave a sweet note for your partner to read! 💕'}
              </p>

              <div className="drawer-note-footer">
                <span className="note-author-tag">
                  {dailyNote?.author ? `From ${dailyNote.author === 'zenah' ? 'Zenah' : 'Arnav'}` : ''}
                </span>

                {dailyNote && (
                  <button 
                    className={`note-heart-pill ${dailyNote.lovedBy?.includes(role) ? 'loved' : ''}`}
                    onClick={handleHeartNote}
                  >
                    <Heart size={13} fill={dailyNote.lovedBy?.includes(role) ? '#FF3366' : 'none'} />
                    <span>{dailyNote.lovedBy?.length || 0}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Moments History Feed */}
            <div className="drawer-history-section">
              <div className="history-section-title">
                <Clock size={13} />
                <span>Today's Moments</span>
              </div>

              <div className="history-list">
                {pings.length === 0 ? (
                  <div className="history-empty">No moments yet today. Tap the heart to send one! 💕</div>
                ) : (
                  pings.slice(0, 15).map((p) => {
                    const isMe = p.sender === role;
                    return (
                      <div key={p.id} className={`history-item ${isMe ? 'outgoing' : 'incoming'}`}>
                        <span className="history-emoji">{p.emoji}</span>
                        <div className="history-info">
                          <strong>{isMe ? 'You' : partnerName}: {p.tag}</strong>
                          <p>{p.message}</p>
                          <small>{formatTime(p.timestamp)}</small>
                          {p.reaction && (
                            <span className="history-reply-tag">
                              💬 Replied: {p.reaction}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* App Update & Build Info Footer */}
            <div className="drawer-footer-actions">
              <button 
                className="force-update-btn"
                onClick={() => checkForUpdates(true)}
              >
                <RefreshCw size={13} className={isCheckingUpdate ? 'rotating' : ''} />
                <span>Check for Updates (v2.0)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ROLE SWITCH MODAL ================= */}
      {showRoleModal && (
        <div className="modal-backdrop" onClick={() => setShowRoleModal(false)}>
          <div className="modal-content animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Switch Profile</h3>
              <button className="modal-close-btn" onClick={() => setShowRoleModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="role-options-list">
              <button 
                className={`role-select-item ${role === 'zenah' ? 'active' : ''}`}
                onClick={() => handleSelectRole('zenah')}
              >
                <span className="role-avatar-sm">🌸</span>
                <div className="role-meta">
                  <strong>I'm the Wife</strong>
                  <small>Zenah 👑</small>
                </div>
                {role === 'zenah' && <CheckCircle2 size={16} className="role-check" />}
              </button>

              <button 
                className={`role-select-item ${role === 'arnav' ? 'active' : ''}`}
                onClick={() => handleSelectRole('arnav')}
              >
                <span className="role-avatar-sm">💍</span>
                <div className="role-meta">
                  <strong>I'm the Husband</strong>
                  <small>Arnav 💖</small>
                </div>
                {role === 'arnav' && <CheckCircle2 size={16} className="role-check" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT DAILY NOTE MODAL ================= */}
      {showNoteModal && (
        <div className="modal-backdrop" onClick={() => setShowNoteModal(false)}>
          <div className="modal-content animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Write Love Note 💌</h3>
              <button className="modal-close-btn" onClick={() => setShowNoteModal(false)}>
                <X size={18} />
              </button>
            </div>

            <textarea 
              className="note-textarea"
              placeholder="Write a sweet romantic note for your love..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              rows={4}
              maxLength={280}
            />

            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowNoteModal(false)}
              >
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={handleSaveDailyNote}
                disabled={!newNoteText.trim()}
              >
                <Send size={14} />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
