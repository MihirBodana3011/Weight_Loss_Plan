/* ═══════════════════════════════════════════════════════════════════
   FITOS SERVICE WORKER — Ultra-Robust 24/7 Background Notification Engine
   v5.0 — Works even when PWA is completely closed.

   STRATEGY (Multi-Layer Redundancy):
   1. setTimeout chain — keeps SW alive while page is open
   2. Periodic Background Sync — wakes SW every 15-60min when closed (Android)
   3. Push messages — future server-side push support
   4. SW self-ping via fetch — keeps SW from dying in background
   5. Notification timestamps prevent duplicate firing
═══════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'fitos-v12';
const ASSETS = [
  './index.html',
  './app.css',
  './desktop.css',
  './app.js',
  './data.json',
  './manifest.json',
  './icons/fitos_icon.png',
  './icons/fitos_icon_512.png'
];

/* ── FULL DAILY SCHEDULE ──────────────────────────────────────────
   challenge: false = always fire (even without challenge)
   challenge: true  = only fire when 90-day challenge is ACTIVE
   urgent: true     = requireInteraction + strong vibration
──────────────────────────────────────────────────────────────────*/
const DAILY_SCHEDULE = [
  // === NIGHT SHIFT END / PRE-WORKOUT (2:30 AM – 6 AM) ===
  {
    h: 2, m: 30, tag: 'job_ends', challenge: false, urgent: true,
    title: '🏁 JOB ENDS — Pre-Workout Phase',
    body: 'Shift khatam! Ab gym ki taiyari karo. ½ Banana + Black Coffee ready karo. 🔥'
  },

  {
    h: 3, m: 0, tag: 'pregym', challenge: false, urgent: true,
    title: '🍌 PRE-GYM MEAL',
    body: '½ Banana + Black Coffee. Benefits: Blocks fatigue, increases focus, and accelerates fat burning! 🔥'
  },

  {
    h: 3, m: 15, tag: 'fat_burner', challenge: false, urgent: false,
    title: '💊 Fat Burner Tablet — Dr. Morepen',
    body: 'Gym days only — abhi le lo tablet. Metabolism fire karo before gym! 🔥'
  },

  {
    h: 4, m: 0, tag: 'gym', challenge: false, urgent: true,
    title: '🏋️ GYM TIME — BEAST MODE ON!',
    body: '4 AM – 6 AM: High-Intensity session at Fit Master Gym. No excuses — JAO ABHI! 💪'
  },

  {
    h: 5, m: 30, tag: 'gym_wrap', challenge: false, urgent: false,
    title: '⚡ Gym Wrap-Up Soon',
    body: 'Cool down karo, stretch karo. 6 baj rahe hain — recovery time shuru hoga.'
  },

  // === RECOVERY SLEEP (6:15 AM – 12:00 PM) ===
  {
    h: 6, m: 15, tag: 'recovery_sleep', challenge: false, urgent: true,
    title: '😴 RECOVERY SLEEP — Abhi So Jao!',
    body: 'Post-gym 6-hour deep recovery window. So jao — muscle growth isi mein hoti hai! 💤'
  },

  // === WAKE UP & FASTED SUPPLEMENTS (12:00 PM onward) ===
  {
    h: 12, m: 0, tag: 'wake_up', challenge: false, urgent: true,
    title: '⏰ WAKE UP — 12:00 PM',
    body: 'Uth ja bhai! Fasted kickstart mode ON. Time to start the day. ☀️'
  },
  {
    h: 12, m: 10, tag: 'jeera1', challenge: false, urgent: false,
    title: '🌿 Jeera/Saunf/Ajwain + Lemon',
    body: 'Supplement — Fasting detox drink pi lo abhi. Metabolism active karo! ⚡'
  },
  {
    h: 12, m: 30, tag: 'acv1', challenge: false, urgent: false,
    title: '🍎 Apple Cider Vinegar — R1',
    body: 'Supplement — 1 tbsp ACV in warm water. Gut health boost! 💪'
  },
  {
    h: 13, m: 0, tag: 'isab1', challenge: false, urgent: false,
    title: '🌾 Isabgol — Round 1',
    body: 'Supplement — 1 tsp in water. Fiber dose no. 1.'
  },

  // === MAIN LUNCH (1:15 PM) ===
  {
    h: 13, m: 15, tag: 'lunch', challenge: false, urgent: true,
    title: '🍱 MAIN LUNCH — 1:15 PM',
    body: 'High Protein / High Fiber Meal. Biggest meal of the day — sahi se khao! 💪'
  },

  // === AFTERNOON SUPPLEMENTS (4:00 PM – 4:30 PM) ===
  {
    h: 16, m: 0, tag: 'jeera2', challenge: false, urgent: false,
    title: '🌿 Jeera/Saunf/Ajwain + Lemon',
    body: 'Supplement — Afternoon detox drink. Stay hydrated and active!'
  },

  {
    h: 16, m: 15, tag: 'acv2', challenge: false, urgent: false,
    title: '🍎 Apple Cider Vinegar — R2',
    body: 'Supplement — 1 tbsp ACV in warm water. Dinner se pehle le lo!'
  },

  {
    h: 16, m: 30, tag: 'isab2', challenge: false, urgent: false,
    title: '🌾 Isabgol — Round 2',
    body: 'Supplement — 1 tsp in water. Fiber dose no. 2.'
  },

  // === DINNER (5:00 PM) ===
  {
    h: 17, m: 0, tag: 'dinner', challenge: false, urgent: true,
    title: '🍽️ DINNER — 5:00 PM',
    body: 'Lean fuel before work shift. Job se pehle nutritious khao! 🥗'
  },

  // === JOB STARTS (6:30 PM) ===
  {
    h: 18, m: 30, tag: 'job_starts', challenge: false, urgent: true,
    title: '🏢 JOB STARTS — 6:30 PM',
    body: 'Official shift begins! focused raho. Night grind mode ON! 💼'
  },

  // === HYDRATION MID-SHIFT ===
  {
    h: 20, m: 0, tag: 'water_mid', challenge: false, urgent: false,
    title: '💧 HYDRATION CHECK — Shift mein',
    body: 'Kaam ke beech paani mat bhoolna! Keep going.'
  },

  {
    h: 22, m: 0, tag: 'water_22', challenge: false, urgent: false,
    title: '💧 WATER REMINDER — 10 PM',
    body: 'Raat mein bhi hydrated raho. Goal check karo!'
  },

  // === GREEN TEA (11:59 PM) ===
  {
    h: 23, m: 59, tag: 'gt', challenge: false, urgent: false,
    title: '🍵 Green Tea + Lemon',
    body: 'Supplement — Metabolism boost & last drink of the day. 🌙'
  },

  {
    h: 23, m: 0, tag: 'log_check', challenge: false, urgent: true,
    title: '📋 DAILY LOG — Bharo Abhi!',
    body: 'Aaj sab log kiya? Weight, water, workout, meals — sab check karo.'
  },

  // === CHALLENGE MODE EXTRAS (only when 90-day challenge is active) ===
  {
    h: 12, m: 5, tag: 'c_morning', challenge: true, urgent: true,
    title: '🔥 CHALLENGE DAY — JEET KA DIN!',
    body: 'Har rep teri transformation ki taraf ek step hai. Aaj bhi beast raho! 💪'
  },

  {
    h: 15, m: 0, tag: 'c_afternoon', challenge: true, urgent: false,
    title: '⚡ CHALLENGE ENERGY BOOST',
    body: 'Afternoon slump mat aane dena. Paani pi, chal, focused raho!'
  },

  {
    h: 21, m: 0, tag: 'c_night', challenge: true, urgent: true,
    title: '🌙 END OF DAY — CHALLENGE LOG',
    body: 'Aaj ka progress log karo. Har logged day = ek guaranteed win! 🏆'
  },

  {
    h: 1, m: 30, tag: 'c_midnight', challenge: true, urgent: false,
    title: '💪 SHIFT MIDNIGHT MOTIVATION',
    body: 'Shift ke beech bhi motivated raho. Aaj ka din jeet chuke ho! 🏆'
  },
];

