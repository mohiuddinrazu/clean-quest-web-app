// =============================================================================
// FIREBASE CONFIGURATION 
// =============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyA3WYbm_4-XXXXXXX",
  authDomain: "clean-quest.firebaseapp.com",
  databaseURL: "https://clean-quest.firebaseio.com/",
  projectId: "clean-quest",
  storageBucket: "clean-quest.firebasestorage.app",
  messagingSenderId: "216",
  appId: "1:216"
};

// Check if Firebase SDK is loaded and config is set
const isFirebaseConfigured = typeof firebase !== 'undefined' && 
                            firebaseConfig.apiKey !== "AIzaSyA3WYbm_4-XXXXXXX";

let db = null;
let auth = null;
let currentUser = null;

// Initialize Firebase if configured
if (isFirebaseConfigured) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        console.log('📝 Falling back to localStorage');
    }
}

let roomOrder = [];
let competitionHistory = {};
let draggedElement = null;

// Default rooms configuration
const DEFAULT_ROOMS = {
    kitchen: {
        name: 'Kitchen',
        icon: '🍳',
        tasks: [
            { name: 'Wash dishes', frequency: 1 },
            { name: 'Wipe counters', frequency: 1 },
            { name: 'Clean stovetop', frequency: 3 },
            { name: 'Mop floor', frequency: 7 },
            { name: 'Clean refrigerator', frequency: 14 }
        ]
    },
    bathroom: {
        name: 'Bathroom',
        icon: '🚿',
        tasks: [
            { name: 'Clean toilet', frequency: 3 },
            { name: 'Clean shower/tub', frequency: 7 },
            { name: 'Wipe mirrors', frequency: 3 },
            { name: 'Mop floor', frequency: 7 },
            { name: 'Empty trash', frequency: 3 }
        ]
    },
    bedroom: {
        name: 'Bedroom',
        icon: '🛏️',
        tasks: [
            { name: 'Make bed', frequency: 1 },
            { name: 'Change sheets', frequency: 7 },
            { name: 'Vacuum floor', frequency: 7 },
            { name: 'Dust surfaces', frequency: 7 },
            { name: 'Organize closet', frequency: 30 }
        ]
    },
    living: {
        name: 'Living Room',
        icon: '🛋️',
        tasks: [
            { name: 'Vacuum floor', frequency: 7 },
            { name: 'Dust surfaces', frequency: 7 },
            { name: 'Organize clutter', frequency: 3 },
            { name: 'Clean windows', frequency: 30 },
            { name: 'Vacuum couch', frequency: 14 }
        ]
    },
    laundry: {
        name: 'Laundry',
        icon: '👕',
        tasks: [
            { name: 'Do laundry', frequency: 7 },
            { name: 'Fold clothes', frequency: 7 },
            { name: 'Clean washer', frequency: 30 },
            { name: 'Organize supplies', frequency: 30 }
        ]
    }
};

const EMOJI_OPTIONS = [
    '🏠', '🏡', '🏢', '🏪', '🏬', '🏀', '🏰', '🏛️',
    '🍳', '🚿', '🛏️', '🛋️', '👕', '🚪', '🪟', '🚽',
    '🧹', '🧺', '🧼', '🧽', '🧴', '🪣', '🗑️', '📦',
    '💼', '📚', '🎮', '🎨', '🎵', '🏋️', '🌱', '🐕',
    '🐈', '🐱', '🐾', '🦮', '🐩', '🐈‍⬛', '😺', '😸',
    '🚗', '🔧', '🛠️', '⚙️', '🔑', '💡', '🕯️', '🪴'
];

// App state
let rooms = {};
let collapsedRooms = new Set();
let activeFilter = null;
let competitionData = {};
let currentUserId = null;
let currentUserName = '';
let allUsers = {};
let isUpdating = false; // Prevents render loops
let allCollapsed = false; // For collapse all button
let listenersActive = false; // Track if listeners are set up
let notificationsSent = false; // Track if notifications have been sent this session

// Initialize app
function init() {
    if (auth) {
        // Check authentication state
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                currentUserId = user.uid;
                console.log('✅ User authenticated:', currentUserId);
                loadUserProfile();
            } else {
                // Show login modal
                showLoginModal();
            }
        });
    } else {
        // No Firebase - use localStorage
        currentUserId = localStorage.getItem('cleanquest_userId');
        if (!currentUserId) {
            currentUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('cleanquest_userId', currentUserId);
        }
        
        currentUserName = localStorage.getItem('cleanquest_userName') || '';
        updateUserNameDisplay();
        
        loadDataFromLocalStorage();
        createDustParticles();
        forceUIUpdate();
    }
    
    setupFormHandlers();
    
    // Request notification permission ONLY if default (hasn't been asked yet)
    if ("Notification" in window && Notification.permission === "default") {
        // We can request, but modern browsers might block this if not triggered by user interaction.
    }
    
    // Update stats every minute
    setInterval(() => {
        updateStats();
        updateCompetitionProgress();
        checkAndNotifyDueTasks();
    }, 60000);
}

// Helper to force UI update immediately (Optimistic UI)
function forceUIUpdate() {
    renderRooms();
    updateStats();
    updateCompetitionProgress();
}

// Show login modal
function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

// Load user profile
function loadUserProfile() {
    if (!db || !currentUserId) return;
    
    console.log('📥 Loading user profile for:', currentUserId);
    
    // Load user name from Firebase
    db.ref(`users/${currentUserId}/name`).once('value', (snapshot) => {
        if (snapshot.exists()) {
            currentUserName = snapshot.val();
            console.log('✅ User name loaded:', currentUserName);
            updateUserNameDisplay();
            
            // Now setup listeners and load data
            setupFirebaseListeners();
            createDustParticles();
        } else {
            console.log('⚠️ No name found, prompting user');
            // User doesn't have a name yet
            setupFirebaseListeners();
            createDustParticles();
            setTimeout(() => openUserNameModal(), 500);
        }
    }).catch((error) => {
        console.error('❌ Error loading user profile:', error);
        setupFirebaseListeners();
        createDustParticles();
    });
}

