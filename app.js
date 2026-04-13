// ═══════════════════════════════════════════════
// CONSTANTS & GLOBALS
// ═══════════════════════════════════════════════
var DAY_NAMES, DAY_SHORT, DAY_WORKOUT_TYPE, WORKOUTS, WEEKLY_MEALS, MEAL_CONFIG, DAILY_MACROS, DAILY_TIMELINE;
var DATA_LOADED = false;
var EXPANDED_MEAL_ID = null;

var DAILY_MOTIVATIONS = [
  "Pain is temporary. Quitting lasts forever.",
  "Every rep counts. Every meal matters. Stay locked in.",
  "You didn't come this far to only come this far.",
  "The body achieves what the mind believes.",
  "Discipline beats motivation every single day.",
  "Push harder than yesterday if you want a different tomorrow.",
  "Sweat now. Shine later. No shortcuts.",
  "Your only competition is who you were yesterday.",
  "Small steps every day — massive results every month.",
  "The grind doesn't stop. Neither do you.",
  "Eat right. Train hard. Sleep deep. Repeat.",
  "Champions are made in the moments they want to quit.",
  "Progress, not perfection. Keep moving.",
  "Your future self is watching — make them proud.",
  "One day or day one. You decide.",
  "Success is the sum of small efforts repeated daily.",
  "Don't stop when you're tired. Stop when you're done.",
  "The secret to getting ahead is getting started.",
  "Strength doesn't come from what you can do — it comes from overcoming what you thought you couldn't.",
  "Hard days build strong people.",
  "Fall in love with the process and results will follow.",
  "No excuses. No days off. Full send.",
  "Transform your body. Transform your life.",
  "Every workout is a step closer to the best version of you.",
  "The pain you feel today is the strength you feel tomorrow.",
  "Stay consistent. Stay patient. Stay focused.",
  "Eat clean. Train mean. Stay lean.",
  "You are one workout away from a good mood.",
  "Ninety days of grind. A lifetime of results.",
  "FASTED. FOCUSED. FEARLESS."
];

// ═══════════════════════════════════════════════
// NEURAL CORE (SMART ANALYTICS ENGINE)
// ═══════════════════════════════════════════════
var NeuralCore = {
  // 1RM Calculator (Brzycki Formula)
  calc1RM: function (w, r) {
    if (r === 1) return w;
    return Math.round(w / (1.0278 - (0.0278 * r)));
  },

  // Predict weight in N days based on recent trend (past 7-14 days)
  predictWeight: function (days) {
    var weights = DB.weights();
    if (weights.length < 3) return null;

    // Simple linear trend based on first and last log in the window
    var start = weights[0];
    var end = weights[weights.length - 1];
    var dayDiff = (end.t - start.t) / (1000 * 60 * 60 * 24);
    if (dayDiff < 1) return end.kg;

    var ratePerDay = (end.kg - start.kg) / dayDiff;
    return (end.kg + (ratePerDay * days)).toFixed(1);
  },

  // Identify plateau (weight hasn't changed > 0.5% in 14 days despite > 90% adherence)
  isPlateau: function () {
    var weights = DB.weights();
    if (weights.length < 5) return false;

    var recent = weights.slice(-5);
    var first = recent[0].kg;
    var last = recent[recent.length - 1].kg;
    var diff = Math.abs(first - last);
    var pctChange = (diff / first) * 100;

    return pctChange < 0.5; // Less than 0.5% change
  },

  // Calculate Volume Load (Sets x Reps x Weight)
  calcVolume: function (exercises) {
    var vol = 0;
    for (var id in exercises) {
      var ex = exercises[id];
      var sw = ex.setWeights || {};
      var sd = ex.setDone || {};
      for (var s in sd) {
        if (sd[s]) {
          var w = parseFloat(sw[s]) || 0;
          // Assume reps from workout config or 10 if unknown
          vol += w * 10;
        }
      }
    }
    return vol;
  },

  // Recovery Readiness Score (0-100)
  getRecoveryIndex: function () {
    var mas = getMetabolicAdaptabilityScore();
    var weights = DB.weights();
    var fatigue = 0;

    if (weights.length > 2) {
      var latest = weights[weights.length - 1].kg;
      var prev = weights[weights.length - 2].kg;
      if (latest > prev + 1) fatigue += 20; // Rapid water weight spike
    }

    return Math.max(0, mas - fatigue);
  },

  // Smart Macro Adjustment based on Goal & BF%
  getMacroAdjustment: function () {
    var p = DB.profile();
    var bf = parseFloat(p.bodyFat || 20);
    var goal = p.goalMode || 'cut';

    var adj = { cal: 0, protein: 0 };
    if (goal === 'cut') {
      adj.cal = -500;
      adj.protein = bf > 25 ? 1.8 : 2.2; // Higher protein for leaner people on cut
    } else {
      adj.cal = 300;
      adj.protein = 2.0;
    }
    return adj;
  }
};

var DAILY_SUPPLEMENTS = {
  "supp_fatburner": "<strong>Usage:</strong> 1 Tablet with warm water 30-45 mins before gym.<br><strong>Benefits:</strong> Stimulates fat oxidation, controls cravings, and boosts metabolic rate using Green Coffee, Guggul, and Pippali.",
  "supp_centrum": "<strong>Usage:</strong> 1 Tablet with lunch.<br><strong>Benefits:</strong> Supports immunity, muscle function, and heart health with 24 essential vitamins and minerals plus Grape Seed Extract.",
  "supp_tslim": "<strong>Usage:</strong> 1 Tablet at 12:15 PM with lunch.<br><strong>Benefits:</strong> Helps control appetite before the evening window and supports fat metabolism.",
  "supp_jeera1": "<strong>Usage:</strong> 1 cup warm drink with lemon, jeera, saunf, and ajwain.<br><strong>Benefits:</strong> Detox support and digestion boost.",
  "supp_acv1": "<strong>Usage:</strong> 1 tbsp in 250ml warm water, ideally 90 min after lunch.<br><strong>Benefits:</strong> Improves insulin sensitivity and supports fat loss.",
  "supp_isab1": "<strong>Usage:</strong> 1 tsp in water.<br><strong>Benefits:</strong> High fiber for digestive health and satiety.",
  "supp_jeera2": "<strong>Usage:</strong> 1 cup warm drink.<br><strong>Benefits:</strong> Afternoon digestion support.",
  "supp_acv2": "<strong>Usage:</strong> 1 tbsp in 250ml warm water.<br><strong>Benefits:</strong> Supports blood sugar stability before dinner.",
  "supp_isab2": "<strong>Usage:</strong> 1 tsp in lukewarm water before dinner.<br><strong>Benefits:</strong> High fiber to help control hunger and support bowel regularity.",
  "supp_snack": "<strong>Usage:</strong> 30g roasted chana or 20g makhana during office break.<br><strong>Benefits:</strong> Low-calorie protein snack to manage hunger.",
  "supp_gt": "<strong>Usage:</strong> 1 cup plain green tea, no sugar.<br><strong>Benefits:</strong> Calorie-free metabolism support and night-time hydration.",
  "pregym": "1 medium banana + black coffee no sugar, no milk"
};

function todayDay() {
  if (!DATA_LOADED) return DAY_SHORT[new Date().getDay()].toLowerCase();
  return DB.get('todayDay') || DAY_NAMES[new Date().getDay()];
}

function getDayNum() { return DATA_LOADED ? DB.get('dayNum') || 0 : 0; }
function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

var DAILY_MOTIVATIONS = [
  "The night isn't for sleeping. It's for grinding. Push harder.",
  "They sleep. You outwork them. Beast mode activated.",
  "Pain is temporary. Quitting lasts forever. Don't stop.",
  "It's 4 AM. Nobody is watching. This is where champions are made.",
  "Exhausted? Good. That means you're changing.",
  "Your mind will quit 100 times before your body does. Keep going.",
  "Discipline will take you places motivation can't.",
  "Sweat is just fat crying. Make it pour.",
  "You didn't wake up this early to be average.",
  "Night shift. Early gym. Total domination.",
  "Doubt is only a thought. Action is reality.",
  "No alarms. Your goals should wake you up.",
  "Tiredness is a mindset. Dominate it.",
  "Comfort is the enemy of greatness.",
  "Every rep is a step away from who you were.",
  "You cannot cheat the grind. It knows how much you've invested.",
  "Embrace the darkness. That's where you grow.",
  "Results happen when no one is watching.",
  "Your body is a weapon. Sharpen it.",
  "Fall in love with the suffering.",
  "Be unbroken. Be relentless. Be unstoppable.",
  "You're not surviving the night shift. You're conquering it.",
  "Stop waiting for motivation. Build discipline.",
  "Weakness is a choice. Choose strength.",
  "The heavier it gets, the stronger you become.",
  "Let your success make the noise.",
  "Turn the pain into power.",
  "Vibrate higher. Lift heavier. Grind longer.",
  "Excuses don't burn calories.",
  "Your future self is watching you right now. Make them proud.",
  "Blood, sweat, and respect. First two you give. Last one you earn.",
  "If it doesn't challenge you, it doesn't change you."
];

