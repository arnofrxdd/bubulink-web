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
  Sparkles
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

const RADIAL_VIBES = [
  { id: 'thinking', emoji: '💖', label: 'Thinking of You', msg: "Just wanted to remind you how deeply I love you. You're on my mind ❤️" },
  { id: 'missing', emoji: '🥺', label: 'Missing You', msg: 'Missing your presence, your voice, and holding you close to me right now.' },
  { id: 'hug', emoji: '🫂', label: 'Need a Hug', msg: 'Sending you the warmest, tightest hug. Wish I could hold you in my arms right now.' },
  { id: 'call', emoji: '📞', label: 'Call Me Soon', msg: "Call me whenever you're free, I'd love to hear your voice." },
  { id: 'night', emoji: '🌙', label: 'Goodnight', msg: "Goodnight my love. Rest peacefully, you're the last thing on my mind tonight 🌙❤️" },
  { id: 'morning', emoji: '☀️', label: 'Good Morning', msg: 'Good morning sunshine! Hope your day is as bright and lovely as you are ☀️🌸' },
];

const QUICK_REPLIES = [
  { emoji: '💖', label: 'Love you forever' },
  { emoji: '📞', label: 'Calling you right now' },
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

  // iOS Safari Standalone Detection Gate
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissInstallGate, setDismissInstallGate] = useState(false);

  // Gesture state for Center Smart Heart
  const [isHolding, setIsHolding] = useState(false);
  const [selectedVibeIndex, setSelectedVibeIndex] = useState(null);
  const [heartPulsing, setHeartPulsing] = useState(false);

  const holdTimerRef = useRef(null);
  const heartCenterRef = useRef({ x: 0, y: 0 });
  const heartElemRef = useRef(null);
  const lastPingIdRef = useRef(null);
  const lastReactionRef = useRef(null);

  const partnerRole = role === 'zenah' ? 'arnav' : 'zenah';
  const partnerName = role === 'zenah' ? 'Arnav' : 'Zenah';
  const myName = role === 'zenah' ? 'Zenah' : 'Arnav';

  // Check iOS standalone mode on mount
  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standaloneMode = window.navigator.standalone === true || 
      window.matchMedia('(display-mode: standalone)').matches;

    // Only force install screen if on iOS and NOT standalone
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

  // Listen to daily sticky note in real-time
  useEffect(() => {
    const unsub = subscribeToDailyNote((note) => setDailyNote(note));
    return () => unsub();
  }, []);

  // Listen to Firestore pings in real-time
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

  // Auto-sync push registration on role change
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
      alert('⚠️ Notifications are blocked in your iPhone Settings!\n\nPlease open your iPhone Settings > Notifications > BubuLink and turn "Allow Notifications" ON.');
      return;
    }

    try {
      const res = await registerPushWithVPS(currentRole);
      setIsSubscribing(false);
      if (res.success) {
        setNotifGranted(true);
        confetti({ particleCount: 35, spread: 60 });
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

    // Auto-attempt push registration on this direct user gesture if not granted yet
    if (!notifGranted) {
      registerPushWithVPS(role).then((res) => {
        if (res.success) setNotifGranted(true);
      });
    }

    setHeartPulsing(true);
    setTimeout(() => setHeartPulsing(false), 800);

    if (navigator.vibrate) {
      navigator.vibrate([50, 60, 50]);
    }
    playChimeSound();

    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.5 },
      colors: ['#E55675', '#FF758F', '#FFB3C1', '#FFFFFF'],
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

  // SEND RADIAL VIBE PING (Drag & Release)
  const fireRadialPing = async (vibe) => {
    if (!role || !vibe) return;

    if (navigator.vibrate) {
      navigator.vibrate([70, 80, 70]);
    }
    playChimeSound();

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.5 },
      colors: ['#E55675', '#D4AF37', '#FF758F', '#FFFFFF'],
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

  // ================= GESTURE HANDLERS FOR CENTER SMART HEART =================
  const handleTouchStart = (e) => {
    // Record center point of the heart on screen
    if (heartElemRef.current) {
      const rect = heartElemRef.current.getBoundingClientRect();
      heartCenterRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    // Set hold timer (260ms threshold for Hold vs Tap)
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(true);
      if (navigator.vibrate) navigator.vibrate(40);
    }, 260);
  };

  const handleTouchMove = (e) => {
    if (!isHolding) return;

    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - heartCenterRef.current.x;
    const dy = touch.clientY - heartCenterRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If dragged outside the center deadzone (> 40px)
    if (dist > 40) {
      let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 to 180
      // Normalize angle relative to top (-90deg is 0)
      let normAngle = (angleDeg + 90 + 360) % 360;

      // 6 vibes = 60 degrees each
      let index = Math.round(normAngle / 60) % 6;
      if (index !== selectedVibeIndex) {
        setSelectedVibeIndex(index);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    } else {
      setSelectedVibeIndex(null);
    }
  };

  const handleTouchEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isHolding) {
      // User held and released
      if (selectedVibeIndex !== null && RADIAL_VIBES[selectedVibeIndex]) {
        fireRadialPing(RADIAL_VIBES[selectedVibeIndex]);
      }
      setIsHolding(false);
      setSelectedVibeIndex(null);
    } else {
      // User quick tapped
      fireHeartbeatPing();
    }
  };

  // 1. SAFARI INSTALLATION GATE (Shown only in normal iOS Safari browser)
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
        <div className="onboarding-card">
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

  return (
    <div className="app-container smart-screen">
      {/* Floating In-App Toast */}
      {toastAlert && (
        <div className="toast-floating-banner animate-bounce-in" onClick={() => setToastAlert(null)}>
          <div className="toast-icon">⚡</div>
          <div className="toast-text">
            <strong>{toastAlert.title}</strong>
            <p>{toastAlert.body}</p>
          </div>
          <button className="toast-close"><X size={14} /></button>
        </div>
      )}

      {/* ULTRA-MINIMAL TOP BAR */}
      <header className="minimal-header">
        <button 
          className="user-pill-btn"
          onClick={() => setShowRoleModal(true)}
        >
          <span className="user-pill-avatar">{role === 'zenah' ? '🌸' : '💍'}</span>
          <span className="user-pill-name">{myName}</span>
          <RefreshCw size={12} className="switch-icon" />
        </button>

        <button 
          className={`notif-pill-btn ${notifGranted ? 'active' : ''}`}
          onClick={handleEnableNotifs}
          title="Notification Status"
        >
          <Bell size={14} />
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

      {/* PARTNER'S LATEST INCOMING PING (Floating Pill) */}
      {latestPartnerPing && (
        <div className="incoming-ping-pill animate-slide-in">
          <div className="incoming-ping-top">
            <span className="incoming-emoji">{latestPartnerPing.emoji}</span>
            <div className="incoming-text">
              <strong>{partnerName}: {latestPartnerPing.tag}</strong>
              <small>{formatTime(latestPartnerPing.timestamp)}</small>
            </div>
          </div>

          {/* Quick 1-Tap Reactions Bar */}
          <div className="quick-replies-row">
            {QUICK_REPLIES.map((r) => {
              const isSelected = latestPartnerPing.reaction === r.label;
              return (
                <button
                  key={r.label}
                  className={`reply-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleReact(latestPartnerPing.id, r.label, latestPartnerPing.sender)}
                >
                  <span>{r.emoji}</span>
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= CENTER STAGE: THE SMART HEART ================= */}
      <div className="center-stage">
        
        {/* Expanding Radial Halo of Vibes on Hold */}
        {isHolding && (
          <div className="radial-halo-container">
            {RADIAL_VIBES.map((v, i) => {
              // Calculate circular coordinates: radius = 120px
              const angleDeg = i * 60 - 90;
              const angleRad = (angleDeg * Math.PI) / 180;
              const x = Math.round(130 * Math.cos(angleRad));
              const y = Math.round(130 * Math.sin(angleRad));
              const isTargeted = selectedVibeIndex === i;

              return (
                <div
                  key={v.id}
                  className={`radial-vibe-bubble ${isTargeted ? 'targeted' : ''}`}
                  style={{
                    transform: `translate(${x}px, ${y}px) scale(${isTargeted ? 1.3 : 1})`,
                  }}
                >
                  <span className="radial-emoji">{v.emoji}</span>
                  <span className="radial-label">{v.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* The Sculptured Glowing Heart (Pure luxury 3D heart, not a circular ball) */}
        <div
          ref={heartElemRef}
          className={`pure-heart-btn ${heartPulsing ? 'pulse-burst' : ''} ${isHolding ? 'holding-glow' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
        >
          <div className="heart-ambient-light"></div>
          <svg 
            className="pure-heart-svg" 
            viewBox="0 0 220 200" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF758F" />
                <stop offset="35%" stopColor="#FF3366" />
                <stop offset="75%" stopColor="#D90429" />
                <stop offset="100%" stopColor="#9B001F" />
              </linearGradient>

              <linearGradient id="heartSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
                <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="innerShine" x1="30%" y1="0%" x2="70%" y2="100%">
                <stop offset="0%" stopColor="#FFAEC0" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#FF3366" stopOpacity="0" />
              </linearGradient>

              <filter id="heartShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="16" stdDeviation="22" floodColor="#FF3366" floodOpacity="0.55" />
                <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#FF3366" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Glowing Drop Shadow layer */}
            <path
              d="M110 185 C110 185 15 125 15 62 C15 28 42 8 78 8 C98 8 106 18 110 24 C114 18 122 8 142 8 C178 8 205 28 205 62 C205 125 110 185 110 185 Z"
              fill="url(#heartGradient)"
              filter="url(#heartShadow)"
            />

            {/* Sculptured Rich Heart Body */}
            <path
              d="M110 180 C110 180 20 122 20 62 C20 31 45 12 78 12 C95 12 105 21 110 26 C115 21 125 12 142 12 C175 12 200 31 200 62 C200 122 110 180 110 180 Z"
              fill="url(#heartGradient)"
            />

            {/* Top Left Curve Satin Highlight */}
            <path
              d="M78 14 C48 14 26 32 26 60 C26 90 54 126 88 150 C66 124 40 92 40 62 C40 38 56 22 78 22 C91 22 100 28 105 34 C103 26 93 14 78 14 Z"
              fill="url(#heartSheen)"
            />

            {/* Upper Lobe Crest Glow */}
            <ellipse 
              cx="72" 
              cy="30" 
              rx="26" 
              ry="11" 
              transform="rotate(-20 72 30)"
              fill="url(#innerShine)" 
            />
          </svg>
        </div>

        {/* Minimal Smart Gesture Hint */}
        <div className="gesture-hint-text">
          {isHolding 
            ? (selectedVibeIndex !== null ? `Release to send ${RADIAL_VIBES[selectedVibeIndex].label}!` : 'Slide thumb to select vibe')
            : 'Tap for heartbeat • Hold to slide vibe'
          }
        </div>
      </div>

      {/* ================= BOTTOM DRAWER TRIGGER ================= */}
      <footer className="bottom-drawer-trigger">
        <button 
          className="drawer-pill-btn"
          onClick={() => setShowDrawer(true)}
        >
          <ChevronUp size={16} />
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

            {/* Daily Love Note Widget */}
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
                  <div>
                    {dailyNote.lovedBy ? (
                      <span className="loved-tag">Loved by {dailyNote.lovedBy === 'zenah' ? 'Zenah' : 'Arnav'} ❤️</span>
                    ) : (
                      <button className="heart-action-btn" onClick={handleHeartNote}>
                        <Heart size={13} />
                        <span>Love this</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Moments Feed */}
            <div className="drawer-timeline-section">
              <h4>Recent Moments</h4>
              {pings.length === 0 ? (
                <div className="drawer-empty-state">No moments yet. Tap the heart to send one! 💖</div>
              ) : (
                <div className="drawer-pings-list">
                  {pings.map((p) => (
                    <div key={p.id} className="drawer-ping-item">
                      <div className="ping-item-left">
                        <span className="item-emoji">{p.emoji}</span>
                        <div>
                          <strong>{p.sender === 'zenah' ? 'Zenah' : 'Arnav'}</strong>
                          <p>{p.message}</p>
                        </div>
                      </div>
                      <span className="item-time">{formatTime(p.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Write Daily Love Note Modal */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💌 Write Today's Love Note</h3>
              <button className="modal-close-x" onClick={() => setShowNoteModal(false)}>
                <X size={16} />
              </button>
            </div>
            <textarea
              className="note-textarea"
              rows={4}
              placeholder="Good morning my lovely wife, kick ass today! Love you always..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
            />
            <button className="modal-save-btn" onClick={handleSaveDailyNote}>
              Save Note 💖
            </button>
          </div>
        </div>
      )}

      {/* Switch Role Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Switch Profile 📱</h3>
              <button className="modal-close-x" onClick={() => setShowRoleModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-roles-list">
              <button 
                className={`modal-role-item ${role === 'zenah' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('zenah')}
              >
                <span>🌸 Zenah (The Wife)</span>
                {role === 'zenah' && <CheckCircle2 size={18} className="check-icon" />}
              </button>

              <button 
                className={`modal-role-item ${role === 'arnav' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('arnav')}
              >
                <span>💍 Arnav (The Husband)</span>
                {role === 'arnav' && <CheckCircle2 size={18} className="check-icon" />}
              </button>

              <button 
                className="modal-role-item reset"
                onClick={() => {
                  localStorage.removeItem('bubulink_role');
                  setRole(null);
                  setShowRoleModal(false);
                }}
              >
                🔄 Reset to Welcome Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