// Setup Firebase listeners with debouncing
function setupFirebaseListeners() {
    if (listenersActive) {
        console.log('⚠️ Listeners already active, skipping setup');
        return;
    }
    listenersActive = true;
    console.log('🔧 Setting up Firebase listeners');
    
    // Listen to rooms with debouncing
    let roomsTimeout;
    db.ref('rooms').on('value', (snapshot) => {
        if (isUpdating) {
            return;
        }
        
        clearTimeout(roomsTimeout);
        roomsTimeout = setTimeout(() => {
            console.log('📥 Room data received from Firebase');
            if (snapshot.exists()) {
                rooms = snapshot.val();
                // FIX: Firebase stores JS arrays as objects with numeric keys.
                // Normalize tasks and history back to real arrays after every load.
                normalizeRoomsData(rooms);
                console.log('✅ Rooms loaded:', Object.keys(rooms).length);
            } else {
                console.log('⚠️ No rooms found, initializing defaults');
                initializeDefaultRooms();
                saveDataToFirebase();
            }
            forceUIUpdate();
            checkMonthlyReset();
            checkAndNotifyDueTasks(); 
        }, 150);
    });
    
    // Listen to collapsed rooms (only for current user)
    db.ref(`userPreferences/${currentUserId}/collapsed`).on('value', (snapshot) => {
        if (isUpdating) return;
        
        if (snapshot.exists()) {
            const collapsed = snapshot.val();
            collapsedRooms = new Set(collapsed);
            updateCollapseAllButton();
            if (Object.keys(rooms).length > 0) {
                renderRooms();
            }
        }
    });
    
    // Listen to competition data
    db.ref('competition').on('value', (snapshot) => {
        if (snapshot.exists()) {
            competitionData = snapshot.val();
        } else {
            resetCompetition();
        }
        updateCompetitionProgress();
    });
    
    // Listen to room order (per user)
    let roomOrderTimeout;
    db.ref(`userPreferences/${currentUserId}/roomOrder`).on('value', (snapshot) => {
        if (isUpdating) return;
        
        clearTimeout(roomOrderTimeout);
        roomOrderTimeout = setTimeout(() => {
            if (snapshot.exists()) {
                const serverOrder = snapshot.val();
                if (serverOrder && Array.isArray(serverOrder)) {
                    roomOrder = serverOrder;
                    if (Object.keys(rooms).length > 0) {
                        renderRooms();
                    }
                }
            }
        }, 150);
    });

    // Listen to competition history
    db.ref('competitionHistory').on('value', (snapshot) => {
        if (snapshot.exists()) {
            competitionHistory = snapshot.val();
        }
    });
    // Listen to all users
    db.ref('users').on('value', (snapshot) => {
        if (snapshot.exists()) {
            allUsers = snapshot.val();
        } else {
            allUsers = {};
        }
        
        // Ensure current user exists
        if (!allUsers[currentUserId]) {
            allUsers[currentUserId] = {
                name: currentUserName || 'User',
                points: 0
            };
            db.ref(`users/${currentUserId}`).set(allUsers[currentUserId]);
        }
        
        updateCompetitionProgress();
    });
}

// Initialize default rooms
function initializeDefaultRooms() {
    rooms = {};
    for (let [key, room] of Object.entries(DEFAULT_ROOMS)) {
        rooms[key] = {
            name: room.name,
            icon: room.icon,
            tasks: room.tasks.map((task, index) => ({
                id: `${key}_${index}_${Date.now()}`,
                name: task.name,
                frequency: task.frequency,
                lastCompleted: null,
                lastCompletedBy: null,
                history: []
            }))
        };
    }
}

// FIX: Firebase stores JS arrays as plain objects with numeric string keys ("0","1",...).
// This function converts them back to real arrays so for...of and .map() work correctly.
function normalizeRoomsData(roomsData) {
    if (!roomsData) return;
    for (const room of Object.values(roomsData)) {
        // Normalize tasks
        if (room.tasks && !Array.isArray(room.tasks)) {
            room.tasks = Object.values(room.tasks);
        }
        if (!room.tasks) room.tasks = [];
        // Normalize history inside each task
        for (const task of room.tasks) {
            if (task.history && !Array.isArray(task.history)) {
                task.history = Object.values(task.history);
            }
            if (!task.history) task.history = [];
        }
    }
}

// Load data from localStorage
function loadDataFromLocalStorage() {
    const savedRooms = localStorage.getItem('cleanquest_rooms');
    const savedCollapsed = localStorage.getItem('cleanquest_collapsed');
    const savedCompetition = localStorage.getItem('cleanquest_competition');
    const savedUsers = localStorage.getItem('cleanquest_users');
    const savedCompetitionHistory = localStorage.getItem('cleanquest_competitionHistory');
    const savedRoomOrder = localStorage.getItem('cleanquest_roomOrder');

    if (savedRooms) {
        rooms = JSON.parse(savedRooms);
    } else {
        initializeDefaultRooms();
        saveDataToLocalStorage();
    }
    
    if (savedCollapsed) {
        collapsedRooms = new Set(JSON.parse(savedCollapsed));
    }
    
    if (savedCompetition) {
        competitionData = JSON.parse(savedCompetition);
    } else {
        resetCompetition();
    }
    
    if (savedUsers) {
        allUsers = JSON.parse(savedUsers);
    }

    if (savedCompetitionHistory) {
        competitionHistory = JSON.parse(savedCompetitionHistory);
    }

    if (savedRoomOrder) {
        roomOrder = JSON.parse(savedRoomOrder);
    }
    
    // Ensure current user exists
    if (!allUsers[currentUserId]) {
        allUsers[currentUserId] = {
            name: currentUserName || 'User',
            points: 0
        };
        saveDataToLocalStorage();
    }
}

// Save to Firebase with batching and longer delay
let writeTimeout;
function saveDataToFirebase() {
    if (!db) return;
    
    console.log('💾 Preparing to save data to Firebase');
    
    // Set updating flag to pause listener updates temporarily
    isUpdating = true;
    
    // Batch writes
    clearTimeout(writeTimeout);
    writeTimeout = setTimeout(() => {
        console.log('🚀 Saving data to Firebase...');
        
        const updates = {};
        updates['/rooms'] = rooms;
        updates['/competition'] = competitionData;
        updates['/users'] = allUsers;
        updates[`/userPreferences/${currentUserId}/collapsed`] = [...collapsedRooms];
        
        db.ref().update(updates).then(() => {
            console.log('✅ Data saved successfully');
            setTimeout(() => {
                isUpdating = false;
            }, 300);
        }).catch((error) => {
            console.error('❌ Firebase write error:', error);
            isUpdating = false;
        });
    }, 500); 
}

