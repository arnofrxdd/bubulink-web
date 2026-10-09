import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
  Heart, 
  Send, 
  Bell, 
  CheckCircle2, 
  RefreshCw, 
  Smartphone,
  Flame,
  Volume2,
  X
} from 'lucide-react';
import { 
  sendPingToFirestore, 
  reactToPingInFirestore, 
  subscribeToPings, 
  requestNotificationPermission, 
  showSystemNotification,
  playChimeSound
} from './firebase';

const QUICK_TAGS = [
  { emoji: '🦢', label: 'Lucky Swan 🦢' },
  { emoji: '🐶', label: 'Cute Puppy / Animal 🐾' },
  { emoji: '🍗', label: 'Craving Mutton / Duck 🦆' },
  { emoji: '🍫', label: 'Period Chocolate Alert 🍫' },
  { emoji: '🥰', label: 'Missing My Husband 💍' },
  { emoji: '😂', label: 'Unfiltered Goofy Moment 🤪' },
];

const QUICK_REACTIONS = [
  { emoji: '💖', label: 'Love you wife!' },
  { emoji: '🍫', label: 'Chocolates sent!' },
  { emoji: '📞', label: 'Calling my girl!' },
  { emoji: '🧸', label: 'Huge hug sent!' },
  { emoji: '🦆', label: 'Mutton & Duck ready!' },
];