/* ── IndexedDB helpers ──────────────────────────────────────────── */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fitos_sw_db', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(new Error('IndexedDB open failed'));
  });
}

function dbGet(key) {
  return openDB().then(db => new Promise(resolve => {
    const req = db.transaction('config', 'readonly').objectStore('config').get(key);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror = () => resolve(null);
  }));
}

function dbSet(key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction('config', 'readwrite').objectStore('config').put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('dbSet failed'));
  }));
}

/* ── Fire a notification ─────────────────────────────────────────── */
function fireNotification(slot) {
  const isUrgent = slot.urgent === true;
  const options = {
    body: slot.body,
    icon: './icons/fitos_icon_512.png',
    badge: './icons/fitos_icon.png',
    tag: slot.tag,
    renotify: true,
    requireInteraction: isUrgent,
    vibrate: isUrgent
      ? [300, 100, 300, 100, 600, 100, 300]   // strong triple buzz
      : [200, 100, 200],                        // soft double buzz
    silent: false,
    timestamp: Date.now(),
    data: { url: './index.html', tag: slot.tag, urgent: isUrgent },
    actions: [
      { action: 'open', title: '📱 Open FitOS' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ]
  };

  // Add challenge-style accent for challenge notifications
  if (slot.challenge) {
    options.body = '🏆 ' + slot.body;
  }

  return self.registration.showNotification(slot.title, options);
}

/* ── OS Level Notification Triggers (Android Battery Bypass) ────── */
async function updateScheduledTriggers() {
  if (!('TimestampTrigger' in self)) return; // Triggers API unsupported, standard loop will handle it
  try {
    const profile = await dbGet('profile') || {};
    const isChallengeActive = !!(profile.startDate);
    const now = Date.now();
    for (const slot of DAILY_SCHEDULE) {
       if (slot.challenge && !isChallengeActive) continue;
       // Today
       let d = new Date(); d.setHours(slot.h, slot.m, 0, 0);
       if (d.getTime() > now) await scheduleSingleTrigger(slot, d.getTime());
       // Tomorrow
       let d2 = new Date(); d2.setDate(d2.getDate() + 1); d2.setHours(slot.h, slot.m, 0, 0);
       await scheduleSingleTrigger(slot, d2.getTime());
    }
  } catch (e) { console.error('[FitOS SW] Trigger error:', e); }
}

async function scheduleSingleTrigger(slot, timestamp) {
  const isUrgent = slot.urgent === true;
  const tTag = slot.tag + '_sched_' + timestamp;
  const existing = await self.registration.getNotifications({ tag: tTag, includeScheduled: true });
  if (existing && existing.length > 0) return; 
  await self.registration.showNotification(slot.challenge ? '🏆 ' + slot.title : slot.title, {
    body: slot.body, icon: './icons/fitos_icon_512.png', badge: './icons/fitos_icon.png',
    tag: tTag, vibrate: isUrgent ? [300, 100, 300, 100, 600] : [200, 100, 200],
    showTrigger: new TimestampTrigger(timestamp),
    data: { url: './index.html' }
  });
}

/* ── Master check: Should we fire anything right now? ────────────── */
async function checkAndFire() {
  try {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // Load challenge status from IndexedDB
    const profile = await dbGet('profile') || {};
    const isChallengeActive = !!(profile.startDate);

    // Load today's fired log (tracks which notifications already sent today)
    const firedLog = await dbGet('firedLog_' + todayKey) || {};

    let fired = false;

    for (const slot of DAILY_SCHEDULE) {
      // Skip challenge-only slots if challenge is not running
      if (slot.challenge && !isChallengeActive) continue;

      // Match this slot's scheduled time (within current minute)
      if (slot.h === h && slot.m === m) {
        if (!firedLog[slot.tag]) {
          await fireNotification(slot);
          firedLog[slot.tag] = Date.now();
          fired = true;
          // Small delay between multiple same-minute notifications
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // Save updated log
    if (fired) {
      await dbSet('firedLog_' + todayKey, firedLog);
    }

    // Clean up old logs (keep only last 3 days)
    await cleanOldLogs(todayKey);

  } catch (err) {
    console.error('[FitOS SW] checkAndFire error:', err);
  }
}

/* ── Clean old fired logs from IndexedDB ────────────────────────── */
async function cleanOldLogs(todayKey) {
  try {
    const db = await openDB();
    const store = db.transaction('config', 'readonly').objectStore('config');
    const keys = await new Promise(resolve => {
      const req = store.getAllKeys();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => resolve([]);
    });

    const tda = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = tda.getFullYear() + '-' + String(tda.getMonth() + 1).padStart(2, '0') + '-' + String(tda.getDate()).padStart(2, '0');

    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith('firedLog_')) {
        const dateStr = key.replace('firedLog_', '');
        if (dateStr < threeDaysAgo) {
          const delTx = db.transaction('config', 'readwrite');
          delTx.objectStore('config').delete(key);
        }
      }
    }
  } catch (e) {
    // Non-critical, ignore
  }
}

/* ── SW Keep-Alive: Schedule next minute precisely ──────────────────
   Browsers kill idle SWs. We schedule the next check at the exact
   start of next minute so SW stays alive for scheduled times.
   Additionally — every check also does a self-fetch to extend life.
──────────────────────────────────────────────────────────────────── */
let _clockRunning = false;

function scheduleNextMinute() {
  if (_clockRunning) return; // prevent duplicate timers
  _clockRunning = true;

  const now = new Date();
  // Calculate ms until the start of next minute + 100ms buffer
  const msUntilNext = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 100;

  setTimeout(async () => {
    _clockRunning = false;
    await checkAndFire();
    // Self-extend: do a dummy fetch to keep SW alive
    try {
      await fetch('./manifest.json?_sw_ping=' + Date.now(), { cache: 'no-store' });
    } catch (e) { /* offline is fine */ }
    scheduleNextMinute(); // reschedule for the minute after
  }, msUntilNext);
}

/* ── Missed notification catch-up ───────────────────────────────────
   When SW wakes up (from sleep/kill), scan last 15 minutes for
   any missed notifications and fire them immediately.
──────────────────────────────────────────────────────────────────── */
async function catchUpMissedNotifs() {
  try {
    const now = new Date();
    const todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const profile = await dbGet('profile') || {};
    const isChallengeActive = !!(profile.startDate);
    const firedLog = await dbGet('firedLog_' + todayKey) || {};

    const nowMins = now.getHours() * 60 + now.getMinutes();
    let updated = false;

    for (const slot of DAILY_SCHEDULE) {
      if (slot.challenge && !isChallengeActive) continue;

      const slotMins = slot.h * 60 + slot.m;
      const missedWindow = 15; // catch up to 15 minutes late

      // Check if this slot was in the last 15 minutes and not yet fired
      if (slotMins <= nowMins && slotMins > nowMins - missedWindow) {
        if (!firedLog[slot.tag]) {
          // Fire with "missed" indicator
          const missedSlot = {
            ...slot,
            title: '⚠️ ' + slot.title,
            body: '[Missed ' + (nowMins - slotMins) + 'min ago] ' + slot.body,
            urgent: false // don't make missed notifs require interaction
          };
          await fireNotification(missedSlot);
          firedLog[slot.tag] = Date.now();
          updated = true;
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    if (updated) {
      await dbSet('firedLog_' + todayKey, firedLog);
    }
  } catch (e) {
    console.error('[FitOS SW] catchUp error:', e);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SERVICE WORKER LIFECYCLE EVENTS
═══════════════════════════════════════════════════════════════════ */

/* ── INSTALL ──────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log('[FitOS SW] Installing v5...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

/* ── ACTIVATE ─────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  console.log('[FitOS SW] Activating v5...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take control of all pages
      .then(() => {
        scheduleNextMinute(); // start the clock
        updateScheduledTriggers(); // push native alarms into OS if supported
        return catchUpMissedNotifs(); // check for missed notifications
      })
  );
});

/* ── FETCH (Stale-While-Revalidate Strategy for Assets) ────────── */
self.addEventListener('fetch', event => {
  if (event.request.url.includes('_sw_ping')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.url.includes('data.json')) {
          return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } });
        }
      });
      return cachedResponse || fetchPromise;
    })
  );
});

