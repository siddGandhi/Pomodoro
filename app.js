// app.js
import { db } from "./firebase-config.js";
import { collection, doc, setDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const STUDY_TIME = 0.1 * 60; // 6 seconds for quick testing
const BREAK_TIME = 5 * 60;

let timeLeft = STUDY_TIME;
let timerId = null;
let isStudyMode = true;
let isRunning = false;
let isAlarmPlaying = false;
let currentSessionId = null;

let audioCtx = null;
let alarmOscillator = null;
let alarmGain = null;

const timerDisplay = document.getElementById('timer');
const statusDisplay = document.getElementById('status');
const startPauseBtn = document.getElementById('startPauseBtn');
const ffBtn = document.getElementById('ffBtn');
const card = document.getElementById('card');
const bgCanvas = document.getElementById('bgCanvas');

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Visual mosaic injection function
function renderTileToBackground(statusValue) {
    const tile = document.createElement('div');
    tile.classList.add('session-tile');

    if (statusValue === 2) tile.classList.add('tile-success');
    else if (statusValue === 1) tile.classList.add('tile-ff');
    else if (statusValue === 0) tile.classList.add('tile-abandoned');
    else if (statusValue === 3) tile.classList.add('tile-paused'); // Added for pause status

    bgCanvas.appendChild(tile);
}

// Fetch individual data points on load
async function loadDailyGrid() {
    bgCanvas.innerHTML = '';
    const todayStr = getTodayString();

    const q = query(
        collection(db, "pomodoro"),
        orderBy("timestamp", "asc")
    );

    try {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            renderTileToBackground(data.status);
        });
    } catch (e) {
        console.error("Error drawing background canvas: ", e);
    }
}

// Write/Overwrite custom entries in Firebase
async function logSessionEvent(statusValue, sessionId) {
    if (!sessionId) return;

    const docRef = doc(db, "pomodoro", sessionId);
    const payload = {
        timestamp: Date.now(),
        date: getTodayString(),
        status: statusValue // 2 = Complete, 1 = FF, 0 = Abandoned
    };

    try {
        return await setDoc(docRef, payload, { merge: true });
    } catch (error) {
        console.error("Failed to commit session record:", error);
        throw error;
    }
}

// --- ALARM FUNCTIONS (RESTORED DEFINITIONS) ---
function startAlarmSound(frequency) {
    if (isAlarmPlaying) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    alarmOscillator = audioCtx.createOscillator();
    alarmGain = audioCtx.createGain();

    alarmOscillator.type = 'triangle';
    alarmOscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    let time = audioCtx.currentTime;
    alarmGain.gain.setValueAtTime(0, time);

    for (let i = 0; i < 3600; i += 0.6) {
        alarmGain.gain.setValueAtTime(0.3, time + i);
        alarmGain.gain.setValueAtTime(0, time + i + 0.3);
    }

    alarmOscillator.connect(alarmGain);
    alarmGain.connect(audioCtx.destination);

    alarmOscillator.start();
    isAlarmPlaying = true;
    card.classList.add('alarm-active');
}

function stopAlarmSound() {
    if (isAlarmPlaying) {
        try {
            alarmOscillator.stop();
            alarmOscillator.disconnect();
            alarmGain.disconnect();
        } catch (e) { }
        isAlarmPlaying = false;
        card.classList.remove('alarm-active');
    }
}
// ----------------------------------------------

function startTimer() {
    if (isAlarmPlaying) stopAlarmSound();

    if (!isRunning && isStudyMode && !currentSessionId) {
        currentSessionId = "session_" + Date.now();
        logSessionEvent(0, currentSessionId);
    }

    isRunning = true;
    startPauseBtn.textContent = "Pause";

    timerId = setInterval(async () => {
        timeLeft--;
        updateDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerId);

            if (isStudyMode) {
                startAlarmSound(440);

                const finishedSessionId = currentSessionId;
                currentSessionId = null;

                prepareNextMode();

                try {
                    await logSessionEvent(2, finishedSessionId);
                    await loadDailyGrid();
                } catch (err) {
                    console.error("Firebase update failed, but timer is continuing:", err);
                }
            } else {
                startAlarmSound(523.25);
                prepareNextMode();
            }
        }
    }, 1000);
}

async function pauseTimer() {
    isRunning = false;
    clearInterval(timerId);
    startPauseBtn.textContent = isStudyMode ? "Start Focus" : "Start Rest";

    // NEW LOGIC: If we are pausing an active study block, log it as status 3
    if (isStudyMode && currentSessionId) {
        try {
            await logSessionEvent(3, currentSessionId);
            await loadDailyGrid();
        } catch (err) {
            console.error("Failed to log pause status to Firebase:", err);
        }
    }
}

// Fast Forward Handling
ffBtn.addEventListener('click', () => {
    stopAlarmSound();
    if (isStudyMode && isRunning && currentSessionId) {
        logSessionEvent(1, currentSessionId).then(() => loadDailyGrid());
        currentSessionId = null;
    }
    prepareNextMode();
});

function prepareNextMode() {
    isStudyMode = !isStudyMode;
    timeLeft = isStudyMode ? STUDY_TIME : BREAK_TIME;

    if (isStudyMode) {
        statusDisplay.textContent = "Study Time";
        statusDisplay.className = "study-mode";
        startPauseBtn.style.backgroundColor = "var(--study-color)";
        startPauseBtn.textContent = "Start Focus";
    } else {
        statusDisplay.textContent = "Rest Time";
        statusDisplay.className = "break-mode";
        startPauseBtn.style.backgroundColor = "var(--break-color)";
        startPauseBtn.textContent = "Start Rest";
    }
    isRunning = false;
    clearInterval(timerId);
    updateDisplay();
}

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

startPauseBtn.addEventListener('click', () => {
    if (isRunning) { pauseTimer(); } else { startTimer(); }
});

updateDisplay();
loadDailyGrid();