export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem('bubulink_role'));
  const [notifGranted, setNotifGranted] = useState(false);
  const [pings, setPings] = useState([]);
  const [selectedTag, setSelectedTag] = useState(QUICK_TAGS[0].label);
  const [customNote, setCustomNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [activeModalPing, setActiveModalPing] = useState(null);
  const [toastAlert, setToastAlert] = useState(null);
  
  const lastPingIdRef = useRef(null);
  const lastReactionRef = useRef(null);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotifGranted(true);
    }

    // Listen to custom in-app floating banner alerts
    const handleAlert = (e) => {
      const { title, body } = e.detail;
      setToastAlert({ title, body, id: Date.now() });
      setTimeout(() => {
        setToastAlert(null);
      }, 5000);
    };

    window.addEventListener('bubulink_alert', handleAlert);
    return () => window.removeEventListener('bubulink_alert', handleAlert);
  }, []);

  // Subscribe to real-time Firestore pings
  useEffect(() => {
    const unsubscribe = subscribeToPings((list) => {
      if (list && list.length > 0) {
        const top = list[0];
        const currentRole = localStorage.getItem('bubulink_role');

        // 🔔 If I am Arnav and Zenah sent a new ping -> Notify me!
        if (currentRole === 'arnav' && top.sender === 'zenah') {
          if (lastPingIdRef.current && lastPingIdRef.current !== top.id) {
            showSystemNotification(
              `🌸 Zenah Spotted Something Cute! (${top.emoji})`,
              top.message
            );
          }
          lastPingIdRef.current = top.id;
        }

        // 🔔 If I am Zenah and Arnav replied -> Notify me!
        if (currentRole === 'zenah' && top.reaction) {
          const reactionKey = `${top.id}_${top.reaction}`;
          if (lastReactionRef.current && lastReactionRef.current !== reactionKey) {
            showSystemNotification(
              '💖 Arnav Replied with Love!',
              `Your husband reacted: ${top.reaction}`
            );
          }
          lastReactionRef.current = reactionKey;
        }
      }
      setPings(list);
    });

    return () => unsubscribe();
  }, []);

  const handleSelectRole = async (selectedRole) => {
    localStorage.setItem('bubulink_role', selectedRole);
    setRole(selectedRole);
    setShowRoleModal(false);
    playChimeSound();
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
  };

  const handleEnableNotifs = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
    playChimeSound();
    showSystemNotification('🔔 Alerts Active!', 'You will now receive sound & popup alerts on every ping.');
  };

  // Zenah sends cute ping
  const handleSendPing = async () => {
    setIsSending(true);
    const tagObj = QUICK_TAGS.find(t => t.label === selectedTag) || QUICK_TAGS[0];
    const message = customNote.trim().length > 0 
      ? customNote.trim() 
      : 'Spotted something cute and instantly had to ping my husband!';

    const newPing = {
      id: Date.now().toString(),
      sender: 'zenah',
      tag: selectedTag,
      emoji: tagObj.emoji,
      message,
      timestamp: new Date().toISOString(),
      reaction: null,
      reactionTimestamp: null,
    };

    // Trigger celebration confetti on her screen
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#DE7C8C', '#FF9EB1', '#C9974B', '#FFFFFF'],
    });

    await sendPingToFirestore(newPing);
    setCustomNote('');
    setIsSending(false);
    setActiveModalPing(newPing);
  };

  // Arnav sends reaction
  const handleReact = async (pingId, reactionEmoji) => {
    await reactToPingInFirestore(pingId, reactionEmoji);
    confetti({
      particleCount: 30,
      spread: 40,
      origin: { y: 0.7 },
      colors: ['#DE7C8C', '#C9974B', '#FFD700'],
    });
  };

  // Test simulation button
  const handleSimulatePing = async () => {
    const sample = [
      { tag: 'Cute Puppy / Animal 🐾', emoji: '🐶', message: 'Saw the tiniest golden puppy in a shop window and had to tell my husband right now!!' },
      { tag: 'Period Chocolate Alert 🍫', emoji: '🍫', message: 'Needs 100% undivided attention, chocolates, and babying 24/7 right now!' },
      { tag: 'Lucky Swan 🦢', emoji: '🦢', message: 'Swan is my life! Thinking of you Bubu 💕' }
    ][Math.floor(Math.random() * 3)];

    const simPing = {
      id: Date.now().toString(),
      sender: 'zenah',
      tag: sample.tag,
      emoji: sample.emoji,
      message: sample.message,
      timestamp: new Date().toISOString(),
      reaction: null,
    };

    await sendPingToFirestore(simPing);
    showSystemNotification(`🌸 Zenah Spotted Something Cute! (${sample.emoji})`, sample.message);
  };

  // Format timestamp helper
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 1. ONBOARDING SCREEN IF NO ROLE SELECTED
  if (!role) {
    return (
      <div className="app-container onboarding-screen">
        <div className="onboarding-card">
          <div className="swan-floating-badge animate-float">🦢</div>
          <h1 className="brand-title">BubuLink</h1>
          <div className="badge-pill gold-pill">
            <Sparkles size={13} />
            <span>Private 2-Person Couple Portal</span>
          </div>
          <p className="onboarding-sub">Who is holding this phone right now?</p>

          <div className="role-cards-grid">
            <button 
              className="role-card zenah-card"
              onClick={() => handleSelectRole('zenah')}
            >
              <div className="role-avatar">🌸</div>
              <div className="role-info">
                <span className="role-tag pink">Spontaneous 0.2s Caller</span>
                <h2>I'm Zenah 👑</h2>
                <p>The Princess, Bubu & Wife • 🦢 Swan is my life</p>
              </div>
            </button>

            <button 
              className="role-card arnav-card"
              onClick={() => handleSelectRole('arnav')}
            >
              <div className="role-avatar">💖</div>
              <div className="role-info">
                <span className="role-tag gold">Always on Standby</span>
                <h2>I'm Arnav 💍</h2>
                <p>The Husband & Bubu • 24/7 Zenah Pamper Station</p>
              </div>
            </button>
          </div>

          <div className="pwa-hint">
            <Smartphone size={14} />
            <span>Install on iPhone: Tap Safari <strong>Share ⬆️</strong> &gt; <strong>Add to Home Screen</strong></span>
          </div>
        </div>
      </div>
    );
  }

  const latestPing = pings.length > 0 ? pings[0] : null;

  return (
    <div className="app-container">
      {/* Floating Drop-down Toast Notification */}
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

      {/* Top Header Bar */}
      <header className="app-header">
        <div className="user-profile-row">
          <div className={`user-badge-avatar ${role === 'zenah' ? 'pink' : 'gold'}`}>
            {role === 'zenah' ? '👑' : '💍'}
          </div>
          <div className="user-details">
            <h2 className="user-name">
              {role === 'zenah' ? "Zenah's Sanctuary 🦢" : "Arnav's Radar 💖"}
            </h2>
            <span className="user-status-text">
              {role === 'zenah' ? 'Wife to Arnav • Realtime Cloud Active ⚡' : 'Husband to Zenah • Standby Station ⚡'}
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button className="notif-btn" onClick={handleEnableNotifs} title="Enable Alerts">
            <Bell size={15} />
            <span>{notifGranted ? 'Sound ON' : 'Enable Alerts'}</span>
          </button>
          <button 
            className="switch-role-btn" 
            onClick={() => setShowRoleModal(true)}
            title="Switch Partner View"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* ================= ZENAH'S VIEW ================= */}
        {role === 'zenah' && (
          <div className="zenah-dashboard">
            {/* Status Card */}
            <div className="status-card">
              <span className="status-icon">🦢</span>
              <div>
                <h4>Swan is My Life & Lucky Charm</h4>
                <p>Arnav is on standby to pamper you 24/7</p>
              </div>
            </div>

            {/* THE GIANT 3D PULSING CUTE BUTTON */}
            <div className="cute-button-wrapper">
              <button 
                className="giant-cute-button animate-pulse-glow"
                onClick={handleSendPing}
                disabled={isSending}
              >
                <span className="swan-icon">🦢</span>
                <span className="button-main-text">SAW SOMETHING<br />CUTE!</span>
                <span className="button-sub-text">Tap to ping Arnav ⚡</span>
              </button>
            </div>

            {/* Quick Tag Selector */}
            <div className="section-title-row">
              <h3>What did you spot, Princess?</h3>
            </div>
            <div className="tags-chips-grid">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag.label}
                  className={`tag-chip ${selectedTag === tag.label ? 'active' : ''}`}
                  onClick={() => setSelectedTag(tag.label)}
                >
                  {tag.label}
                </button>
              ))}
            </div>

            {/* Optional Note Input */}
            <div className="note-input-container">
              <input 
                type="text" 
                placeholder="Add an optional note for your husband..." 
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendPing()}
              />
            </div>
          </div>
        )}

        {/* ================= ARNAV'S VIEW ================= */}
        {role === 'arnav' && (
          <div className="arnav-dashboard">
            {/* LATEST INCOMING PING HERO CARD */}
            {latestPing && (
              <div className="latest-ping-card animate-slide-in">
                <div className="ping-card-header">
                  <span className="ping-badge">⚡ LATEST CUTE PING FROM ZENAH</span>
                  <span className="ping-time">{formatTime(latestPing.timestamp)}</span>
                </div>

                <div className="ping-content-row">
                  <span className="ping-emoji">{latestPing.emoji}</span>
                  <div className="ping-text">
                    <h4>{latestPing.tag}</h4>
                    <p className="ping-message">“{latestPing.message}”</p>
                  </div>
                </div>

                <div className="reaction-prompt">Quick 1-Tap Response to Zenah:</div>
                <div className="reactions-scroll-row">
                  {QUICK_REACTIONS.map((r) => {
                    const isSelected = latestPing.reaction === r.emoji;
                    return (
                      <button
                        key={r.label}
                        className={`reaction-pill ${isSelected ? 'active' : ''}`}
                        onClick={() => handleReact(latestPing.id, r.emoji)}
                      >
                        <span className="reaction-emoji">{r.emoji}</span>
                        <span>{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Test Simulation Trigger Card */}
            <div className="simulate-card">
              <div className="simulate-info">
                <span className="sim-icon">🧪</span>
                <div>
                  <h4>Test Real-time Ping + Alert</h4>
                  <p>Fires real sound chime, system banner and writes to cloud</p>
                </div>
              </div>
              <button className="simulate-btn" onClick={handleSimulatePing}>
                Trigger ⚡
              </button>
            </div>
          </div>
        )}

        {/* ================= COMMON RECENT TIMELINE ================= */}
        <section className="timeline-section">
          <div className="section-title-row">
            <h3>{role === 'zenah' ? 'Recent Pings & Husband Reactions 💌' : "Zenah's Cute Activity Log 📜"}</h3>
            <span className="count-tag">{pings.length} moments</span>
          </div>

          {pings.length === 0 ? (
            <div className="empty-state">
              <p>No pings yet. Tap the giant swan button above! 🦢</p>
            </div>
          ) : (
            <div className="pings-list">
              {pings.map((p) => (
                <div key={p.id} className="ping-item-card">
                  <div className="item-header">
                    <div className="item-title-group">
                      <span className="item-emoji">{p.emoji}</span>
                      <strong>{p.tag}</strong>
                    </div>
                    <span className="item-time">{formatTime(p.timestamp)}</span>
                  </div>
                  <p className="item-body">“{p.message}”</p>

                  {p.reaction && (
                    <div className="reaction-tag">
                      <span>{p.reaction}</span>
                      <span>Arnav replied with love ❤️</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Confirmation Modal when Zenah sends a ping */}
      {activeModalPing && (
        <div className="modal-overlay" onClick={() => setActiveModalPing(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-avatar pink">{activeModalPing.emoji}</div>
            <h2>Ping Sent to Arnav! 💖</h2>
            <p className="modal-desc">“{activeModalPing.message}”</p>
            <div className="delivered-badge">
              ⚡ Delivered to your husband's screen via Cloud
            </div>
            <button className="modal-close-btn" onClick={() => setActiveModalPing(null)}>
              Got it Bubu 💕
            </button>
          </div>
        </div>
      )}

      {/* Role Switcher Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Switch Device View 📱</h2>
            <p className="modal-sub">Select which partner interface to view:</p>

            <div className="modal-roles-list">
              <button 
                className={`modal-role-btn ${role === 'zenah' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('zenah')}
              >
                <span>🌸 Zenah’s View (Wife 👑)</span>
                {role === 'zenah' && <CheckCircle2 size={18} className="check-icon" />}
              </button>

              <button 
                className={`modal-role-btn ${role === 'arnav' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('arnav')}
              >
                <span>💍 Arnav’s View (Husband 💖)</span>
                {role === 'arnav' && <CheckCircle2 size={18} className="check-icon" />}
              </button>

              <button 
                className="modal-role-btn reset"
                onClick={() => {
                  localStorage.removeItem('bubulink_role');
                  setRole(null);
                  setShowRoleModal(false);
                }}
              >
                🔄 Reset to First-Time Welcome Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