// Save to localStorage
function saveDataToLocalStorage() {
    localStorage.setItem('cleanquest_rooms', JSON.stringify(rooms));
    localStorage.setItem('cleanquest_collapsed', JSON.stringify([...collapsedRooms]));
    localStorage.setItem('cleanquest_competition', JSON.stringify(competitionData));
    localStorage.setItem('cleanquest_users', JSON.stringify(allUsers));
    localStorage.setItem('cleanquest_competitionHistory', JSON.stringify(competitionHistory));
    localStorage.setItem('cleanquest_roomOrder', JSON.stringify(roomOrder));
}

// Unified save function
function saveData() {
    if (db) {
        saveDataToFirebase();
    } else {
        saveDataToLocalStorage();
    }
}

// Save room order
function saveRoomOrder() {
    if (db) {
        db.ref(`userPreferences/${currentUserId}/roomOrder`).set(roomOrder);
    } else {
        localStorage.setItem('cleanquest_roomOrder', JSON.stringify(roomOrder));
    }
}

// Update user name display
function updateUserNameDisplay() {
    const badge = document.getElementById('userName');
    if (currentUserName) {
        badge.textContent = currentUserName;
    } else {
        badge.textContent = 'Set Name';
    }
}

// Open user name modal
function openUserNameModal() {
    document.getElementById('userNameInput').value = currentUserName;
    document.getElementById('userNameModal').classList.add('active');
}

// Handle logout
async function handleLogout() {
    if (auth && currentUser) {
        await auth.signOut();
        location.reload();
    }
}

// Handle sign up
async function handleSignUp() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        closeModal('loginModal');
        alert('Account created! Please set your name.');
        setTimeout(() => openUserNameModal(), 500);
    } catch (error) {
        alert('Sign up failed: ' + error.message);
    }
}

// Check if month has changed and reset competition
function checkMonthlyReset() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
    
    if (!competitionData.month || competitionData.month !== currentMonth) {
        resetCompetition();
    }
}

// Reset competition for new month
function resetCompetition() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
    const previousMonth = competitionData.month;
    
    // Save winner of previous month
    if (previousMonth && previousMonth !== currentMonth) {
        // Calculate points for the previous month specifically to save in history
        let teamPoints = 0;
        
        // We need to calculate points based on history timestamps, not the current accumulator
        // But since we are switching months, we can assume the accumulator *was* for the previous month
        // if we were resetting strictly. However, since we are moving to dynamic calc,
        // we should calculate it properly.
        
        // For simplicity during migration, we will use the dynamic calculation logic:
        const [prevYear, prevMonthNum] = previousMonth.split('-');
        
        // Calculate scores for previous month
        const prevMonthScores = calculateMonthlyScores(parseInt(prevYear), parseInt(prevMonthNum));
        teamPoints = Object.values(prevMonthScores).reduce((a, b) => a + b, 0);

        const daysInPrevMonth = new Date(prevYear, parseInt(prevMonthNum) + 1, 0).getDate();
        
        let totalPossible = 0;
        for (let room of Object.values(rooms)) {
            const tasks = Array.isArray(room.tasks) ? room.tasks : Object.values(room.tasks || {});
            for (let task of tasks) {
                totalPossible += Math.floor(daysInPrevMonth / task.frequency);
            }
        }
        
        const monsterPoints = Math.floor((daysInPrevMonth / daysInPrevMonth) * totalPossible);
        const winner = teamPoints >= monsterPoints ? 'Team' : 'Monster';
        
        if (!competitionHistory) competitionHistory = {};
        competitionHistory[previousMonth] = {
            winner: winner,
            teamPoints: teamPoints,
            monsterPoints: monsterPoints,
            totalPossible: totalPossible,
            endDate: Date.now(),
            participants: Object.entries(prevMonthScores).map(([uid, points]) => ({
                name: allUsers[uid] ? allUsers[uid].name : 'Unknown',
                points: points
            }))
        };
        
        if (db) {
            db.ref('competitionHistory').set(competitionHistory);
        } else {
            localStorage.setItem('cleanquest_competitionHistory', JSON.stringify(competitionHistory));
        }
    }
    
    // Reset current month
    competitionData = {
        month: currentMonth,
        startDate: now.getTime()
    };
    
    saveData();
}

// Helper: Calculate scores for a specific month/year based on task history
function calculateMonthlyScores(year, monthIndex) {
    const scores = {};
    
    if (!rooms) return scores;

    for (const room of Object.values(rooms)) {
        if (!room.tasks) continue;
        
        // Guard: tasks may be an object (Firebase) or array
        const tasks = Array.isArray(room.tasks) ? room.tasks : Object.values(room.tasks);
        
        for (const task of tasks) {
            if (!task.history) continue;
            
            // Guard: history may be an object (Firebase) or array
            const history = Array.isArray(task.history) ? task.history : Object.values(task.history);
            
            for (const entry of history) {
                const date = new Date(entry.timestamp);
                if (date.getFullYear() === year && date.getMonth() === monthIndex) {
                    const uid = entry.userId;
                    scores[uid] = (scores[uid] || 0) + 1;
                }
            }
        }
    }
    return scores;
}