// ═══════════════════════════════════════════════
// DATABASE (UNIFIED USER-WISE DATE-WISE)
// ═══════════════════════════════════════════════
var DB = {
  _g: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  _s: function (k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  get: function (k) { return this._g(k); },
  set: function (k, v) { this._s(k, v); },

  profile: function () {
    var p = this._g('fp_profile') || {};
    if (!p.userId) { p.userId = 'user_' + Math.random().toString(36).substr(2, 9); this._s('fp_profile', p); }
    return p;
  },
  setProfile: function (v) {
    var existing = this.profile();
    var merged = {};
    for (var k in existing) merged[k] = existing[k];
    for (var k in v) merged[k] = v[k];
    this._s('fp_profile', merged);
  },

  _getData: function () { return this._g('fp_userData') || []; },
  _saveData: function (data) { this._s('fp_userData', data); },

  _getDayEntry: function (date) {
    var uid = this.profile().userId;
    var data = this._getData();
    var entry = null;
    for (var i = 0; i < data.length; i++) { if (data[i].date === date && data[i].userId === uid) { entry = data[i]; break; } }
    if (!entry) {
      entry = { userId: uid, date: date, weight: 0, water: 0, steps: 0, workout: false, diet: false, _rawWorkout: {}, _rawDiet: {} };
      data.push(entry);
      this._saveData(data);
    }
    return entry;
  },

  _updateDay: function (date, partial) {
    var uid = this.profile().userId;
    var data = this._getData();
    var idx = -1;
    for (var j = 0; j < data.length; j++) { if (data[j].date === date && data[j].userId === uid) { idx = j; break; } }
    if (idx === -1) {
      this._getDayEntry(date);
      data = this._getData();
      for (var j = 0; j < data.length; j++) { if (data[j].date === date && data[j].userId === uid) { idx = j; break; } }
    }
    var updated = {};
    for (var k in data[idx]) updated[k] = data[idx][k];
    for (var k in partial) updated[k] = partial[k];
    updated.userId = uid;
    data[idx] = updated;
    this._saveData(data);
  },

  weights: function () {
    var uid = this.profile().userId;
    var logs = this._g('fp_weightLogs') || [];
    // Filter by user and sort by timestamp
    return logs.filter(function (l) { return l.userId === uid; }).sort(function (a, b) { return a.t - b.t; });
  },
  addWeight: function (date, kg) {
    var uid = this.profile().userId;
    var logs = this._g('fp_weightLogs') || [];
    // Add new log with timestamp for granular tracking
    logs.push({ userId: uid, date: date, kg: parseFloat(kg), t: Date.now() });
    this._s('fp_weightLogs', logs);
    // Also update the latest weight in daily data for summary cards
    this._updateDay(date, { weight: parseFloat(kg) });
  },
  exWeights: function (exId) {
    var uid = this.profile().userId;
    var logs = this._g('fp_exWeightLogs') || [];
    return logs.filter(function (l) { return l.userId === uid && l.exId === exId; }).sort(function (a, b) { return a.t - b.t; });
  },
  addExWeight: function (exId, kg) {
    var uid = this.profile().userId;
    var logs = this._g('fp_exWeightLogs') || [];
    logs.push({ userId: uid, exId: exId, kg: parseFloat(kg), t: Date.now() });
    this._s('fp_exWeightLogs', logs);
  },
  exportData: function () {
    var uid = this.profile().userId;
    var data = {
      version: "2.0",
      profile: this.profile(),
      daily: this._getData().filter(function (d) { return d.userId === uid; }),
      weights: this.weights(),
      advanced: this._g('fp_advancedData') || {}
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'FitOS_Data_' + uid + '_' + today() + '.json';
    a.click();
  },
  exportCSV: function () {
    var data = this._getData();
    var csv = "Date,Weight,Water,Steps,WorkoutDone,DietDone\n";
    data.forEach(d => {
      csv += `${d.date},${d.weight},${d.water},${d.steps},${d.workout},${d.diet}\n`;
    });
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'FitOS_Progress_' + today() + '.csv';
    a.click();
  },
  importData: function (jsonStr) {
    try {
      var data = JSON.parse(jsonStr);
      if (data.profile) this._s('fp_profile', data.profile);
      if (data.daily) this._s('fp_userData', data.daily);
      if (data.weights) this._s('fp_weightLogs', data.weights);
      if (data.advanced) this._s('fp_advancedData', data.advanced);
      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  },

  getWater: function (date) { return this._getDayEntry(date).water || 0; },
  setWater: function (date, n) { this._updateDay(date, { water: Math.max(0, n) }); },

  getNotifHistory: function () { return this._g('fp_notifHistory') || {}; },
  setNotifId: function (id) {
    var h = this.getNotifHistory();
    h[id] = Date.now();
    this._s('fp_notifHistory', h);
  },

  getNotifHistory: function () { return this._g('fp_notifHistory') || {}; },
  setNotifId: function (id) {
    var h = this.getNotifHistory();
    h[id] = Date.now();
    this._s('fp_notifHistory', h);
  },

  getSteps: function (date) { return this._getDayEntry(date).steps || 0; },
  setSteps: function (date, n) { this._updateDay(date, { steps: Math.max(0, n) }); },

  getMeal: function (date) { return this._getDayEntry(date)._rawDiet || {}; },
  setMealItem: function (date, key, val) {
    var d = this._getDayEntry(date);
    var rd = d._rawDiet || {};
    rd[key] = val;
    var d_status = (rd['lunch'] === true || rd['dinner'] === true);
    this._updateDay(date, { _rawDiet: rd, diet: d_status });
  },

  getWorkout: function (date) { return this._getDayEntry(date)._rawWorkout || {}; },
  setWorkout: function (date, data) {
    var d = this._getDayEntry(date);
    var rw = {};
    for (var k in d._rawWorkout) rw[k] = d._rawWorkout[k];
    for (var k in data) rw[k] = data[k];
    this._updateDay(date, { _rawWorkout: rw, workout: rw.completed || false });
  },
  setExercise: function (date, exId, data) {
    var d = this._getDayEntry(date);
    var w = d._rawWorkout || {};
    if (!w.exercises) w.exercises = {};
    var ex = w.exercises[exId] || {};
    for (var k in data) ex[k] = data[k];
    w.exercises[exId] = ex;
    this._updateDay(date, { _rawWorkout: w, workout: true });
    this._s('last_active_date', date);
  },
  // Advanced Metrics store
  getAdvanced: function (key) { return (this._g('fp_advancedData') || {})[key]; },
  setAdvanced: function (key, val) {
    var d = this._g('fp_advancedData') || {};
    d[key] = val;
    this._s('fp_advancedData', d);
  }
};

function openImportModal() {
  openModal(
    '<div class="modal-title">🔄 RESTORE DATA</div>' +
    '<div style="font-size:0.7rem; color:var(--sub); margin-bottom:15px;">Upload your FitOS backup (.json) to restore all profile and progress data.</div>' +
    '<input type="file" id="import-file" accept=".json" style="display:none;" onchange="handleImportFile(this)"/>' +
    '<button class="modal-btn primary" onclick="document.getElementById(\'import-file\').click()">SELECT FILE</button>'
  );
}

function handleImportFile(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var success = DB.importData(e.target.result);
    if (success) {
      showToast('✅ Progress Restored! Restarting...');
      setTimeout(function () { location.reload(); }, 1500);
    } else {
      showToast('❌ Invalid format.');
    }
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
function toLocalDate(d) {
  var date = d || new Date();
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function today() { return toLocalDate(); }

function formatDate(d) {
  if (!d) return '---';
  var dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function updateTopBar() {
  var td = document.getElementById('topbar-date');
  if (td) {
    var now = new Date();
    // Manual format to get exactly HH:MM AM/PM style
    var hh = now.getHours();
    var mm = now.getMinutes();
    var ampm = hh >= 12 ? 'P.M' : 'A.M';
    hh = hh % 12;
    hh = hh ? hh : 12;
    var timeStr = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ' ' + ampm;
    td.innerHTML = formatDate(today()) + ' <span style="margin-left:8px; opacity:0.8; font-family:JetBrains Mono,monospace; font-size:0.85em;">' + timeStr + '</span>';
  }
  var db = document.getElementById('day-badge');
  if (db) {
    var dn = getDayNum();
    db.textContent = dn > 0 ? 'DAY ' + dn : 'READY';
    db.style.color = dn > 0 ? 'var(--fire)' : 'var(--sub)';
  }
}
function getDayNum() {
  var p = DB.profile();
  if (!p.startDate) return 0;
  var start = new Date(p.startDate + 'T00:00:00');
  var now = new Date();
  if (isNaN(start.getTime())) return 0;
  var diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(diff, 1), 90);
}
function getWorkoutType(dayName) { return DAY_WORKOUT_TYPE[dayName] || 'rest'; }
function todayWorkoutType() { return getWorkoutType(todayDay()); }

function showToast(msg, dur, type) {
  if (!dur) dur = 2500;
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = '';
  if (type === 'success') t.classList.add('toast-success');
  else if (type === 'error') t.classList.add('toast-error');
  else if (type === 'info') t.classList.add('toast-info');
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(function () { t.classList.remove('show'); }, dur);
}

function calcStreak() {
  var streak = 0;
  var d = new Date();
  var MEAL_IDS = ['pregym', 'postworkout', 'lunch', 'dinner', 'supp_snack'];
  for (var i = 0; i < 90; i++) {
    var dStr = toLocalDate(d);
    var meals = DB.getMeal(dStr);
    var hasActivity = false;
    MEAL_IDS.forEach(function (id) { if (meals[id] === true) hasActivity = true; });
    var wk = DB.getWorkout(dStr);
    if (wk.completed) hasActivity = true;
    if (DB.getWater(dStr) > 0) hasActivity = true;
    if (!hasActivity && i > 0) break;
    if (hasActivity) streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

/* ── Workout Image Mapper ────────────────────── */
function getExerciseImage(name) {
  var map = {
    "Jumping Jacks": "Jumping Jacks.gif",
    "Arm Circles": "Arm Circles.gif",
    "Torso Twists": "Torso Twists.gif",
    "Lat Pulldown": "Lat Pulldown.gif",
    "Bent-over Barbell Row": "Bent-over Rows.gif",
    "Seated Cable Row": "Seated Rows.gif",
    "Single Arm Cable Row": "Single Arm Cable Rows.gif",
    "Straight Arm Pulldown": "Straight Arm Pulldowns.gif",
    "Machine Reverse Fly": "Machine Reverse Fly.gif",
    "Barbell Curl": "Barbell Curls.gif",
    "Hammer Curl": "Hammer Curls.gif",
    "Preacher Curl": "Preacher Curls.gif",
    "Concentration Curl": "Concentration Curls.gif",
    "Rope Hammer Curl": "Rope Hammer Curls.gif",
    "Barbell Wrist Curl": "Barbell Wrist Curls.gif",
    "Reverse Wrist Curl": "Reverse Wrist Curls.gif",
    "Stair Climber": "Stair Climber.gif",
    "Treadmill Incline Walk": "Treadmill (Incline).gif",
    "Cross Trainer": "Cross Trainer.gif",
    "Flat Bench Press": "Flat Bench Press.gif",
    "Incline DB Press": "Incline DB Press.gif",
    "Decline Chest Press": "Decline Chest Press.gif",
    "Pec Deck Fly": "Pec Fly.gif",
    "Flat DB Fly": "Flat DB Fly.gif",
    "Cable Crossover": "Cable Crossover.gif",
    "Cable Pushdowns": "Cable Pushdowns.jfif",
    "Overhead DB Extension": "Overhead DB Ext.gif",
    "Skull Crushers (EZ Bar)": "Skull Crushers (EZ Bar).gif",
    "Bench Dips": "Bench Dips.jfif",
    "Rope Pushdowns": "Rope Pushdowns.gif",
    "Cable Crunches": "Cable Crunches.gif",
    "Hanging Knee Raises": "Hanging Knee Raises.gif",
    "Plank": "Plank.gif",
    "Russian Twists": "Russian Twists.gif",
    "Bicycle Crunches": "Bicycle Crunches.gif",
    "Leg Raises": "Leg Raises.gif",
    "Cycling (Warm-up)": "Cycling.gif",
    "Mobility Work": "Mobility.gif",
    "Barbell Back Squat": "Barbell Back Squat.jfif",
    "Sumo Squat": "Sumo Squats.jfif",
    "Leg Press": "Leg Press.jfif",
    "Hack Squat": "Hack Squat.gif",
    "Leg Extensions": "Leg Extensions.gif",
    "Walking Lunges": "Walking Lunges.gif",
    "Box Step-ups": "Step-ups.jfif",
    "Lying Leg Curls": "Leg Curls.jfif",
    "Seated Leg Curls": "Seated Curls.jfif",
    "Romanian Deadlift": "RDLs.webp",
    "Good Mornings": "Good Mornings.gif",
    "Standing Calf Raise": "Standing Raise.jfif",
    "Seated Calf Raise": "Seated Raise.jfif",
    "Leg Press Calf Raise": "Leg Press Calf Raise.gif",
    "Overhead Shoulder Press": "Overhead Shoulder Press.gif",
    "Dumbbell Lateral Raise": "Dumbbell Lateral Raise.gif",
    "Front Raise": "Front Raise.gif",
    "Face Pulls (Cable)": "Face Pulls (Cable).gif",
    "Fasted Walk": "Treadmill (Incline).gif",
    "Stretching / Mobility": "Mobility.gif",
    "Crunches": "Cable Crunches.gif",
    "Bodyweight Squats": "Squats.jfif",
    "Glute Bridge": "Leg Curls.jfif",
    "Leg Press": "Leg Press.jfif",
    "Bench Dips": "Bench Dips.jfif",
    "Cable Pushdowns": "Cable Pushdowns.jfif",
    "Leg Curls": "Leg Curls.jfif",
    "Seated Curls": "Seated Curls.jfif",
    "Seated Raise": "Seated Raise.jfif",
    "Standing Raise": "Standing Raise.jfif",
    "Step-ups": "Step-ups.jfif",
    "Sumo Squats": "Sumo Squats.jfif",
    "Barbell Back Squat": "Barbell Back Squat.jfif",
    "RDLs": "RDLs.webp"
  };
  var file = map[name] || (name + ".gif");
  return 'Images/' + file;
}

// ═══════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════
var currentPage = 'home';
function goPage(page) {
  var old = document.querySelector('.page.active');
  if (old) {
    old.classList.add('animating');
    setTimeout(function () {
      old.classList.remove('active', 'animating');
      _showPage(page);
    }, 200);
  } else {
    _showPage(page);
  }
}
function _showPage(page) {
  var target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    // Force reflow
    target.offsetHeight;
  }
  document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
  var btn = document.querySelector('.nav-btn[data-page="' + page + '"]');
  if (btn) btn.classList.add('active');
  document.getElementById('main-scroll').scrollTop = 0;
  currentPage = page;
  if (page === 'home') renderHome();
  else if (page === 'workout') renderWorkout(selectedWorkoutDay || todayDay());
  else if (page === 'diet') renderDiet();
  else if (page === 'water') renderWater();
  else if (page === 'progress') renderProgress();
}
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.onclick = function () { goPage(btn.dataset.page); };
  });
}

// ═══════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════
// ── helpers for home cards ──────────────────────
function getTodaySetsProgress() {
  var wType = todayWorkoutType();
  var wo = WORKOUTS[wType];
  if (!wo || !wo.groups) return { done: 0, total: 0, isRest: wType === 'rest' };

  var totalSets = 0;
  wo.groups.forEach(function (g) {
    g.exercises.forEach(function (ex) {
      if (ex.sets > 0) totalSets += ex.sets;
    });
  });

  var wkData = DB.getWorkout(today());
  var exData = wkData.exercises || {};
  var doneSets = 0;

  wo.groups.forEach(function (g) {
    g.exercises.forEach(function (ex) {
      var ed = exData[ex.id] || {};
      var setDone = ed.setDone || {};
      for (var i = 1; i <= ex.sets; i++) {
        if (setDone[i]) doneSets++;
      }
    });
  });

  return { done: doneSets, total: totalSets, isRest: wType === 'rest' };
}

function getTodayCaloriesBurned(dayName) {
  if (!dayName) dayName = todayDay();
  var wType = getWorkoutType(dayName);
  var wo = WORKOUTS[wType];
  if (!wo || !wo.groups || wType === 'rest') return { done: 0, total: 0 };

  // Calculate date for this day
  var dDt = new Date();
  dDt.setDate(dDt.getDate() - dDt.getDay() + DAY_NAMES.indexOf(dayName));
  var dStr = toLocalDate(dDt);
  var wkData = DB.getWorkout(dStr);
  var exData = wkData.exercises || {};
  var completedCalories = 0;
  var totalCalories = 0;

  // Calorie burn per set by exercise type - UPDATED WITH DAY-BY-DAY VALUES
  // PULL DAY TOTAL: 1,094 cal | PUSH DAY TOTAL: 1,061 cal | POWER DAY TOTAL: 1,306 cal
  var calorieMap = {
    // Warm-up exercises
    "Jumping Jacks": 6, "Arm Circles": 5, "Torso Twists": 5,
    "Cycling (Warm-up)": 12, "Mobility Work": 12,
    // Back exercises
    "Lat Pulldown": 11, "Bent-over Barbell Row": 12, "Seated Cable Row": 11,
    "Single Arm Cable Row": 10, "Straight Arm Pulldown": 10, "Machine Reverse Fly": 10,
    // Biceps exercises
    "Barbell Curl": 10, "Hammer Curl": 9, "Preacher Curl": 9, "Concentration Curl": 8,
    "Rope Hammer Curl": 9, "Barbell Wrist Curl": 7, "Reverse Wrist Curl": 7,
    // Chest exercises
    "Flat Bench Press": 13, "Incline DB Press": 12, "Decline Chest Press": 12,
    "Pec Deck Fly": 11, "Flat DB Fly": 10, "Cable Crossover": 10,
    // Triceps exercises
    "Cable Pushdowns": 10, "Overhead DB Extension": 11, "Skull Crushers (EZ Bar)": 11,
    "Bench Dips": 10, "Rope Pushdowns": 10,
    // Ab exercises
    "Cable Crunches": 9, "Hanging Knee Raises": 10, "Plank": 8, "Russian Twists": 9,
    "Bicycle Crunches": 9, "Leg Raises": 10, "Crunches": 8,
    // Leg exercises
    "Barbell Back Squat": 14, "Sumo Squat": 13, "Leg Press": 13, "Hack Squat": 12,
    "Leg Extensions": 11, "Walking Lunges": 12, "Box Step-ups": 11,
    "Lying Leg Curls": 12, "Seated Leg Curls": 11, "Romanian Deadlift": 13,
    "Good Mornings": 12, "Standing Calf Raise": 9, "Seated Calf Raise": 8,
    "Leg Press Calf Raise": 9,
    // Shoulder exercises
    "Overhead Shoulder Press": 12, "Dumbbell Lateral Raise": 10, "Front Raise": 10,
    "Face Pulls (Cable)": 9,
    // Cardio: 12 cal per minute (60 min = 720 cal)
    "Treadmill Incline Walk": 12
  };

  wo.groups.forEach(function (g) {
    g.exercises.forEach(function (ex) {
      var ed = exData[ex.id] || {};
      var setDone = ed.setDone || {};
      var baseCal = calorieMap[ex.name] || 10; // Default 10 cal per set

      // For time-based exercises (cardio/warmup), multiply by time in minutes
      if (ex.time && (ex.name === "Treadmill Incline Walk" || ex.name === "Cycling (Warm-up)" || ex.name === "Mobility Work")) {
        var timeMatch = ex.time.match(/(\d+)/);
        if (timeMatch) {
          var minutes = parseInt(timeMatch[1]);
          var completedSets = 0;
          var totalSets = 0;
          for (var i = 1; i <= ex.sets; i++) {
            totalSets++;
            if (setDone[i]) completedSets++;
          }
          totalCalories += totalSets * minutes * baseCal;
          completedCalories += completedSets * minutes * baseCal;
        }
      } else {
        // For rep-based exercises, calories per set
        var completedSets = 0;
        for (var i = 1; i <= ex.sets; i++) {
          totalCalories += baseCal;
          if (setDone[i]) {
            completedSets++;
            completedCalories += baseCal;
          }
        }
      }
    });
  });

  return { done: Math.round(completedCalories), total: Math.round(totalCalories) };
}

function getTodayWorkoutProgress() {
  var wType = todayWorkoutType();
  var wo = WORKOUTS[wType];
  if (!wo || !wo.groups) return { done: 0, total: 0, isRest: wType === 'rest' };
  var total = 0;
  wo.groups.forEach(function (g) { total += g.exercises.length; });
  var wkData = DB.getWorkout(today());
  var exData = wkData.exercises || {};
  var done = 0;
  wo.groups.forEach(function (g) {
    g.exercises.forEach(function (ex) {
      if (exData[ex.id] && exData[ex.id].done) done++;
    });
  });
  return { done: done, total: total, isRest: wType === 'rest' };
}

function getTodayMealSupplementProgress() {
  var MEAL_IDS = ['pregym', 'postworkout', 'lunch', 'dinner', 'supp_snack'];
  var SUPP_IDS = ['supp_fatburner', 'supp_jeera1', 'supp_tslim', 'supp_centrum', 'supp_acv1', 'supp_isab2', 'supp_gt'];
  var mealData = DB.getMeal(today());
  var mealDone = 0;
  MEAL_IDS.forEach(function (id) { if (mealData[id] === true) mealDone++; });
  var suppDone = 0;
  SUPP_IDS.forEach(function (id) { if (mealData[id] === true) suppDone++; });
  return { meals: mealDone, totalMeals: MEAL_IDS.length, supp: suppDone, totalSupp: SUPP_IDS.length };
}

function updateHomeWorkoutCard() {
  // Update workout progress card on home screen in real-time
  var wo = getTodayWorkoutProgress();
  var sp = getTodaySetsProgress();
  var wType = todayWorkoutType();
  var TYPE_COLORS = { pull: '#ff6b1a', push: '#38bdf8', power: '#a78bfa', rest: '#22c55e' };
  var woColor = wo.isRest ? 'var(--green)' : (TYPE_COLORS[wType] || 'var(--fire)');
  var woVal = wo.isRest ? '🌿' : (wo.done + '<span style="font-size:.65rem;color:var(--sub)">/' + wo.total + '</span>');
  var setsColor = sp.total > 0 ? (sp.done >= sp.total ? 'var(--green)' : '#ff6b1a') : 'var(--sub)';
  var setsVal = sp.isRest ? '—' : (sp.done + '<span style="font-size:.65rem;color:var(--sub)">/' + sp.total + '</span>');

  var statChips = document.querySelectorAll('.stat-chip');
  // Find the workout chip (usually 3rd chip - index 2)
  if (statChips[2]) {
    var val = statChips[2].querySelector('.stat-val');
    if (val) {
      val.style.color = woColor;
      val.innerHTML = woVal;
    }
  }
  // Find the sets chip (usually 6th chip - index 5)
  if (statChips[5]) {
    var setVal = statChips[5].querySelector('.stat-val');
    if (setVal) {
      setVal.style.color = setsColor;
      setVal.innerHTML = setsVal;
    }
  }
}

function updateWorkoutHeaderCalories(dayName) {
  // Update calories display in workout header
  if (!dayName) dayName = todayDay();
  var caloriesBurned = getTodayCaloriesBurned(dayName);
  var calDisplay = caloriesBurned.done + '<span style="font-size:.75rem;color:var(--sub)">/' + caloriesBurned.total + '</span>';
  var headerRight = document.querySelector('.wk-header-right');
  if (headerRight) {
    var calDiv = headerRight.querySelector('[style*="text-align:right"]');
    if (calDiv) {
      calDiv.innerHTML = '<div style="font-size:12px; opacity:0.7;">CALORIES</div><div style="font-weight:bold; color:var(--fire);">🔥 ' + calDisplay + ' cal</div>';
    }
  }
}

function weekStripHTML() {
  var todayDate = today();
  var todayDow = new Date().getDay(); // 0=sun
  var SHORT_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var TYPE_COLORS = { pull: '#ff6b1a', push: '#38bdf8', power: '#a78bfa', rest: '#22c55e' };
  var TYPE_SHORT = { pull: 'PULL', push: 'PUSH', power: 'PWR', rest: 'REST' };

  // Build week: current week Sun→Sat
  var startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - todayDow);

  var html = '<div class="week-strip">';
  for (var i = 0; i < 7; i++) {
    var dt = new Date(startOfWeek.getTime() + i * 86400000);
    var dStr = toLocalDate(dt);
    var dayName = DAY_NAMES[i]; // DAY_NAMES array: [sun,mon,...]
    var wType = getWorkoutType(dayName);
    var color = TYPE_COLORS[wType] || '#555';
    var isToday = (i === todayDow);
    var wkData = DB.getWorkout(dStr);
    var isDone = wkData.completed || false;

    html += '<div class="ws-day' + (isToday ? ' ws-today' : '') + (isDone ? ' ws-done' : '') + '">' +
      '<div class="ws-label">' + SHORT_LABELS[i] + '</div>' +
      '<div class="ws-dot" style="background:' + (isDone ? 'var(--green)' : isToday ? color : '#333') + ';border:2px solid ' + color + ';"></div>' +
      '<div class="ws-type" style="color:' + color + ';">' + TYPE_SHORT[wType] + '</div>' +
      '</div>';
  }
  html += '</div>';
  return html;
}

function renderHome() {
  try {
    var p = DB.profile();
    var d = today();
    var dayNum = getDayNum();
    var w = DB.getWater(d);
    var goal = p.waterGoal || 10;
    var ML = 250;
    var curL = (w * ML / 1000).toFixed(2);
    var weights = DB.weights().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var lastWt = weights.length ? weights[weights.length - 1].kg : null;
    var prevWt = weights.length > 1 ? weights[weights.length - 2].kg : null;
    var wtDelta = (lastWt && prevWt) ? (lastWt - prevWt).toFixed(1) : null;
    var wtDeltaStr = wtDelta ? (parseFloat(wtDelta) > 0 ? '+' + wtDelta : wtDelta) + ' kg' : '';
    var wtDeltaColor = wtDelta && parseFloat(wtDelta) <= 0 ? 'var(--green)' : 'var(--red)';

    // BMI calculation
    var h_cm = parseFloat(p.height || 0);
    var bmi = (h_cm > 0 && lastWt) ? (lastWt / Math.pow(h_cm / 100, 2)).toFixed(1) : null;
    var bmiColor = bmi ? (bmi < 18.5 ? 'var(--blue)' : bmi < 25 ? 'var(--green)' : bmi < 30 ? 'var(--gold)' : 'var(--red)') : 'var(--sub)';

    // Streak
    var streak = calcStreak();

    var pct = Math.round((dayNum / 90) * 100);
    var wo = getTodayWorkoutProgress();
    var sp = getTodaySetsProgress();
    var ms = getTodayMealSupplementProgress();

    var wType = todayWorkoutType();
    var TYPE_COLORS = { pull: '#ff6b1a', push: '#38bdf8', power: '#a78bfa', rest: '#22c55e' };
    var TYPE_LABELS = { pull: '💪 PULL DAY', push: '🏋️ PUSH DAY', power: '⚡ POWER DAY', rest: '🌿 REST DAY' };
    var woColor = wo.isRest ? 'var(--green)' : (TYPE_COLORS[wType] || 'var(--fire)');
    var woVal = wo.isRest ? '🌿' : (wo.done + '<span style="font-size:.65rem;color:var(--sub)">/' + wo.total + '</span>');
    var woLabel = wo.isRest ? 'REST DAY' : '🏋️ WORKOUT';

    var isChallengeActive = dayNum > 0;
    var pct = isChallengeActive ? Math.round((dayNum / 90) * 100) : 0;
    var daysLeft = Math.max(0, 90 - dayNum);

    var mealPct = ms.totalMeals > 0 ? Math.round((ms.meals / ms.totalMeals) * 100) : 0;
    var mealColor = mealPct >= 100 ? 'var(--green)' : mealPct > 0 ? 'var(--gold)' : 'var(--sub)';
    var suppPct = ms.totalSupp > 0 ? Math.round((ms.supp / ms.totalSupp) * 100) : 0;
    var suppColor = suppPct >= 100 ? 'var(--green)' : suppPct > 0 ? '#a78bfa' : 'var(--sub)';

    var setsPct = sp.total > 0 ? Math.round((sp.done / sp.total) * 100) : 0;
    var setsColor = setsPct >= 100 ? 'var(--green)' : setsPct > 0 ? '#ff6b1a' : 'var(--sub)';
    var setsVal = sp.isRest ? '—' : (sp.done + '<span style="font-size:.65rem;color:var(--sub)">/' + sp.total + '</span>');

    // Daily motivation (cycle by day number or date)
    var motIdx = dayNum > 0 ? (dayNum - 1) % DAILY_MOTIVATIONS.length : (new Date().getDate() % DAILY_MOTIVATIONS.length);
    var motivation = DAILY_MOTIVATIONS[motIdx] || DAILY_MOTIVATIONS[0];

    // Workout type pill color
    var wTypeColor = TYPE_COLORS[wType] || '#555';
    var wTypeLabel = TYPE_LABELS[wType] || wType.toUpperCase();

    var notifAlert = '';
    if (window.Notification && Notification.permission !== 'granted') {
      notifAlert = '<div onclick="requestNotifPermission()" class="haptic-press" style="margin:16px 16px 24px 16px;background:rgba(255,107,26,0.15);border:1px dashed var(--fire);border-radius:12px;padding:12px;text-align:center;cursor:pointer;">' +
        '<div style="font-size:.7rem;font-weight:700;color:var(--fire);letter-spacing:1px;text-transform:uppercase;">🔔 ENABLE STRICT REMINDERS</div>' +
        '<div style="font-size:.6rem;color:var(--sub);margin-top:2px;">Get alerts for meals, water &amp; weight logs</div>' +
        '</div>';
    }

    var mas = getMetabolicAdaptabilityScore();
    var phase = getMetabolicPhase();
    var hudClass = phase === 'FASTED OXIDATION' ? 'hud-border-fasted' : (phase === 'ANABOLIC REPAIR' ? 'hud-border-anabolic' : 'hud-border-recovery');

    document.getElementById('page-home').innerHTML =
      notifAlert +

      // Challenge Ring Card
      '<div class="challenge-ring-card tilt-card ' + hudClass + '">' +
      '<svg class="ring-svg" width="70" height="70" viewBox="0 0 72 72">' +
      '<circle cx="36" cy="36" r="30" fill="none" stroke="#222" stroke-width="5"/>' +
      '<circle cx="36" cy="36" r="30" fill="none" stroke="#ff6b1a" stroke-width="5"' +
      ' stroke-dasharray="' + (2 * Math.PI * 30) + '" stroke-dashoffset="' + (2 * Math.PI * 30 * (1 - pct / 100)) + '"' +
      ' transform="rotate(-90 36 36)"/>' +
      '<text x="36" y="42" text-anchor="middle" fill="#fff" font-family="Bebas Neue" font-size="16">' + (isChallengeActive ? pct + '%' : '—') + '</text>' +
      '</svg>' +
      '<div class="ring-info">' +
      (isChallengeActive ?
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<div class="ring-day-num">DAY ' + dayNum + '</div>' +
        '<span style="font-size:.55rem;font-weight:900;padding:3px 8px;border-radius:20px;background:' + wTypeColor + '22;color:' + wTypeColor + ';border:1px solid ' + wTypeColor + '44;letter-spacing:1px;">' + wTypeLabel + '</span>' +
        '</div>' +
        (streak > 1 ? '<div style="font-size:.6rem;color:var(--gold);letter-spacing:1px;margin:2px 0;">🔥 ' + streak + '-DAY STREAK</div>' : '<div class="ring-day-of">' + daysLeft + ' DAYS TO GO</div>') +
        '<div class="ring-progress-bar"><div class="ring-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="challenge-actions">' +
        '<button class="challenge-btn restart-btn" onclick="event.stopPropagation();restartChallenge()">🔄 RESTART</button>' +
        '<button class="challenge-btn reset-btn" onclick="event.stopPropagation();resetChallenge()">⚠️ RESET</button>' +
        '</div>'
        :
        '<div class="ring-day-num" style="font-size:1.8rem;">CHALLENGE READY</div>' +
        '<div class="ring-day-of">TAP BELOW TO START DAY 1</div>' +
        '<div class="challenge-actions">' +
        '<button class="challenge-btn start-btn" onclick="event.stopPropagation();startChallenge()">🚀 START CHALLENGE</button>' +
        '</div>'
      ) +
      '</div>' +
      '</div>' +

      // Quick Stats Chips
      '<div class="quick-stats">' +
      // Water chip — shows glasses
      '<div class="stat-chip tilt-card" onclick="quickWaterAdd()">' +
      '<div class="stat-val" style="color:var(--blue)">' + w + '<span style="font-size:.65rem">/' + goal + '</span></div>' +
      '<div class="stat-label">💧 WATER</div>' +
      '</div>' +
      // Weight chip — shows kg
      '<div class="stat-chip tilt-card" onclick="editWeight()">' +
      '<div class="stat-val" style="color:var(--gold)">' + (lastWt || '<span style="font-size:.8rem;color:var(--sub)">TAP</span>') + '</div>' +
      '<div class="stat-label">⚖️ KG</div>' +
      '</div>' +
      // Workout chip
      '<div class="stat-chip tilt-card" onclick="goPage(\'workout\')">' +
      '<div class="stat-val" style="color:' + woColor + '">' + woVal + '</div>' +
      '<div class="stat-label">' + woLabel + '</div>' +
      '</div>' +
      // Meals chip
      '<div class="stat-chip tilt-card" onclick="goPage(\'diet\')">' +
      '<div class="stat-val" style="color:' + mealColor + '">' + ms.meals + '<span style="font-size:.65rem;color:var(--sub)">/' + ms.totalMeals + '</span></div>' +
      '<div class="stat-label">🍱 MEALS</div>' +
      '</div>' +
      // Supps chip
      '<div class="stat-chip tilt-card" onclick="goPage(\'diet\')">' +
      '<div class="stat-val" style="color:' + suppColor + '">' + ms.supp + '<span style="font-size:.65rem;color:var(--sub)">/' + ms.totalSupp + '</span></div>' +
      '<div class="stat-label">🌿 SUPPS</div>' +
      '</div>' +
      // Sets chip
      '<div class="stat-chip tilt-card" onclick="goPage(\'workout\')">' +
      '<div class="stat-val" style="color:' + setsColor + '">' + setsVal + '</div>' +
      '<div class="stat-label">💪 SETS</div>' +
      '</div>' +
      '</div>' +

      weekStripHTML() +
      '<div class="section">' +
      '<div class="sec-h"><div class="sec-h-title">⏰ TODAY\'S TIMELINE</div>' +
      '<div id="metabolic-status" style="font-size:0.6rem; color:var(--gold); letter-spacing:1.5px; margin-left:auto;">' + getMetabolicPhase() + '</div>' +
      '</div>' +
      scheduleHTML() +
      '</div>';
  } catch (err) {
    console.error('[FitOS] renderHome Error:', err);
    document.getElementById('page-home').innerHTML = '<div style="padding:40px;text-align:center;color:var(--fire);font-weight:700;">⚠ LOADING ERROR<br><div style="font-size:.7rem;font-weight:400;color:var(--sub);margin-top:10px;">Please hard refresh (Ctrl+F5) to fix cache. Details: ' + err.message + '</div></div>';
  }
}


function scheduleHTML() {
  var mealData = DB.getMeal(today());
  var rows = DAILY_TIMELINE;

  return rows.map(function (r, idx) {
    var status = mealData[r.id];
    var isDone = status === true;
    var isSkipped = status === 'skipped';

    if (!r.id && r.a && r.a.indexOf('GYM') !== -1) {
      var wProg = getTodayWorkoutProgress();
      if (!wProg.isRest && wProg.done >= wProg.total && wProg.total > 0) {
        isDone = true;
      }
    }

    var bgColor = isDone ? 'rgba(34,197,94,0.08)' : (isSkipped ? 'rgba(239,68,68,0.08)' : 'var(--card)');
    var borderColor = isDone ? 'var(--green)' : (isSkipped ? 'var(--red)' : 'var(--border)');
    var textColor = isDone ? 'var(--green)' : (isSkipped ? 'var(--red)' : 'var(--text)');

    var doneBtn = r.id ? '<button onclick="event.stopPropagation();toggleItemStatus(\'' + r.id + '\')" style="flex-shrink:0;background:' + (isDone ? 'var(--green)' : 'transparent') + ';border:1px solid ' + (isDone ? 'var(--green)' : '#333') + ';color:' + (isDone ? '#000' : '#555') + ';border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:.8rem;">✓</button>' : '';
    var skipBtn = r.id ? '<button onclick="event.stopPropagation();toggleSkipStatus(\'' + r.id + '\')" style="flex-shrink:0;background:' + (isSkipped ? 'var(--red)' : 'transparent') + ';border:1px solid ' + (isSkipped ? 'var(--red)' : '#333') + ';color:' + (isSkipped ? '#fff' : '#555') + ';border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:.7rem;">✕</button>' : '';
    var btns = r.id ? '<div style="display:flex;gap:4px;">' + doneBtn + skipBtn + '</div>' : '';

    var isExpanded = r.id && (EXPANDED_MEAL_ID === r.id);
    var dayName = todayDay();
    var detailText = (r.id && WEEKLY_MEALS[dayName]) ? WEEKLY_MEALS[dayName][r.id] : '';
    var expandHtml = (isExpanded && detailText) ? '<div class="meal-expanded-content">' + detailText + '</div>' : '';

    var clickAction = r.id ? 'toggleMealDetail(\'' + r.id + '\')' : (r.name && r.name.indexOf('GYM') !== -1 ? 'goPage(\'workout\')' : '');
    // Using a more robust check for GYM workout
    if (!r.id && r.a && r.a.indexOf('GYM') !== -1) clickAction = "goPage('workout')";

    var rowId = 'row-home-' + (r.id || idx);
    var windowTag = getSmartWindowTag(r.t);
    var windowHtml = windowTag ? '<div class="smart-window-tag" style="font-size:0.55rem; color:var(--fire); letter-spacing:1.5px; margin-bottom:4px; font-weight:900; text-shadow:0 0 8px var(--fire-glow);">⚡ ' + windowTag + '</div>' : '';

    return '<div id="' + rowId + '" onclick="' + clickAction + '" class="stagger-item haptic-press tilt-card" style="animation-delay:' + (idx * 0.05) + 's;cursor:pointer;background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:10px;margin-bottom:6px;padding:12px;display:flex;flex-direction:column;gap:4px;transition:transform 0.3s cubic-bezier(0.3, 1, 0.3, 1);">' +
      windowHtml +
      '<div style="display:flex;align-items:center;gap:8px;">' +
      '<div style="min-width:68px;font-size:.6rem;font-family:JetBrains Mono,monospace;color:var(--sub);line-height:1.3;">' + r.t + '</div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div id="title-home-' + r.id + '" style="font-size:.78rem;font-weight:600;color:' + textColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + r.a + '</div>' +
      '<div style="font-size:.62rem;color:var(--sub);margin-top:1px;">' + r.d + '</div>' +
      '</div>' +
      btns +
      '</div>' +
      expandHtml +
      '</div>';
  }).join('');
}

function toggleMealDetail(id) {
  if (!id) return;
  var oldId = EXPANDED_MEAL_ID;
  EXPANDED_MEAL_ID = (EXPANDED_MEAL_ID === id) ? null : id;

  // Surgical Update: Collapse old, Expand new
  if (oldId) {
    var oldContentHome = document.querySelector('#row-home-' + oldId + ' .meal-expanded-content');
    if (oldContentHome) oldContentHome.remove();
    var oldContentDiet = document.querySelector('#row-diet-' + oldId + ' .meal-expanded-content');
    if (oldContentDiet) oldContentDiet.remove();
  }

  if (EXPANDED_MEAL_ID) {
    var dayName = todayDay();
    var detailText = (WEEKLY_MEALS[dayName] && WEEKLY_MEALS[dayName][id]) ? WEEKLY_MEALS[dayName][id] : (DAILY_SUPPLEMENTS[id] || '');
    if (detailText) {
      var htmlContent = '<div class="meal-expanded-content">' + detailText + '</div>';
      var rowHome = document.getElementById('row-home-' + id);
      if (rowHome) rowHome.insertAdjacentHTML('beforeend', htmlContent);
      var rowDiet = document.getElementById('row-diet-' + id);
      if (rowDiet) rowDiet.insertAdjacentHTML('beforeend', htmlContent);
    }
  }
}

// ── AI MIND EVOLUTION HELPERS ──
function getMetabolicPhase() {
  var h = new Date().getHours();
  if (h >= 5 && h < 11) return 'FASTED OXIDATION';
  if (h >= 11 && h < 17) return 'GLYCOGEN LOADING';
  if (h >= 17 && h < 22) return 'ANABOLIC REPAIR';
  return 'DEEP RECOVERY';
}

function getSmartWindowTag(timeStr) {
  var t = timeStr.toUpperCase().replace(/\s/g, '');
  if (t === '3:15AM') return "LIPID BURNING WINDOW";
  if (t === '12:10PM') return "FASTED DETOX PHASE";
  if (t === '1:15PM') return "ANABOLIC PROTEIN WINDOW";
  if (t === '4:30PM') return "METABOLIC ACCELERATOR";
  if (t === '5:00PM') return "ANABOLIC REPAIR PHASE";
  return null;
}

function getMetabolicAdaptabilityScore() {
  var d = today();
  var p = DB.profile();
  var w = DB.getWater(d);
  var wGoal = p.waterGoal || 10;
  var waterScore = Math.min((w / wGoal) * 100, 100);

  var meals = DB.getMeal(d);
  var mealsDone = 0;
  // Account for actual meals only
  var targetMeals = ['pregym', 'postworkout', 'lunch', 'dinner', 'supp_snack'];
  targetMeals.forEach(function (m) { if (meals[m] === true) mealsDone++; });
  var mealScore = (mealsDone / targetMeals.length) * 100;

  var workout = DB.getWorkout(d);
  var workoutScore = 0;
  var wType = todayWorkoutType();
  if (wType === 'rest') {
    workoutScore = 100;
  } else {
    // Check if workout is completed or at least partially done
    if (workout.completed) {
      workoutScore = 100;
    } else {
      var prog = getTodayWorkoutProgress();
      if (prog.total > 0) workoutScore = (prog.done / prog.total) * 100;
    }
  }

  var mas = Math.round((waterScore * 0.3) + (mealScore * 0.4) + (workoutScore * 0.3));
  return Math.min(Math.max(mas, 0), 100);
}

function getCyberDiagnostics() {
  var h = new Date().getHours();
  var phase = getMetabolicPhase();
  var logs = [];

  if (phase === 'FASTED OXIDATION') {
    logs.push("SYS.METABOLIC > LIPID_BURN: ACTIVE [MAX]");
    logs.push("SYS.CORE > CORTISOL: SPIKING [ALERT]");
  } else if (phase === 'GLYCOGEN LOADING') {
    logs.push("SYS.METABOLIC > INSULIN: SENSITIVE");
    logs.push("SYS.CORE > NUTRIENT_DRIVE: PEAK");
  } else if (phase === 'ANABOLIC REPAIR') {
    logs.push("SYS.METABOLIC > REPAIR_MODE: ENGAGED");
    logs.push("SYS.CORE > GH_RELEASE: COMMENCING");
  } else {
    logs.push("SYS.METABOLIC > REST_CYCLE: ACTIVE");
    logs.push("SYS.CORE > AUTOPHAGY: DETECTED");
  }

  var wProg = getTodayWorkoutProgress();
  if (wProg.total > 0 && wProg.done < wProg.total) {
    logs.push("SYS.FORCE > NEURAL_READY: 100% [GO HARD]");
  } else if (wProg.total > 0 && wProg.done >= wProg.total) {
    logs.push("SYS.FORCE > NEURAL_FATIGUE: DETECTED [RECOVER]");
  }

  return logs;
}




function toggleItemStatus(id) {
  var d = today();
  var mealData = DB.getMeal(d);
  var cur = mealData[id];
  var newVal = cur === true ? false : true;
  DB.setMealItem(d, id, newVal);

  // Surgical Update: Home
  var rowHome = document.getElementById('row-home-' + id);
  if (rowHome) {
    var isDone = newVal === true;
    rowHome.style.background = isDone ? 'rgba(34,197,94,0.08)' : 'var(--card)';
    rowHome.style.borderColor = isDone ? 'var(--green)' : 'var(--border)';
    var title = document.getElementById('title-home-' + id);
    if (title) title.style.color = isDone ? 'var(--green)' : 'var(--text)';
    var btn = rowHome.querySelector('button[onclick*="toggleItemStatus"]');
    if (btn) {
      btn.style.background = isDone ? 'var(--green)' : 'transparent';
      btn.style.borderColor = isDone ? 'var(--green)' : '#333';
      btn.style.color = isDone ? '#000' : '#555';
    }
  }

  // Surgical Update: Diet
  var rowDiet = document.getElementById('row-diet-' + id);
  if (rowDiet) {
    var isDone = newVal === true;
    rowDiet.style.background = isDone ? 'rgba(34,197,94,0.07)' : 'var(--card)';
    rowDiet.style.borderColor = isDone ? 'rgba(34,197,94,0.35)' : 'var(--border)';
    var titleD = document.getElementById('title-diet-' + id);
    if (titleD) {
      titleD.style.color = isDone ? 'var(--sub)' : 'var(--text)';
      titleD.style.textDecoration = isDone ? 'line-through' : 'none';
    }
    var btnD = rowDiet.querySelector('div[onclick*="toggleItemStatus"]');
    if (btnD) {
      btnD.style.background = isDone ? 'var(--green)' : 'transparent';
      btnD.style.borderColor = isDone ? 'var(--green)' : '#333';
      btnD.style.color = isDone ? '#000' : 'transparent';
    }
  }

  updateHomeStats();
}

function toggleSkipStatus(id) {
  var d = today();
  var mealData = DB.getMeal(d);
  var cur = mealData[id];
  var newVal = cur === 'skipped' ? false : 'skipped';
  DB.setMealItem(d, id, newVal);

  // Surgical Update: Home
  var rowHome = document.getElementById('row-home-' + id);
  if (rowHome) {
    var isSkipped = newVal === 'skipped';
    rowHome.style.background = isSkipped ? 'rgba(239,68,68,0.08)' : 'var(--card)';
    rowHome.style.borderColor = isSkipped ? 'var(--red)' : 'var(--border)';
    var title = document.getElementById('title-home-' + id);
    if (title) title.style.color = isSkipped ? 'var(--red)' : 'var(--text)';
    var btnS = rowHome.querySelector('button[onclick*="toggleSkipStatus"]');
    if (btnS) {
      btnS.style.background = isSkipped ? 'var(--red)' : 'transparent';
      btnS.style.borderColor = isSkipped ? 'var(--red)' : '#333';
      btnS.style.color = isSkipped ? '#fff' : '#555';
    }
  }

  // Surgical Update: Diet
  var rowDiet = document.getElementById('row-diet-' + id);
  if (rowDiet) {
    var isSkipped = newVal === 'skipped';
    rowDiet.style.background = isSkipped ? 'rgba(239,68,68,0.07)' : 'var(--card)';
    rowDiet.style.borderColor = isSkipped ? 'rgba(239,68,68,0.35)' : 'var(--border)';
    var titleD = document.getElementById('title-diet-' + id);
    if (titleD) {
      titleD.style.color = isSkipped ? 'var(--sub)' : 'var(--text)';
      titleD.style.textDecoration = isSkipped ? 'line-through' : 'none';
    }
    var btnD = rowDiet.querySelector('div[onclick*="toggleSkipStatus"]');
    if (btnD) {
      btnD.style.borderColor = isSkipped ? 'var(--red)' : '#333';
      btnD.style.background = isSkipped ? 'var(--red)' : 'transparent';
      btnD.style.color = isSkipped ? '#fff' : 'transparent';
    }
  }

  updateHomeStats();
}

function updateHomeStats() {
  if (currentPage !== 'home') return;
  var d = today();
  var dayNum = getDayNum();
  var pct = dayNum > 0 ? Math.round((dayNum / 90) * 100) : 0;
  var ms = getTodayMealSupplementProgress();

  // Update Ring
  var ringFill = document.querySelector('.ring-progress-fill');
  if (ringFill) ringFill.style.width = pct + '%';

  // Update Stats Chips
  var chips = document.querySelectorAll('.stat-chip');
  if (chips.length >= 5) {
    // Meal Chip
    var mPct = ms.totalMeals > 0 ? Math.round((ms.meals / ms.totalMeals) * 100) : 0;
    var mColor = mPct >= 100 ? 'var(--green)' : mPct > 0 ? 'var(--gold)' : 'var(--sub)';
    chips[3].querySelector('.stat-val').style.color = mColor;
    chips[3].querySelector('.stat-val').innerHTML = ms.meals + '<span style="font-size:.65rem;color:var(--sub)">/' + ms.totalMeals + '</span>';

    // Supp Chip
    var sPct = ms.totalSupp > 0 ? Math.round((ms.supp / ms.totalSupp) * 100) : 0;
    var sColor = sPct >= 100 ? 'var(--green)' : sPct > 0 ? '#a78bfa' : 'var(--sub)';
    chips[4].querySelector('.stat-val').style.color = sColor;
    chips[4].querySelector('.stat-val').innerHTML = ms.supp + '<span style="font-size:.65rem;color:var(--sub)">/' + ms.totalSupp + '</span>';
  }
}

function quickWaterAdd() {
  var t = today();
  var cur = DB.getWater(t);
  var newVal = cur + 1;
  var p = DB.profile();
  var goal = p.waterGoal || 10;
  var ML = 250;
  var newL = (newVal * ML / 1000).toFixed(2);
  DB.setWater(t, newVal);
  var pct = Math.min(Math.round((newVal / goal) * 100), 100);
  showToast('💧 Glass ' + newVal + ' / ' + goal + '  (' + newL + ' L)  ' + pct + '%', 2500, 'info');

  // Surgical Update
  if (currentPage === 'home') {
    var chips = document.querySelectorAll('.stat-chip');
    if (chips[0]) {
      var goalL = (goal * ML / 1000).toFixed(1);
      chips[0].querySelector('.stat-val').innerHTML = newVal + '<span style="font-size:.65rem">/' + goal + '</span>';
      var sub = chips[0].querySelector('.stat-sub');
      if (sub) sub.innerHTML = newL + ' L';
    }
  }
}

function quickWeightLog() {
  openModal(
    '<div class="modal-title">⚖️ LOG WEIGHT</div>' +
    '<input class="modal-input" id="modal-wt" type="number" step="0.1" placeholder="Current weight in kg..."/>' +
    '<button class="modal-btn primary" onclick="saveWt()">SAVE</button>'
  );
}
function saveWt() {
  var v = parseFloat(document.getElementById('modal-wt').value);
  if (v > 30) {
    DB.addWeight(today(), v);
    closeModal();
    showToast('⚖️ Weight logged!');
    // Automatic BMI recalculation logic
    if (currentPage === 'progress') renderProgress();

    // Surgical Update
    if (currentPage === 'home') {
      var chips = document.querySelectorAll('.stat-chip');
      if (chips[1]) {
        chips[1].querySelector('.stat-val').textContent = v;
      }
    }
  }
}

function quickStepsLog() {
  openModal(
    '<div class="modal-title">👣 LOG STEPS</div>' +
    '<input class="modal-input" id="modal-steps" type="number" placeholder="Today\'s steps..."/>' +
    '<button class="modal-btn primary" onclick="saveSteps()">SAVE</button>'
  );
}
function saveSteps() {
  var v = parseInt(document.getElementById('modal-steps').value);
  if (v >= 0) { DB.setSteps(today(), v); closeModal(); renderHome(); showToast('👣 Steps logged!'); }
}

// ═══════════════════════════════════════════════
// WORKOUT PAGE
// ═══════════════════════════════════════════════
var selectedWorkoutDay = '';

function renderWorkout(day) {
  if (!selectedWorkoutDay) selectedWorkoutDay = todayDay();
  selectedWorkoutDay = day;
  var wType = getWorkoutType(day);
  var wo = WORKOUTS[wType];

  var dDt = new Date();
  dDt.setDate(dDt.getDate() - dDt.getDay() + DAY_NAMES.indexOf(day));
  var dStr = toLocalDate(dDt);
  var wkData = DB.getWorkout(dStr);
  var isDone = wkData.completed || false;

  var tabsHtml = DAY_NAMES.map(function (d) {
    var dtT = new Date();
    dtT.setDate(dtT.getDate() - dtT.getDay() + DAY_NAMES.indexOf(d));
    var dsT = toLocalDate(dtT);
    var dwT = DB.getWorkout(dsT);
    var cls = 'day-tab';
    if (d === day) cls += ' active';
    else if (dwT.completed) cls += ' done';
    return '<div class="' + cls + '" onclick="renderWorkout(\'' + d + '\')">' + DAY_SHORT[DAY_NAMES.indexOf(d)] + '</div>';
  }).join('');

  document.getElementById('page-workout').innerHTML =
    '<div class="day-tabs">' + tabsHtml + '</div>' +
    (wType === 'rest' ? renderRestDay() : renderWorkoutDay(day, dStr, wo, wkData, isDone));
}

function renderWorkoutDay(day, dStr, wo, wkData, isDone) {
  var exData = wkData.exercises || {};
  var groupsHtml = '';

  wo.groups.forEach(function (group) {
    var exHtml = group.exercises.map(function (ex, idx) {
      var ed = exData[ex.id] || {};
      var done = ed.done || false;
      var badge = ex.time ? ex.time : (ex.sets + 'x' + (ex.reps || '?'));
      var setsHtml = '';

      // Auto-suggestion logic
      var suggestedWeight = '';
      if (ex.logWeight !== false && !ex.time) {
        var prevWeights = DB.weights().filter(w => w.exId === ex.id);
        if (prevWeights.length > 0) {
          var lastW = prevWeights[prevWeights.length - 1].kg;
          var sug = (lastW * 1.025).toFixed(1); // 2.5% progression
          suggestedWeight = '<div class="suggested-weight">NEXT GOAL: ' + sug + 'kg</div>';
        }
      }

      if (ex.sets > 0) {
        for (var s = 1; s <= ex.sets; s++) {
          var sw = (ed.setWeights || {})[s] || '';
          var sr = (ed.setRpes || {})[s] || '';
          var isSetDone = (ed.setDone || {})[s] || false;
          var showWeight = ex.logWeight !== false;

          var inputs = '';

          setsHtml += '<div class="set-row">' +
            '<div class="set-check' + (isSetDone ? ' done' : '') + '" id="chk-' + ex.id + '-' + s + '" onclick="event.stopPropagation();toggleSetDone(\'' + dStr + '\',\'' + ex.id + '\',' + s + ')">✓</div>' +
            '<div class="set-num">SET ' + s + '</div>' +
            '<div class="set-reps">' + (ex.reps ? ex.reps + ' REPS' : ex.time) + (suggestedWeight && s === 1 ? suggestedWeight : '') + '</div>' +
            inputs +
            '</div>';
        }
      }
      return '<div class="exercise-row stagger-item tilt-card' + (done ? ' ex-done' : '') + '" id="ex-' + dStr + '-' + ex.id + '" style="animation-delay:' + (idx * 0.05) + 's;">' +
        '<div class="ex-header haptic-press" onclick="toggleExerciseBody(\'' + dStr + '\',\'' + ex.id + '\')">' +
        '<div class="ex-name">' + ex.name + '</div>' +
        '<div class="ex-badge">' + (done ? '✓ ' : '') + badge + '</div>' +
        '<div class="ex-expand" id="exp-' + dStr + '-' + ex.id + '">▼</div>' +
        '</div>' +
        '<div class="ex-body" id="body-' + dStr + '-' + ex.id + '">' +
        '<img data-src="' + getExerciseImage(ex.name) + '" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="workout-img" loading="lazy" />' +
        '<div class="ex-cue">⚡ CUE: ' + getExerciseCue(ex.name) + '</div>' +
        setsHtml +
        '</div>' +
        '</div>';
    }).join('');
    groupsHtml += '<div class="muscle-group"><div class="muscle-label">' + group.icon + ' ' + group.name + '</div>' + exHtml + '</div>';
  });

  var caloriesBurned = getTodayCaloriesBurned(day);
  var calDisplay = caloriesBurned.done + '<span style="font-size:.75rem;color:var(--sub)">/' + caloriesBurned.total + '</span>';
  return '<div class="wk-header">' +
    '<div class="wk-header-left"><div class="wk-type" style="color:var(--fire)">' + wo.short + '</div><div class="wk-name">' + wo.label + '</div></div>' +
    '<div class="wk-header-right" style="display:flex; gap:15px; align-items:center; font-size:14px;">' +
    '<div style="text-align:right;"><div style="font-size:12px; opacity:0.7;">CALORIES</div><div style="font-weight:bold; color:var(--fire);">🔥 ' + calDisplay + ' cal</div></div>' +
    '</div>' +
    '</div>' + groupsHtml;
}

function renderRestDay() {
  return '<div class="rest-day-card tilt-card"><span class="rest-emoji">🌿</span><div class="rest-day-title">REST & RECOVERY</div><div class="rest-day-desc">Active recovery or home stretching recommended.</div></div>';
}

function toggleExerciseBody(dStr, exId) {
  var body = document.getElementById('body-' + dStr + '-' + exId);
  var exp = document.getElementById('exp-' + dStr + '-' + exId);

  if (!body) return;

  var isOpen = body.classList.contains('open');

  // Accordion logic: Close all other open exercise bodies in the current day
  var allBodies = document.querySelectorAll('.ex-body.open');
  allBodies.forEach(function (otherBody) {
    if (otherBody !== body) {
      otherBody.classList.remove('open');
      // Update its icon to ▼
      var otherIdSplit = otherBody.id.split('-');
      var otherId = otherIdSplit.slice(1).join('-'); // handles multiple dashes in dStr
      var otherExp = document.getElementById('exp-' + otherId);
      if (otherExp) otherExp.textContent = '▼';
    }
  });

  // Toggle current body
  if (isOpen) {
    body.classList.remove('open');
    if (exp) exp.textContent = '▼';
  } else {
    body.classList.add('open');
    if (exp) exp.textContent = '▲';

    // Lazy load GIF: Copy data-src to src
    var img = body.querySelector('.workout-img');
    if (img && img.dataset.src) {
      img.src = img.dataset.src;
    }
  }
}

function toggleSetDone(dStr, exId, setNum) {
  var wkData = DB.getWorkout(dStr);
  var exData = (wkData.exercises || {})[exId] || {};
  var setDone = exData.setDone || {};
  var nowSetDone = !setDone[setNum];
  setDone[setNum] = nowSetDone;

  if (nowSetDone) {
    var sw = (exData.setWeights || {})[setNum] || 0;
    if (sw > 0) {
      DB.addExWeight(exId, sw);
      // Calculate 1RM and store if reps exist
      var workouts = WORKOUTS[getWorkoutType(selectedWorkoutDay)];
      var exObj = null;
      workouts.groups.forEach(function (g) {
        g.exercises.forEach(function (e) { if (e.id === exId) exObj = e; });
      });
      if (exObj && exObj.reps) {
        var onerm = NeuralCore.calc1RM(sw, exObj.reps);
        var exOnerms = DB.getAdvanced('exOnerms') || {};
        exOnerms[exId] = onerm;
        DB.setAdvanced('exOnerms', exOnerms);
      }
    }
  }

  DB.setExercise(dStr, exId, { setDone: setDone });

  // Update set UI
  var chk = document.getElementById('chk-' + exId + '-' + setNum);
  if (chk) chk.classList.toggle('done', nowSetDone);

  // Check if all sets are done to finish the whole exercise
  var totalSets = 0;
  var workouts = WORKOUTS[getWorkoutType(selectedWorkoutDay)];
  workouts.groups.forEach(function (g) {
    g.exercises.forEach(function (e) {
      if (e.id === exId) totalSets = e.sets;
    });
  });

  var doneCount = 0;
  for (var i = 1; i <= totalSets; i++) {
    if (setDone[i]) doneCount++;
  }

  var allDone = (doneCount === totalSets && totalSets > 0);
  DB.setExercise(dStr, exId, { done: allDone });

  // Update main card visual
  var row = document.getElementById('ex-' + dStr + '-' + exId);
  if (row) {
    row.classList.toggle('ex-done', allDone);
    var badge = row.querySelector('.ex-badge');
    if (badge) {
      var workouts = WORKOUTS[getWorkoutType(selectedWorkoutDay)];
      var exObj = null;
      workouts.groups.forEach(function (g) {
        g.exercises.forEach(function (e) { if (e.id === exId) exObj = e; });
      });
      var baseText = exObj.time ? exObj.time : (exObj.sets + 'x' + (exObj.reps || '?'));
      badge.textContent = (allDone ? '✓ ' : '') + baseText;
    }
  }

  if (allDone) {
    showToast('🔥 Exercise Complete!');
    // Update home screen workout card in real-time
    setTimeout(function () {
      updateHomeWorkoutCard();
      // Also update calorie display in workout header
      updateWorkoutHeaderCalories(selectedWorkoutDay);
    }, 100);
  }
}


function saveSetRpe(dStr, exId, setNum, val) {
  var wkData = DB.getWorkout(dStr);
  var exData = (wkData.exercises || {})[exId] || {};
  var setRpes = exData.setRpes || {};
  setRpes[setNum] = parseInt(val) || 0;
  DB.setExercise(dStr, exId, { setRpes: setRpes });
}

function getExerciseCue(name) {
  var cues = {
    "Lat Pulldown": "Pull with elbows, not hands. Squeeze shoulder blades.",
    "Flat Bench Press": "Keep shoulder blades retracted. Drive feet into floor.",
    "Barbell Back Squat": "Brace core tight. Descend until thighs are parallel.",
    "Barbell Curl": "Keep elbows pinned to sides. Full range of motion.",
    "Overhead Shoulder Press": "Push head through window at the top. Squeeze glutes.",
    "Treadmill Incline Walk": "Maintain upright posture. Don't hold onto rails."
  };
  return cues[name] || "Focus on mind-muscle connection and controlled tempo.";
}

function saveSetWeight(dStr, exId, setNum, val) {
  var wkData = DB.getWorkout(dStr);
  var exData = (wkData.exercises || {})[exId] || {};
  var setWeights = exData.setWeights || {};
  setWeights[setNum] = parseFloat(val) || 0;
  DB.setExercise(dStr, exId, { setWeights: setWeights });
}

function markWorkoutDone(dStr) {
  DB.setWorkout(dStr, { completed: true });
  showToast('🔥 Workout recorded! Beast Level!');
  renderWorkout(selectedWorkoutDay);
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// DIET PAGE
// ═══════════════════════════════════════════════
function renderDiet() {
  var t = today();
  var mealData = DB.getMeal(t);
  var totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;

  var dayD = todayDay();
  var dm = DAILY_MACROS[dayD] || {};

  var mealConfigs = {
    pregym: dm.pregym || MEAL_CONFIG['pregym'],
    postworkout: dm.postworkout || MEAL_CONFIG['postworkout'],
    lunch: dm.lunch || MEAL_CONFIG['lunch'],
    dinner: dm.dinner || MEAL_CONFIG['dinner'],
    supp_snack: dm.supp_snack || MEAL_CONFIG['supp_snack']
  };

  ['pregym', 'postworkout', 'lunch', 'dinner', 'supp_snack'].forEach(function (id) {
    var c = mealConfigs[id];
    if (c && mealData[id] === true) {
      totalCal += c.cal || 0; totalPro += c.protein || 0; totalCarb += c.carbs || 0; totalFat += c.fat || 0;
    }
  });

  var TL = [
    { t: '2:30 AM', icon: '🏁', label: 'JOB ENDS', desc: 'Job finished — hydrate with 1 glass lukewarm water' },
    { t: '2:45 AM', icon: '💊', label: 'Dr. Morepen Fat Burner', desc: 'Take with half banana — not on empty stomach', id: 'supp_fatburner', type: 'supp' },
    { t: '3:00 AM', icon: '🍌', label: 'PRE-WORKOUT MEAL', desc: '1 medium banana + black coffee (no sugar, no milk)', id: 'pregym', type: 'meal' },
    { t: '4:00 AM', icon: '🏋️', label: 'GYM TRAINING', desc: 'High intensity training (1 hr)' },
    { t: '5:00 AM', icon: '🚶', label: 'TREADMILL WALK', desc: '1 hr walk at 4.5–5 km/hr' },
    { t: '6:00 AM', icon: '🥛', label: 'POST-WORKOUT RECOVERY', desc: '200ml warm low-fat milk + 30g roasted chana', id: 'postworkout', type: 'meal' },
    { t: '6:15 AM', icon: '😴', label: 'RECOVERY SLEEP', desc: '6 hours of recovery sleep' },
    { t: '12:00 PM', icon: '⏰', label: 'WAKE UP', desc: 'Start the day with a detox drink' },
    { t: '12:05 PM', icon: '🌿', label: 'DETOX DRINK', desc: 'Warm water with lemon, jeera, saunf, and ajwain', id: 'supp_jeera1', type: 'supp' },
    { t: '12:15 PM', icon: '💊', label: 'T-Slim Tablet', desc: 'Take with water before lunch', id: 'supp_tslim', type: 'supp' },
    { t: '12:15 PM', icon: '💊', label: 'Centrum Men Multivitamin', desc: 'Take with lunch', id: 'supp_centrum', type: 'supp' },
    { t: '1:00 PM', icon: '🍱', label: 'MAIN LUNCH', desc: 'Dal + cooked soya chunks + salad + roti', id: 'lunch', type: 'meal' },
    { t: '2:30 PM', icon: '🍎', label: 'Apple Cider Vinegar', desc: '1 tbsp ACV in warm water', id: 'supp_acv1', type: 'supp' },
    { t: '4:00 PM', icon: '🌾', label: 'Isabgol', desc: '1 tsp in lukewarm water before dinner', id: 'supp_isab2', type: 'supp' },
    { t: '5:00 PM', icon: '🍽️', label: 'DINNER', desc: 'Soya chunks + veggies, no roti', id: 'dinner', type: 'meal' },
    { t: '6:30 PM', icon: '🏢', label: 'JOB STARTS', desc: 'Keep a 1 litre water bottle with you' },
    { t: '9:30 PM', icon: '🥜', label: 'OFFICE BREAK SNACK', desc: '30g roasted chana or 20g makhana', id: 'supp_snack', type: 'supp' },
    { t: '12:00 AM', icon: '🍵', label: 'Green Tea', desc: 'Plain, no sugar', id: 'supp_gt', type: 'supp' }
  ];

  var timelineHtml = '';
  for (var ri = 0; ri < TL.length; ri++) {
    var row = TL[ri];
    var isDone = row.id ? (mealData[row.id] === true) : false;
    var isSkipped = row.id ? (mealData[row.id] === 'skipped') : false;
    var isMeal = row.type === 'meal';
    var isSupp = row.type === 'supp';
    var hasAction = !!row.id;

    // Themed colors
    var accentColor = isDone ? (isMeal ? 'var(--gold)' : 'var(--green)') : (isSkipped ? 'var(--red)' : 'var(--sub)');
    var bgColor = isDone ? (isMeal ? 'rgba(245,197,23,0.07)' : 'rgba(34,197,94,0.07)') : (isSkipped ? 'rgba(239,68,68,0.07)' : 'var(--card)');
    var borderColor = isDone ? (isMeal ? 'rgba(245,197,23,0.4)' : 'rgba(34,197,94,0.35)') : (isSkipped ? 'rgba(239,68,68,0.35)' : 'var(--border)');
    var cursor = hasAction ? 'cursor:pointer;' : '';
    var nameColor = (isDone || isSkipped) ? 'var(--sub)' : 'var(--text)';
    var strikeThru = (isDone || isSkipped) ? 'text-decoration:line-through;' : '';

    var macroPills = '';
    if (isMeal) {
      var mc = mealConfigs[row.id];
      if (mc) {
        macroPills = '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;">'
          + '<span class="meal-macro-pill">' + mc.cal + ' KCAL</span>'
          + '<span class="meal-macro-pill">' + mc.protein + 'g P</span>'
          + '<span class="meal-macro-pill">' + mc.carbs + 'g C</span>'
          + '<span class="meal-macro-pill">' + mc.fat + 'g F</span>'
          + '</div>';
      }
    }

    // Done button state
    var chkBorder = isDone ? accentColor : '#333';
    var chkBg = isDone ? accentColor : 'transparent';
    var chkColor = isDone ? '#000' : 'transparent';

    // Skip button state
    var skpBorder = isSkipped ? 'var(--red)' : '#333';
    var skpBg = isSkipped ? 'var(--red)' : 'transparent';
    var skpColor = isSkipped ? '#fff' : 'transparent';

    var btns = hasAction
      ? '<div style="display:flex;gap:4px;">'
      + '<div onclick="event.stopPropagation();toggleItemStatus(\'' + row.id + '\');" style="flex-shrink:0;width:26px;height:26px;border-radius:7px;border:2px solid ' + chkBorder + ';background:' + chkBg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.75rem;color:' + chkColor + ';">✓</div>'
      + '<div onclick="event.stopPropagation();toggleSkipStatus(\'' + row.id + '\');" style="flex-shrink:0;width:26px;height:26px;border-radius:7px;border:2px solid ' + skpBorder + ';background:' + skpBg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.65rem;color:' + skpColor + ';">✕</div>'
      + '</div>'
      : '';

    var onclickStr = hasAction ? ' onclick="toggleItemStatus(\'' + row.id + '\');"' : '';

    var isExpanded = row.id && (EXPANDED_MEAL_ID === row.id);
    var detailText = row.id ? (WEEKLY_MEALS[dayD] && WEEKLY_MEALS[dayD][row.id] ? WEEKLY_MEALS[dayD][row.id] : (DAILY_SUPPLEMENTS[row.id] || '')) : '';
    var expandHtml = (isExpanded && detailText) ? '<div class="meal-expanded-content" style="margin-left:20px;">' + detailText + '</div>' : '';

    var rowId = 'row-diet-' + (row.id || ri);
    timelineHtml += '<div id="' + rowId + '" onclick="toggleMealDetail(\'' + row.id + '\')" class="stagger-item haptic-press tilt-card" style="animation-delay:' + (ri * 0.05) + 's;' + cursor + 'background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:11px;margin-bottom:6px;padding:11px 12px;display:flex;flex-direction:column;gap:4px;transition:transform 0.3s cubic-bezier(0.3, 1, 0.3, 1);">'
      + '<div style="display:flex;align-items:flex-start;gap:10px;">'
      + '<div style="min-width:60px;font-size:.57rem;font-family:JetBrains Mono,monospace;color:var(--sub);line-height:1.4;padding-top:2px;flex-shrink:0;">' + row.t + '</div>'
      + '<div style="font-size:1rem;flex-shrink:0;margin-top:1px;">' + row.icon + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div id="title-diet-' + row.id + '" style="font-size:.8rem;font-weight:600;color:' + nameColor + ';' + strikeThru + '">' + row.label + '</div>'
      + '<div style="font-size:.62rem;color:var(--sub2);margin-top:2px;">' + row.desc + '</div>'
      + macroPills
      + '</div>'
      + btns
      + '</div>'
      + expandHtml
      + '</div>';
  }

  // Dynamic Goal Calculation with Fallback
  var goals = { cal: 1350, protein: 120, carbs: 110, fat: 35 };
  if (typeof DAILY_MACROS !== 'undefined' && DAILY_MACROS[dayD]) {
    var dm = DAILY_MACROS[dayD];
    var g = { cal: 0, protein: 0, carbs: 0, fat: 0 };
    ['pregym', 'postworkout', 'lunch', 'dinner', 'supp_snack'].forEach(function (id) {
      if (dm[id]) {
        g.cal += (dm[id].cal || 0);
        g.protein += (dm[id].protein || 0);
        g.carbs += (dm[id].carbs || 0);
        g.fat += (dm[id].fat || 0);
      }
    });
    if (g.cal > 0) goals = g;
  }

  var pctCal = Math.min((totalCal / goals.cal) * 100, 100) || 0;
  var pctPro = Math.min((totalPro / goals.protein) * 100, 100) || 0;
  var pctCarb = Math.min((totalCarb / goals.carbs) * 100, 100) || 0;
  var pctFat = Math.min((totalFat / goals.fat) * 100, 100) || 0;

  var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var tableRows = '';
  for (var di = 0; di < days.length; di++) {
    var dayK = days[di];
    var dm = WEEKLY_MEALS[dayK] || {};
    var preG = dm.pregym || '---';
    var postW = (dm.postworkout || '---').replace(/<strong>.*?<\/strong>/g, '').trim();
    var lunchText = (dm.lunch || '---').replace(/<strong>.*?<\/strong>/g, '').trim();
    var dinnerText = (dm.dinner || '---').replace(/<strong>.*?<\/strong>/g, '').trim();
    var snackText = (dm.supp_snack || '---');

    tableRows += '<tr><td>' + dayK.toUpperCase() + '</td><td>' + preG + '</td><td>' + postW + '</td><td>' + lunchText + '</td><td>' + dinnerText + '</td><td>' + snackText + '</td></tr>';
  }

  document.getElementById('page-diet').innerHTML =
    // Completion summary banner
    (function () {
      var MEAL_IDS = ['pregym', 'postworkout', 'lunch', 'dinner', 'supp_snack'];
      var SUPP_IDS = ['supp_fatburner', 'supp_jeera1', 'supp_tslim', 'supp_centrum', 'supp_acv1', 'supp_isab2', 'supp_gt'];
      var mDone = 0, sDone = 0;
      MEAL_IDS.forEach(function (id) { if (mealData[id] === true) mDone++; });
      SUPP_IDS.forEach(function (id) { if (mealData[id] === true) sDone++; });
      var allMDone = mDone >= MEAL_IDS.length; var allSDone = sDone >= SUPP_IDS.length;
      var bannerColor = (allMDone && allSDone) ? 'var(--green)' : (mDone > 0 || sDone > 0) ? 'var(--gold)' : 'var(--sub)';
      var emoji = (allMDone && allSDone) ? '🏆' : (mDone > 0 || sDone > 0) ? '⚡' : '🎯';
      return '<div style="margin:8px 16px 4px;padding:10px 14px;background:' + (allMDone && allSDone ? 'rgba(34,197,94,0.1)' : 'rgba(245,197,23,0.08)') + ';border:1px solid ' + bannerColor + '44;border-radius:12px;display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-size:.65rem;font-weight:900;color:' + bannerColor + ';letter-spacing:1px;">' + emoji + ' MEALS: ' + mDone + '/' + MEAL_IDS.length + '</span>' +
        '<span style="font-size:.65rem;font-weight:900;color:' + bannerColor + ';letter-spacing:1px;">SUPPS: ' + sDone + '/' + SUPP_IDS.length + '</span>' +
        '<span style="font-size:.65rem;font-weight:700;color:' + (totalCal > 0 ? 'var(--fire)' : 'var(--sub)') + ';">🔥 ' + totalCal + ' KCAL</span>' +
        '</div>';
    })() +
    '<div class="macro-bar-card tilt-card">' +
    '<div class="macro-stats" style="width:100%;">' +
    '<div class="macro-item">' +
    '<div class="macro-item-top"><span class="macro-item-lbl">Calories</span><span class="macro-item-val">' + totalCal + '<span> / ' + goals.cal + '</span></span><span style="font-size:.6rem;color:var(--fire);font-weight:800;">' + Math.round(pctCal) + '%</span></div>' +
    '<div class="macro-item-bar"><div class="macro-item-fill" style="width:' + pctCal + '%; background:var(--fire);"></div></div>' +
    '</div>' +
    '<div class="macro-item">' +
    '<div class="macro-item-top"><span class="macro-item-lbl">Protein</span><span class="macro-item-val">' + totalPro + '<span> / ' + goals.protein + 'g</span></span><span style="font-size:.6rem;color:var(--gold);font-weight:800;">' + Math.round(pctPro) + '%</span></div>' +
    '<div class="macro-item-bar"><div class="macro-item-fill" style="width:' + pctPro + '%; background:var(--gold);"></div></div>' +
    '</div>' +
    '<div class="macro-item">' +
    '<div class="macro-item-top"><span class="macro-item-lbl">Carbs</span><span class="macro-item-val">' + totalCarb + '<span> / ' + goals.carbs + 'g</span></span><span style="font-size:.6rem;color:var(--green);font-weight:800;">' + Math.round(pctCarb) + '%</span></div>' +
    '<div class="macro-item-bar"><div class="macro-item-fill" style="width:' + pctCarb + '%; background:var(--green);"></div></div>' +
    '</div>' +
    '<div class="macro-item">' +
    '<div class="macro-item-top"><span class="macro-item-lbl">Fat</span><span class="macro-item-val">' + totalFat + '<span> / ' + goals.fat + 'g</span></span><span style="font-size:.6rem;color:var(--blue);font-weight:800;">' + Math.round(pctFat) + '%</span></div>' +
    '<div class="macro-item-bar"><div class="macro-item-fill" style="width:' + pctFat + '%; background:var(--blue);"></div></div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="section"><div class="sec-h"><div class="sec-h-title">TODAY\'S DIET &amp; SUPPLEMENTS</div></div>' + timelineHtml + '</div>' +
    '<div class="section" style="margin-top:12px;"><div class="sec-h"><div class="sec-h-title">WEEKLY MENU REF</div></div><div class="menu-ref-wrap"><table class="menu-table"><thead><tr><th>DAY</th><th>PRE-GYM</th><th>POST-WORKOUT</th><th>LUNCH</th><th>DINNER</th><th>OFFICE SNACK</th></tr></thead><tbody>' + tableRows + '</tbody></table></div></div>' +
    '<div style="padding:10px 0;font-size:.65rem;color:var(--sub);text-align:center;">Tap any item to mark complete</div>';
}

// WATER PAGE
// ═══════════════════════════════════════════════

function renderWater() {
  var t = today();
  var cur = DB.getWater(t);
  var goal = DB.profile().waterGoal || 10;
  var pct = Math.min((cur / goal) * 100, 100) || 0;
  var ML_PER_GLASS = 250; // 1 glass = 250ml
  var curL = (cur * ML_PER_GLASS / 1000).toFixed(2);
  var goalL = (goal * ML_PER_GLASS / 1000).toFixed(2);

  // Hydration status
  var hydPct = Math.min((cur / goal) * 100, 100) || 0;
  var hydStatus, hydColor, hydEmoji;
  if (hydPct >= 100) { hydStatus = 'CHAMPION HYDRATION'; hydColor = 'var(--green)'; hydEmoji = '🏆'; }
  else if (hydPct >= 70) { hydStatus = 'WELL HYDRATED'; hydColor = 'var(--green)'; hydEmoji = '✅'; }
  else if (hydPct >= 40) { hydStatus = 'NEEDS MORE WATER'; hydColor = 'var(--gold)'; hydEmoji = '⚠️'; }
  else { hydStatus = 'DEHYDRATED'; hydColor = 'var(--red)'; hydEmoji = '🔴'; }

  // 7-day average
  var totalW7 = 0;
  var glassesHtml = '';
  for (var i = 1; i <= goal; i++) {
    var filled = i <= cur ? ' filled' : '';
    var icon = i <= cur ? '💧' : '🚰';
    glassesHtml += '<div class="glass-item tilt-card' + filled + '" onclick="DB.setWater(\'' + t + '\',' + i + '); renderWater();"><div style="font-size:1.4rem;">' + icon + '</div><div class="glass-lbl">' + i + '</div></div>';
  }

  var chartData = [];
  var now = new Date();
  for (var i = 6; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(now.getDate() - i);
    var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    chartData.push({ date: iso, dayIdx: d.getDay() });
  }

  var chartHtml = chartData.map(function (item) {
    var c = DB.getWater(item.date);
    totalW7 += c;
    var p = Math.min((c / goal) * 100, 100) || 0;
    var lbl = DAY_SHORT[item.dayIdx];
    var filled = c >= goal ? ' filled' : '';
    var cL = (c * ML_PER_GLASS / 1000).toFixed(1);
    return '<div class="chart-bar-wrap"><div class="chart-bar-val">' + c + '<div style="font-size:.45rem;color:var(--sub);">' + cL + 'L</div></div><div class="chart-bar' + filled + '" style="height:' + Math.max(p, 5) + '%;"></div><div class="chart-bar-lbl">' + lbl + '</div></div>';
  }).join('');
  var avg7 = (totalW7 / 7).toFixed(1);
  var avg7L = (parseFloat(avg7) * ML_PER_GLASS / 1000).toFixed(2);

  document.getElementById('page-water').innerHTML =
    '<div class="water-display tilt-card">' +
    '<div class="water-big-num">' + cur + '</div>' +
    '<div style="font-size:1.1rem; font-weight:700; color:var(--blue); letter-spacing:1px; margin-top:2px;">' + curL + ' L</div>' +
    '<div style="font-size:.65rem;font-weight:900;color:' + hydColor + ';letter-spacing:2px;margin:4px 0 2px;">' + hydEmoji + ' ' + hydStatus + '</div>' +
    '<div class="water-goal-label">GLASSES TODAY (GOAL: ' + goal + ' glasses / ' + goalL + ' L)</div>' +
    '<div class="water-bar"><div class="water-bar-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="water-controls">' +
    '<button class="water-btn" onclick="DB.setWater(\'' + t + '\',' + (cur - 1) + '); renderWater();">-</button>' +
    '<div class="water-val-display">' + Math.round(cur) + ' <span style="font-size:.65rem;color:var(--sub);">' + curL + 'L</span></div>' +
    '<button class="water-btn" onclick="DB.setWater(\'' + t + '\',' + (cur + 1) + '); renderWater();">+</button>' +
    '</div>' +
    '</div>' +
    '<div class="section" style="margin-top:12px;">' +
    '<div class="sec-h"><div class="sec-h-title">🚰 HYDRATION TRACKER</div></div>' +
    '<div class="glasses-grid">' + glassesHtml + '</div>' +
    '</div>' +
    '<div class="section" style="margin-top:12px;">' +
    '<div class="sec-h"><div class="sec-h-title">📊 PAST 7 DAYS</div><div style="font-size:.6rem;color:var(--blue);margin-left:auto;font-weight:800;">AVG: ' + avg7 + ' glasses / ' + avg7L + ' L</div></div>' +
    '<div class="water-week-chart"><div class="chart-bars">' + chartHtml + '</div></div>' +
    '</div>';
}

// ═══════════════════════════════════════════════
// PROGRESS PAGE
// ═══════════════════════════════════════════════

function generateWeightChartSVG(pts) {
  if (!pts || !pts.length) return '<div class="empty-chart" style="padding:40px; text-align:center; color:var(--sub); font-size:0.85rem; font-weight:600;">📊 Log weights to see trend...</div>';

  var w = 340, h = 260, pad = 35, barGap = 4;
  var wts = pts.map(function (p) { return p.kg; });
  var minW = Math.min.apply(null, wts) - 2;
  var maxW = Math.max.apply(null, wts) + 2;
  if (maxW === minW) { minW -= 5; maxW += 5; }

  var barWidth = Math.max(8, (w - 2 * pad - (pts.length - 1) * barGap) / pts.length);
  var getX = function (i) { return pad + (i * (barWidth + barGap)); };
  var getY = function (v) { return h - pad - ((v - minW) * (h - 2 * pad) / (maxW - minW)); };

  // Grid lines with labels
  var gridHtml = '';
  var step = (maxW - minW) > 10 ? 5 : 2;
  for (var v = Math.ceil(minW / step) * step; v <= maxW; v += step) {
    var gy = getY(v);
    gridHtml += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (w - 10) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.06)" stroke-width="1.5" />';
    gridHtml += '<text x="12" y="' + (gy + 4) + '" fill="var(--sub)" style="font-size:10px; font-weight:700;">' + v + '</text>';
  }

  var barsHtml = '';
  var avgWeight = wts.reduce(function (a, b) { return a + b; }) / wts.length;

  for (var i = 0; i < pts.length; i++) {
    var x = getX(i);
    var y = getY(pts[i].kg);
    var barHeight = getY(minW) - y;

    // Color based on comparison
    var isAboveAvg = pts[i].kg > avgWeight;
    var barColor = isAboveAvg ? 'var(--red)' : 'var(--green)';
    var lightColor = isAboveAvg ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)';

    // Bar with gradient
    var barId = 'bar-' + i;
    barsHtml += '<defs><linearGradient id="grad' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + barColor + '" stop-opacity="0.9"/><stop offset="100%" stop-color="' + barColor + '" stop-opacity="0.6"/></linearGradient></defs>';

    // Main bar with shadow
    barsHtml += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="url(#grad' + i + ')" rx="3" ry="3" opacity="0.85" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.4))" />';

    // Highlight bar on hover effect
    barsHtml += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + lightColor + '" rx="3" ry="3" opacity="0" class="bar-hover" style="transition:opacity 0.2s;" />';

    // Value label on top
    var showLabel = (i === 0) || (i === pts.length - 1) || (pts.length > 20 && i % Math.floor(pts.length / 5) === 0) || (pts.length <= 10);
    if (showLabel) {
      barsHtml += '<text x="' + (x + barWidth / 2) + '" y="' + (y - 8) + '" fill="' + barColor + '" text-anchor="middle" style="font-size:11px;font-weight:bold;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));">' + pts[i].kg + '</text>';
    }

    // Date label on bottom (for first, last, and every nth)
    if (i === 0 || i === pts.length - 1 || (pts.length > 20 && i % Math.floor(pts.length / 4) === 0)) {
      var dateStr = pts[i].date.substring(5); // MM-DD format
      barsHtml += '<text x="' + (x + barWidth / 2) + '" y="' + (h - 5) + '" fill="var(--sub)" text-anchor="middle" style="font-size:8px;">' + dateStr + '</text>';
    }
  }

  // Axis lines
  var axisHtml = '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - 10) + '" y2="' + (h - pad) + '" stroke="var(--border)" stroke-width="1.5" />' +
    '<line x1="' + pad + '" y1="' + pad + '" x2="' + pad + '" y2="' + (h - pad) + '" stroke="var(--border)" stroke-width="1.5" />';

  // Average line
  var avgY = getY(avgWeight);
  barsHtml += '<line x1="' + pad + '" y1="' + avgY + '" x2="' + (w - 10) + '" y2="' + avgY + '" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5,5" opacity="0.6" />' +
    '<text x="' + (w - 8) + '" y="' + (avgY - 5) + '" fill="var(--gold)" text-anchor="end" style="font-size:9px;font-weight:bold;">AVG</text>';

  var svg = '<svg id="weight-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="overflow:visible; width:100%; height:100%;">' +
    gridHtml +
    axisHtml +
    barsHtml +
    '</svg>';

  return svg;
}

