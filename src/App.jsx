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
  { id: 'missing', emoji: '🥺', label: 'Missing You', msg: 'Missing you so much right now. Thinking of you ❤️' },
  { id: 'call', emoji: '📞', label: 'Call Me', msg: 'Are you free to talk? Ring me whenever you get this! 📞' },
  { id: 'hug', emoji: '🫂', label: 'Need a Hug', msg: 'Feeling a little low... really need a tight hug from you 🫂' },
  { id: 'safe', emoji: '🏡', label: 'Reached Home', msg: 'Just reached safely! All good here ✨' },
  { id: 'night', emoji: '🌙', label: 'Goodnight', msg: 'Going to sleep now, love you to the moon and back! 🌙💤' },
  { id: 'morning', emoji: '☀️', label: 'Good Morning', msg: 'Good morning my sunshine! Hope you have the best day ☀️🌸' },
];

const QUICK_REPLIES = [
  { emoji: '📞', label: 'Calling in 5m' },
  { emoji: '💖', label: 'Love you so much' },
  { emoji: '🫂', label: 'Huge hug sent' },
  { emoji: '🚗', label: 'On my way' },
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
    const currentRole = localStorage.getItem('bubulink_role') || role || 'arnav';

    if ('Notification' in window && Notification.permission === 'denied') {
      alert('⚠️ Notifications are blocked in your iPhone Settings!\n\nPlease open your iPhone Settings > Notifications > BubuLink and turn "Allow Notifications" ON.');
      return;
    }

    const res = await registerPushWithVPS(currentRole);
    if (res.success) {
      setNotifGranted(true);
      showSystemNotification('🔔 Alerts Active!', `Your phone is connected as ${currentRole === 'zenah' ? 'Zenah' : 'Arnav'}!`);
    } else {
      alert(res.reason || 'Please tap Allow when iOS prompts for notifications.');
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
      message: 'Thinking of you right now ❤️',
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
                <h2>I'm Zenah 👑</h2>
                <p>The Wife • Assam</p>
              </div>
            </button>

            <button 
              className="role-card arnav-card"
              onClick={() => handleSelectRole('arnav')}
            >
              <div className="role-avatar">💍</div>
              <div className="role-info">
                <h2>I'm Arnav 💖</h2>
                <p>The Husband • Standby</p>
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
        <button className="activate-alerts-banner animate-bounce-in" onClick={handleEnableNotifs}>
          <span className="banner-bell-icon">🔔</span>
          <div className="banner-bell-text">
            <strong>Tap to Enable Notifications ⚡</strong>
            <small>Required to get {partnerName}'s lock-screen pings</small>
          </div>
          <span className="banner-tap-arrow">Allow</span>
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
              const x = Math.round(120 * Math.cos(angleRad));
              const y = Math.round(120 * Math.sin(angleRad));
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

        {/* The Giant Tactile Heart */}
        <div
          ref={heartElemRef}
          className={`smart-heart-btn ${heartPulsing ? 'pulse-burst' : ''} ${isHolding ? 'holding-aura' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
        >
          <div className="heart-aura-layer"></div>
          <svg className="heart-svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
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
                <span>🌸 Zenah (Wife • Assam)</span>
                {role === 'zenah' && <CheckCircle2 size={18} className="check-icon" />}
              </button>

              <button 
                className={`modal-role-item ${role === 'arnav' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('arnav')}
              >
                <span>💍 Arnav (Husband)</span>
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