// Create floating dust particles
function createDustParticles() {
    if (document.querySelector('.dust-particle')) return;
    
    const particleCount = 15;
    const particles = ['💨', '✨', '🌟', '⭐', '🏀'];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'dust-particle';
        particle.textContent = particles[Math.floor(Math.random() * particles.length)];
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.fontSize = (Math.random() * 20 + 10) + 'px';
        particle.style.animation = `float ${Math.random() * 10 + 10}s infinite ease-in-out`;
        document.body.appendChild(particle);
    }
    
    if (!document.getElementById('floatAnimation')) {
        const style = document.createElement('style');
        style.id = 'floatAnimation';
        style.textContent = `
            @keyframes float {
                0%, 100% { transform: translate(0, 0) rotate(0deg); }
                25% { transform: translate(20px, -20px) rotate(90deg); }
                50% { transform: translate(-20px, 20px) rotate(180deg); }
                75% { transform: translate(20px, 20px) rotate(270deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Collapse/Expand All functionality
function toggleCollapseAll() {
    allCollapsed = !allCollapsed;
    
    if (allCollapsed) {
        collapsedRooms = new Set(Object.keys(rooms));
        document.getElementById('collapseAllText').textContent = 'Expand All';
        document.getElementById('collapseAllIcon').textContent = '⚟';
    } else {
        collapsedRooms.clear();
        document.getElementById('collapseAllText').textContent = 'Collapse All';
        document.getElementById('collapseAllIcon').textContent = '⚞';
    }
    
    saveData();
    renderRooms(); 
}

function updateCollapseAllButton() {
    const totalRooms = Object.keys(rooms).length;
    const collapsedCount = collapsedRooms.size;
    
    if (collapsedCount === totalRooms && totalRooms > 0) {
        allCollapsed = true;
        document.getElementById('collapseAllText').textContent = 'Expand All';
        document.getElementById('collapseAllIcon').textContent = '⚟';
    } else {
        allCollapsed = false;
        document.getElementById('collapseAllText').textContent = 'Collapse All';
        document.getElementById('collapseAllIcon').textContent = '⚞';
    }
}

// Render all rooms
function renderRooms() {
    const container = document.getElementById('roomsContainer');
    container.innerHTML = '';
    
    // Get ordered room keys
    let orderedRoomKeys = roomOrder.filter(key => rooms[key]);
    
    // Deduplicate
    orderedRoomKeys = [...new Set(orderedRoomKeys)];
    
    // Add any new rooms that aren't in the order yet
    Object.keys(rooms).forEach(key => {
        if (!orderedRoomKeys.includes(key)) {
            orderedRoomKeys.push(key);
        }
    });
    
    // Update roomOrder locally (without triggering Firebase write) if new rooms appeared
    // Room order is explicitly saved only when the user changes it via drag/drop or adding a room.
    if (JSON.stringify(roomOrder) !== JSON.stringify(orderedRoomKeys)) {
        roomOrder = orderedRoomKeys;
    }
    
    orderedRoomKeys.forEach((roomKey, index) => {
        const room = rooms[roomKey];
        const section = createRoomSection(roomKey, room);
        
        section.setAttribute('draggable', 'true');
        section.dataset.roomKey = roomKey;
        section.dataset.index = index;
        section.style.cursor = 'move';
        
        section.addEventListener('dragstart', handleDragStart);
        section.addEventListener('dragend', handleDragEnd);
        section.addEventListener('dragover', handleDragOver);
        section.addEventListener('drop', handleDrop);
        
        container.appendChild(section);
    });
    
    updateCollapseAllButton();
}

// Drag and drop handlers
function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    document.querySelectorAll('.room-section').forEach(el => {
        el.style.borderTop = 'none';
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    this.style.borderTop = '3px solid var(--accent-blue)';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    this.style.borderTop = 'none';
    
    if (draggedElement !== this) {
        const fromIndex = parseInt(draggedElement.dataset.index);
        const toIndex = parseInt(this.dataset.index);
        
        const [removed] = roomOrder.splice(fromIndex, 1);
        roomOrder.splice(toIndex, 0, removed);
        
        saveRoomOrder();
        renderRooms();
    }
    
    return false;
}


// Create room section
function createRoomSection(roomKey, room) {
    const section = document.createElement('div');
    section.className = 'room-section';
    
    const isCollapsed = collapsedRooms.has(roomKey);
    
    section.innerHTML = `
        <div class="room-header" onclick="toggleRoom('${roomKey}')">
            <div class="room-title">
                <span class="room-icon">${room.icon}</span>
                <span>${room.name}</span>
            </div>
            <div class="room-actions">
                <span class="room-toggle ${isCollapsed ? 'collapsed' : ''}">🔻</span>
            </div>
        </div>
        <div class="task-list ${isCollapsed ? 'collapsed' : ''}" id="tasks_${roomKey}">
            ${(Array.isArray(room.tasks) ? room.tasks : Object.values(room.tasks || {})).map(task => createTaskItem(roomKey, task)).join('')}
        </div>
        <div class="room-bottom-actions ${isCollapsed ? 'hidden' : ''}">
            <button class="room-delete-btn" onclick="deleteRoom('${roomKey}')" title="Delete room">
                ❌
            </button>
            <button class="add-task-btn" onclick="openAddTaskModal('${roomKey}')">
                 ＋ Add Task
            </button>
        </div>
    `;
    
    return section;
}

// Create task item
function createTaskItem(roomKey, task) {
    const status = getTaskStatus(task);
    const statusText = getStatusText(task);
    const frequencyText = getFrequencyText(task.frequency);
    const progressPercent = getProgressPercent(task);
    const completedBy = task.lastCompletedBy && allUsers[task.lastCompletedBy] ? 
        allUsers[task.lastCompletedBy].name : '';
    
    const daysSince = task.lastCompleted ? 
        (Date.now() - task.lastCompleted) / (1000 * 60 * 60 * 24) : 999;
    const isChecked = task.lastCompleted && daysSince < task.frequency * 0.7;
    
    return `
        <div class="task-item ${status}" data-status="${status}">
            <div class="task-main">
                <div class="task-checkbox ${isChecked ? 'checked' : ''}" 
                     onclick="event.stopPropagation(); handleTaskCheckbox('${roomKey}', '${task.id}')">
                </div>
                <div class="task-info" onclick="openHistoryModal('${roomKey}', '${task.id}')">
                    <div class="task-name">${task.name}</div>
                    <div class="task-meta">
                        <span class="task-frequency">↻ ${frequencyText}</span>
                        <span class="task-status status-${status}">${statusText}</span>
                        ${completedBy ? `<span class="task-completed-by">by ${completedBy}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions" onclick="event.stopPropagation();">
                    <button class="task-btn" onclick="openEditTaskModal('${roomKey}', '${task.id}')" title="Edit">
                        ⋮
                    </button>
                    <button class="task-btn" onclick="deleteTask('${roomKey}', '${task.id}')" title="Delete">
                        ⨉
                    </button>
                </div>
            </div>
            <div class="task-progress-bar">
                <div class="task-progress-fill ${status}" style="width: ${progressPercent}%"></div>
            </div>
        </div>
    `;
}

// Handle task checkbox click
function handleTaskCheckbox(roomKey, taskId) {
    const room = rooms[roomKey];
    const task = room.tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    const daysSince = task.lastCompleted ? 
        (Date.now() - task.lastCompleted) / (1000 * 60 * 60 * 24) : 999;
    const isChecked = task.lastCompleted && daysSince < task.frequency * 0.7;

    if (isChecked) {
        document.getElementById('actionRoomKey').value = roomKey;
        document.getElementById('actionTaskId').value = taskId;
        document.getElementById('taskActionModal').classList.add('active');
    } else {
        openCompleteTaskModal(roomKey, taskId);
    }
}

// Open complete task modal
function openCompleteTaskModal(roomKey, taskId) {
    const room = rooms[roomKey];
    const task = room.tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    document.getElementById('completeTaskRoom').value = roomKey;
    document.getElementById('completeTaskId').value = taskId;
    document.getElementById('completeTaskName').textContent = task.name;
    
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    document.getElementById('completionDate').value = today;
    document.getElementById('completionDate').max = today;

    const userSelect = document.getElementById('completionUser');
    userSelect.innerHTML = '';
    Object.entries(allUsers).forEach(([userId, userObj]) => {
        const option = document.createElement('option');
        option.value = userId;
        option.textContent = userObj.name || 'User';
        if (userId === currentUserId) option.selected = true;
        userSelect.appendChild(option);
    });

    document.getElementById('completeTaskModal').classList.add('active');
}

// Setup complete task form
function setupCompleteTaskForm() {
    document.getElementById('completeTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const roomKey = document.getElementById('completeTaskRoom').value;
        const taskId = document.getElementById('completeTaskId').value;
        const dateStr = document.getElementById('completionDate').value;

        const selectedUserId = document.getElementById('completionUser').value;
        const selectedUserName = allUsers[selectedUserId]
            ? (allUsers[selectedUserId].name || 'User')
            : (currentUserName || 'User');

        const [year, month, day] = dateStr.split('-').map(Number);
        const completionDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        const timestamp = completionDate.getTime();

        markTaskComplete(roomKey, taskId, timestamp, selectedUserId, selectedUserName);
        closeModal('completeTaskModal');
    });
}