function generateMuscleChartSVG() {
  var labels = ["Back", "Biceps", "Chest", "Triceps", "Legs", "Abs", "Shoulders"];
  var counts = { Back: 0, Biceps: 0, Chest: 0, Triceps: 0, Legs: 0, Abs: 0, Shoulders: 0 };

  // Scraper through workout data for past 7 days
  var data = DB._getData();
  data.slice(-7).forEach(day => {
    var exData = (day._rawWorkout || {}).exercises || {};
    for (var id in exData) {
      if (exData[id].done) {
        // Map ID to group
        if (id.startsWith('b')) counts.Back++;
        else if (id.startsWith('bi')) counts.Biceps++;
        else if (id.startsWith('ch')) counts.Chest++;
        else if (id.startsWith('tr')) counts.Triceps++;
        else if (id.startsWith('q') || id.startsWith('h')) counts.Legs++;
        else if (id.startsWith('ab')) counts.Abs++;
        else if (id.startsWith('sh')) counts.Shoulders++;
      }
    }
  });

  var max = Math.max.apply(null, Object.values(counts)) || 1;
  var w = 340, h = 160, pad = 30;
  var barW = (w - pad * 2) / labels.length;

  var bars = labels.map(function (l, i) {
    var val = counts[l];
    var barH = (val / max) * (h - pad * 2);
    var x = pad + i * barW;
    var y = h - pad - barH;
    return '<rect x="' + (x + 5) + '" y="' + y + '" width="' + (barW - 10) + '" height="' + barH + '" fill="var(--fire)" opacity="0.6" rx="4"/>' +
      '<text x="' + (x + barW / 2) + '" y="' + (h - 10) + '" fill="var(--sub)" font-size="8" text-anchor="middle">' + l.toUpperCase() + '</text>' +
      '<text x="' + (x + barW / 2) + '" y="' + (y - 5) + '" fill="var(--fire)" font-size="9" font-weight="700" text-anchor="middle">' + val + '</text>';
  }).join('');

  return '<svg viewBox="0 0 ' + w + ' ' + h + '">' + bars + '</svg>';
}