/* ── PERIODIC BACKGROUND SYNC ─────────────────────────────────── */
// Fires automatically by Android Chrome even when app is closed.
// Registered from app.js with minInterval: 15 minutes.
self.addEventListener('periodicsync', event => {
  console.log('[FitOS SW] Periodic sync:', event.tag);
  if (event.tag === 'fitos-reminder-check') {
    event.waitUntil(
      checkAndFire()
        .then(() => catchUpMissedNotifs())
        .then(() => scheduleNextMinute())
    );
  }
});

/* ── PUSH (Server-side push for future use) ─────────────────────── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  console.log('[FitOS SW] Push received:', data);
  event.waitUntil(
    self.registration.showNotification(data.title || '🔥 FitOS Alert!', {
      body: data.body || 'Stay on track with your goals!',
      icon: './icons/fitos_icon_512.png',
      badge: './icons/fitos_icon.png',
      vibrate: [300, 100, 300, 100, 600],
      requireInteraction: true,
      tag: data.tag || 'push-notif',
      data: { url: data.url || './index.html' }
    })
  );
});

/* ── MESSAGE from app.js ─────────────────────────────────────── */
self.addEventListener('message', async event => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {

    // App requests immediate custom alert notification
    case 'SHOW_STRICTION': {
      const d = msg.payload;
      await self.registration.showNotification(d.title || '⚖️ FitOS Alert!', {
        body: d.body || 'Check your goals now!',
        icon: './icons/fitos_icon_512.png',
        badge: './icons/fitos_icon.png',
        vibrate: [300, 100, 300, 100, 500, 100, 300],
        tag: d.tag || 'strict-alert',
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: { url: './index.html' }
      });
      break;
    }

    // App syncs user profile so SW knows if challenge is active
    case 'SYNC_PROFILE': {
      await dbSet('profile', msg.payload);
      console.log('[FitOS SW] Profile synced, challenge:', !!(msg.payload && msg.payload.startDate));
      await updateScheduledTriggers(); // Re-schedule triggers if profile changed
      break;
    }

    // App asks the SW to fire any pending notifications right now
    case 'CHECK_NOW': {
      await checkAndFire();
      break;
    }

    // App asks SW to do catch-up on missed ones
    case 'CATCH_UP': {
      await catchUpMissedNotifs();
      break;
    }

    // Start or restart the minute clock
    case 'START_CLOCK': {
      _clockRunning = false; // reset flag so it can restart
      scheduleNextMinute();
      console.log('[FitOS SW] Clock restarted.');
      break;
    }

    // App requests test notification
    case 'TEST_NOTIF': {
      await self.registration.showNotification('🔥 FitOS — Test Notification', {
        body: 'Bhai, notifications sahi se kaam kar rahi hain! Background mein bhi aayengi. 💪',
        icon: './icons/fitos_icon_512.png',
        badge: './icons/fitos_icon.png',
        vibrate: [200, 100, 200, 100, 400, 100, 200],
        requireInteraction: true,
        tag: 'test-notif',
        renotify: true
      });
      break;
    }

    default:
      console.log('[FitOS SW] Unknown message type:', msg.type);
  }
});

/* ── NOTIFICATION CLICK ─────────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
  const action = event.action;

  if (action === 'dismiss') return; // just close it

  // 'open' action or tap anywhere — open/focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ((client.url.includes('index.html') || client.url.endsWith('/')) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

/* ── NOTIFICATION CLOSE (dismissed by user) ─────────────────── */
self.addEventListener('notificationclose', event => {
  // Could log analytics here in the future
  console.log('[FitOS SW] Notification dismissed:', event.notification.tag);
});