// Mark task complete
function markTaskComplete(roomKey, taskId, timestamp, userId, userName) {
    userId   = userId   || currentUserId;
    userName = userName || currentUserName || 'User';

    const room = rooms[roomKey];
    const task = room.tasks.find(t => t.id === taskId);

    if (!task) return;

    if (!allUsers[userId]) {
        allUsers[userId] = {
            name: userName,
            points: 0
        };
    }

    if (!task.lastCompleted || timestamp > task.lastCompleted) {
        task.lastCompleted = timestamp;
        task.lastCompletedBy = userId;
    }

    if (!task.history) task.history = [];
    task.history.push({
        timestamp: timestamp,
        userId: userId,
        userName: userName
    });

    // We don't rely on allUsers points accumulation anymore for the monthly game
    // but we can still increment it for lifetime tracking if desired
    allUsers[userId].points = (allUsers[userId].points || 0) + 1;
    
    saveData();
    forceUIUpdate(); // Update UI immediately
    showCelebration();
}

// Unmark task
function unmarkTask(roomKey, taskId) {
    const room = rooms[roomKey];
    const task = room.tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    if (task.history && task.history.length > 0) {
        task.history.sort((a, b) => a.timestamp - b.timestamp);
        task.history.pop();
    }
    
    if (task.history.length > 0) {
        const latest = task.history[task.history.length - 1];
        task.lastCompleted = latest.timestamp;
        task.lastCompletedBy = latest.userId;
    } else {
        task.lastCompleted = null;
        task.lastCompletedBy = null;
    }
    
    saveData();
    forceUIUpdate(); // Update UI immediately
}

// Get task status
function getTaskStatus(task) {
    if (!task.lastCompleted) return 'overdue';
    
    const daysSince = (Date.now() - task.lastCompleted) / (1000 * 60 * 60 * 24);
    
    if (daysSince >= task.frequency) return 'overdue';
    if (daysSince >= task.frequency * 0.7) return 'soon';
    return 'fresh';
}

// Get progress percent
function getProgressPercent(task) {
    if (!task.lastCompleted) return 100;
    
    const daysSince = (Date.now() - task.lastCompleted) / (1000 * 60 * 60 * 24);
    const percent = (daysSince / task.frequency) * 100;
    
    return Math.min(100, Math.max(0, percent));
}

// Get status text
function getStatusText(task) {
    if (!task.lastCompleted) {
        return '😟 Never done';
    }
    
    const daysSince = (Date.now() - task.lastCompleted) / (1000 * 60 * 60 * 24);
    const daysRemaining = task.frequency - daysSince;
    
    if (daysSince >= task.frequency) {
        const daysOverdue = Math.floor(daysSince - task.frequency);
        return `⚠ ${daysOverdue}d overdue`;
    }
    
    if (daysSince >= task.frequency * 0.7) {
        const daysLeft = Math.ceil(daysRemaining);
        return `⏰ ${daysLeft}d left`;
    }
    
    const daysLeft = Math.ceil(daysRemaining);
    return `✅ ${daysLeft}d left`;
}

// Get frequency text
function getFrequencyText(days) {
    if (days === 1) return 'Daily';
    if (days === 3) return 'Every 3 days';
    if (days === 7) return 'Weekly';
    if (days === 14) return 'Bi-weekly';
    if (days === 30) return 'Monthly';
    if (days === 90) return 'Quarterly';
    return `Every ${days} days`;
}

// Show celebration animation
function showCelebration() {
    const celebrations = ['✨', '🎉', '⭐', '🌟', '💫', '🎊'];
    const emoji = celebrations[Math.floor(Math.random() * celebrations.length)];
    
    const celebration = document.createElement('div');
    celebration.className = 'celebration';
    celebration.textContent = emoji;
    document.body.appendChild(celebration);
    
    setTimeout(() => celebration.remove(), 1000);
}