function renderProgress() {
  var prof = DB.profile();
  var weights = DB.weights();
  var chartWeights = [];

  if (prof.startWeight && prof.startDate) {
    chartWeights.push({ date: prof.startDate, kg: parseFloat(prof.startWeight) });
  }
  var dateMap = {};
  if (prof.startWeight && prof.startDate) {
    dateMap[prof.startDate] = parseFloat(prof.startWeight);
  }
  for (var i = 0; i < weights.length; i++) {
    dateMap[weights[i].date] = weights[i].kg;
  }
  var dates = Object.keys(dateMap).sort();
  for (var i = 0; i < dates.length; i++) {
    chartWeights.push({ date: dates[i], kg: dateMap[dates[i]] });
  }

  var lastWtObj = weights.length ? weights[weights.length - 1] : (prof.startWeight ? { kg: parseFloat(prof.startWeight) } : null);
  var firstWtObj = prof.startWeight ? { kg: parseFloat(prof.startWeight) } : (weights.length ? weights[0] : null);

  var weightPred30 = NeuralCore.predictWeight(30) || '---';
  var weightPred60 = NeuralCore.predictWeight(60) || '---';
  var weightPred90 = NeuralCore.predictWeight(90) || '---';
  var isPlat = NeuralCore.isPlateau();
  var recIndex = NeuralCore.getRecoveryIndex();

  var onerms = DB.getAdvanced('exOnerms') || {};
  var best1rm = 0;
  for (var id in onerms) if (onerms[id] > best1rm) best1rm = onerms[id];

  var targetWt = parseFloat(prof.targetWeight || 0);
  var needsToLose = targetWt > 0 ? (lastWtObj ? (lastWtObj.kg - targetWt) : 0).toFixed(1) : '--';
  if (parseFloat(needsToLose) < 0) needsToLose = '0';

  // Total lost since day 1
  var totalLost = (firstWtObj && lastWtObj) ? (firstWtObj.kg - lastWtObj.kg).toFixed(1) : null;
  var totalLostColor = totalLost && parseFloat(totalLost) > 0 ? 'var(--green)' : totalLost && parseFloat(totalLost) < 0 ? 'var(--red)' : 'var(--sub)';
  var totalLostLabel = totalLost && parseFloat(totalLost) > 0 ? '↓ ' + totalLost + ' KG LOST' : totalLost && parseFloat(totalLost) < 0 ? '↑ ' + Math.abs(parseFloat(totalLost)) + ' KG GAINED' : 'NO CHANGE';

  // Days remaining
  var dayNum = getDayNum();
  var daysLeft = Math.max(0, 90 - dayNum);
  var streak = calcStreak();

  document.getElementById('page-progress').innerHTML =
    // 1. MAS Score card (filled async by renderHealthMetrics)
    '<div id="bio-hud-container"></div>' +

    // 2. Weight Progress - stats grid (now 8 cards: 3+3+2)
    '<div class="section">' +
    '<div class="sec-h"><div class="sec-h-title">⚖️ WEIGHT PROGRESS</div></div>' +
    '<div class="progress-stats">' +
    '<div class="prog-stat" onclick="editWeight()" style="cursor:pointer;"><div class="prog-stat-val" style="color:var(--gold);">' + (lastWtObj ? lastWtObj.kg : '--') + '</div><div class="prog-stat-lbl">CURRENT (KG)</div></div>' +
    '<div class="prog-stat" onclick="editTarget()" style="cursor:pointer;"><div class="prog-stat-val" style="color:var(--blue);">' + (targetWt || '--') + '</div><div class="prog-stat-lbl">TARGET (KG)</div></div>' +
    '<div class="prog-stat"><div class="prog-stat-val" style="color:var(--red);">' + needsToLose + '</div><div class="prog-stat-lbl">TO LOSE (KG)</div></div>' +
    '<div class="prog-stat" onclick="editHeight()" style="cursor:pointer;"><div class="prog-stat-val" style="color:var(--green);">' + (prof.height || '--') + '</div><div class="prog-stat-lbl">HEIGHT (CM)</div></div>' +
    '<div class="prog-stat" onclick="editGender()" style="cursor:pointer;"><div class="prog-stat-val" style="color:var(--purple); font-size:1rem;">' + (prof.gender || 'male').toUpperCase() + '</div><div class="prog-stat-lbl">GENDER</div></div>' +
    '<div class="prog-stat" onclick="editAge()" style="cursor:pointer;"><div class="prog-stat-val" style="color:var(--gold);">' + (prof.age || '--') + '</div><div class="prog-stat-lbl">AGE</div></div>' +
    '</div>' +
    '</div>' +

    // Total lost badge (moved between Weight Progress and Body Metrics)
    (totalLost ? '<div style="margin:2px 16px 14px;padding:10px 16px;background:' + (parseFloat(totalLost) > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)') + ';border:1px solid ' + totalLostColor + '44;border-radius:12px;display:flex;align-items:center;justify-content:space-between;">' +
      '<span style="font-size:.85rem;font-weight:900;color:' + totalLostColor + ';letter-spacing:1px;">' + totalLostLabel + '</span>' +
      '<span style="font-size:.6rem;color:var(--sub);">DAY ' + dayNum + ' / 90  •  ' + daysLeft + ' TO GO</span>' +
      '</div>' : '') +

    // 3. Body Metrics 16-card grid (BMI, Body Fat, etc.) - filled async
    '<div id="adv-metrics" class="metrics-grid"></div>' +

    // 4. AI Insights + Cycle Intelligence + Advanced Metrics 7D + Predictive - filled async
    '<div id="ai-insights-container"></div>' +

    // 5. Neural Predictions (60/90 day)
    '<div class="section">' +
    '<div class="sec-h"><div class="sec-h-title">🧠 NEURAL PREDICTIONS</div></div>' +
    '<div class="tilt-card" style="margin:0 16px; padding:15px; background:rgba(255,107,26,0.05); border:1px dashed var(--fire); border-radius:14px;">' +
    '<div style="display:flex; justify-content:space-between; margin-bottom:10px;">' +
    '<div><div style="font-size:0.5rem; color:var(--sub)">60 DAYS</div><div style="font-size:1.1rem; font-weight:700; color:var(--fire);">' + weightPred60 + ' kg</div></div>' +
    '<div><div style="font-size:0.5rem; color:var(--sub)">90 DAYS</div><div style="font-size:1.1rem; font-weight:700; color:var(--gold);">' + weightPred90 + ' kg</div></div>' +
    '<div style="text-align:right;"><div style="font-size:0.5rem; color:var(--sub)">TREND</div><div style="font-size:1.1rem; font-weight:700; color:var(--green);">' + (isPlat ? 'STALL' : 'LOSS') + '</div></div>' +
    '</div>' +
    '<div style="font-size:0.6rem; color:var(--sub2); font-style:italic;">Predictions calculated via linear regression of past 14 days activity.</div>' +
    '</div>' +
    '</div>' +

    // 6. Mini analytics cards (Recovery/Plateau/1RM/Forecast)
    '<div class="analytics-grid">' +
    '<div class="analytics-card tilt-card">' +
    '<div class="an-label">RECOVERY READINESS</div>' +
    '<div class="an-val" style="color:var(--green)">' + recIndex + '%</div>' +
    '<div class="an-trend ' + (recIndex > 70 ? 'up' : 'down') + '">' + (recIndex > 70 ? '▲ OPTIMAL' : '▼ CAUTION') + '</div>' +
    '</div>' +
    '<div class="analytics-card tilt-card">' +
    '<div class="an-label">PLATEAU STATUS</div>' +
    '<div class="an-val" style="color:' + (isPlat ? 'var(--red)' : 'var(--blue)') + '">' + (isPlat ? 'DETECTED' : 'CLEAR') + '</div>' +
    '<div class="an-trend">' + (isPlat ? 'SWITCH PROGRAM' : 'KEEP GRINDING') + '</div>' +
    '</div>' +

    '<div class="analytics-card tilt-card">' +
    '<div class="an-label">FORECAST (30D)</div>' +
    '<div class="an-val" style="color:var(--fire)">' + weightPred30 + ' <span style="font-size:0.6rem">KG</span></div>' +
    '<div class="an-trend">A.I PREDICTION</div>' +
    '</div>' +
    '</div>' +

    // 7. Muscle Group Volume chart removed

    // 8. Weight Trend chart
    '<div class="weight-chart" style="margin:20px 16px; padding:18px 16px; background:linear-gradient(135deg, rgba(255,107,26,0.08), rgba(88,198,255,0.05)); border:1px solid rgba(255,107,26,0.2); border-radius:18px; backdrop-filter:blur(10px);">' +
    '<div class="weight-chart-title" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; font-size:0.9rem; font-weight:900; letter-spacing:1px; color:var(--gold);">📊 WEIGHT TREND <button onclick="DB.exportData()" style="background:rgba(255,107,26,0.2); border:1px solid rgba(255,107,26,0.3); color:var(--gold); font-size:.65rem; padding:6px 12px; border-radius:8px; cursor:pointer; font-family:\'Bebas Neue\',sans-serif; letter-spacing:1px; font-weight:700; transition:all 0.3s;">⬇️ EXPORT</button></div>' +
    '<div style="position:relative; height:240px;">' +
    generateWeightChartSVG(chartWeights.slice(-15)) +
    '</div>' +
    '</div>' +

    // 9. Data Management
    '<div class="section" style="margin-bottom:100px;">' +
    '<div class="sec-h"><div class="sec-h-title">⚙️ DATA MANAGEMENT</div></div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:0 16px;">' +
    '<button class="modal-btn" onclick="DB.exportCSV()" style="width:100%; border-color:var(--green); color:var(--green); font-size:0.7rem;">📊 EXCEL CSV</button>' +
    '<button class="modal-btn" onclick="openImportModal()" style="width:100%; border-color:var(--purple); color:var(--purple); font-size:0.7rem;">🔄 RESTORE JSON</button>' +
    '<button class="modal-btn" onclick="window.print()" style="width:100%; border-color:var(--blue); color:var(--blue); font-size:0.7rem; grid-column: span 2;">📄 DOWNLOAD PDF REPORT</button>' +
    '</div>' +
    '</div>';

  setTimeout(function () {
    var prof = DB.profile();
    var h = parseFloat(prof.height || 0);
    var age = parseInt(prof.age || 25);
    var gender = prof.gender || 'male';
    var wtList = DB.weights();
    var curW = wtList.length ? wtList[wtList.length - 1].kg : 0;

    // Fetch today's behavioral context for AI
    var todayDate = today();
    var waterTaken = DB.getWater(todayDate);
    var waterGoal = prof.waterGoal || 10;
    var rawMeals = DB.getMeal(todayDate);
    var workoutData = DB.getWorkout(todayDate);

    // 1. Process today's meal completion
    var mealIds = ['pregym', 'postworkout', 'lunch', 'dinner', 'supp_snack'];
    var mealsDone = 0;
    var mealsSkipped = 0;
    mealIds.forEach(function (mid) {
      if (rawMeals[mid] === true) mealsDone++;
      if (rawMeals[mid] === 'skipped') mealsSkipped++;
    });

    // 2. Calculate 7-Day Weight Trend
    var trendDelta = 0;
    if (wtList.length >= 2) {
      var latest = wtList[wtList.length - 1].kg;
      // Look back 7 entries or to start if less than 7
      var lookbackIdx = Math.max(0, wtList.length - 8);
      var prev = wtList[lookbackIdx].kg;
      trendDelta = latest - prev;
    }

    // 3. Calculate 3-Day Adherence Average (Water/Diet)
    var avgWater3d = 0;
    var avgDiet3d = 0;
    var daysToAvg = 3;
    for (var dIdx = 0; dIdx < daysToAvg; dIdx++) {
      var pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - dIdx);
      var dStr = toLocalDate(pastDate);
      avgWater3d += DB.getWater(dStr);

      var pMeals = DB.getMeal(dStr);
      var pDone = 0;
      mealIds.forEach(function (mid) { if (pMeals[mid] === true) pDone++; });
      avgDiet3d += (pDone / mealIds.length);
    }
    avgWater3d /= daysToAvg;
    avgDiet3d = (avgDiet3d / daysToAvg) * 100;

    var dailyContext = {
      water: { taken: waterTaken, goal: waterGoal, avg3d: avgWater3d },
      diet: { done: mealsDone, skipped: mealsSkipped, total: mealIds.length, avg3d: avgDiet3d },
      workout: { done: workoutData.completed || false },
      trend: { delta7d: trendDelta, hasData: wtList.length >= 3 }
    };

    // 4. Calculate Projected Goal Date
    var projectedDateHtml = '';
    if (wtList.length >= 3 && trendDelta < 0) {
      var targetWt = parseFloat(prof.targetWeight || 0);
      var currentWt = wtList[wtList.length - 1].kg;
      if (targetWt > 0 && currentWt > targetWt) {
        var weeklyLoss = Math.abs(trendDelta);
        var remaining = currentWt - targetWt;
        var weeksToGoal = remaining / weeklyLoss;
        var goalDate = new Date();
        goalDate.setDate(goalDate.getDate() + (weeksToGoal * 7));
        projectedDateHtml = '<div class="projection-tag pulse-card" style="margin-top:12px; font-size:0.7rem; color:var(--fire); letter-spacing:1px; text-transform:uppercase; text-align:center; padding:10px; border:1px solid var(--border2); border-radius:12px;">' +
          '🔮 PROJECTED GOAL DATE: <span style="font-weight:900;">' + toLocalDate(goalDate).toUpperCase() + '</span>' +
          '</div>';
      }
    }

    // 5. Bio-HUD Integration (MAS & Terminal)
    var mas = getMetabolicAdaptabilityScore();
    var masColor = mas >= 90 ? 'var(--green)' : mas >= 70 ? 'var(--gold)' : 'var(--red)';
    var diagLogs = getCyberDiagnostics();

    var hudHtml = '';

    var container = document.getElementById('bio-hud-container');
    if (container) container.innerHTML = hudHtml;

    if (h > 0 && curW > 0) renderHealthMetrics(h, curW, age, gender, dailyContext, projectedDateHtml);

  }, 100);
}

