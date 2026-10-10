import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Heart, 
  Send, 
  Bell, 
  RefreshCw, 
  Smartphone,
  X,
  Camera,
  Edit3,
  MapPin,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon
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
  registerPushWithVPS,
  compressImage
} from './firebase';

const QUICK_PINGS = [
  {
    id: 'missing',
    emoji: '🥺',
    label: 'Missing You',
    defaultMsg: 'Missing you so much right now. Wishing you were here with me ❤️',
  },
  {
    id: 'call',
    emoji: '📞',
    label: 'Free to Call?',
    defaultMsg: 'Are you free to talk? Ring me whenever you get this! 📞',
  },
  {
    id: 'safe',
    emoji: '🏡',
    label: 'Reached Safely',
    defaultMsg: 'Just reached safely! All settled and wanted to let you know ✨',
  },
  {
    id: 'hug',
    emoji: '🫂',
    label: 'Need a Hug',
    defaultMsg: 'Feeling a little low right now... really need a tight hug from you 🫂',
  },
  {
    id: 'thinking',
    emoji: '💭',
    label: 'Thinking of You',
    defaultMsg: 'Just stopped everything because you randomly crossed my mind 🥰',
  },
  {
    id: 'cute',
    emoji: '✨',
    label: 'Saw Something Cute',
    defaultMsg: 'Spotted something super cute and immediately thought of you! 💕',
  },
  {
    id: 'morning',
    emoji: '☀️',
    label: 'Good Morning',
    defaultMsg: 'Good morning my sunshine! Hope you have an amazing day ahead ☀️🌸',
  },
  {
    id: 'night',
    emoji: '🌙',
    label: 'Good Night',
    defaultMsg: 'Going to sleep now, love you to the moon and back! Dream of me 🌙💤',
  },
];

const QUICK_REACTIONS = [
  { emoji: '📞', label: 'Calling in 5 mins' },
  { emoji: '💖', label: 'Love you so much' },
  { emoji: '🫂', label: 'Sending big hugs' },
  { emoji: '🥰', label: 'Saw this! So cute' },
  { emoji: '🚗', label: 'On my way' },
];