// Update stats (Counters at top)
function updateStats() {
    let clean = 0, soon = 0, overdue = 0;
    
    for (let room of Object.values(rooms)) {
        // Guard: tasks may be an object (Firebase) or array
        const tasks = Array.isArray(room.tasks) ? room.tasks : Object.values(room.tasks || {});
        for (let task of tasks) {
            const status = getTaskStatus(task);
            if (status === 'fresh') clean++;
            else if (status === 'soon') soon++;
            else if (status === 'overdue') overdue++;
        }
    }
    
    // Safety check for elements before trying to update textContent
    if (document.getElementById('cleanCount')) {
        document.getElementById('cleanCount').textContent = clean;
        document.getElementById('soonCount').textContent = soon;
        document.getElementById('overdueCount').textContent = overdue;
    }
    
    // Update dust counter with current user's monthly points
    const now = new Date();
    const monthlyScores = calculateMonthlyScores(now.getFullYear(), now.getMonth());
    const userPoints = monthlyScores[currentUserId] || 0;
    
    if (document.getElementById('dustCount')) {
        document.getElementById('dustCount').textContent = userPoints;
    }
}

// Check and notify for due tasks
function checkAndNotifyDueTasks() {
    if (notificationsSent) return; 
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    
    let dueSoonTasks = [];
    
    for (let room of Object.values(rooms)) {
        const tasks = Array.isArray(room.tasks) ? room.tasks : Object.values(room.tasks || {});
        for (let task of tasks) {
            if (task.lastCompleted) {
                const daysSince = (Date.now() - task.lastCompleted) / (1000 * 60 * 60 * 24);
                if (daysSince >= task.frequency * 0.7 && daysSince < task.frequency) {
                    dueSoonTasks.push(task.name);
                }
            }
        }
    }
    
    if (dueSoonTasks.length > 0) {
        const title = "Tasks Due Soon!";
        const body = `You have ${dueSoonTasks.length} tasks needing attention: ${dueSoonTasks.slice(0, 3).join(', ')}${dueSoonTasks.length > 3 ? '...' : ''}`;
        
        new Notification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/2097/2097734.png' 
        });
        
        notificationsSent = true;
    }
}