function editWeight() {
  var weights = DB.weights();
  var lastWt = weights.length ? weights[weights.length - 1].kg : 70;
  openModal(
    '<div class="modal-title">⚖️ LOG WEIGHT</div>' +
    '<input class="modal-input" id="edit-wt" type="number" step="0.1" value="' + lastWt + '" placeholder="Current weight in kg..."/>' +
    '<button class="modal-btn primary" onclick="saveWeight()">LOG WEIGHT</button>'
  );
}
function saveWeight() {
  var v = parseFloat(document.getElementById('edit-wt').value);
  if (v > 30) {
    DB.addWeight(today(), v);
    closeModal();
    if (currentPage === 'home') renderHome();
    else if (currentPage === 'progress') renderProgress();
    showToast('⚖️ Weight logged!');
  } else {
    showToast('⚠️ Please enter a valid weight.');
  }
}

function editTarget() {
  var prof = DB.profile();
  openModal(
    '<div class="modal-title">🎯 EDIT TARGET WEIGHT</div>' +
    '<input class="modal-input" id="edit-target" type="number" step="0.1" value="' + (prof.targetWeight || 65) + '" placeholder="Target weight in kg..."/>' +
    '<button class="modal-btn primary" onclick="saveTarget()">SAVE TARGET</button>'
  );
}
function saveTarget() {
  var v = parseFloat(document.getElementById('edit-target').value);
  if (v > 20 && v < 300) {
    DB.setProfile({ targetWeight: v });
    closeModal();
    renderProgress();
    showToast('🎯 Target weight updated!');
  } else {
    showToast('⚠️ Please enter a valid weight.');
  }
}

function editHeight() {
  var prof = DB.profile();
  openModal(
    '<div class="modal-title">📏 EDIT HEIGHT</div>' +
    '<input class="modal-input" id="edit-h" type="number" value="' + (prof.height || 170) + '" placeholder="Height in cm..."/>' +
    '<button class="modal-btn primary" onclick="saveHeight()">SAVE</button>'
  );
}
function saveHeight() {
  var v = parseFloat(document.getElementById('edit-h').value);
  if (v > 50 && v < 250) {
    DB.setProfile({ height: v });
    closeModal();
    renderProgress();
    showToast('📏 Height updated!');
  }
}

function editGender() {
  var prof = DB.profile();
  var isMale = (prof.gender || 'male') === 'male';
  openModal(
    '<div class="modal-title">⚧ EDIT GENDER</div>' +
    '<select class="modal-input" id="edit-gender" style="background:var(--bg3); color:white; border:1px solid var(--border2);">' +
    '<option value="male" ' + (isMale ? 'selected' : '') + '>MALE</option>' +
    '<option value="female" ' + (!isMale ? 'selected' : '') + '>FEMALE</option>' +
    '</select>' +
    '<button class="modal-btn primary" onclick="saveGender()">SAVE</button>'
  );
}
function saveGender() {
  var v = document.getElementById('edit-gender').value;
  DB.setProfile({ gender: v });
  closeModal();
  renderProgress();
  showToast('⚧ Gender updated!');
}

function editAge() {
  var prof = DB.profile();
  openModal(
    '<div class="modal-title">🎂 EDIT AGE</div>' +
    '<input class="modal-input" id="edit-age" type="number" value="' + (prof.age || 25) + '" placeholder="Your age..."/>' +
    '<button class="modal-btn primary" onclick="saveAge()">SAVE</button>'
  );
}
function saveAge() {
  var v = parseInt(document.getElementById('edit-age').value);
  if (v > 5 && v < 120) {
    DB.setProfile({ age: v });
    closeModal();
    renderProgress();
    showToast('🎂 Age updated!');
  }
}