export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem('bubulink_role'));
  const [notifGranted, setNotifGranted] = useState(false);
  const [pings, setPings] = useState([]);
  const [dailyNote, setDailyNote] = useState(null);
  const [selectedPing, setSelectedPing] = useState(QUICK_PINGS[0]);
  const [customNote, setCustomNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [toastAlert, setToastAlert] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const fileInputRef = useRef(null);
  const lastPingIdRef = useRef(null);
  const lastReactionRef = useRef(null);

  const partnerRole = role === 'zenah' ? 'arnav' : 'zenah';
  const partnerName = role === 'zenah' ? 'Arnav' : 'Zenah';
  const myName = role === 'zenah' ? 'Zenah' : 'Arnav';

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotifGranted(true);
    }

    const handleAlert = (e) => {
      const { title, body } = e.detail;
      setToastAlert({ title, body, id: Date.now() });
      setTimeout(() => setToastAlert(null), 5000);
    };

    window.addEventListener('bubulink_alert', handleAlert);
    return () => window.removeEventListener('bubulink_alert', handleAlert);
  }, []);

  // Listen to daily sticky note in real-time
  useEffect(() => {
    const unsub = subscribeToDailyNote((note) => {
      setDailyNote(note);
    });
    return () => unsub();
  }, []);

  // Listen to Firestore pings in real-time
  useEffect(() => {
    const unsubscribe = subscribeToPings((list) => {
      if (list && list.length > 0) {
        const top = list[0];
        const currentRole = localStorage.getItem('bubulink_role');

        // New incoming ping from partner
        if (currentRole && top.sender !== currentRole) {
          if (lastPingIdRef.current && lastPingIdRef.current !== top.id) {
            showSystemNotification(
              `${top.emoji} ${top.sender === 'zenah' ? 'Zenah' : 'Arnav'}: ${top.tag}`,
              top.message
            );
          }
          lastPingIdRef.current = top.id;
        }

        // Reaction from partner on my ping
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

  // Sync push registration whenever role changes
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
    const res = await registerPushWithVPS(currentRole);
    if (res.success) {
      setNotifGranted(true);
      showSystemNotification('🔔 Alerts Active!', 'Your phone is connected for lock-screen push!');
    } else {
      alert(res.reason || 'Please allow notifications in Safari settings');
    }
  };

  // Image Selection & Compression
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 800, 0.7);
      setPhotoDataUrl(compressed);
    } catch (err) {
      console.error('Error compressing image:', err);
    }
  };

  // Send Ping
  const handleSendPing = async () => {
    if (!role) return;
    setIsSending(true);

    const message = customNote.trim().length > 0 
      ? customNote.trim() 
      : selectedPing.defaultMsg;

    const newPing = {
      id: Date.now().toString(),
      sender: role,
      recipient: partnerRole,
      tag: selectedPing.label,
      emoji: selectedPing.emoji,
      message,
      image: photoDataUrl || null,
      timestamp: new Date().toISOString(),
      reaction: null,
      responderRole: null,
      reactionTimestamp: null,
    };

    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.65 },
      colors: ['#E55675', '#FF9EB1', '#D4AF37', '#FFFFFF'],
    });

    playChimeSound();
    await sendPingToFirestore(newPing);

    setCustomNote('');
    setPhotoDataUrl(null);
    setIsSending(false);
    showSystemNotification('⚡ Ping Sent!', `Delivered to ${partnerName}'s lock screen!`);
  };

  // React to Partner's Ping
  const handleReact = async (pingId, reactionLabel, originalSender) => {
    await reactToPingInFirestore(pingId, reactionLabel, role, originalSender);
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#E55675', '#FFD700', '#FFFFFF'],
    });
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
    confetti({ particleCount: 30, spread: 50 });
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

  // ONBOARDING SCREEN
  if (!role) {
    return (
      <div className="app-container onboarding-screen">
        <div className="onboarding-card">
          <div className="brand-icon-badge animate-float">💖</div>
          <h1 className="brand-title">BubuLink</h1>
          <div className="badge-pill connection-pill">
            <Sparkles size={13} />
            <span>Private Couple Portal</span>
          </div>
          <p className="onboarding-sub">Select who is using this phone:</p>

          <div className="role-cards-grid">
            <button 
              className="role-card zenah-card"
              onClick={() => handleSelectRole('zenah')}
            >
              <div className="role-avatar">🌸</div>
              <div className="role-info">
                <span className="role-tag pink">Assam 📍</span>
                <h2>I'm Zenah 👑</h2>
                <p>The Wife • Love & Sanctuary</p>
              </div>
            </button>

            <button 
              className="role-card arnav-card"
              onClick={() => handleSelectRole('arnav')}
            >
              <div className="role-avatar">💍</div>
              <div className="role-info">
                <span className="role-tag gold">Always on Standby</span>
                <h2>I'm Arnav 💖</h2>
                <p>The Husband • 24/7 Connected</p>
              </div>
            </button>
          </div>

          <div className="pwa-hint">
            <Smartphone size={14} />
            <span>Lock-screen alerts: Tap Safari <strong>Share ⬆️</strong> &gt; <strong>Add to Home Screen</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // Partner's latest ping
  const latestPartnerPing = pings.find(p => p.sender === partnerRole);

  return (
    <div className="app-container">
      {/* In-app Toast Banner */}
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

      {/* Top Distance & Status Header */}
      <header className="app-header">
        <div className="distance-bar">
          <div className="distance-node">
            <span className="node-dot pink-dot"></span>
            <span className="node-label">Assam (Zenah 🌸)</span>
          </div>
          <div className="distance-track">
            <span className="pulse-heart">❤️</span>
            <span className="distance-text">~1,800 km</span>
          </div>
          <div className="distance-node">
            <span className="node-dot gold-dot"></span>
            <span className="node-label">Arnav 💍</span>
          </div>
        </div>

        <div className="header-meta-row">
          <div className="user-profile-chip">
            <span className="avatar-mini">{role === 'zenah' ? '🌸' : '💍'}</span>
            <div>
              <h3 className="profile-name">{myName}</h3>
              <div className="live-status-row">
                <span className="live-pulse"></span>
                <span>Realtime Connected</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button 
              className={`action-btn ${notifGranted ? 'active' : ''}`}
              onClick={handleEnableNotifs}
              title="Push Notification Status"
            >
              <Bell size={15} />
              <span>{notifGranted ? 'Alerts ON' : 'Enable Alerts'}</span>
            </button>
            <button 
              className="action-btn switch-btn" 
              onClick={() => setShowRoleModal(true)}
              title="Switch Profile"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main App Body */}
      <main className="main-content">
        
        {/* ================= 1. DAILY STICKY LOVE NOTE ================= */}
        <section className="sticky-note-card">
          <div className="sticky-note-header">
            <div className="note-title-row">
              <span className="note-icon">💌</span>
              <h4>Today's Love Note</h4>
            </div>
            <button 
              className="note-edit-btn"
              onClick={() => {
                setNewNoteText(dailyNote?.content || '');
                setShowNoteModal(true);
              }}
            >
              <Edit3 size={13} />
              <span>{dailyNote ? 'Edit' : 'Write'}</span>
            </button>
          </div>

          <p className="note-content">
            {dailyNote?.content || 'Leave a sweet note for your partner to see every time they open the app! 💕'}
          </p>

          <div className="note-footer">
            <span className="note-author">
              {dailyNote?.author ? `Written by ${dailyNote.author === 'zenah' ? 'Zenah' : 'Arnav'}` : 'Tap edit to write'}
            </span>

            {dailyNote && (
              <div className="note-heart-area">
                {dailyNote.lovedBy ? (
                  <span className="loved-stamp">Loved by {dailyNote.lovedBy === 'zenah' ? 'Zenah' : 'Arnav'} ❤️</span>
                ) : (
                  <button className="heart-note-btn" onClick={handleHeartNote}>
                    <Heart size={14} className="heart-fill" />
                    <span>Love this</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ================= 2. PARTNER'S LATEST MOMENT HERO ================= */}
        {latestPartnerPing && (
          <section className="partner-hero-card animate-slide-in">
            <div className="hero-header">
              <div className="hero-badge">
                <span className="live-sparkle">⚡</span>
                <span>LATEST FROM {partnerName.toUpperCase()}</span>
              </div>
              <span className="hero-time">{formatTime(latestPartnerPing.timestamp)}</span>
            </div>

            <div className="hero-body">
              <div className="hero-tag-row">
                <span className="hero-emoji">{latestPartnerPing.emoji}</span>
                <span className="hero-tag-text">{latestPartnerPing.tag}</span>
              </div>
              <p className="hero-message">“{latestPartnerPing.message}”</p>

              {latestPartnerPing.image && (
                <div 
                  className="hero-image-wrapper"
                  onClick={() => setFullscreenImage(latestPartnerPing.image)}
                >
                  <img src={latestPartnerPing.image} alt="Shared moment" />
                  <span className="tap-expand-hint">Tap to expand 🔍</span>
                </div>
              )}
            </div>

            {/* Quick 1-Tap Response Bar */}
            <div className="reaction-section">
              <div className="reaction-title">Quick 1-Tap Reply to {partnerName}:</div>
              <div className="reactions-pill-grid">
                {QUICK_REACTIONS.map((r) => {
                  const isSelected = latestPartnerPing.reaction === r.label;
                  return (
                    <button
                      key={r.label}
                      className={`reaction-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => handleReact(latestPartnerPing.id, r.label, latestPartnerPing.sender)}
                    >
                      <span className="rx-emoji">{r.emoji}</span>
                      <span className="rx-text">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ================= 3. 1-TAP INSTANT PING GRID ================= */}
        <section className="ping-section">
          <div className="section-title-row">
            <h3>Send 1-Tap Alert to {partnerName} ⚡</h3>
            <span className="section-hint">Pings their lock screen</span>
          </div>

          <div className="quick-pings-grid">
            {QUICK_PINGS.map((p) => {
              const isSelected = selectedPing.id === p.id;
              return (
                <button
                  key={p.id}
                  className={`ping-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedPing(p);
                    playChimeSound();
                  }}
                >
                  <span className="ping-chip-emoji">{p.emoji}</span>
                  <span className="ping-chip-label">{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Photo Drop & Custom Note Bar */}
          <div className="ping-composer-card">
            <div className="composer-row">
              <input
                type="text"
                className="composer-input"
                placeholder={`Optional custom note (Default: "${selectedPing.defaultMsg}")`}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendPing()}
              />

              <button 
                type="button" 
                className={`photo-picker-btn ${photoDataUrl ? 'has-photo' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                title="Attach Photo"
              >
                <Camera size={18} />
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />
            </div>

            {/* Photo preview thumbnail */}
            {photoDataUrl && (
              <div className="photo-preview-bar">
                <img src={photoDataUrl} alt="Preview" className="thumb-preview" />
                <span className="photo-attached-text">Photo attached</span>
                <button 
                  className="remove-photo-btn"
                  onClick={() => setPhotoDataUrl(null)}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Big Send Button */}
            <button 
              className="send-ping-hero-btn"
              onClick={handleSendPing}
              disabled={isSending}
            >
              <span className="send-btn-emoji">{selectedPing.emoji}</span>
              <div className="send-btn-text">
                <strong>Ping {partnerName} Now</strong>
                <small>Sends lock-screen push notification ⚡</small>
              </div>
              <Send size={18} className="send-arrow" />
            </button>
          </div>
        </section>

        {/* ================= 4. SHARED TIMELINE ================= */}
        <section className="timeline-section">
          <div className="section-title-row">
            <h3>Moments & Activity 💌</h3>
            <span className="section-count">{pings.length} moments</span>
          </div>

          {pings.length === 0 ? (
            <div className="empty-state">
              <p>No moments yet. Send your first 1-tap ping above! 💕</p>
            </div>
          ) : (
            <div className="timeline-list">
              {pings.map((p) => {
                const isFromMe = p.sender === role;
                const senderDisplayName = p.sender === 'zenah' ? 'Zenah' : 'Arnav';

                return (
                  <div key={p.id} className={`moment-item ${isFromMe ? 'from-me' : 'from-partner'}`}>
                    <div className="moment-top">
                      <div className="moment-sender-tag">
                        <span className="moment-emoji">{p.emoji}</span>
                        <strong>{senderDisplayName}</strong>
                        <span className="moment-tag-badge">{p.tag}</span>
                      </div>
                      <span className="moment-time">{formatTime(p.timestamp)}</span>
                    </div>

                    <p className="moment-msg">“{p.message}”</p>

                    {p.image && (
                      <div 
                        className="moment-thumb-container"
                        onClick={() => setFullscreenImage(p.image)}
                      >
                        <img src={p.image} alt="Moment snapshot" />
                      </div>
                    )}

                    {p.reaction && (
                      <div className="moment-reaction-pill">
                        <span>❤️ {p.reaction}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ================= MODALS ================= */}

      {/* Edit Daily Love Note Modal */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💌 Write Today's Love Note</h3>
              <button className="modal-close-x" onClick={() => setShowNoteModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="modal-sub">This stays pinned at the top of both your screens.</p>
            <textarea
              className="note-textarea"
              rows={4}
              placeholder="Good morning my lovely wife, kick ass today! Love you always..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
            />
            <div className="modal-action-row">
              <button className="modal-save-btn" onClick={handleSaveDailyNote}>
                Save & Alert {partnerName} 💖
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Switcher Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Switch Profile 📱</h3>
              <button className="modal-close-x" onClick={() => setShowRoleModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="modal-sub">Choose which phone interface to use:</p>

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

      {/* Fullscreen Photo Viewer */}
      {fullscreenImage && (
        <div className="fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
          <button className="fullscreen-close-btn" onClick={() => setFullscreenImage(null)}>
            <X size={20} />
          </button>
          <img src={fullscreenImage} alt="Fullscreen moment" className="fullscreen-img" />
        </div>
      )}
    </div>
  );
}