// Filter by status
function filterByStatus(status) {
    document.querySelectorAll('.stat-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.task-item').forEach(item => item.classList.remove('highlighted'));
    
    if (activeFilter === status) {
        activeFilter = null;
    } else {
        activeFilter = status;
        document.getElementById(`stat-${status}`).classList.add('active');
        
        document.querySelectorAll(`.task-item[data-status="${status}"]`).forEach(item => {
            item.classList.add('highlighted');
        });
        
        const firstHighlighted = document.querySelector('.task-item.highlighted');
        if (firstHighlighted) {
            firstHighlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Toggle room collapse
function toggleRoom(roomKey) {
    if (collapsedRooms.has(roomKey)) {
        collapsedRooms.delete(roomKey);
    } else {
        collapsedRooms.add(roomKey);
    }
    
    saveData();
    renderRooms(); 
}

// Delete room
function deleteRoom(roomKey) {
    if (!confirm(`Are you sure you want to delete the ${rooms[roomKey].name} room and all its tasks?`)) return;
    
    delete rooms[roomKey];
    collapsedRooms.delete(roomKey);
    
    saveData();
    forceUIUpdate();
}

// Open add task modal
function openAddTaskModal(roomKey) {
    document.getElementById('modalTitle').textContent = 'Add Task';
    document.getElementById('taskForm').reset();
    document.getElementById('editTaskRoom').value = roomKey;
    document.getElementById('editTaskId').value = '';
    document.getElementById('customFrequencyInput').classList.remove('active');
    document.getElementById('taskModal').classList.add('active');
}

// Open edit task modal
function openEditTaskModal(roomKey, taskId) {
    const room = rooms[roomKey];
    const task = room.tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskName').value = task.name;
    
    const standardFrequencies = ['1', '3', '7', '14', '30', '90'];
    if (standardFrequencies.includes(task.frequency.toString())) {
        document.getElementById('taskFrequency').value = task.frequency;
        document.getElementById('customFrequencyInput').classList.remove('active');
    } else {
        document.getElementById('taskFrequency').value = 'custom';
        document.getElementById('customDays').value = task.frequency;
        document.getElementById('customFrequencyInput').classList.add('active');
    }
    
    document.getElementById('editTaskRoom').value = roomKey;
    document.getElementById('editTaskId').value = taskId;
    document.getElementById('taskModal').classList.add('active');
}

// Toggle custom frequency input
function toggleCustomFrequency() {
    const select = document.getElementById('taskFrequency');
    const customInput = document.getElementById('customFrequencyInput');
    
    if (select.value === 'custom') {
        customInput.classList.add('active');
        document.getElementById('customDays').required = true;
    } else {
        customInput.classList.remove('active');
        document.getElementById('customDays').required = false;
    }
}

// Open add room modal
function openAddRoomModal() {
    document.getElementById('roomForm').reset();
    document.getElementById('selectedEmoji').value = '🏠';
    
    const picker = document.getElementById('emojiPicker');
    picker.innerHTML = '';
    
    EMOJI_OPTIONS.forEach(emoji => {
        const option = document.createElement('div');
        option.className = 'emoji-option';
        option.textContent = emoji;
        option.onclick = function() { selectEmoji(emoji); };
        if (emoji === '🏠') option.classList.add('selected');
        picker.appendChild(option);
    });
    
    document.getElementById('roomModal').classList.add('active');
}

// Select emoji
function selectEmoji(emoji) {
    document.getElementById('selectedEmoji').value = emoji;
    document.querySelectorAll('.emoji-option').forEach(opt => opt.classList.remove('selected'));
    event.target.classList.add('selected');
}

// Open competition modal 
function openCompetitionModal() {
    try {
        updateCompetitionProgress();
    } catch (e) {
        console.error("Error updating competition stats:", e);
    }
    document.getElementById('competitionModal').classList.add('active');
}

// Update competition progress (Rewritten for dynamic monthly calculation)
function updateCompetitionProgress() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    const currentDay = now.getDate();
    
    // Calculate total possible points this month
    let totalPossiblePoints = 0;
    
    if (rooms) {
        for (let room of Object.values(rooms)) {
            if (room.tasks) {
                // Guard: tasks may be an object (Firebase) or array
                const tasks = Array.isArray(room.tasks) ? room.tasks : Object.values(room.tasks);
                for (let task of tasks) {
                    totalPossiblePoints += Math.floor(daysInMonth / task.frequency);
                }
            }
        }
    }
    
    // Calculate team total points (Dynamic Monthly)
    const monthlyScores = calculateMonthlyScores(currentYear, currentMonthIndex);
    const teamPoints = Object.values(monthlyScores).reduce((a, b) => a + b, 0);
    
    // Calculate monster progress
    const monsterProgress = Math.floor((currentDay / daysInMonth) * totalPossiblePoints);
    
    // Calculate percentages
    const teamPercent = totalPossiblePoints > 0 ? Math.round((teamPoints / totalPossiblePoints) * 100) : 0;
    const monsterPercent = totalPossiblePoints > 0 ? Math.round((monsterProgress / totalPossiblePoints) * 100) : 0;
    
    // Update UI
    const teamBar = document.getElementById('teamProgressBar');
    if (teamBar) teamBar.style.width = teamPercent + '%';
    
    const monsterBar = document.getElementById('monsterProgressBar');
    if (monsterBar) monsterBar.style.width = monsterPercent + '%';
    
    document.getElementById('teamProgress').textContent = teamPercent + '%';
    document.getElementById('monsterProgress').textContent = monsterPercent + '%';
    
    // Update user scores
    const scoresContainer = document.getElementById('userScoresContainer');
    if (scoresContainer) {
        scoresContainer.innerHTML = '<div style="font-weight: 600; margin-bottom: 8px; text-align: center;">Individual Scores (This Month)</div>';
        
        // Convert to array and sort
        const sortedUsers = Object.entries(monthlyScores).sort((a, b) => b[1] - a[1]);
        
        if (sortedUsers.length === 0) {
            scoresContainer.innerHTML += '<div style="text-align:center; color: var(--text-light); padding: 10px;">No points yet this month!</div>';
        }

        sortedUsers.forEach(([userId, points]) => {
            const user = allUsers[userId] || { name: 'Unknown User' };
            const isCurrentUser = userId === currentUserId;
            scoresContainer.innerHTML += `
                <div class="user-score-item" style="${isCurrentUser ? 'border: 2px solid var(--accent-blue);' : ''}">
                    <div class="user-score-name">
                        ${isCurrentUser ? '👤' : '👥'} ${user.name || 'User'}
                    </div>
                    <div class="user-score-points">${points} pts</div>
                </div>
            `;
        });
    }
    
    // Update status message
    const statusEl = document.getElementById('competitionStatus');
    const subtitleEl = document.getElementById('competitionSubtitle');
    
    if (statusEl && subtitleEl) {
        if (currentDay >= daysInMonth - 1) {
            if (teamPoints >= monsterProgress) {
                statusEl.textContent = '🎉 Team Victory!';
                subtitleEl.textContent = 'Your household defeated the Dirt Monster this month!';
            } else {
                statusEl.textContent = '👹 Monster Wins!';
                subtitleEl.textContent = 'Better teamwork next month!';
            }
        } else if (teamPoints > monsterProgress) {
            statusEl.textContent = '🔥 Team is Winning!';
            subtitleEl.textContent = `Keep it up! ${daysInMonth - currentDay} days left.`;
        } else if (teamPoints === monsterProgress) {
            statusEl.textContent = '⚔️ It\'s a Tie!';
            subtitleEl.textContent = `Push ahead! ${daysInMonth - currentDay} days left.`;
        } else {
            statusEl.textContent = '💪 Team Needs Help!';
            subtitleEl.textContent = `The monster is ahead! ${daysInMonth - currentDay} days left.`;
        }
    }

    // Add competition history
    if (competitionHistory && Object.keys(competitionHistory).length > 0 && scoresContainer) {
        const historyHtml = `
            <div style="margin-top: 24px; padding-top: 24px; border-top: 2px solid var(--bg-secondary);">
                <div style="font-weight: 600; margin-bottom: 12px; text-align: center;">📊 Past Months</div>
                ${Object.entries(competitionHistory)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 6)
                    .map(([month, data]) => {
                        const [year, monthNum] = month.split('-');
                        const monthName = new Date(year, monthNum).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        const icon = data.winner === 'Team' ? '🎉' : '👹';
                        const color = data.winner === 'Team' ? 'var(--accent-blue)' : 'var(--accent-dirty)';
                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-primary); border-radius: 8px; margin-bottom: 8px;">
                                <span style="flex: 1;">${monthName}</span>
                                <span style="flex: 1; text-align: center; font-weight: 600; color: ${color};">${icon} ${data.winner}</span>
                                <span style="flex: 1; text-align: right; font-size: 12px;">${data.teamPoints} vs ${data.monsterPoints}</span>
                            </div>
                        `;
                    }).join('')}
            </div>
        `;
        
        scoresContainer.innerHTML += historyHtml;
    }
}

// Open history modal
function openHistoryModal(roomKey, taskId) {
    const room = rooms[roomKey];
    const task = room.tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    document.getElementById('historyTitle').textContent = `${task.name} - History`;
    
    const historyList = document.getElementById('historyList');
    
    let htmlContent = '';

    if (!task.history || task.history.length === 0) {
        htmlContent = '<div class="empty-history">No cleaning history yet. Complete this task to start tracking!</div>';
    } else {
        const sortedHistory = [...task.history].sort((a, b) => b.timestamp - a.timestamp);
        
        htmlContent = sortedHistory.map((entry, index) => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
            
            const userName = entry.userName || (allUsers[entry.userId] ? allUsers[entry.userId].name : 'User');
            
            return `
                <div class="history-item">
                    <div>
                        <div class="history-date">${dateStr}</div>
                        <div class="history-user">by ${userName}</div>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn edit" onclick="editHistoryEntry('${roomKey}', '${taskId}', ${index})">
                            Edit
                        </button>
                        <button class="history-action-btn delete" onclick="deleteHistoryEntry('${roomKey}', '${taskId}', ${index})">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    htmlContent += `
        <button class="btn btn-primary" style="margin-top: 16px; width: 100%;" 
                onclick="addHistoryRecord('${roomKey}', '${taskId}')">
            + Add History Record
        </button>
    `;
    
    historyList.innerHTML = htmlContent;
    document.getElementById('historyModal').classList.add('active');
}