function renderHealthMetrics(forcedH, forcedW, age, gender, context, projectionHtml) {
  var h_cm = forcedH || parseFloat(DB.profile().height || 0);
  var h_m = h_cm / 100;
  var weights = DB.weights();
  var w = forcedW || (weights.length ? weights[weights.length - 1].kg : 0);

  if (!h_m || !w) return;
  var bmi = w / (h_m * h_m);

  // (Calculation logic remains the same...)
  // ... [omitted for brevity in replacement chunk but preserved in file] ...

  var cat = '', color = '';
  if (bmi < 18.5) { cat = 'UNDERWEIGHT'; color = 'var(--blue)'; }
  else if (bmi < 25) { cat = 'NORMAL'; color = 'var(--green)'; }
  else if (bmi < 30) { cat = 'OVERWEIGHT'; color = 'var(--gold)'; }
  else { cat = 'OBESE'; color = 'var(--red)'; }

  // BMI categorization handled for status label
  var bmiStatus = cat;

  // Advanced Calculations
  var gFactor = (gender === 'male' ? 1 : 0);

  // 1. Body Fat Ratio (Deurenberg Formula)
  var bfr = (1.20 * bmi) + (0.23 * age) - (10.8 * gFactor) - 5.4;
  if (age < 18) {
    bfr = (1.51 * bmi) - (0.70 * age) - (3.6 * gFactor) + 1.4;
  }
  bfr = Math.max(3, Math.min(50, bfr));

  // 2. Subcutaneous Fat (Estimated ~85% of total fat)
  var subFat = bfr * 0.85;

  // 3. Visceral Fat Index (Estimated Scale 1-20)
  var viscIdx = (0.1 * age) + (0.15 * bmi) - 6;
  viscIdx = Math.max(1, Math.min(30, Math.round(viscIdx)));

  // 4. Total Body Water (Watson Formula)
  var tbw = 0;
  if (gender === 'male') {
    tbw = 2.447 - (0.09156 * age) + (0.1074 * h_cm) + (0.3362 * w);
  } else {
    tbw = -2.097 + (0.1069 * h_cm) + (0.2466 * w);
  }
  var tbwPct = (tbw / w) * 100;

  // 5. Protein Mass
  var lbm = w * (1 - (bfr / 100));
  var protein = lbm * 0.21;

  // 6. Mineral
  var mineral = w * 0.058;

  // 7. Lean Body Mass (LBM)
  var lbm = w * (1 - (bfr / 100));

  // 8. Muscle Mass
  var muscleMass = lbm - mineral;

  // 9. BMR (Basal Metabolic Rate - Mifflin-St Jeor)
  var bmr = (10 * w) + (6.25 * h_cm) - (5 * age) + (gender === 'male' ? 5 : -161);

  // 10. Ideal Weight (Based on BMI 22)
  var idealWeight = 22 * (h_m * h_m);

  // 11. Obesity Degree
  var obesityDegree = ((w - idealWeight) / idealWeight) * 100;

  // 12. Body Age (Biological age estimate)
  var genderBaseBFR = (gender === 'male' ? 15 : 22);
  var bodyAge = age + (bmi - 22) + (bfr - genderBaseBFR) * 0.5;
  bodyAge = Math.max(age - 5, Math.min(age + 20, Math.round(bodyAge)));

  // 13. TDEE (Total Daily Energy Expenditure - Estimate)
  var tdee = bmr * 1.375;

  // 9. Fat Mass
  var fatMass = w * (bfr / 100);

  // 10. Muscle Rate
  var muscleRate = (muscleMass / w) * 100;

  // Logic for Metric Status Labels
  var viscStatus = viscIdx < 10 ? 'HEALTHY' : (viscIdx < 15 ? 'HIGH' : 'WARNING');
  var tbwStatus = (gender === 'male' ? (tbwPct > 55 ? 'HYDRATED' : 'LOW') : (tbwPct > 50 ? 'HYDRATED' : 'LOW'));
  var bfrStatus = (gender === 'male' ? (bfr < 20 ? 'ATHLETIC' : (bfr < 25 ? 'NORMAL' : 'HIGH')) : (bfr < 25 ? 'ATHLETIC' : (bfr < 32 ? 'NORMAL' : 'HIGH')));
  var obesityStatus = obesityDegree < 10 ? 'NORMAL' : (obesityDegree < 20 ? 'OVER' : 'OBESE');

  // Generate Insights
  var insights = generateAIInsights({
    bmi: bmi, bfr: bfr, tbwPct: tbwPct, viscIdx: viscIdx,
    protein: protein, gender: gender, age: age, weight: w,
    bmr: bmr, lbm: lbm, muscleMass: muscleMass,
    context: context || {}
  });

  var insightsHtml = '<div class="insight-card">' +
    '<div class="ins-header"><div class="ins-title">✨ PREMIUM AI INSIGHTS</div></div>' +
    '<div class="ins-list">' +
    insights.map(function (ins) {
      return '<div class="ins-item">' +
        '<div class="ins-icon">' + ins.icon + '</div>' +
        '<div class="ins-content">' +
        '<div class="ins-msg">' + ins.msg + '</div>' +
        '<div class="ins-action">' + ins.action + '</div>' +
        '</div>' +
        '</div>';
    }).join('') +
    '</div>' +
    '</div>';

  // Render Grid (4 Sets of 4)
  var metricsHtml =
    // Set 1: Basics
    createMetricCard('🔢', bmi.toFixed(1), 'BMI', 'Body Mass Index', 'm-blue', 0, bmiStatus) +
    createMetricCard('⚖️', idealWeight.toFixed(1), 'KG', 'Ideal Weight', 'm-blue', 1, 'TARGET') +
    createMetricCard('📈', (obesityDegree > 0 ? '+' : '') + obesityDegree.toFixed(1), '%', 'Obesity Degree', 'm-red', 2, obesityStatus) +
    createMetricCard('🎂', bodyAge, 'YRS', 'Biological Age', 'm-purple', 3, 'BODY AGE') +

    // Set 2: Fat
    createMetricCard('🔥', bfr.toFixed(1), '%', 'Body Fat Ratio', 'm-red', 4, bfrStatus) +
    createMetricCard('🍔', fatMass.toFixed(1), 'KG', 'Fat Mass', 'm-red', 5, 'TOTAL FAT') +
    createMetricCard('⚠️', viscIdx, 'IDX', 'Visceral Fat', 'm-red', 6, viscStatus) +
    createMetricCard('🧬', subFat.toFixed(1), '%', 'Subcutaneous Fat', 'm-gold', 7, 'NORMAL') +

    // Set 3: Build
    createMetricCard('💪', muscleMass.toFixed(1), 'KG', 'Muscle Mass', 'm-green', 8, 'STRENGTH') +
    createMetricCard('⚡', muscleRate.toFixed(1), '%', 'Muscle Rate', 'm-green', 9, 'RATIO') +
    createMetricCard('🥩', protein.toFixed(1), 'KG', 'Protein Mass', 'm-green', 10, 'QUALITY') +
    createMetricCard('🦾', lbm.toFixed(1), 'KG', 'Lean Body Mass', 'm-purple', 11, 'LBM') +

    // Set 4: Metabolism & Foundation
    createMetricCard('🔋', Math.round(bmr), 'KCAL', 'Basal Metabolism', 'm-gold', 12, 'BMR') +
    createMetricCard('🔥', Math.round(tdee), 'KCAL', 'Total Energy', 'm-gold', 13, 'TDEE') +
    createMetricCard('💧', tbw.toFixed(1), 'L', 'Body Water', 'm-blue', 14, tbwStatus) +
    createMetricCard('🦴', mineral.toFixed(1), 'KG', 'Mineral Mass', 'm-purple', 15, 'BALANCED');

  // Render advanced insights with cycle analysis and predictive analytics
  var cycleAnalysisHtml = generateCycleAnalysisHtml();
  var advancedMetricsHtml = generateAdvancedMetricsHtml();
  var predictiveHtml = generatePredictiveInsights();

  document.getElementById('ai-insights-container').innerHTML =
    (projectionHtml || '') +
    insightsHtml +
    cycleAnalysisHtml +
    advancedMetricsHtml +
    predictiveHtml;
  document.getElementById('adv-metrics').innerHTML = metricsHtml;
}

// ═══════════════════════════════════════════════
// ADVANCED AI INSIGHTS ENGINE v3.0
// ═══════════════════════════════════════════════

function getCycleData(days) {
  var data = [];
  for (var i = days - 1; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var dStr = toLocalDate(d);
    var entry = DB._getDayEntry(dStr);
    var water = entry.water || 0;
    var meals = entry._rawDiet || {};
    var workout = entry._rawWorkout || {};
    var mealCount = 0;
    ['pregym', 'postworkout', 'lunch', 'dinner', 'supp_snack'].forEach(function (m) { if (meals[m] === true) mealCount++; });
    data.push({
      date: dStr,
      water: water,
      meals: mealCount,
      workout: workout.completed || false,
      weight: entry.weight || 0
    });
  }
  return data;
}

function calculateAdvancedMetrics(days) {
  var cycle = getCycleData(days);
  var weights = DB.weights().slice(-days);
  var profile = DB.profile();

  var metrics = {
    // Water metrics
    waterTotal: 0,
    waterDays: 0,
    waterOptimal: 0,
    waterGoal: profile.waterGoal || 10,

    // Diet metrics
    mealTotal: 0,
    mealDays: 0,
    mealAdherence: 0,

    // Workout metrics
    workoutDays: 0,
    workoutAdherence: 0,

    // Weight metrics
    weightStart: 0,
    weightEnd: 0,
    weightTrend: 0,
    weightDelta: 0,

    // Calculated
    consistencyScore: 0,
    disciplineRating: ''
  };

  cycle.forEach(function (day) {
    metrics.waterTotal += day.water;
    if (day.water > 0) metrics.waterDays++;
    if (day.water >= metrics.waterGoal) metrics.waterOptimal++;
    metrics.mealTotal += day.meals;
    if (day.meals > 0) metrics.mealDays++;
    if (day.workout) metrics.workoutDays++;
    if (day.weight > 0) {
      if (!metrics.weightStart) metrics.weightStart = day.weight;
      metrics.weightEnd = day.weight;
    }
  });

  metrics.waterAvg = (metrics.waterTotal / cycle.length).toFixed(1);
  metrics.mealAvg = (metrics.mealTotal / cycle.length).toFixed(1);
  metrics.mealAdherence = Math.round((metrics.mealDays / cycle.length) * 100);
  metrics.workoutAdherence = Math.round((metrics.workoutDays / cycle.length) * 100);

  if (metrics.weightStart && metrics.weightEnd) {
    metrics.weightDelta = (metrics.weightEnd - metrics.weightStart).toFixed(1);
    metrics.weightTrend = (metrics.weightDelta / days * 7).toFixed(2); // Weekly trend
  }

  var dScore = (metrics.mealAdherence * 0.35) + (metrics.workoutAdherence * 0.35) + ((metrics.waterDays / cycle.length) * 100 * 0.3);
  metrics.consistencyScore = Math.round(dScore);

  if (metrics.consistencyScore >= 95) metrics.disciplineRating = 'ELITE';
  else if (metrics.consistencyScore >= 85) metrics.disciplineRating = 'EXCELLENT';
  else if (metrics.consistencyScore >= 75) metrics.disciplineRating = 'GOOD';
  else if (metrics.consistencyScore >= 50) metrics.disciplineRating = 'MODERATE';
  else metrics.disciplineRating = 'REQUIRES FOCUS';

  return metrics;
}

function detectPatterns() {
  var week7 = calculateAdvancedMetrics(7);
  var week14 = calculateAdvancedMetrics(14);

  var patterns = {
    waterTrend: '',
    mealTrend: '',
    workoutTrend: '',
    bestDay: '',
    weakPoint: '',
    consistency: ''
  };

  // Water trend detection
  if (week7.waterAvg > week7.waterGoal * 0.8) {
    patterns.waterTrend = 'CONSISTENT HYDRATION';
  } else if (week7.waterAvg > week7.waterGoal * 0.6) {
    patterns.waterTrend = 'MODERATE HYDRATION';
  } else {
    patterns.waterTrend = 'DEHYDRATION PATTERN';
  }

  // Meal adherence trend
  if (week7.mealAdherence >= 85) {
    patterns.mealTrend = 'DISCIPLINED DIET';
  } else if (week7.mealAdherence >= 70) {
    patterns.mealTrend = 'VARIABLE MEALS';
  } else {
    patterns.mealTrend = 'INCONSISTENT DIET';
  }

  // Workout pattern
  if (week7.workoutAdherence >= 85) {
    patterns.workoutTrend = 'COMMITTED TRAINING';
  } else if (week7.workoutAdherence >= 60) {
    patterns.workoutTrend = 'SPORADIC TRAINING';
  } else {
    patterns.workoutTrend = 'SKIPPED WORKOUTS';
  }

  // Identify weak point
  var scores = {
    'Water': week7.waterDays / 7 * 100,
    'Diet': week7.mealAdherence,
    'Workouts': week7.workoutAdherence
  };
  patterns.weakPoint = Object.keys(scores).reduce(function (a, b) { return scores[a] < scores[b] ? a : b; });

  // Consistency over 14 days
  if (week7.consistencyScore === week14.consistencyScore) {
    patterns.consistency = 'STABLE PERFORMANCE';
  } else if (week7.consistencyScore > week14.consistencyScore) {
    patterns.consistency = 'IMPROVING TREND';
  } else {
    patterns.consistency = 'DECLINING TREND';
  }

  return patterns;
}

function generateAIInsights(m) {
  var ins = [];
  var ctx = m.context || {};

  // Load cycle data for analysis
  var week7 = calculateAdvancedMetrics(7);
  var week14 = calculateAdvancedMetrics(14);
  var patterns = detectPatterns();
  var profile = DB.profile();
  var weights = DB.weights();

  // ═══ ADVANCED WEIGHT TRACKING ANALYSIS ═══
  var weightAnalysis = {
    currentWeight: m.weight,
    targetWeight: profile.targetWeight,
    startWeight: profile.startWeight,
    remaining: m.weight - profile.targetWeight,
    weeklyDelta: week7.weightTrend,
    bodyFat: m.bfr,
    muscleMass: m.muscleMass,
    fatMass: m.weight * (m.bfr / 100),
    bodyAge: m.bodyAge,
    chronoAge: m.age,
    bmi: m.bmi,
    viscIdx: m.viscIdx,
    tbwPct: m.tbwPct
  };

  // ═══ TIER 1: CRITICAL HEALTH ALERTS ═══
  if (weightAnalysis.bmi >= 35) {
    ins.push({
      icon: '🚨',
      msg: 'OBESITY CRITICAL LEVEL',
      action: 'BMI: ' + weightAnalysis.bmi.toFixed(1) + ' (OBESE). Health at immediate risk. Weight: ' + weightAnalysis.currentWeight.toFixed(1) + 'kg → Target: ' + weightAnalysis.targetWeight + 'kg. Lose ' + Math.ceil(weightAnalysis.remaining) + 'kg = reduce mortality risk by 40-50%.'
    });
  } else if (weightAnalysis.viscIdx >= 15) {
    ins.push({
      icon: '⚠️',
      msg: 'VISCERAL FAT CRITICAL',
      action: 'Visceral Index: ' + weightAnalysis.viscIdx + ' (CRITICAL). Organ fat detected. Action: Eliminate refined carbs, increase fiber, add HIIT. This fat responds fastest to lifestyle.'
    });
  }

  // ═══ TIER 2: BODY COMPOSITION ANALYSIS ═══
  if (weightAnalysis.weeklyDelta < -1.5) {
    ins.push({
      icon: '⚡',
      msg: 'RAPID WEIGHT LOSS: ' + Math.abs(weightAnalysis.weeklyDelta).toFixed(2) + 'kg/week',
      action: 'Loss speed: ' + Math.abs(weightAnalysis.weeklyDelta).toFixed(2) + 'kg/week = UNSAFE. Risk: Muscle loss (current: ' + weightAnalysis.muscleMass.toFixed(1) + 'kg). Protein: ' + (weightAnalysis.currentWeight * 2.5).toFixed(0) + 'g/day. Slow pace preserves muscle.'
    });
  }

  if (m.muscleRate < (m.gender === 'male' ? 35 : 28)) {
    ins.push({
      icon: '💪',
      msg: 'MUSCLE MASS LOW: ' + m.muscleRate.toFixed(1) + '%',
      action: 'Muscle: ' + m.muscleMass.toFixed(1) + 'kg (' + m.muscleRate.toFixed(1) + '% of body). Add strength training 4x/week + protein ' + (weightAnalysis.currentWeight * 2.0).toFixed(0) + 'g/day. Muscle increases metabolism.'
    });
  }

  // ═══ TIER 3: BODY FAT ANALYSIS ═══
  var bfTarget = m.gender === 'male' ? 15 : 22;
  if (m.bfr > bfTarget + 10) {
    ins.push({
      icon: '🔥',
      msg: 'AGGRESSIVE FAT LOSS PHASE',
      action: 'Body Fat: ' + m.bfr.toFixed(1) + '% (Target: ' + bfTarget + '%). Fat mass: ' + weightAnalysis.fatMass.toFixed(1) + 'kg. Lose 1kg fat every 7-10 days at 500kcal deficit.'
    });
  } else if (m.bfr <= bfTarget + 2) {
    ins.push({
      icon: '🏆',
      msg: 'BODY FAT OPTIMAL',
      action: 'Body Fat: ' + m.bfr.toFixed(1) + '% (Target achieved!). Muscle: ' + m.muscleMass.toFixed(1) + 'kg. Focus: Maintenance. Add 200kcal, prioritize protein & strength.'
    });
  }

  // ═══ TIER 4: BMI & WEIGHT TRACKING ═══
  if (weightAnalysis.bmi < 18.5) {
    ins.push({
      icon: '📊',
      msg: 'UNDERWEIGHT STATUS',
      action: 'BMI: ' + weightAnalysis.bmi.toFixed(1) + ' (Underweight). Target range: ' + (18.5 * Math.pow(profile.height / 100, 2)).toFixed(0) + '-' + (24.9 * Math.pow(profile.height / 100, 2)).toFixed(0) + 'kg. Gain muscle: +300kcal + protein ' + (weightAnalysis.currentWeight * 2.0).toFixed(0) + 'g/day.'
    });
  } else if (weightAnalysis.weeklyDelta === 0 || Math.abs(weightAnalysis.weeklyDelta) < 0.2) {
    var plateauReason = '';
    if (ctx.water && ctx.water.avg3d < (ctx.water.goal * 0.7)) {
      plateauReason = 'water (avg: ' + ctx.water.avg3d.toFixed(1) + ' vs goal: ' + ctx.water.goal + ')';
    } else if (ctx.diet && ctx.diet.avg3d < 75) {
      plateauReason = 'meal adherence (' + ctx.diet.avg3d.toFixed(0) + '%)';
    } else {
      plateauReason = 'body adapting - likely recomposition';
    }
    ins.push({
      icon: '⚖️',
      msg: 'WEIGHT PLATEAU DETECTED',
      action: 'Weight: ' + weightAnalysis.currentWeight.toFixed(1) + 'kg stable. Root: ' + plateauReason + '. If fixable issue, resolve in 3-5 days. Otherwise, losing fat + gaining muscle = PROGRESS.'
    });
  } else if (Math.abs(week7.weightTrend) > 0.3) {
    var direction = week7.weightTrend < 0 ? 'losing' : 'gaining';
    var etalabel = Math.ceil((weightAnalysis.remaining) / Math.abs(week7.weightTrend));
    ins.push({
      icon: '📈',
      msg: 'WEIGHT MOMENTUM: ' + (week7.weightTrend < 0 ? '-' : '+') + Math.abs(week7.weightTrend).toFixed(2) + 'kg/week',
      action: 'Trend: ' + direction + ' ' + Math.abs(week7.weightTrend).toFixed(2) + 'kg/week. Current: ' + weightAnalysis.currentWeight.toFixed(1) + 'kg → Goal: ' + weightAnalysis.targetWeight + 'kg. ETA: ' + etalabel + ' weeks.'
    });
  }

  // ═══ TIER 5: METABOLIC INSIGHTS ═══
  var maintenance = Math.round(m.bmr * 1.375);
  var deficitCurrent = Math.abs(Math.round(maintenance - ((Math.abs(weightAnalysis.weeklyDelta || 0.5) * 3500) / 7)));

  ins.push({
    icon: '🔋',
    msg: 'METABOLIC RATE: BMR ' + Math.round(m.bmr) + ' | TDEE ' + maintenance + ' kcal',
    action: 'Basal (rest): ' + Math.round(m.bmr) + 'kcal. Total: ' + maintenance + 'kcal/day. Current deficit: ' + deficitCurrent + 'kcal/day → ' + (deficitCurrent * 7 / 3500).toFixed(1) + 'kg/week loss potential. For weight goal, target: ' + (Math.round(maintenance * 0.85)) + 'kcal/day.'
  });

  // ═══ TIER 6: BIOLOGICAL AGE ═══
  var ageStatus = weightAnalysis.bodyAge > weightAnalysis.chronoAge ? 'AGED' : 'REVERSED';
  var ageDiff = Math.abs(weightAnalysis.bodyAge - weightAnalysis.chronoAge);
  if (ageStatus === 'AGED' && ageDiff > 0) {
    ins.push({
      icon: '🎂',
      msg: 'BIOLOGICAL AGE: ' + weightAnalysis.bodyAge + ' (Actual: ' + weightAnalysis.chronoAge + ')',
      action: 'Aging: +' + ageDiff + ' years due to body fat (' + m.bfr.toFixed(1) + '%) and hydration (' + m.tbwPct.toFixed(1) + '%). Reverse aging: Lower fat to ' + bfTarget + '% + TBW to 55%+. Reverses cellular age.'
    });
  } else if (ageDiff > 0) {
    ins.push({
      icon: '✨',
      msg: 'BIOLOGICAL AGE REVERSED: ' + weightAnalysis.bodyAge + ' (Actual: ' + weightAnalysis.chronoAge + ')',
      action: 'Age reversed ' + ageDiff + ' years! Metrics excellent: Fat ' + m.bfr.toFixed(1) + '%, TBW ' + m.tbwPct.toFixed(1) + '%, Muscle ' + m.muscleRate.toFixed(1) + '%. Maintain this consistency.'
    });
  }

  // ═══ TIER 7: HYDRATION & CELLULAR ═══
  if (m.tbwPct < 50) {
    ins.push({
      icon: '💧',
      msg: 'DEHYDRATION: TBW ' + m.tbwPct.toFixed(1) + '%',
      action: 'Body water: ' + m.tbwPct.toFixed(1) + '% (target: 52-58%). Add 2-3 glasses/day for 7 days. Retest. Proper hydration = faster metabolism & better fat loss.'
    });
  }

  // ═══ TIER 8: WEIGHT HISTORY ═══
  if (weights.length >= 7) {
    var firstWeight = weights[0].kg;
    var totalLoss = firstWeight - weightAnalysis.currentWeight;
    var totalDays = (new Date(weights[weights.length - 1].date) - new Date(weights[0].date)) / (1000 * 60 * 60 * 24);
    var avgWeeklyLoss = (totalLoss / (totalDays / 7));

    if (totalLoss > 0 && avgWeeklyLoss > 0) {
      var etaWeeks = Math.ceil((weightAnalysis.remaining) / (avgWeeklyLoss || 0.5));
      ins.push({
        icon: '🎯',
        msg: 'TOTAL PROGRESS: -' + totalLoss.toFixed(1) + 'kg in ' + Math.ceil(totalDays) + ' days',
        action: 'History: ' + firstWeight.toFixed(1) + 'kg → ' + weightAnalysis.currentWeight.toFixed(1) + 'kg. Average: ' + avgWeeklyLoss.toFixed(2) + 'kg/week. Remaining: ' + weightAnalysis.remaining.toFixed(1) + 'kg. ETA: ' + etaWeeks + ' weeks.'
      });
    }
  }

  // ═══ PRIORITY & CLEANUP ═══
  if (ins.length === 0) {
    ins.push({
      icon: '🏆',
      msg: 'ALL METRICS OPTIMAL',
      action: 'Weight: ' + weightAnalysis.currentWeight.toFixed(1) + 'kg | Fat: ' + m.bfr.toFixed(1) + '% | Muscle: ' + m.muscleMass.toFixed(1) + 'kg | Age: ' + m.bodyAge + 'yrs | TBW: ' + m.tbwPct.toFixed(1) + '%. Elite metrics. Focus: advanced periodization & recovery.'
    });
  }

  var priority = { '🚨': 0, '⚠️': 1, '⚡': 2, '💪': 3, '🔥': 4, '📊': 5, '⚖️': 6, '📈': 7, '🔋': 8, '🎂': 9, '✨': 10, '💧': 11, '🎯': 12, '🏆': 13 };
  ins.sort(function (a, b) {
    return (priority[a.icon] || 99) - (priority[b.icon] || 99);
  });

  return ins.slice(0, 8);
}

function createMetricCard(icon, val, unit, label, cls, idx, status) {
  var statusHtml = status ? '<div class="metric-status">• ' + status + '</div>' : '';
  return '<div class="metric-card ' + cls + '" style="animation-delay:' + (0.3 + idx * 0.05) + 's">' +
    statusHtml +
    '<div class="metric-main">' +
    '<div class="metric-icon">' + icon + '</div>' +
    '<div class="metric-val">' + val + '<span>' + unit + '</span></div>' +
    '</div>' +
    '<div class="metric-lbl">' + label + '</div>' +
    '</div>';
}

// ═══════════════════════════════════════════════
// ADVANCED CYCLE ANALYSIS & INTELLIGENCE
// ═══════════════════════════════════════════════

function generateCycleAnalysisHtml() {
  var week7 = calculateAdvancedMetrics(7);
  var week14 = calculateAdvancedMetrics(14);
  var month30 = calculateAdvancedMetrics(30);
  var patterns = detectPatterns();

  var html = '<div class="intelligence-section" style="margin:20px 16px; padding:16px; background:linear-gradient(135deg, rgba(34,197,94,0.08), rgba(255,107,26,0.05)); border:1px solid rgba(255,107,26,0.2); border-radius:16px; backdrop-filter:blur(10px);">';

  // Header
  html += '<div style="font-size:0.8rem; font-weight:900; letter-spacing:2px; color:var(--gold); margin-bottom:12px; display:flex; align-items:center; gap:6px;">🧠 CYCLE INTELLIGENCE</div>';

  // Three-period comparison
  html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px;">';

  html += '<div style="background:rgba(34,197,94,0.1); border:1px solid var(--green); border-radius:10px; padding:10px; text-align:center;">';
  html += '<div style="font-size:0.65rem; color:var(--sub); font-weight:700;">7-DAY SCORE</div>';
  html += '<div style="font-size:1.2rem; color:var(--green); font-weight:900; margin:4px 0;">' + week7.consistencyScore + '%</div>';
  html += '<div style="font-size:0.6rem; color:var(--sub);">W:' + week7.waterDays + ' D:' + week7.mealAdherence + '% T:' + week7.workoutAdherence + '%</div>';
  html += '</div>';

  html += '<div style="background:rgba(255,107,26,0.1); border:1px solid var(--gold); border-radius:10px; padding:10px; text-align:center;">';
  html += '<div style="font-size:0.65rem; color:var(--sub); font-weight:700;">14-DAY TREND</div>';
  html += '<div style="font-size:1.2rem; color:var(--gold); font-weight:900; margin:4px 0;">' + week14.consistencyScore + '%</div>';
  if (week7.weightDelta !== '0') {
    html += '<div style="font-size:0.6rem; color:var(--fire);">Weight: ' + (week14.weightDelta > 0 ? '+' : '') + week14.weightDelta + 'kg</div>';
  }
  html += '</div>';

  html += '<div style="background:rgba(100,200,255,0.1); border:1px solid var(--blue); border-radius:10px; padding:10px; text-align:center;">';
  html += '<div style="font-size:0.65rem; color:var(--sub); font-weight:700;">30-DAY AVG</div>';
  html += '<div style="font-size:1.2rem; color:var(--blue); font-weight:900; margin:4px 0;">' + month30.consistencyScore + '%</div>';
  html += '<div style="font-size:0.6rem; color:var(--sub);">Stability: ' + (patterns.consistency === 'STABLE PERFORMANCE' ? '✓' : patterns.consistency === 'IMPROVING TREND' ? '↗' : '↘') + '</div>';
  html += '</div>';

  html += '</div>';

  // Key patterns
  html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; font-size:0.65rem;">';
  html += '<div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:8px; border-left:3px solid var(--green);"><strong>🌊</strong> ' + patterns.waterTrend + '</div>';
  html += '<div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:8px; border-left:3px solid var(--gold);"><strong>🍱</strong> ' + patterns.mealTrend + '</div>';
  html += '<div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:8px; border-left:3px solid var(--fire);"><strong>💪</strong> ' + patterns.workoutTrend + '</div>';
  html += '<div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:8px; border-left:3px solid var(--purple);"><strong>⚡</strong> Weak: ' + patterns.weakPoint + '</div>';
  html += '</div>';

  // Discipline rating with visual
  var ratingColor = week7.disciplineRating === 'ELITE' ? 'var(--green)' : (week7.disciplineRating === 'EXCELLENT' ? 'var(--gold)' : 'var(--sub)');
  html += '<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:10px; border:1px solid ' + ratingColor + '44; margin-bottom:8px;">';
  html += '<div style="font-size:0.65rem; color:var(--sub); font-weight:700;">DISCIPLINE RATING</div>';
  html += '<div style="display:flex; align-items:center; gap:8px; margin-top:4px;">';

  var stars = '';
  var ratingVal = week7.disciplineRating === 'ELITE' ? 5 : (week7.disciplineRating === 'EXCELLENT' ? 4 : (week7.disciplineRating === 'GOOD' ? 3 : 2));
  for (var s = 0; s < ratingVal; s++) stars += '⭐';
  for (var s = ratingVal; s < 5; s++) stars += '☆';

  html += '<div style="font-size:0.9rem; color:' + ratingColor + '; font-weight:900;">' + stars + '</div>';
  html += '<div style="flex:1; font-size:0.65rem; color:var(--sub);">' + week7.disciplineRating + ' | Score: ' + week7.consistencyScore + '/100</div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';

  return html;
}

function generatePredictiveInsights() {
  var profile = DB.profile();
  var weights = DB.weights();
  var week7 = calculateAdvancedMetrics(7);

  if (weights.length < 3 || !profile.targetWeight) {
    return '<div style="padding:10px; font-size:0.7rem; color:var(--sub); text-align:center;">Log more data for predictive analytics...</div>';
  }

  var latest = weights[weights.length - 1].kg;
  var current = latest;
  var target = parseFloat(profile.targetWeight);
  var weeklyRate = parseFloat(week7.weightTrend) || 0;

  var html = '<div class="prediction-card" style="margin:20px 16px; padding:16px; background:linear-gradient(135deg, rgba(168,107,207,0.1), rgba(88,198,255,0.05)); border:1px solid rgba(168,107,207,0.2); border-radius:16px;">';

  html += '<div style="font-size:0.8rem; font-weight:900; letter-spacing:2px; color:var(--purple); margin-bottom:12px; display:flex; align-items:center; gap:6px;">🔮 PREDICTIVE ANALYTICS</div>';

  if (weeklyRate < -0.3) {
    var weeksRemaining = Math.ceil((current - target) / Math.abs(weeklyRate));
    var projDate = new Date();
    projDate.setDate(projDate.getDate() + (weeksRemaining * 7));

    html += '<div style="background:rgba(34,197,94,0.1); padding:12px; border-radius:10px; margin-bottom:10px; border-left:4px solid var(--green);">';
    html += '<div style="font-size:0.65rem; color:var(--sub); font-weight:700;">PROJECTED GOAL DATE</div>';
    html += '<div style="font-size:1.1rem; font-weight:900; color:var(--green); margin-top:4px;">📅 ' + toLocalDate(projDate) + '</div>';
    html += '<div style="font-size:0.65rem; color:var(--sub); margin-top:4px;">At current rate: ' + Math.abs(weeklyRate).toFixed(2) + 'kg/week</div>';
    html += '</div>';

    html += '<div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:10px; margin-bottom:10px; font-size:0.7rem;">';
    html += '<strong>📊 Weight Loss Physics:</strong><br>';
    html += 'Current: ' + current.toFixed(1) + 'kg | Target: ' + target + 'kg | Remaining: ' + (current - target).toFixed(1) + 'kg<br>';
    html += 'Weekly rate: ' + Math.abs(weeklyRate).toFixed(2) + 'kg | ETA: ' + weeksRemaining + ' weeks';
    html += '</div>';
  } else if (weeklyRate > 0.3) {
    html += '<div style="background:rgba(239,68,68,0.1); padding:12px; border-radius:10px; border-left:4px solid var(--red);">';
    html += '<div style="font-size:0.65rem; color:var(--sub); font-weight:700;">⚠️ GAINING WEIGHT</div>';
    html += '<div style="font-size:0.9rem; color:var(--red); font-weight:900; margin-top:4px;">+' + weeklyRate.toFixed(2) + 'kg/week</div>';
    html += '<div style="font-size:0.65rem; color:var(--sub); margin-top:6px;">Action: Review calorie intake & meal timing. Increase activity level.</div>';
    html += '</div>';
  } else {
    html += '<div style="background:rgba(168,107,207,0.1); padding:12px; border-radius:10px; border-left:4px solid var(--purple);">';
    html += '<div style="font-size:0.65rem; color:var(--sub); font-weight:700;">🏔️ PLATEAU STATE</div>';
    html += '<div style="font-size:0.9rem; color:var(--purple); font-weight:900; margin-top:4px;">Change: ' + Math.abs(weeklyRate).toFixed(2) + 'kg/week (stable)</div>';
    html += '<div style="font-size:0.65rem; color:var(--sub); margin-top:6px;">Body recomposition in progress. Track body measurements & photos for better progress indication.</div>';
    html += '</div>';
  }

  html += '</div>';

  return html;
}

// ═══════════════════════════════════════════════
// ADVANCED METRICS RENDERING
// ═══════════════════════════════════════════════

function generateAdvancedMetricsHtml() {
  var week7 = calculateAdvancedMetrics(7);
  var profile = DB.profile();

  var html = '<div class="advanced-metrics-section" style="margin:20px 16px; padding:16px; background:rgba(255,107,26,0.05); border:1px solid rgba(255,107,26,0.15); border-radius:16px;">';

  html += '<div style="font-size:0.8rem; font-weight:900; letter-spacing:2px; color:var(--fire); margin-bottom:12px;">📊 ADVANCED METRICS (7D AVG)</div>';

  html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">';

  // Water metrics
  html += '<div style="background:rgba(88,198,255,0.1); padding:8px 4px; border-radius:10px; border-left:3px solid var(--blue); margin-bottom: 2px; text-align: center;">';
  html += '<div style="font-size:0.45rem; color:var(--sub); font-weight:700;">💧 HYDRATION</div>';
  html += '<div style="font-size:0.8rem; color:var(--blue); font-weight:900; margin-top:2px;">' + week7.waterAvg + 'L/day</div>';
  html += '<div style="font-size:0.45rem; color:var(--sub);">' + week7.waterGoal + ' glasses</div>';
  html += '</div>';

  // Diet adherence
  html += '<div style="background:rgba(255,184,82,0.1); padding:8px 4px; border-radius:10px; border-left:3px solid var(--gold); margin-bottom: 2px; text-align: center;">';
  html += '<div style="font-size:0.45rem; color:var(--sub); font-weight:700;">🍱 DIET ADHERE</div>';
  html += '<div style="font-size:0.8rem; color:var(--gold); font-weight:900; margin-top:2px;">' + week7.mealAdherence + '%</div>';
  html += '<div style="font-size:0.45rem; color:var(--sub);">' + week7.mealDays + '/7 days tracked</div>';
  html += '</div>';

  // Workout adherence card removed

  // Weight trend
  if (week7.weightDelta !== '0' && week7.weightDelta !== 0) {
    var trendColor = parseFloat(week7.weightDelta) < 0 ? 'var(--green)' : 'var(--red)';
    html += '<div style="background:rgba(34,197,94,0.1); padding:8px 4px; border-radius:10px; border-left:3px solid ' + trendColor + '; margin-bottom: 2px; text-align: center;">';
    html += '<div style="font-size:0.45rem; color:var(--sub); font-weight:700;">⚖️ WT DELTA</div>';
    html += '<div style="font-size:0.8rem; color:' + trendColor + '; font-weight:900; margin-top:2px;">' + (parseFloat(week7.weightDelta) > 0 ? '+' : '') + week7.weightDelta + 'kg</div>';
    html += '<div style="font-size:0.45rem; color:var(--sub);">7-day change</div>';
    html += '</div>';
  }

  html += '</div>';

  html += '</div>';

  return html;
}



// ═══════════════════════════════════════════════
// SETUP & BOOT
// ═══════════════════════════════════════════════
function setupSave() {
  if (!DATA_LOADED) { showToast('Loading... please wait'); return; }
  var name = document.getElementById('s-name').value || 'Athlete';
  var weight = parseFloat(document.getElementById('s-weight').value);
  var targetWeight = parseFloat(document.getElementById('s-target-weight').value);
  var height = parseFloat(document.getElementById('s-height').value);
  var age = parseInt(document.getElementById('s-age').value);
  var gender = document.getElementById('s-gender').value;
  var waterGoal = parseInt(document.getElementById('s-water-goal').value) || 10;
  var bodyFat = parseFloat(document.getElementById('s-bodyfat').value) || 20;
  var goalMode = document.getElementById('s-goal-mode').value;

  if (!weight) { showToast('Enter your current weight!'); return; }
  if (!targetWeight) { showToast('Enter your target weight!'); return; }
  if (!height) { showToast('Enter your height for BMI!'); return; }
  if (!age) { showToast('Enter your age for accuracy!'); return; }

  DB.setProfile({
    name: name, weight: weight, targetWeight: targetWeight,
    height: height, age: age, gender: gender, waterGoal: waterGoal,
    startWeight: weight, bodyFat: bodyFat, goalMode: goalMode
  });
  DB.addWeight(today(), weight);
  initApp();
}

function startChallenge() {
  DB.setProfile({ startDate: today() });
  updateTopBar();
  syncProfileWithSW(); // tell SW challenge is now active
  renderHome();
  showToast('🔥 Day 1 started! Stay disciplined.');
}

function resetChallenge() {
  if (confirm('⚠️ RESET CHALLENGE? This will clear your Day count. Your history remains.')) {
    DB.setProfile({ startDate: null });
    updateTopBar();
    syncProfileWithSW(); // tell SW challenge is now inactive
    renderHome();
    showToast('Challenge Reset. Day count cleared.');
  }
}

function restartChallenge() {
  if (confirm('🔄 RESTART CHALLENGE? Start again at Day 1 (Today).')) {
    DB.setProfile({ startDate: today() });
    updateTopBar();
    syncProfileWithSW(); // tell SW challenge restarted
    renderHome();
    showToast('Challenge Restarted! Day 1.');
  }
}

function initApp() {
  document.getElementById('setup').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  updateTopBar();
  setInterval(updateTopBar, 30000);
  initNav();
  goPage('home');
  // Start background systems after UI is ready
  initBackgroundMode();
}

// ═══════════════════════════════════════════════
// BOOTSTRAP - Load data.json then start
// ═══════════════════════════════════════════════
(function bootstrap() {
  fetch('data.json?t=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DAY_NAMES = d.DAY_NAMES;
      DAY_SHORT = d.DAY_SHORT;
      DAY_WORKOUT_TYPE = d.DAY_WORKOUT_TYPE;
      WORKOUTS = d.WORKOUTS;
      WEEKLY_MEALS = d.WEEKLY_MEALS;
      MEAL_CONFIG = d.MEAL_CONFIG;
      DAILY_MACROS = d.DAILY_MACROS;
      DAILY_TIMELINE = d.DAILY_TIMELINE;
      DATA_LOADED = true;
      // Hide splash screen
      var splash = document.getElementById('splash');
      if (splash) splash.style.display = 'none';
      // If user has profile, start app; otherwise show setup
      if (DB.profile().name) {
        initApp();
      } else {
        // Ensure setup is visible
        document.getElementById('setup').style.display = 'block';
        window.setupReady = true;
      }
    })
    .catch(function (e) {
      console.error('data.json load failed:', e);
      document.body.innerHTML = "<div style='padding:40px;color:white;text-align:center;'><h2>CORS Error</h2><p>Please open using a Local Server (Live Server in VS Code)</p></div>";
    });
})();

// ═══════════════════════════════════════════════
// PWA & NOTIFICATIONS — Ultra Mode 24/7
// ═══════════════════════════════════════════════

var _swReg = null; // global reference to SW registration

/* ── Utility: post message to SW safely ──────── */
function postToSW(msg) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(msg);
    return true;
  }
  return false;
}