// Helper to add history record
function addHistoryRecord(roomKey, taskId) {
    closeModal('historyModal');
    openCompleteTaskModal(roomKey, taskId);
}

// Edit history entry
function editHistoryEntry(roomKey, taskId, index) {
    const room = rooms[roomKey];
    const task = room.tasks.find(t => t.id === taskId);
    
    if (!task || !task.history || !task.history[task.history.length - 1 - index]) return;
    
    closeModal('historyModal');
    
    const sortedHistory = [...task.history].sort((a, b) => b.timestamp - a.timestamp);
    const entry = sortedHistory[index];
    
    const date = new Date(entry.timestamp);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    document.getElementById('completeTaskRoom').value = roomKey;
    document.getElementById('completeTaskId').value = taskId;
    document.getElementById('completeTaskName').textContent = task.name;
    document.getElementById('completionDate').value = dateStr;
    
    const originalIndex = task.history.findIndex(h => h.timestamp === entry.timestamp && h.userId === entry.userId);
    
    if (originalIndex !== -1) {
        deleteHistoryEntry(roomKey, taskId, task.history.length - 1 - originalIndex, true);
    }
    
    document.getElementById('completeTaskModal').classList.add('active');
}

// Delete history entry
function deleteHistoryEntry(roomKey, taskId, index, skipConfirm) {
    if (!skipConfirm && !confirm('Delete this history entry?')) return;
    
    const room = rooms[roomKey];
    const task = room.tasks.find(t => t.id === taskId);
    
    if (!task || !task.history) return;
    
    const actualIndex = task.history.length - 1 - index;
    
    task.history.splice(actualIndex, 1);
    
    if (task.history.length > 0) {
        const sorted = [...task.history].sort((a, b) => a.timestamp - b.timestamp);
        const latest = sorted[sorted.length - 1];
        
        task.lastCompleted = latest.timestamp;
        task.lastCompletedBy = latest.userId;
    } else {
        task.lastCompleted = null;
        task.lastCompletedBy = null;
    }
    
    saveData();
    forceUIUpdate();
    
    if (!skipConfirm) {
        openHistoryModal(roomKey, taskId);
    }
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Setup form handlers
function setupFormHandlers() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            closeModal('loginModal');
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    });

    // Handlers for Task Action Modal
    document.getElementById('btnAddNewRecord').addEventListener('click', () => {
        const roomKey = document.getElementById('actionRoomKey').value;
        const taskId = document.getElementById('actionTaskId').value;
        closeModal('taskActionModal');
        openCompleteTaskModal(roomKey, taskId);
    });

    document.getElementById('btnUncheckTask').addEventListener('click', () => {
        const roomKey = document.getElementById('actionRoomKey').value;
        const taskId = document.getElementById('actionTaskId').value;
        closeModal('taskActionModal');
        unmarkTask(roomKey, taskId);
    });
    
    // Task form
    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const roomKey = document.getElementById('editTaskRoom').value;
        const taskId = document.getElementById('editTaskId').value;
        const name = document.getElementById('taskName').value;
        let frequency = document.getElementById('taskFrequency').value;
        
        if (frequency === 'custom') {
            frequency = parseInt(document.getElementById('customDays').value);
        } else {
            frequency = parseInt(frequency);
        }
        
        const room = rooms[roomKey];
        
        if (taskId) {
            // Edit existing task
            const task = room.tasks.find(t => t.id === taskId);
            if (task) {
                task.name = name;
                task.frequency = frequency;
            }
        } else {
            // Add new task
            console.log('➕ Adding new task to room:', roomKey);
            room.tasks.push({
                id: `${roomKey}_${Date.now()}`,
                name: name,
                frequency: frequency,
                lastCompleted: null,
                lastCompletedBy: null,
                history: []
            });
        }
        
        saveData();
        forceUIUpdate();
        closeModal('taskModal');
    });
    
    // Room form (FIXED: Write new room directly to Firebase immediately)
    document.getElementById('roomForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('roomName').value;
        const icon = document.getElementById('selectedEmoji').value;
        const roomKey = 'room_' + Date.now();
        
        console.log('➕ Adding new room:', name);
        
        rooms[roomKey] = {
            name: name,
            icon: icon,
            tasks: []
        };

        // Immediately write new room directly to Firebase (bypasses 500ms batch delay)
        if (db) {
            db.ref(`rooms/${roomKey}`).set(rooms[roomKey])
                .then(() => console.log('✅ New room saved to Firebase'))
                .catch(err => console.error('❌ Failed to save room:', err));
        }

        // FIX: Add to order and save order separately
        if (!roomOrder.includes(roomKey)) {
            roomOrder.push(roomKey);
            saveRoomOrder();
        }
        
        saveData();
        forceUIUpdate();
        closeModal('roomModal');
    });
    
    // User name form
    document.getElementById('userNameForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        currentUserName = document.getElementById('userNameInput').value.trim();
        console.log('💾 Saving user name:', currentUserName);
        
        if (!allUsers[currentUserId]) {
            allUsers[currentUserId] = { name: currentUserName, points: 0 };
        } else {
            allUsers[currentUserId].name = currentUserName;
        }
        
        if (db && currentUserId) {
            try {
                await db.ref(`users/${currentUserId}/name`).set(currentUserName);
                console.log('✅ User name saved to Firebase');
            } catch (error) {
                console.error('❌ Error saving user name:', error);
            }
        }
        
        localStorage.setItem('cleanquest_userName', currentUserName);
        
        saveData();
        updateUserNameDisplay();
        closeModal('userNameModal');
    });
    
    setupCompleteTaskForm();
}

// Delete task
function deleteTask(roomKey, taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    const room = rooms[roomKey];
    room.tasks = room.tasks.filter(t => t.id !== taskId);
    
    saveData();
    forceUIUpdate();
}

// Close modal when clicking overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