/* ── Full SW Setup ───────────────────────────── */
function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js?v=12').then(function (reg) {
    _swReg = reg;
    console.log('[FitOS] SW v11 registered:', reg.scope);

    // Force SW to take control immediately
    if (reg.waiting) reg.waiting.postMessage({ type: 'START_CLOCK' });
    if (reg.active) reg.active.postMessage({ type: 'START_CLOCK' });

    // Wait for SW to be fully ready
    navigator.serviceWorker.ready.then(function (readyReg) {
      _swReg = readyReg;

      // Sync user profile so SW knows if challenge is active
      if (readyReg.active) {
        readyReg.active.postMessage({ type: 'SYNC_PROFILE', payload: DB.profile() });
        readyReg.active.postMessage({ type: 'START_CLOCK' });
        readyReg.active.postMessage({ type: 'CATCH_UP' }); // check missed notifs on load
      }

      // Register Periodic Background Sync
      // minInterval: 15 minutes — OS fires it as often as it allows
      if ('periodicSync' in readyReg) {
        readyReg.periodicSync.register('fitos-reminder-check', {
          minInterval: 15 * 60 * 1000
        }).then(function () {
          console.log('[FitOS] Periodic sync registered (15min min interval).');
        }).catch(function (err) {
          console.warn('[FitOS] Periodic sync unavailable:', err.message);
        });
      }
    });

    // Listen for SW state changes (e.g. new SW activated)
    reg.addEventListener('updatefound', function () {
      var newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'activated') {
            newWorker.postMessage({ type: 'START_CLOCK' });
          }
        });
      }
    });

  }).catch(function (err) {
    console.error('[FitOS] SW registration failed:', err);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', setupServiceWorker);
}

/* ── Re-sync profile with SW (call on challenge start/reset) ──── */
function syncProfileWithSW() {
  var sent = postToSW({ type: 'SYNC_PROFILE', payload: DB.profile() });
  if (!sent && _swReg && _swReg.active) {
    _swReg.active.postMessage({ type: 'SYNC_PROFILE', payload: DB.profile() });
  }
}

/* ── Permission Request — Full Modal UI ──────── */
function requestNotifPermission() {
  if (!window.Notification) {
    showToast('❌ Browser does not support notifications.');
    return;
  }
  if (Notification.permission === 'granted') {
    // Already granted — show test notification
    postToSW({ type: 'TEST_NOTIF' });
    showToast('✅ Notifications ON! Test bhej diya.');
    return;
  }
  if (Notification.permission === 'denied') {
    openModal(
      '<div class="modal-title" style="color:var(--red)">🔕 Notifications Blocked!</div>' +
      '<div style="font-size:.8rem;color:var(--sub);text-align:center;margin:12px 0 20px;line-height:1.6;">' +
      'Browser ne notifications block ki hain.<br>' +
      '<strong style="color:var(--text)">Fix karne ke steps:</strong><br>' +
      '1. Address bar mein 🔒 icon tap karo<br>' +
      '2. Notifications → Allow karo<br>' +
      '3. Page reload karo' +
      '</div>' +
      '<button class="modal-btn" onclick="closeModal()" style="width:100%">GOT IT</button>'
    );
    return;
  }

  // Show full-screen permission modal
  openModal(
    '<div style="text-align:center;padding:8px 0;">' +
    '<div style="font-size:2.5rem;margin-bottom:8px;">🔔</div>' +
    '<div class="modal-title">24/7 STRICT REMINDERS</div>' +
    '<div style="font-size:.78rem;color:var(--sub);text-align:center;margin:10px 0 15px;line-height:1.7;">' +
    'Ye app tumhe <strong style="color:var(--fire)">har din 17+ reminders</strong> bhejegi:<br>' +
    '⏰ Wake up • ⚖️ Weight log<br>' +
    '💧 Hydration • 🍱 Meals<br>' +
    '🏋️ Gym time' +
    '</div>' +
    '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:14px;margin-bottom:20px;text-align:left;">' +
    '<div style="font-size:.75rem;font-weight:700;color:var(--red);margin-bottom:6px;">⚠️ FIX ANDROID APP KILLER</div>' +
    '<div style="font-size:.65rem;color:var(--text);line-height:1.5;">' +
    'Android browser ko background me kill kar deta hai. Notifications hamesha aane ke liye:<br><br>' +
    '1. Phone settings > Apps > Chrome me jao<br>' +
    '2. <b>Battery</b> par tap karo<br>' +
    '3. <b>Unrestricted</b> select karo!<br><br>' +
    '<span style="color:var(--sub)">Sirf tabhi reminders app band hone par proper aayengi!</span>' +
    '</div>' +
    '</div>' +
    '<button class="modal-btn primary" style="width:100%;font-size:.85rem;padding:14px;" onclick="_doRequestPermission()">🔥 ENABLE ALERTS & I FIXED BATTERY</button>' +
    '<button class="modal-btn" style="width:100%;margin-top:8px;font-size:.75rem;" onclick="closeModal()">BAAD MEIN</button>' +
    '</div>'
  );
}

function _doRequestPermission() {
  closeModal();
  Notification.requestPermission().then(function (permission) {
    if (permission === 'granted') {
      // Immediately fire a welcome notification via SW
      setTimeout(function () {
        postToSW({
          type: 'SHOW_STRICTION',
          payload: {
            title: '🔥 FitOS Reminders — ACTIVE!',
            body: 'Bhai, ab koi reminder miss nahi hogi. App band ho tab bhi pushups ke liye yaad dilaenge! 💪',
            tag: 'welcome-notif'
          }
        });
        // Also restart the clock
        postToSW({ type: 'START_CLOCK' });
        postToSW({ type: 'SYNC_PROFILE', payload: DB.profile() });
      }, 500);
      showToast('✅ 24/7 Reminders Active! Har slot pe notification aayegi.');
      renderHome(); // hide the notification banner
    } else {
      showToast('❌ Permission denied. Notifications off rahegi.');
    }
  });
}

/* ── In-Page Reminder Check (runs every minute while app is open) */
function checkTimelineReminders() {
  if (!DATA_LOADED || !window.Notification || Notification.permission !== 'granted') return;
  var d = today();
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var mealData = DB.getMeal(d);
  var notifLog = DB.getNotifHistory();
  var todayPrefix = d + '_';

  /* 1. Job Ends - Pre-gym / Setup */
  if (h === 2 && m >= 30 && m < 35) {
    if (!notifLog[todayPrefix + 'job_end']) {
      sendStrictNotif('🏁 JOB ENDS!', 'Shift khatam! Start your pre-workout meal now.', 'job_end');
    }
  }

  /* 2. Gym time at 4 AM */
  if (h === 4 && m < 5) {
    var wkData = DB.getWorkout(d);
    if (!wkData.completed && !notifLog[todayPrefix + 'gym_4am']) {
      sendStrictNotif('🏋️ GYM TIME — AB JAO!', '4:00 AM. Beast Mode ON at Fit Master Gym! No excuses.', 'gym_4am');
    }
  }

  /* 3. Sleep at 6:15 AM */
  if (h === 6 && m >= 15 && m < 20) {
    if (!notifLog[todayPrefix + 'sleep_6am']) {
      sendStrictNotif('😴 RECOVERY SLEEP', 'Deep 6-hour recovery window begins. Rest up.', 'sleep_6am');
    }
  }

  /* 4. Wake up at 12 PM */
  if (h === 12 && m < 5) {
    if (!notifLog[todayPrefix + 'wake_12pm']) {
      sendStrictNotif('⏰ WAKE UP!', 'Day shift shuru! Fasted detox modes ON.', 'wake_12pm');
    }
  }

  /* 5. Pre-shift Dinner at 5 PM */
  if (h === 17 && m < 5) {
    if (!notifLog[todayPrefix + 'dinner_5pm']) {
      sendStrictNotif('🍽️ DINNER TIME', 'Get your lean fuel before work shift.', 'dinner_5pm');
    }
  }

  /* 6. Job Starts at 6:30 PM */
  if (h === 18 && m >= 30 && m < 35) {
    if (!notifLog[todayPrefix + 'job_start']) {
      sendStrictNotif('🏢 JOB STARTS', 'Night grind mode ON! Focus up.', 'job_start');
    }
  }

  /* 7. Daily log reminder at 11 PM */
  if (h === 23 && m < 5) {
    if (!notifLog[todayPrefix + 'endofday']) {
      sendStrictNotif('📋 DAILY LOG', 'Raat ke 11 baj gaye. Log your progress!', 'endofday');
    }
  }
}

/* ── Send strict notification via SW ────────── */
function sendStrictNotif(title, body, id) {
  var d = today();
  DB.setNotifId(d + '_' + id);
  if (!postToSW({ type: 'SHOW_STRICTION', payload: { title: title, body: body, tag: id } })) {
    // Fallback: direct Notification API
    try { new Notification(title, { body: body, icon: './icons/fitos_icon.png' }); } catch (e) { }
  }
}

/* ── isTimeMatch / isComingUp helpers ─────────── */
function isTimeMatch(timeStr) {
  var now = new Date();
  var hh = now.getHours();
  var mm = now.getMinutes();
  var hh12 = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
  var ampm = hh >= 12 ? 'PM' : 'AM';
  var nowStr = hh12 + ':' + String(mm).padStart(2, '0') + ' ' + ampm;
  return nowStr === timeStr;
}
function isComingUp(timeStr, mins) {
  var now = new Date();
  var parts = timeStr.split(':');
  var target = new Date();
  var hh = parseInt(parts[0]);
  if (timeStr.indexOf('PM') !== -1 && hh < 12) hh += 12;
  if (timeStr.indexOf('AM') !== -1 && hh === 12) hh = 0;
  target.setHours(hh, parseInt(parts[1]), 0, 0);
  var diff = (target.getTime() - now.getTime()) / 60000;
  return diff > 0 && diff <= mins;
}

/* ── Auto-check every minute while app is open ── */
setInterval(checkTimelineReminders, 60000);
setTimeout(checkTimelineReminders, 3000); // also check 3s after page open

// ═══════════════════════════════════════════════
// BACKGROUND MODE ENGINE
// ═══════════════════════════════════════════════

var _bgInitDone = false;

function initBackgroundMode() {
  if (_bgInitDone) return;
  _bgInitDone = true;

  /* 1. Revive SW whenever app comes back to foreground */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      console.log('[FitOS] App foregrounded — reviving SW...');
      postToSW({ type: 'START_CLOCK' });
      postToSW({ type: 'CATCH_UP' });
      postToSW({ type: 'SYNC_PROFILE', payload: DB.profile() });
      // Re-register periodic sync in case it got dropped
      _reRegisterPeriodicSync();
    }
  });

  /* 2. keepAlive ping: fetch manifest every 20s while page is visible */
  setInterval(function () {
    if (document.visibilityState === 'visible' && navigator.serviceWorker && navigator.serviceWorker.controller) {
      fetch('./manifest.json?_ka=' + Date.now(), { cache: 'no-store' }).catch(function () { });
    }
  }, 20000);

  /* 3. On first load, check if we need to show background setup prompt */
  _checkBackgroundSetupNeeded();
}

function _reRegisterPeriodicSync() {
  if (!_swReg) return;
  navigator.serviceWorker.ready.then(function (reg) {
    if ('periodicSync' in reg) {
      reg.periodicSync.register('fitos-reminder-check', {
        minInterval: 15 * 60 * 1000
      }).catch(function () { });
    }
  });
}

/* ── Check if setup is done already ───────────── */
function _checkBackgroundSetupNeeded() {
  // Show banner only if: never shown before, OR notification not yet granted
  var dismissed = localStorage.getItem('fitos_bg_setup_done');
  var notifGranted = window.Notification && Notification.permission === 'granted';
  if (!dismissed && !notifGranted) {
    setTimeout(function () {
      showBackgroundSetupModal();
    }, 1500); // slight delay so app loads first
  }
}

/* ── Background Setup — Full screen step-by-step modal ──── */
function showBackgroundSetupModal() {
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  var installNote = '';
  if (!isStandalone) {
    if (isAndroid) {
      installNote = '<div style="background:rgba(255,107,26,0.15);border:1px solid var(--fire);border-radius:10px;padding:12px;margin-bottom:14px;font-size:.75rem;color:var(--fire);text-align:center;">' +
        '<strong>&#9888;&#65039; Pehle Install Karo!</strong><br>' +
        '<span style="color:var(--sub)">Chrome → ⋮ Menu → "Add to Home Screen" → Install<br>Phir Home Screen se kholo</span>' +
        '</div>';
    } else {
      installNote = '<div style="background:rgba(255,107,26,0.15);border:1px solid var(--fire);border-radius:10px;padding:12px;margin-bottom:14px;font-size:.75rem;color:var(--fire);text-align:center;">' +
        '<strong>&#9888;&#65039; PWA Install Required</strong><br>' +
        '<span style="color:var(--sub)">Home Screen pe add karo background ke liye</span>' +
        '</div>';
    }
  }

  var androidBatterySteps = isAndroid ? (
    '<div style="margin-top:14px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.3);border-radius:10px;padding:12px;">' +
    '<div style="font-size:.7rem;font-weight:700;color:#38bdf8;letter-spacing:1px;margin-bottom:8px;">&#9889; BATTERY OPTIMIZATION OFF KARO</div>' +
    '<div style="font-size:.72rem;color:var(--sub);line-height:1.8;">' +
    '1. Phone <strong style="color:var(--text)">Settings</strong> → open karo<br>' +
    '2. <strong style="color:var(--text)">Apps</strong> → FitOS dhundho<br>' +
    '3. <strong style="color:var(--text)">Battery</strong> → "Unrestricted" select karo<br>' +
    '4. <strong style="color:var(--text)">Background Activity</strong> → On karo' +
    '</div>' +
    '</div>'
  ) : '';

  openModal(
    '<div style="text-align:center;">' +
    '<div style="font-size:2.2rem;margin-bottom:4px;">&#128241;</div>' +
    '<div class="modal-title" style="font-size:1rem;">BACKGROUND MODE SETUP</div>' +
    '<div style="font-size:.7rem;color:var(--sub);margin:4px 0 14px;">App band hone par bhi notifications aayengi</div>' +
    '</div>' +
    installNote +
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
    '<div class="bg-step-card">' +
    '<div class="bg-step-num">1</div>' +
    '<div class="bg-step-text">' +
    '<div class="bg-step-title">&#128276; Notifications Allow Karo</div>' +
    '<div class="bg-step-desc">Sab reminders ke liye zaroori hai</div>' +
    '</div>' +
    '<div id="notif-status-dot" class="bg-status-dot ' + (window.Notification && Notification.permission === 'granted' ? 'done' : 'pending') + '"></div>' +
    '</div>' +
    '<div class="bg-step-card">' +
    '<div class="bg-step-num">2</div>' +
    '<div class="bg-step-text">' +
    '<div class="bg-step-title">&#128241; Home Screen pe Add Karo</div>' +
    '<div class="bg-step-desc">Chrome → ⋮ → "Add to Home Screen"</div>' +
    '</div>' +
    '<div class="bg-status-dot ' + (isStandalone ? 'done' : 'pending') + '"></div>' +
    '</div>' +
    '<div class="bg-step-card">' +
    '<div class="bg-step-num">3</div>' +
    '<div class="bg-step-text">' +
    '<div class="bg-step-title">&#9889; Battery Optimization OFF Karo</div>' +
    '<div class="bg-step-desc">Settings → Apps → FitOS → Battery → Unrestricted</div>' +
    '</div>' +
    '<div class="bg-status-dot pending"></div>' +
    '</div>' +
    '</div>' +
    androidBatterySteps +
    '<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">' +
    '<button class="modal-btn primary" style="width:100%;padding:13px;font-size:.85rem;" onclick="_bgSetupEnableNotif()">' +
    '&#128276; STEP 1: NOTIFICATIONS ENABLE KARO' +
    '</button>' +
    '<button class="modal-btn" style="width:100%;font-size:.75rem;" onclick="_bgSetupDismiss()">' +
    'PEHLE INSTALL KARUNGA &#10140;' +
    '</button>' +
    '</div>'
  );
}

function _bgSetupEnableNotif() {
  closeModal();
  if (!window.Notification) {
    showToast('Browser me notifications support nahi hai.');
    return;
  }
  if (Notification.permission === 'granted') {
    // Already granted, send a test notif and show next steps
    postToSW({ type: 'TEST_NOTIF' });
    showToast('✅ Notifications ON hain! Test notification bheja.');
    localStorage.setItem('fitos_bg_setup_done', '1');
    _showBatteryOptModal();
    return;
  }
  Notification.requestPermission().then(function (perm) {
    if (perm === 'granted') {
      // Send welcome notif immediately
      setTimeout(function () {
        postToSW({
          type: 'SHOW_STRICTION',
          payload: {
            title: '&#128293; FitOS Background Mode ACTIVE!',
            body: 'App band hone par bhi notifications aayengi. Abhi battery optimization off karo! ⚡',
            tag: 'bg-setup-done'
          }
        });
      }, 800);
      // Restart everything
      postToSW({ type: 'START_CLOCK' });
      postToSW({ type: 'SYNC_PROFILE', payload: DB.profile() });
      _reRegisterPeriodicSync();
      localStorage.setItem('fitos_bg_setup_done', '1');
      renderHome();
      _showBatteryOptModal(); // show step 3 immediately after
    } else {
      showToast('❌ Permission deny ki. Settings se manually allow karo.');
    }
  });
}

function _bgSetupDismiss() {
  closeModal();
  localStorage.setItem('fitos_bg_setup_done', '1');
}

/* ── Battery optimization guide modal ────────── */
function _showBatteryOptModal() {
  setTimeout(function () {
    openModal(
      '<div style="text-align:center;margin-bottom:12px;">' +
      '<div style="font-size:2rem;">&#9889;</div>' +
      '<div class="modal-title">LAST STEP — BATTERY</div>' +
      '<div style="font-size:.7rem;color:var(--sub);margin-top:4px;">Yahi ek step app ko truly background mein rakhega</div>' +
      '</div>' +
      '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;">' +
      '<div style="font-size:.72rem;color:var(--text);line-height:2;">' +
      '<div>&#128241; <strong>Phone Settings</strong> open karo</div>' +
      '<div>&#128269; <strong>"Apps"</strong> ya "Application Manager" dhundho</div>' +
      '<div>&#128081; <strong>"FitOS"</strong> select karo</div>' +
      '<div>&#9889; <strong>"Battery"</strong> tap karo</div>' +
      '<div>&#9989; <strong>"Unrestricted"</strong> ya "No Restrictions" select karo</div>' +
      '<div>&#128276; <strong>"Background Activity"</strong> → ON karo</div>' +
      '</div>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:.68rem;color:var(--sub);text-align:center;line-height:1.6;">' +
      'Samsung: Settings → Battery → Battery Usage Limits → FitOS exclude karo<br>' +
      'Mi/Redmi: Settings → Battery Saver → FitOS → No Restrictions<br>' +
      'OnePlus: Battery → Battery Optimization → FitOS → Don\'t Optimize' +
      '</div>' +
      '<button class="modal-btn primary" style="width:100%;margin-top:14px;" onclick="closeModal();showToast(\'✅ Setup Complete! Ab notifications aayengi.\')">&#10003; HO GAYA, SAMAJH GAYA!</button>'
    );
  }, 400);
}

/* ── Publicly callable: open background setup modal from settings ─ */
function openBackgroundSetup() {
  showBackgroundSetupModal();
}

/* ── PWA INSTALL LOGIC ────────────────────── */
var deferredPrompt;
window.addEventListener('beforeinstallprompt', function (e) {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Show the install banner if not in standalone
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.remove('hidden-start');
  }
});

function dismissPWA() {
  var banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
}

setTimeout(function () {
  var btn = document.getElementById('btn-pwa-install');
  if (btn) {
    btn.onclick = function () {
      if (!deferredPrompt) return;
      dismissPWA();
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        }
        deferredPrompt = null;
      });
    };
  }
}, 1000);

// Check if running in standalone (Installed)
window.addEventListener('load', function () {
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    console.log('Running in standalone mode');
  }
});
// ═══════════════════════════════════════════════
// NATIVE ANDROID BRIDGE (Capacitor)
// ═══════════════════════════════════════════════
var isNative = !!(window.Capacitor && window.Capacitor.Plugins);
if (isNative) {
  // Signal to Service Worker via IDB
  var _idbw = indexedDB.open('fitos-config', 1);
  _idbw.onupgradeneeded = function (e) {
    var db = e.target.result;
    if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
  };
  _idbw.onsuccess = function (e) {
    var db = e.target.result;
    var tx = db.transaction('config', 'readwrite');
    tx.objectStore('config').put(true, 'isNativeApp');
  };
}

function requestNotifPermission() {
  if (isNative) {
    nativeRequestPermissions();
  } else if ('Notification' in window) {
    Notification.requestPermission().then(function (status) {
      if (status === 'granted') {
        showToast('🔔 Notifications Enabled!');
        renderHome();
      }
    });
  }
}

async function nativeRequestPermissions() {
  const { LocalNotifications } = window.Capacitor.Plugins;
  try {
    const status = await LocalNotifications.requestPermissions();
    if (status.display === 'granted') {
      showToast('🔔 Proper App Alerts Enabled!');
      syncNativeReminders();
      renderHome();
    }
  } catch (e) {
    console.warn('Native notif error:', e);
  }
}

async function syncNativeReminders() {
  if (!isNative) return;
  const { LocalNotifications } = window.Capacitor.Plugins;
  const { Haptics } = window.Capacitor.Plugins;

  try {
    // Clear old schedules
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    // Schedule new ones
    var notifications = [];
    var sched = [
      { h: 3, m: 15, t: '💊 DR. MOREPEN', b: 'Pre-gym Fat Burner time! 1 tab with warm water. 🔥' },
      { h: 13, m: 15, t: '🍱 MAIN LUNCH', b: 'High Protein / High Fiber meal khao! Support with Centrum Men. 💪' },
      { h: 15, m: 10, t: '🌿 AFTERNOON DETOX', b: 'Jeera/Saunf drink + ACV sequence starts now! 💧' },
      { h: 16, m: 30, t: '💊 T-SLIM TIME', b: 'Take T-Slim tablet (30 mins before dinner)! 🥗' },
      { h: 17, m: 0, t: '🍽️ DINNER', b: 'Lean fuel before job shift! Sahi khao. 🥗' },
      { h: 18, m: 30, t: '🏢 JOB STARTS', b: 'Night grind mode ON! Stay focused. 💼' },
      { h: 23, m: 0, t: '📋 DAILY LOG', b: 'Aaj ka progress record kiya? check karo! ✍️' },
      { h: 23, m: 59, t: '🍵 GREEN TEA', b: 'Last supplement of the day! Metabolism boost. 🌙' }
    ];

    sched.forEach(function (s, idx) {
      notifications.push({
        title: s.t,
        body: s.b,
        id: 1000 + idx,
        schedule: { on: { hour: s.h, minute: s.m }, repeats: true, allowWhileIdle: true },
        sound: 'default',
        attachments: [],
        actionTypeId: '',
        extra: null
      });
    });

    await LocalNotifications.schedule({ notifications: notifications });
    console.log('Native schedule synced:', notifications.length);

    if (Haptics) await Haptics.vibrate({ duration: 500 });
  } catch (err) {
    console.error('Sync error:', err);
  }
}

// Auto-sync on load if native
if (isNative) {
  setTimeout(syncNativeReminders, 2000);
}

/* ── 4D ENGINE: ADVANCED TILT & GLARE ── */
function initTiltEffect() {
  if (!(window.matchMedia && window.matchMedia('(pointer:fine)').matches)) return;

  var lastPointer = { x: 0, y: 0 };
  var rafPending = false;

  function applyTilt(xPos, yPos) {
    var cards = document.querySelectorAll('.tilt-card');
    cards.forEach(function (card) {
      if (card.classList.contains('animating')) return;
      var rect = card.getBoundingClientRect();
      var x = xPos - rect.left;
      var y = yPos - rect.top;
      if (x > 0 && x < rect.width && y > 0 && y < rect.height) {
        var xPct = x / rect.width;
        var yPct = y / rect.height;
        var rotX = (yPct - 0.5) * -18;
        var rotY = (xPct - 0.5) * 18;
        card.style.transform = 'perspective(1200px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) scale3d(1.02, 1.02, 1.02)';
        card.style.setProperty('--gx', (xPct * 100) + '%');
        card.style.setProperty('--gy', (yPct * 100) + '%');
        card.classList.add('tilting');
      } else {
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        card.classList.remove('tilting');
      }
    });
  }

  document.addEventListener('mousemove', function (e) {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(function () {
        applyTilt(lastPointer.x, lastPointer.y);
        rafPending = false;
      });
    }
  });

  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget || e.target === document.documentElement) {
      document.querySelectorAll('.tilt-card').forEach(function (card) {
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        card.classList.remove('tilting');
      });
    }
  });
}

/* ── HAPTIC ENGINE ── */
function initHaptics() {
  document.addEventListener('touchstart', function (e) {
    var t = e.target;
    if (t.closest('button') || t.closest('.haptic-press') || t.closest('.tilt-card') || t.closest('.set-check') || t.closest('.meal-card')) {
      if (navigator.vibrate) navigator.vibrate(15);
    }
  }, { passive: true });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('button') || t.closest('.haptic-press') || t.closest('.set-check')) {
      if (navigator.vibrate) navigator.vibrate(10);
    }
  });
}

/* ── SPLASH SCREEN LOGIC ───────────────────── */
function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  // Simulate loading steps for premium feel
  const status = splash.querySelector('.splash-status');
  const loader = splash.querySelector('.loader-bar');

  const quote = DAILY_MOTIVATIONS[Math.floor(Math.random() * DAILY_MOTIVATIONS.length)];

  // Create a directive element so it can stick under the status
  const directive = document.createElement('div');
  directive.className = 'splash-directive';
  directive.style.width = '100%';
  directive.style.maxWidth = '280px';
  directive.style.margin = '20px auto 0';
  directive.style.opacity = '0';
  directive.style.transition = 'opacity 0.8s ease';
  directive.style.fontSize = '0.65rem';
  directive.style.color = 'var(--sub)';
  directive.style.lineHeight = '1.5';
  directive.style.textAlign = 'center';
  directive.style.fontFamily = "'JetBrains Mono', monospace";
  directive.style.wordWrap = 'break-word';
  directive.innerHTML = '<span style="color:var(--fire); font-weight:800; letter-spacing:2px; display:block; margin-bottom:5px;">DIRECTIVE</span>' + quote.toUpperCase();

  if (status) status.parentNode.appendChild(directive);

  setTimeout(() => { if (status) status.textContent = "DECRYPTING BIO-METRICS..."; }, 400);
  setTimeout(() => { if (status) status.textContent = "SYNCING WITH CORE..."; }, 1000);
  setTimeout(() => {
    directive.style.opacity = '1';
    if (status) status.textContent = "SYSTEM READY";
  }, 1800);

  setTimeout(() => {
    splash.classList.add('fade-out');
    initBackgroundMode();
    setTimeout(() => {
      splash.remove();
    }, 600);
  }, 4400);
}

// Initialize tilt, haptics and splash
document.addEventListener('DOMContentLoaded', function () {
  initSplash();
  initTiltEffect();
  initHaptics();
  updateTopbar();
});

/* ── TOPBAR DYNAMIC UPDATER ── */
function updateTopbar() {
  var d = new Date();
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var dy = d.getDate();
  var m = months[d.getMonth()];
  var yr = String(d.getFullYear()).slice(-2);
  var hh = d.getHours();
  var mm = String(d.getMinutes()).padStart(2, '0');
  var ampm = hh >= 12 ? 'P.M' : 'A.M';
  var h12 = hh % 12 || 12;
  h12 = String(h12).padStart(2, '0');

  var dateStr = dy + ' ' + m + ' ' + yr + '  ' + h12 + ':' + mm + ' ' + ampm;
  var topdate = document.getElementById('topbar-date');
  if (topdate) topdate.textContent = dateStr;

  try {
    var dayNum = getDayNum();
    var badge = document.getElementById('day-badge');
    if (badge) {
      if (dayNum > 0) {
        badge.textContent = 'DAY ' + dayNum;
        badge.classList.add('active');
      } else {
        badge.textContent = 'READY';
        badge.classList.remove('active');
      }
    }
  } catch (e) { }
}
setInterval(updateTopbar, 10000);

