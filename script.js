// Firebase config is loaded from firebase-config.js

// Import from a recent, stable Firebase version
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { initializeFirestore, getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, updateDoc, deleteDoc, arrayUnion, arrayRemove, query, where, getDocs, Timestamp, writeBatch, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// --- Firebase Config Check ---
if (firebaseConfig.apiKey.includes("AIzaSyB_P4-Si9ua1b7k4W60z6tcTfK-FXdWpRs") || firebaseConfig.projectId.includes("quan-ly-media")) {
    console.warn("Đang sử dụng cấu hình Firebase mặc định. Vui lòng thay thế bằng cấu hình của bạn để triển khai thực tế.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// --- Admin Config ---
const ADMIN_EMAIL = "antonyminh2025@gmail.com";

const AVATAR_STYLES = [
    'pixel-art', 'adventurer', 'big-ears', 'bottts', 'avataaars', 'micah', 'initials',
    'lorelei', 'adventurer-neutral', 'big-smile', 'avataaars-neutral', 'big-ears-neutral',
    'bottts-neutral', 'croodles', 'croodles-neutral', 'fun-emoji', 'icons', 'identicon',
    'lorelei-neutral', 'miniavs', 'open-peeps', 'personas', 'pixel-art-neutral',
    'rings', 'shapes', 'thumbs'
];

// --- Global state ---
let currentUser = null;
let currentUserData = null; // Cache for current user's document data
let isAdmin = false;
let activeGroupId = null;
let activePlanId = null;
let viewHistory = [];
// Listeners
let usersUnsubscribe = null;
let plansUnsubscribe = null;
let taskUnsubscribe = null;
let groupsUnsubscribe = null;
let groupDocUnsubscribe = null;
let friendRequestsUnsubscribe = null;
let chatMessagesUnsubscribe = null;
// Chart
let userGrowthChart = null;
let weeklyProgressChart = null;
let burndownChart = null;
let detailChart = null;
// Data Caches
let cachedTasks = [];
let allUsersCache = [];
let activeGroupMembers = []; 
let currentFriendsData = []; // Cache for friend data {uid, name, email}
// UI State & Drag-Drop State
let currentWeek = 1;
let activeGroupStartDate = null;
let activeGroupTotalWeeks = 4;
let currentChatContext = { type: null, id: null, name: null };
let dragOperation = { taskId: null, isCopy: false };
// Filter State
let filterPartnerValue = '';
let filterAssigneeUid = '';
let filterChannelValue = '';

// --- View Navigation ---
const getCurrentView = () => {
    if (!ui.profileContent.classList.contains('hidden')) return 'profile';
    if (!ui.statisticsContent.classList.contains('hidden')) return 'statistics';
    if (!ui.reportManagementContent.classList.contains('hidden')) return 'report-management';
    if (!ui.facebookReportContent.classList.contains('hidden')) return 'facebook-report';
    if (!ui.facebookMcvReportContent.classList.contains('hidden')) return 'facebook-mcv-report';
    if (!ui.facebookToolsContent.classList.contains('hidden')) return 'facebook-tools';
    if (!ui.contentWriterAssistantContent.classList.contains('hidden')) return 'content-writer-assistant';
    if (!ui.aiToolsContent.classList.contains('hidden')) return 'ai-tools';
    if (!ui.toolsContent.classList.contains('hidden')) return 'tools';
    return 'main';
};

const navigateToView = (viewName) => {
    const currentView = getCurrentView();
    if (currentView !== viewName && currentView !== 'main') {
        // Don't push 'main' to history to avoid loops
        viewHistory.push(currentView);
    }
    // Clear history if navigating back to the main dashboard view
    if (viewName === 'main' && activeGroupId === null) {
        viewHistory = [];
    }
    showView(viewName);
};

// --- NEW: Color Utility for User Names ---
const userColorUtil = {
    cache: {},
    
    // Simple string hash function
    _hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    },

    // Get a color for a user ID
    getColor(uid) {
        if (!uid) return '#1f2937'; // Default color for unassigned
        if (this.cache[uid]) {
            return this.cache[uid];
        }

        const hash = this._hashCode(uid);
        // Use the hash to generate a color in HSL format
        // Hue: 0-360 (full color wheel)
        // Saturation: 50-80% (less intense, better for UI)
        // Lightness: 25-40% (darker for better contrast on white)
        const h = Math.abs(hash) % 360;
        const s = 50 + (Math.abs(hash) % 31); // Saturation between 50% and 80%
        const l = 25 + (Math.abs(hash) % 16); // Lightness between 25% and 40%

        const color = `hsl(${h}, ${s}%, ${l}%)`;
        this.cache[uid] = color;
        return color;
    }
};


// --- UI Elements ---
const ui = {
    // Screens
    loadingScreen: document.getElementById('loading-screen'),
    authScreen: document.getElementById('auth-screen'),
    appScreen: document.getElementById('app-screen'),
    adminScreen: document.getElementById('admin-screen'),
    publicViewScreen: document.getElementById('public-view-screen'),
    
    // Auth
    authForm: document.getElementById('auth-form'),
    authError: document.getElementById('auth-error'),
    authTitle: document.getElementById('auth-title'),
    authToggleText: document.getElementById('auth-toggle-text'),
    authToggleLink: document.getElementById('auth-toggle-link'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    nameFieldContainer: document.getElementById('name-field-container'),
    
    // User App
    userAvatar: document.getElementById('user-avatar'),
    profileAvatarLarge: document.getElementById('profile-avatar-large'),
    profileAvatarContainer: document.getElementById('profile-avatar-container'),
    taskbar: document.getElementById('taskbar'),
    mainContent: document.getElementById('main-content'),
    mainContentContainer: document.getElementById('main-content-container'),
    profileContent: document.getElementById('profile-content'),
    statisticsContent: document.getElementById('statistics-content'),
    toolsContent: document.getElementById('tools-content'),
    aiToolsContent: document.getElementById('ai-tools-content'),
    contentWriterAssistantContent: document.getElementById('content-writer-assistant-content'),
    facebookToolsContent: document.getElementById('facebook-tools-content'),
    facebookMcvReportContent: document.getElementById('facebook-mcv-report-content'),
    facebookReportContent: document.getElementById('facebook-report-content'),
    reportManagementContent: document.getElementById('report-management-content'),
    statsContainer: document.getElementById('stats-container'),
    logoutBtn: document.getElementById('logout-btn'),
    headerTitle: document.getElementById('header-title'),
    backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
    createGroupBtn: document.getElementById('create-group-btn'),
    createPlanBtn: document.getElementById('create-plan-btn'),
    createTaskBtn: document.getElementById('create-task-btn'),
    statisticsBtn: document.getElementById('statistics-btn'),
    joinGroupBtn: document.getElementById('join-group-btn'),
    leaveGroupBtn: document.getElementById('leave-group-btn'),
    friendsBtn: document.getElementById('friends-btn'),
    profileBtn: document.getElementById('profile-btn'),
    openChatBtn: document.getElementById('open-chat-btn'),
    sharePlanBtn: document.getElementById('share-plan-btn'),
    filterBtn: document.getElementById('filter-btn'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileMenu: document.getElementById('mobile-menu'),
    desktopHeaderButtons: document.getElementById('desktop-header-buttons'),
    mobileHeaderButtons: document.getElementById('mobile-header-buttons'),

    // Mobile Bottom Nav
    mobileBottomNav: document.getElementById('mobile-bottom-nav'),
    mobileNavHome: document.getElementById('mobile-nav-home'),
    mobileNavTools: document.getElementById('mobile-nav-tools'),
    mobileNavChat: document.getElementById('mobile-nav-chat'),
    mobileNavFriends: document.getElementById('mobile-nav-friends'),
    mobileNavProfile: document.getElementById('mobile-nav-profile'),

    // Taskbar Group ID
    groupIdDisplay: document.getElementById('group-id-display'),
    groupIdText: document.getElementById('group-id-text'),
    copyGroupIdBtn: document.getElementById('copy-group-id-btn'),

    // Profile Modal
    profileForm: document.getElementById('profile-form'),
    avatarModal: document.getElementById('avatar-modal'),
    avatarSelectionGrid: document.getElementById('avatar-selection-grid'),
    profileNameInput: document.getElementById('profile-name'),
    profileEmailInput: document.getElementById('profile-email'),
    profileNewPasswordInput: document.getElementById('profile-new-password'),
    profileConfirmPasswordInput: document.getElementById('profile-confirm-password'),
    profileError: document.getElementById('profile-error'),

    // Public View
    publicHeaderTitle: document.getElementById('public-header-title'),
    publicStatsContainer: document.getElementById('public-stats-container'),
    publicMainContent: document.getElementById('public-main-content'),
    
    // Admin App
    adminLogoutBtn: document.getElementById('admin-logout-btn'),
    adminStatsContainer: document.getElementById('admin-stats-container'),
    usersTableBody: document.getElementById('users-table-body'),
    addUserBtn: document.getElementById('add-user-btn'),
    userForm: document.getElementById('user-form'),
    userModalTitle: document.getElementById('user-modal-title'),
    userIdInput: document.getElementById('user-id'),
    userNameInput: document.getElementById('user-name'),
    userEmailInput: document.getElementById('user-email-input'),
    userPasswordInput: document.getElementById('user-password'),
    passwordFieldContainer: document.getElementById('password-field-container'),

    // Group Modal
    groupForm: document.getElementById('group-form'),
    groupModalTitle: document.getElementById('group-modal-title'),
    createGroupView: document.getElementById('create-group-view'),
    joinGroupView: document.getElementById('join-group-view'),
    newGroupNameInput: document.getElementById('new-group-name'),
    joinGroupIdInput: document.getElementById('join-group-id'),

    // Plan Modal
    planForm: document.getElementById('plan-form'),
    planModalTitle: document.getElementById('plan-modal-title'),
    planIdInput: document.getElementById('plan-id'),
    planNameInput: document.getElementById('plan-name'),
    planStartMonthSelect: document.getElementById('plan-start-month'),

    // Task Modal
    taskForm: document.getElementById('task-form'),
    deleteTaskBtn: document.getElementById('delete-task-btn'),
    taskIdInput: document.getElementById('task-id'),
    taskTimeInput: document.getElementById('task-time'),
    taskDateInput: document.getElementById('task-date'),
    taskDatetimeInputs: document.getElementById('task-datetime-inputs'),
    taskDateInputNew: document.getElementById('task-date-input'),
    taskTimeInputNew: document.getElementById('task-time-input'),
    taskPartnerInput: document.getElementById('task-partner'),
    taskContentInput: document.getElementById('task-content'),
    taskStatusInput: document.getElementById('task-status'),
    taskAssigneeInput: document.getElementById('task-assignee'),
    taskModalTitle: document.getElementById('task-modal-title'),
    taskScriptLinkInput: document.getElementById('task-script-link'),
    taskVideoLinkInput: document.getElementById('task-video-link'),
    taskCompletedVideoLinkInput: document.getElementById('task-completed-video-link'),
    taskPriorityInput: document.getElementById('task-priority'),
    taskPointsInput: document.getElementById('task-points'),
    taskChannelInput: document.getElementById('task-channel'),
    addChannelBtn: document.getElementById('add-channel-btn'),
    taskChannelOptionsContainer: document.getElementById('task-channel-options'),

    // Channel Modal
    channelModal: document.getElementById('channel-modal'),
    channelForm: document.getElementById('channel-form'),
    channelInputContainer: document.getElementById('channel-input-container'),
    addChannelRowBtn: document.getElementById('add-channel-row-btn'),

    // Share Modal
    publicShareToggle: document.getElementById('public-share-toggle'),
    shareLinkContainer: document.getElementById('share-link-container'),
    shareLinkInput: document.getElementById('share-link-input'),
    copyShareLinkBtn: document.getElementById('copy-share-link-btn'),

    // Friends Modal
    sendFriendRequestForm: document.getElementById('send-friend-request-form'),
    friendEmailInput: document.getElementById('friend-email-input'),
    friendRequestMessage: document.getElementById('friend-request-message'),
    friendRequestsList: document.getElementById('friend-requests-list'),
    friendsList: document.getElementById('friends-list'),

    // Chat Popup
    chatPopup: document.getElementById('chat-popup'),
    chatContainer: document.getElementById('chat-container'),
    chatSidebar: document.getElementById('chat-sidebar'),
    chatView: document.getElementById('chat-view'),
    openChatBtn: document.getElementById('open-chat-btn'),
    closeChatPopupBtn: document.getElementById('close-chat-popup-btn'),
    backToConversationsBtn: document.getElementById('back-to-conversations-btn'),
    chatTabAll: document.getElementById('chat-tab-all'),
    chatTabUnread: document.getElementById('chat-tab-unread'),
    chatConversationsList: document.getElementById('chat-conversations-list'),
    chatHeader: document.getElementById('chat-header'),
    chatAvatar: document.getElementById('chat-avatar'),
    chatTitle: document.getElementById('chat-title'),
    chatSubtitle: document.getElementById('chat-subtitle'),
    chatMessages: document.getElementById('messenger-chat-messages'),
    chatInputForm: document.getElementById('messenger-chat-form'),
    chatInput: document.getElementById('messenger-chat-input'),

    // Filter Modal
    filterForm: document.getElementById('filter-form'),
    filterPartnerInput: document.getElementById('filter-partner-input'),
    filterAssigneeSelect: document.getElementById('filter-assignee-select'),
    filterChannelSelect: document.getElementById('filter-channel-select'),
    clearFiltersBtn: document.getElementById('clear-filters-btn'),

    // Statistics View
    statisticsTableBody: document.getElementById('statistics-table-body'),
    statFilterAssignee: document.getElementById('stat-filter-assignee'),
    statFilterDate: document.getElementById('stat-filter-date'),
    statFilterPartner: document.getElementById('stat-filter-partner'),
    statFilterChannel: document.getElementById('stat-filter-channel'),
    statFilterTime: document.getElementById('stat-filter-time'),

    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarNav: document.getElementById('sidebar-nav'),
    groupListContainer: document.getElementById('group-list-container'),
    toggleGroupCategoryBtn: document.getElementById('toggle-group-category-btn'),
    // Tool Category
    toggleToolCategoryBtn: document.getElementById('toggle-tool-category-btn'),
    toolListContainer: document.getElementById('tool-list-container'),
    sidebarAiToolsBtn: document.getElementById('sidebar-ai-tools-btn'),
    navigateToAiToolsBtn: document.getElementById('navigate-to-ai-tools-btn'),

    // Report Category
    // Report Category
    toggleReportCategoryBtn: document.getElementById('toggle-report-category-btn'),
    reportListContainer: document.getElementById('report-list-container'),
    sidebarMcvReportBtn: document.getElementById('sidebar-mcv-report-btn'),
    navigateToMcvReportCard: document.getElementById('navigate-to-mcv-report-card'),
    sidebarFacebookReportBtn: document.getElementById('sidebar-facebook-report-btn'),
    navigateToFacebookReportCard: document.getElementById('navigate-to-facebook-report-card'),

    // Content Writer Assistant
    contentWriterBtn: document.getElementById('content-writer-btn'),
};

// --- NEW: Centralized Header Button Management ---
const handleResize = () => {
    const isMobile = window.innerWidth <= 768;
    if (ui.desktopHeaderButtons) {
        ui.desktopHeaderButtons.style.display = isMobile ? 'none' : 'flex';
    }
    if (ui.mobileHeaderButtons) {
        ui.mobileHeaderButtons.style.display = isMobile ? 'block' : 'none';
    }
    // Hide sidebar on mobile and show it on desktop
    if (ui.sidebar) {
        ui.sidebar.classList.toggle('hidden', isMobile);
    }
};

const updateHeaderButtons = (view) => {
    // Determine current view by inspecting the DOM, as the 'view' param is not always reliable.
    const isProfileView = !ui.profileContent.classList.contains('hidden');
    const isStatsView = !ui.statisticsContent.classList.contains('hidden');
    const isToolsView = !ui.toolsContent.classList.contains('hidden') || !ui.aiToolsContent.classList.contains('hidden') || !ui.contentWriterAssistantContent.classList.contains('hidden');
    const isFacebookView = !ui.facebookToolsContent.classList.contains('hidden') || !ui.facebookMcvReportContent.classList.contains('hidden') || !ui.facebookReportContent.classList.contains('hidden');

    const isGroupDashboard = !activeGroupId && !activePlanId;
    const isPlanDashboard = activeGroupId && !activePlanId;
    const isScheduleView = activeGroupId && activePlanId;

    // Helper to toggle visibility
    const setVisibility = (element, isVisible) => {
        if (element) {
            element.classList.toggle('hidden', !isVisible);
        }
    };

    // Taskbar visibility: Show only when relevant (plan/schedule/stats) and not in other views.
    const isTaskbarVisible = (isPlanDashboard || isScheduleView || isStatsView) && !isProfileView && !isFacebookView && !isToolsView;
    setVisibility(ui.taskbar, isTaskbarVisible);

    // Desktop buttons in header
    const isSubView = isPlanDashboard || isScheduleView || isProfileView || isStatsView || isFacebookView;
    setVisibility(ui.backToDashboardBtn, isSubView);
    setVisibility(ui.createGroupBtn, isGroupDashboard && !isSubView);
    setVisibility(ui.joinGroupBtn, isGroupDashboard && !isSubView);
    
    // Buttons inside the new taskbar
    setVisibility(ui.leaveGroupBtn, isTaskbarVisible);
    setVisibility(ui.createPlanBtn, isPlanDashboard);
    setVisibility(ui.createTaskBtn, isScheduleView);
    setVisibility(ui.statisticsBtn, isScheduleView);
    setVisibility(ui.sharePlanBtn, isScheduleView);
    setVisibility(ui.filterBtn, isScheduleView);
    
    // Always visible when logged in (in header)
    setVisibility(ui.profileBtn, true);
    setVisibility(ui.friendsBtn, true);
    setVisibility(ui.openChatBtn, true); // Always show chat button when logged in
    setVisibility(ui.logoutBtn, true);

    // Also update the mobile menu to reflect the new state
    updateMobileMenu();
};

const updateTaskbar = (groupData) => {
    if (!groupData || !activeGroupId) {
        ui.groupIdDisplay.classList.add('hidden');
        return;
    }

    ui.groupIdDisplay.classList.remove('hidden');
    ui.groupIdDisplay.classList.add('flex'); // Use flex to ensure it's visible
    ui.groupIdText.textContent = activeGroupId;
    
    // Use a fresh event listener to prevent duplicates
    const newCopyBtn = ui.copyGroupIdBtn.cloneNode(true);
    ui.copyGroupIdBtn.parentNode.replaceChild(newCopyBtn, ui.copyGroupIdBtn);
    ui.copyGroupIdBtn = newCopyBtn; // Update reference in ui object

    ui.copyGroupIdBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(activeGroupId).then(() => {
            showMessage('Thành công', 'Đã sao chép ID Nhóm vào bộ nhớ tạm.');
        }, (err) => {
            console.error('Could not copy text: ', err);
            showMessage('Lỗi', 'Không thể sao chép ID.', true);
        });
    });
};


const showScreen = (screenId) => {
    ['auth-screen', 'app-screen', 'admin-screen', 'public-view-screen', 'loading-screen'].forEach(id => {
        const screen = document.getElementById(id);
        if (id === screenId) {
            screen.classList.remove('hidden');
        } else {
            screen.classList.add('hidden');
        }
    });
     if (screenId !== 'loading-screen') {
         ui.loadingScreen.classList.add('hidden');
     }
};

const updateUserAvatar = (uid, style = 'pixel-art') => {
    const avatarUrl = `https://api.dicebear.com/8.x/${style}/svg?seed=${uid}`;
    if (ui.userAvatar) {
        ui.userAvatar.src = avatarUrl;
    }
    if (ui.profileAvatarLarge) {
        ui.profileAvatarLarge.src = avatarUrl;
    }
};

// --- Modal Control ---
window.openModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Initialize custom selects within the modal just before showing it
    modal.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        initCustomSelect(wrapper);
    });

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    setTimeout(() => { // For transition
        modal.querySelector('.modal-content').classList.add('scale-100', 'opacity-100');
        modal.querySelector('.modal-content').classList.remove('scale-95', 'opacity-0');
    }, 10);
};

window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Special handling for chart modal to destroy chart instance
    if (modalId === 'chart-detail-modal' && detailChart) {
        detailChart.destroy();
        detailChart = null;
    }

    document.body.style.overflow = ''; // Restore background scrolling
    const content = modal.querySelector('.modal-content');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200); // Wait for transition
};

const showMessage = (title, text, isError = false) => {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').innerHTML = text;
    const iconEl = document.getElementById('message-icon');
    if (isError) {
        iconEl.innerHTML = '<i class="fas fa-times-circle text-red-500"></i>';
    } else {
        iconEl.innerHTML = '<i class="fas fa-check-circle text-green-500"></i>';
    }
    openModal('message-modal');
};

const showChartDetail = (chartData, chartOptions, chartTitle) => {
    const ctx = document.getElementById('chart-detail-canvas')?.getContext('2d');
    if (!ctx) return;

    document.getElementById('chart-detail-title').textContent = chartTitle;

    if (detailChart) {
        detailChart.destroy();
        detailChart = null;
    }
    
    // First, open the modal so the canvas element is visible and has dimensions.
    openModal('chart-detail-modal');

    // Then, create the chart. A minimal timeout ensures the canvas is ready.
    setTimeout(() => {
        // Double-check that the modal is still open before creating the chart
        const modal = document.getElementById('chart-detail-modal');
        if (modal && !modal.classList.contains('hidden')) {
            detailChart = new Chart(ctx, {
                type: chartData.type || 'line',
                data: chartData.data,
                options: chartOptions
            });
        }
    }, 50);
};

const showConfirmation = (title, text, onConfirm) => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    // Clone and replace to remove old listeners
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', () => {
        onConfirm();
        closeModal('confirm-modal');
    });
    newCancelBtn.addEventListener('click', () => closeModal('confirm-modal'));

    openModal('confirm-modal');
};

// --- Date Utilities ---
function getNumberOfWeeks(year, month) {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay(); 
    const firstDayIndex = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1; // Monday = 0
    const totalSlots = firstDayIndex + lastDayOfMonth.getDate();
    return Math.ceil(totalSlots / 7);
}

const getWeekDates = (weekNumber, groupStartDate) => {
    const baseDate = groupStartDate ? new Date(groupStartDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const firstDayOfWeek1 = new Date(baseDate);
    const dayOffset = (firstDayOfWeek1.getDay() === 0) ? 6 : firstDayOfWeek1.getDay() - 1;
    firstDayOfWeek1.setDate(firstDayOfWeek1.getDate() - dayOffset);

    const startDate = new Date(firstDayOfWeek1);
    startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        dates.push(d);
    }
    return dates;
};

const formatDate = (date) => date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const formatFullDate = (timestamp) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A';
    return timestamp.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatTime = (timestamp) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return '';
    return timestamp.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}


// --- Authentication ---
const toggleAuthMode = (isLogin) => {
    ui.authTitle.textContent = isLogin ? 'Đăng Nhập' : 'Đăng Ký';
    ui.authSubmitBtn.textContent = isLogin ? 'Đăng Nhập' : 'Đăng Ký';
    ui.authToggleText.textContent = isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?';
    ui.authToggleLink.textContent = isLogin ? 'Đăng ký ngay' : 'Đăng nhập';
    ui.authError.classList.add('hidden');
    ui.authForm.reset();
    
    if (isLogin) {
        ui.nameFieldContainer.classList.add('hidden');
    } else {
        ui.nameFieldContainer.classList.remove('hidden');
    }
};

ui.authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthMode(ui.authTitle.textContent === 'Đăng Ký');
});

ui.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const isLogin = ui.authTitle.textContent === 'Đăng Nhập';

    ui.authError.classList.add('hidden');

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle the rest
        } else {
            const name = document.getElementById('name').value.trim();
            if (!name) {
                ui.authError.textContent = 'Vui lòng nhập tên của bạn.';
                ui.authError.classList.remove('hidden');
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            const userData = {
                name: name,
                email: userCredential.user.email,
                groups: [],
                friends: [],
                friendRequests: [],
                activeGroupId: null,
                createdAt: Timestamp.now(),
                status: 'pending' // Default status for new users
            };
            // Auto-assign 'admin' role if the email matches ADMIN_EMAIL
            if (userCredential.user.email === ADMIN_EMAIL) {
                userData.role = 'admin';
                userData.status = 'active'; // Admin user is active by default
            }

            await setDoc(doc(db, "users", userCredential.user.uid), userData);
            
            // After registration, sign them out and show message
            await signOut(auth);
            showMessage('Đăng Ký Thành Công', 'Tài khoản của bạn đã được tạo và đang chờ quản trị viên phê duyệt. Vui lòng quay lại sau.');
            toggleAuthMode(true);
        }
    } catch (error) {
        const message = {
            'auth/user-not-found': 'Email chưa được đăng ký.',
            'auth/wrong-password': 'Sai mật khẩu, vui lòng thử lại.',
            'auth/email-already-in-use': 'Email này đã được sử dụng.',
            'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự.',
            'auth/invalid-email': 'Địa chỉ email không hợp lệ.',
        }[error.code] || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
        ui.authError.textContent = message;
        ui.authError.classList.remove('hidden');
    }
});

const handleLogout = () => signOut(auth);
ui.logoutBtn.addEventListener('click', handleLogout);
ui.adminLogoutBtn.addEventListener('click', handleLogout);

// --- Cleanup Listeners ---
function cleanupAllListeners() {
    if (taskUnsubscribe) taskUnsubscribe();
    if (plansUnsubscribe) plansUnsubscribe();
    if (groupsUnsubscribe) groupsUnsubscribe();
    if (groupDocUnsubscribe) groupDocUnsubscribe();
    if (usersUnsubscribe) usersUnsubscribe();
    if (friendRequestsUnsubscribe) friendRequestsUnsubscribe();
    if (chatMessagesUnsubscribe) chatMessagesUnsubscribe();
    taskUnsubscribe = null;
    plansUnsubscribe = null;
    groupsUnsubscribe = null;
    groupDocUnsubscribe = null;
    usersUnsubscribe = null;
    friendRequestsUnsubscribe = null;
    chatMessagesUnsubscribe = null;
}

// --- App Initializer ---
// ======================================================================
// =================== CUSTOM DATE PICKER LOGIC =====================
// ======================================================================

const datePickerState = {
    visible: false,
    currentDate: new Date(),
    selectedDate: null,
    targetInput: null,
};

const datePickerUI = {
    picker: document.getElementById('custom-date-picker'),
    monthYear: document.getElementById('date-picker-month-year'),
    prevMonthBtn: document.getElementById('date-picker-prev-month'),
    nextMonthBtn: document.getElementById('date-picker-next-month'),
    grid: document.getElementById('date-picker-grid'),
};

function renderDatePicker() {
    if (!datePickerUI.picker) return;

    const year = datePickerState.currentDate.getFullYear();
    const month = datePickerState.currentDate.getMonth();

    datePickerUI.monthYear.textContent = `Tháng ${month + 1}, ${year}`;
    datePickerUI.grid.innerHTML = '';

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Add empty cells for days before the 1st of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
        datePickerUI.grid.appendChild(document.createElement('div'));
    }

    // Add day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.textContent = day;
        cell.className = 'date-picker-day-cell';
        cell.dataset.day = day;

        const today = new Date();
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.classList.add('today');
        }

        if (datePickerState.selectedDate &&
            day === datePickerState.selectedDate.getDate() &&
            month === datePickerState.selectedDate.getMonth() &&
            year === datePickerState.selectedDate.getFullYear()) {
            cell.classList.add('selected');
        }

        datePickerUI.grid.appendChild(cell);
    }
}

function showDatePicker(inputElement) {
    if (!datePickerUI.picker) return;
    
    datePickerState.targetInput = inputElement;
    const inputValue = inputElement.value;
    
    if (inputValue) {
        const parts = inputValue.split('-');
        datePickerState.currentDate = new Date(parts[0], parts[1] - 1, parts[2]);
        datePickerState.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        datePickerState.currentDate = new Date();
        datePickerState.selectedDate = null;
    }

    renderDatePicker();

    const inputRect = inputElement.getBoundingClientRect();
    datePickerUI.picker.style.top = `${window.scrollY + inputRect.bottom + 8}px`;
    datePickerUI.picker.style.left = `${window.scrollX + inputRect.left}px`;
    datePickerUI.picker.classList.remove('hidden');
    datePickerState.visible = true;
}

function hideDatePicker() {
    if (!datePickerUI.picker) return;
    datePickerUI.picker.classList.add('hidden');
    datePickerState.visible = false;
    datePickerState.targetInput = null;
}

datePickerUI.prevMonthBtn?.addEventListener('click', () => {
    datePickerState.currentDate.setMonth(datePickerState.currentDate.getMonth() - 1);
    renderDatePicker();
});

datePickerUI.nextMonthBtn?.addEventListener('click', () => {
    datePickerState.currentDate.setMonth(datePickerState.currentDate.getMonth() + 1);
    renderDatePicker();
});

datePickerUI.grid?.addEventListener('click', (e) => {
    if (e.target.classList.contains('date-picker-day-cell')) {
        const day = parseInt(e.target.dataset.day, 10);
        const newSelectedDate = new Date(
            datePickerState.currentDate.getFullYear(),
            datePickerState.currentDate.getMonth(),
            day
        );
        datePickerState.selectedDate = newSelectedDate;
        
        if (datePickerState.targetInput) {
            // Format to YYYY-MM-DD for the input
            const year = newSelectedDate.getFullYear();
            const month = String(newSelectedDate.getMonth() + 1).padStart(2, '0');
            const date = String(newSelectedDate.getDate()).padStart(2, '0');
            datePickerState.targetInput.value = `${year}-${month}-${date}`;
            
            // Trigger change event for any listeners
            datePickerState.targetInput.dispatchEvent(new Event('change'));
        }
        
        hideDatePicker();
    }
});

// Global click listener to hide the picker
document.addEventListener('click', (e) => {
    if (datePickerState.visible && 
        !datePickerUI.picker.contains(e.target) && 
        e.target !== datePickerState.targetInput) {
        hideDatePicker();
    }
});

// Hijack clicks on date inputs
document.addEventListener('click', (e) => {
    if (e.target.matches('input[type="date"]')) {
        e.preventDefault();
        showDatePicker(e.target);
    }
}, true); // Use capture phase to intercept the click early


function handleRouting() {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');

    if (shareId) {
        initializePublicView(shareId);
    } else {
        initializeAuthenticatedApp();
    }
}

function initializeAuthenticatedApp() {
    onAuthStateChanged(auth, async (user) => {
        cleanupAllListeners();
        cachedTasks = [];
        allUsersCache = [];
        activeGroupMembers = [];
        currentFriendsData = [];
        activeGroupId = null;
        activePlanId = null;
        isAdmin = false;
        currentUser = null;
        currentUserData = null;

        if (user) {
            currentUser = user;
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                currentUserData = { uid: user.uid, ...userDoc.data() };
                const userStatus = currentUserData.status || 'active';

                if (userStatus !== 'active') {
                    let message = 'Tài khoản của bạn đang chờ quản trị viên phê duyệt.';
                    if (userStatus === 'suspended') {
                        message = 'Tài khoản của bạn đã bị khóa.';
                    }
                    await signOut(auth); 
                    showMessage('Truy Cập Bị Từ Chối', message, true);
                    showScreen('auth-screen');
                    toggleAuthMode(true);
                    return;
                }

                if (currentUserData.role === 'admin') {
                    isAdmin = true;
                    showScreen('admin-screen');
                    loadAdminDashboard();
                } else {
                    isAdmin = false;
                    showScreen('app-screen');
                    updateUserAvatar(user.uid, currentUserData.avatarStyle);
                    listenToUserData(user.uid);
                    listenToFriendRequests(user.uid);
                }
            } else {
                await signOut(auth);
                showMessage('Lỗi Dữ Liệu', 'Không tìm thấy hồ sơ người dùng của bạn. Vui lòng liên hệ quản trị viên.', true);
                showScreen('auth-screen');
            }
        } else {
            showScreen('auth-screen');
            ui.mainContent.innerHTML = '';
        }
    });
}

// ======================================================================
// ======================= PUBLIC VIEW SECTION ==========================
// ======================================================================
async function initializePublicView(shareId) {
    showScreen('public-view-screen');
    ui.publicMainContent.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-2xl text-[var(--brand-primary)]"></i><p class="mt-2">Đang tải lịch kế hoạch...</p></div>`;

    try {
        const [groupId, planId] = shareId.split('_');
        if (!groupId || !planId) {
            throw new Error("Invalid share ID format.");
        }

        const groupRef = doc(db, "groups", groupId);
        const groupDoc = await getDoc(groupRef);

        if (!groupDoc.exists() || !groupDoc.data().public) {
            throw new Error("Group does not exist or is not public.");
        }
        
        const groupData = { id: groupDoc.id, ...groupDoc.data() };

        const planRef = doc(db, "groups", groupId, "plans", planId);
        const planDoc = await getDoc(planRef);

        if (!planDoc.exists()) {
            throw new Error("Plan does not exist.");
        }
        const planData = { id: planDoc.id, ...planDoc.data() };

        ui.publicHeaderTitle.textContent = `Lịch Kế Hoạch: ${planData.name} (${groupData.name})`;
        
        // Set global state for public view
        activeGroupId = groupId;
        activePlanId = planId;
        activeGroupStartDate = planData.startDate ? planData.startDate.toDate() : null;
        activeGroupTotalWeeks = activeGroupStartDate ? getNumberOfWeeks(activeGroupStartDate.getFullYear(), activeGroupStartDate.getMonth()) : 4;

        await fetchAndCacheMembers(groupData.members || []);

        const tasksQuery = query(collection(db, "groups", groupId, "plans", planId, "tasks"));
        const tasksSnapshot = await getDocs(tasksQuery);
        cachedTasks = tasksSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
        
        // Render UI
        renderWeekNavigator(true); // isReadOnly = true
        renderSchedule(true); // isReadOnly = true
        updateStats(cachedTasks, true); // isReadOnly = true

    } catch (error) {
        console.error("Error loading public view:", error);
        const errorMessage = 'Lịch kế hoạch này không tồn tại hoặc không được chia sẻ công khai.';
        
        ui.publicMainContent.innerHTML = `<div class="glass-pane text-center p-8">
                          <h2 class="text-xl font-bold mb-2 text-red-600">Lỗi Truy Cập</h2>
                          <p>${errorMessage}</p>
                        </div>`;
    }
}


// ======================================================================
// ========================= ADMIN SECTION ==============================
// ======================================================================

function loadAdminDashboard() {
    listenToAllUsers();
}

window.updateUserStatus = async (userId, newStatus) => {
    const userToUpdate = allUsersCache.find(u => u.id === userId);
    if (!userToUpdate || userToUpdate.email === ADMIN_EMAIL) {
        showMessage('Thao tác không được phép', 'Bạn không thể thay đổi trạng thái của tài khoản này.', true);
        renderUsersTable(allUsersCache); // Revert UI
        return;
    }

    const userRef = doc(db, "users", userId);
    try {
        await updateDoc(userRef, { status: newStatus });
    } catch (error) {
        console.error("Error updating user status:", error);
        showMessage('Lỗi Phân Quyền', 'Không thể cập nhật trạng thái. Vui lòng kiểm tra Firestore Security Rules.', true);
        renderUsersTable(allUsersCache); 
    }
};

function listenToAllUsers() {
    if (usersUnsubscribe) usersUnsubscribe();
    const usersQuery = query(collection(db, "users"));
    usersUnsubscribe = onSnapshot(usersQuery, async (usersSnapshot) => {
        try {
            allUsersCache = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderUsersTable(allUsersCache);

            const groupsSnapshot = await getDocs(collection(db, "groups"));
            const totalGroups = groupsSnapshot.size;

            let totalTasks = 0;
            const taskPromises = groupsSnapshot.docs.map(groupDoc => 
                getDocs(collection(db, "groups", groupDoc.id, "tasks"))
            );
            const taskSnapshots = await Promise.all(taskPromises);
            taskSnapshots.forEach(taskCollection => {
                totalTasks += taskCollection.size;
            });
            
            updateAdminStats(allUsersCache, totalGroups, totalTasks);
            renderUserGrowthChart(allUsersCache);

        } catch(error) {
            console.error("Error updating admin dashboard:", error);
            ui.adminStatsContainer.innerHTML = `<div class="col-span-3 bg-red-100 text-red-700 p-4 rounded-lg">Không thể tải số liệu thống kê.</div>`;
        }
    }, (error) => {
        console.error("Failed to listen to users collection:", error);
        const errorMessage = `Lỗi tải danh sách người dùng. Vui lòng kiểm tra quyền truy cập Firestore (Security Rules). Lỗi: ${error.message}`;
        ui.usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-600">${errorMessage}</td></tr>`;
    });
}

function updateAdminStats(users, totalGroups, totalTasks) {
    const totalUsers = users.length;
    ui.adminStatsContainer.innerHTML = `
        <div class="stat-card"><div class="stat-icon text-blue-500"><i class="fas fa-users"></i></div><div class="stat-value text-blue-600">${totalUsers}</div><div class="stat-label">Tổng người dùng</div></div>
        <div class="stat-card"><div class="stat-icon text-green-500"><i class="fas fa-layer-group"></i></div><div class="stat-value text-green-600">${totalGroups}</div><div class="stat-label">Tổng số nhóm</div></div>
        <div class="stat-card"><div class="stat-icon text-indigo-500"><i class="fas fa-tasks"></i></div><div class="stat-value text-indigo-600">${totalTasks}</div><div class="stat-label">Tổng kế hoạch</div></div>
        <style>
            .stat-card { background: var(--glass-bg); border: 1px solid var(--glass-border-color); border-radius: var(--border-radius-main); padding: 1.5rem; text-align: center; }
            .stat-icon { font-size: 2rem; margin-bottom: 0.75rem; }
            .stat-value { font-size: 2.25rem; font-weight: 700; }
            .stat-label { font-size: 0.875rem; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        </style>
    `;
}

function renderUserGrowthChart(users) {
    const ctx = document.getElementById('user-growth-chart')?.getContext('2d');
    if (!ctx) return;

    const usersByMonth = {};
    users.forEach(user => {
        if (user.createdAt && typeof user.createdAt.toDate === 'function') {
            const date = user.createdAt.toDate();
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            usersByMonth[monthKey] = (usersByMonth[monthKey] || 0) + 1;
        }
    });
    
    const sortedMonths = Object.keys(usersByMonth).sort();
    
    const labels = [];
    const data = [];
    if (sortedMonths.length > 0) {
        const firstMonth = new Date(sortedMonths[0] + "-01T00:00:00");
        const lastMonth = new Date();
        
        let currentMonth = firstMonth;
        while(currentMonth <= lastMonth) {
            const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
            labels.push(`Tháng ${monthKey.split('-')[1]}/${monthKey.split('-')[0]}`);
            data.push(usersByMonth[monthKey] || 0);
            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
    }


    if (userGrowthChart) {
        userGrowthChart.destroy();
    }

    const chartTitle = 'Biểu Đồ Tăng Trưởng Người Dùng';
    userGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số người dùng mới',
                data: data,
                fill: true,
                borderColor: 'rgb(0, 122, 255)',
                backgroundColor: 'rgba(0, 122, 255, 0.2)',
                tension: 0.4,
                pointBackgroundColor: 'rgb(0, 122, 255)',
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { display: false },
                x: { display: false }
            },
            plugins: {
                legend: { display: false },
                title: { display: false },
                tooltip: { enabled: false }
            },
            onClick: () => {
                const detailChartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(0,0,0,0.05)' } },
                        x: { grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: true },
                        title: {
                            display: true,
                            text: chartTitle,
                            font: { size: 18, family: "'Inter', sans-serif", weight: '600' },
                            padding: { bottom: 20 },
                            color: '#1d1d1f'
                        },
                        tooltip: { enabled: true }
                    }
                };
                showChartDetail({ type: 'line', data: userGrowthChart.data }, detailChartOptions, chartTitle);
            }
        }
    });
}


function renderUsersTable(users) {
    if (!ui.usersTableBody) return;
    
    const sortedUsers = [...users].sort((a, b) => {
        const statusA = a.status || 'active';
        const statusB = b.status || 'active';
        if (statusA === 'pending' && statusB !== 'pending') return -1;
        if (statusA !== 'pending' && statusB === 'pending') return 1;
        return 0; // Keep original order for others
    });
    
    ui.usersTableBody.innerHTML = sortedUsers.map(user => {
        const status = user.status || 'active';
        let statusBadge;
        switch (status) {
            case 'active': statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Hoạt động</span>`; break;
            case 'pending': statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Chờ duyệt</span>`; break;
            case 'suspended': statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Bị khóa</span>`; break;
            default: statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Không rõ</span>`;
        }

        const canModify = user.email !== ADMIN_EMAIL;
        let actionsHtml = '';
        if(canModify) {
            actionsHtml += `<button onclick="openEditUserModal('${user.id}')" class="font-medium text-indigo-600 hover:underline">Sửa</button>`;
            if(status === 'active') {
                actionsHtml += `<button onclick="updateUserStatus('${user.id}', 'suspended')" class="font-medium text-orange-600 hover:underline ml-3">Khóa</button>`;
            } else if (status === 'pending') {
                 actionsHtml += `<button onclick="updateUserStatus('${user.id}', 'active')" class="font-medium text-green-600 hover:underline ml-3">Duyệt</button>`;
            } else if (status === 'suspended') {
                actionsHtml += `<button onclick="updateUserStatus('${user.id}', 'active')" class="font-medium text-green-600 hover:underline ml-3">Mở khóa</button>`;
            }
            actionsHtml += `<button onclick="handleDeleteUser('${user.id}', '${user.name}')" class="font-medium text-red-600 hover:underline ml-3">Xóa</button>`;
        }

        const userColor = userColorUtil.getColor(user.id);
        return `
            <tr class="border-b border-gray-200/50 hover:bg-gray-500/5 ${status === 'pending' ? 'bg-yellow-500/10' : ''}">
                <td class="px-6 py-4 font-bold whitespace-nowrap" style="color: ${userColor};">${user.name || 'N/A'}</td>
                <td class="px-6 py-4">${user.email}</td>
                <td class="px-6 py-4">${formatFullDate(user.createdAt)}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}">${user.role === 'admin' ? 'Admin' : 'User'}</span></td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4">${actionsHtml}</td>
            </tr>
        `;
    }).join('');
}


ui.addUserBtn.addEventListener('click', () => {
    ui.userForm.reset();
    ui.userIdInput.value = '';
    ui.userModalTitle.textContent = 'Thêm người dùng mới';
    ui.userEmailInput.disabled = false;
    ui.passwordFieldContainer.classList.remove('hidden');
    ui.userPasswordInput.required = true;
    openModal('user-modal');
});

window.openEditUserModal = (userId) => {
    const user = allUsersCache.find(u => u.id === userId);
    if (!user) {
        showMessage('Lỗi', 'Không tìm thấy người dùng.', true);
        return;
    }
    ui.userForm.reset();
    ui.userModalTitle.textContent = 'Chỉnh sửa người dùng';
    ui.userIdInput.value = user.id;
    ui.userNameInput.value = user.name;
    ui.userEmailInput.value = user.email;
    ui.userEmailInput.disabled = true; // Cannot change email
    ui.passwordFieldContainer.classList.add('hidden'); // For simplicity, password change should be a separate function
    openModal('user-modal');
};

ui.userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = ui.userIdInput.value;
    const name = ui.userNameInput.value;
    const email = ui.userEmailInput.value;
    const password = ui.userPasswordInput.value;
    
    try {
        if (userId) { // Editing existing user
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, { name: name });
            showMessage('Thành công', 'Đã cập nhật thông tin người dùng.');
        } else { // Creating new user by admin
            const tempApp = initializeApp(firebaseConfig, `Secondary-${Date.now()}`); 
            const tempAuth = getAuth(tempApp);
            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            await signOut(tempAuth); 

            const userData = {
                name: name,
                email: email,
                groups: [],
                friends: [],
                friendRequests: [],
                activeGroupId: null,
                createdAt: Timestamp.now(),
                status: 'active' // Admin-created users are active by default
            };
            if (email === ADMIN_EMAIL) {
                userData.role = 'admin';
            }
            await setDoc(doc(db, "users", userCredential.user.uid), userData);
            showMessage('Thành công', 'Đã tạo người dùng mới.');
        }
        closeModal('user-modal');
    } catch (error) {
        console.error("User form error:", error);
        showMessage('Lỗi', `Không thể lưu người dùng: ${error.message}. Vui lòng kiểm tra Security Rules.`, true);
    }
});

window.handleDeleteUser = (userId, userName) => {
    if (!userId) return;
    showConfirmation(`Xóa người dùng "${userName}"?`, 
    'Hành động này sẽ xóa dữ liệu người dùng khỏi Firestore nhưng không xóa tài khoản khỏi hệ thống xác thực. Đây là một hạn chế của việc xóa từ phía client. Tiếp tục?',
    async () => {
        try {
            await deleteDoc(doc(db, "users", userId));
            showMessage('Thành công', `Đã xóa người dùng "${userName}" khỏi cơ sở dữ liệu.`);
        } catch (error) {
            console.error("Delete user error:", error);
            showMessage('Lỗi', 'Không thể xóa người dùng. Vui lòng kiểm tra Security Rules.', true);
        }
    });
};

// ======================================================================
// ======================== USER SECTION ================================
// ======================================================================

// ======================================================================
// ======================== SIDEBAR LOGIC ===============================
// ======================================================================
async function renderSidebar(groupIds) {
    if (!ui.sidebar || !currentUserData) {
        return;
    }

    const groupListContainer = ui.groupListContainer;
    if (!groupListContainer) return;

    groupListContainer.innerHTML = '<div class="text-xs text-gray-500 p-2">Đang tải nhóm...</div>';

    if (!groupIds || groupIds.length === 0) {
        groupListContainer.innerHTML = '<div class="text-xs text-gray-500 p-2">Chưa có nhóm nào.</div>';
        return;
    }

    try {
        const groupPromises = groupIds.map(id => getDoc(doc(db, "groups", id)));
        const groupDocs = await Promise.all(groupPromises);

        let contentHtml = '';
        for (const groupDoc of groupDocs) {
            if (!groupDoc.exists()) continue;
            
            const group = { id: groupDoc.id, ...groupDoc.data() };
            const isGroupActive = group.id === activeGroupId;

            // Fetch plans for this group
            const plansRef = collection(db, "groups", group.id, "plans");
            const plansSnapshot = await getDocs(query(plansRef, orderBy("createdAt")));
            const plans = plansSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            contentHtml += `
                <div class="sidebar-group-container">
                    <div 
                        class="sidebar-group-item w-full flex justify-between items-center cursor-pointer ${isGroupActive && !activePlanId ? 'active' : ''}" 
                        onclick="togglePlanList(event, '${group.id}')">
                        <span class="flex-grow" onclick="event.stopPropagation(); navigateToGroup('${group.id}');">${group.name}</span>
                        ${plans.length > 0 ? `<i class="fas fa-chevron-down text-xs transition-transform p-2"></i>` : ''}
                    </div>
                    <div id="plan-list-${group.id}" class="pl-4 mt-1 space-y-1 plan-list hidden">
                        ${plans.map(plan => `
                            <button 
                                class="sidebar-plan-item ${isGroupActive && plan.id === activePlanId ? 'active' : ''}"
                                onclick="handleSidebarPlanClick('${group.id}', '${plan.id}')">
                                ${plan.name}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        groupListContainer.innerHTML = contentHtml;

    } catch (error) {
        console.error("Error rendering sidebar:", error);
        groupListContainer.innerHTML = '<div class="text-xs text-red-500 p-2">Lỗi tải danh sách nhóm.</div>';
    }
}

window.togglePlanList = (event, groupId) => {
    const planList = document.getElementById(`plan-list-${groupId}`);
    const icon = event.currentTarget.querySelector('i');
    if (planList) {
        const isHidden = planList.classList.contains('hidden');
        planList.classList.toggle('hidden', !isHidden);
        if (icon) {
            icon.classList.toggle('rotate-180', isHidden);
        }
    }
};

window.navigateToGroup = async (groupId) => {
    // First, ensure the main content view is visible
    showView('main');
    // Reset history as we are navigating to a primary view
    viewHistory = [];
    await updateDoc(doc(db, "users", currentUser.uid), { 
        activeGroupId: groupId,
        activePlanId: null 
    });
};

window.handleSidebarPlanClick = async (groupId, planId) => {
    // First, ensure the main content view is visible and prepare the stats container
    showView('main');
    ui.statsContainer.classList.remove('hidden'); // Explicitly show stats for plan view
    // Reset history as we are navigating to a primary view
    viewHistory = [];
    // Selects a specific plan within a group
    await updateDoc(doc(db, "users", currentUser.uid), { 
        activeGroupId: groupId,
        activePlanId: planId 
    });
};


function listenToUserData(uid) {
    const userDocRef = doc(db, "users", uid);
    groupsUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
        try {
            if (!userDoc.exists()) return;
            currentUserData = { uid: userDoc.id, ...userDoc.data() };
            renderSidebar(currentUserData.groups || []); // Render sidebar on every user data change
            const newActiveGroupId = currentUserData.activeGroupId;
            const newActivePlanId = currentUserData.activePlanId;

            // Big state change detection
            if (newActiveGroupId !== activeGroupId || newActivePlanId !== activePlanId) {
                activeGroupId = newActiveGroupId;
                activePlanId = newActivePlanId;

                cleanupAllListeners(); // Clean up all previous listeners
                listenToUserData(uid); // Re-establish the primary listener
                listenToFriendRequests(uid);

                if (activeGroupId && activePlanId) {
                    loadScheduleView(activeGroupId, activePlanId);
                } else if (activeGroupId) {
                    loadPlanDashboard(activeGroupId);
                } else {
                    loadGroupDashboard(currentUserData.groups || []);
                }
            } else if (!activeGroupId && currentUserData.groups) {
                // Initial load or returning to group dashboard
                loadGroupDashboard(currentUserData.groups || []);
            }
        } catch (error) {
            console.error("Critical error in user data listener:", error);
            showMessage('Lỗi Hệ Thống', 'Gặp lỗi nghiêm trọng khi xử lý dữ liệu người dùng. Vui lòng tải lại trang.', true);
        }
    });
}

// --- Group Management ---
async function loadGroupDashboard(groupIds) {
    updateHeaderButtons();
    ui.headerTitle.textContent = 'Các Nhóm Của Tôi';
    ui.statsContainer.classList.add('hidden');
    
    if (groupIds.length === 0) {
        ui.mainContent.innerHTML = `
            <div class="glass-pane text-center p-8">
                <h2 class="text-2xl font-bold mb-2">Chào mừng bạn!</h2>
                <p class="text-gray-600">Bạn chưa ở trong nhóm nào. Hãy tạo một nhóm mới hoặc tham gia bằng mã mời.</p>
            </div>`;
        return;
    }

    let contentHtml = '';
    const groupPromises = groupIds.map(id => getDoc(doc(db, "groups", id)));
    const groupDocs = await Promise.all(groupPromises);

    for (const groupDoc of groupDocs) {
        if (!groupDoc.exists()) continue;
        
        const group = { id: groupDoc.id, ...groupDoc.data() };
        const isGroupAdmin = group.adminId === currentUser.uid;
        const memberCount = group.members?.length || 0;

        // Fetch first 5 members for avatars
        const memberUidsToFetch = (group.members || []).slice(0, 5);
        const memberPromises = memberUidsToFetch.map(uid => getDoc(doc(db, "users", uid)));
        const memberDocs = await Promise.all(memberPromises);
        const members = memberDocs.map(d => d.exists() ? { uid: d.id, ...d.data() } : null).filter(Boolean);

        const avatarsHtml = members.map(member => {
            const avatarStyle = member.avatarStyle || 'pixel-art';
            const avatarUrl = `https://api.dicebear.com/8.x/${avatarStyle}/svg?seed=${member.uid}`;
            return `<img class="group-card-avatar" src="${avatarUrl}" alt="${member.name || ''}" title="${member.name || ''}">`;
        }).join('');

        const moreMembersCount = memberCount > 5 ? `+${memberCount - 5}` : '';
        const moreMembersHtml = moreMembersCount ? `<div class="group-card-avatar-more">${moreMembersCount}</div>` : '';

        const deleteButtonHtml = isGroupAdmin ? `
            <button onclick="deleteGroup(event, '${group.id}', '${group.name}')" class="group-card-delete-btn">
                <i class="fas fa-trash-alt fa-sm"></i>
            </button>
        ` : '';

        contentHtml += `
            <div class="group-card glass-pane" onclick="selectGroup('${group.id}')">
                <div class="group-card-content">
                    <h3 class="group-card-title">${group.name}</h3>
                    <p class="group-card-member-count">${memberCount} thành viên</p>
                </div>
                <div class="group-card-footer">
                     <div class="group-card-avatars">
                        ${avatarsHtml}
                        ${moreMembersHtml}
                    </div>
                    <i class="fas fa-chevron-right group-card-arrow"></i>
                </div>
                ${deleteButtonHtml}
            </div>`;
    }
    
    ui.mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${contentHtml}</div>`;
}

window.selectGroup = async (groupId) => {
    await updateDoc(doc(db, "users", currentUser.uid), { activeGroupId: groupId });
};

window.deleteGroup = async (event, groupId, groupName) => {
    event.stopPropagation();
    showConfirmation(`Xóa nhóm "${groupName}"?`, 'Hành động này không thể hoàn tác. Tất cả kế hoạch và tin nhắn trong nhóm cũng sẽ bị xóa vĩnh viễn.', async () => {
        try {
            const batch = writeBatch(db);

            // Delete all plans and their tasks
            const plansRef = collection(db, "groups", groupId, "plans");
            const plansSnapshot = await getDocs(plansRef);
            for (const planDoc of plansSnapshot.docs) {
                const tasksRef = collection(db, "groups", groupId, "plans", planDoc.id, "tasks");
                const tasksSnapshot = await getDocs(tasksRef);
                tasksSnapshot.docs.forEach(taskDoc => batch.delete(taskDoc.ref));
                batch.delete(planDoc.ref); // Delete the plan itself
            }
            
            // Delete all messages in subcollection
            const messagesRef = collection(db, "groups", groupId, "messages");
            const messagesSnapshot = await getDocs(messagesRef);
            messagesSnapshot.docs.forEach(messageDoc => batch.delete(messageDoc.ref));
            
            // Delete the group itself
            batch.delete(doc(db, "groups", groupId));
            
            await batch.commit();

            // Update all members to remove the group
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (groupDoc.exists() && groupDoc.data().members) {
                const memberUpdates = groupDoc.data().members.map(memberId => {
                    const userRef = doc(db, "users", memberId);
                    return updateDoc(userRef, {
                        groups: arrayRemove(groupId),
                        activeGroupId: null // Reset active group if it was the deleted one
                    });
                });
                await Promise.all(memberUpdates);
            }
            
            showMessage('Thành công', `Nhóm "${groupName}" đã được xóa.`);
        } catch (error) {
            console.error("Delete group error:", error);
            showMessage('Lỗi!', 'Không thể xóa nhóm. Vui lòng kiểm tra lại quyền hoặc thử lại.', true);
        }
    });
};

ui.backToDashboardBtn.addEventListener('click', async () => {
    const previousView = viewHistory.pop();

    if (previousView) {
        // If there's a view in history, go to it.
        // We call showView directly to avoid pushing the current view back to history.
        showView(previousView);
    } else {
        // If history is empty, follow the original logic to go up the hierarchy.
        if (activePlanId) {
            await updateDoc(doc(db, "users", currentUser.uid), { activePlanId: null });
        } else if (activeGroupId) {
            await updateDoc(doc(db, "users", currentUser.uid), { activeGroupId: null });
        } else {
            // As a final fallback, ensure we are at the main dashboard.
            showView('main');
        }
    }
});

ui.createGroupBtn.addEventListener('click', () => {
    ui.groupModalTitle.textContent = 'Tạo nhóm mới';
    ui.createGroupView.classList.remove('hidden');
    ui.joinGroupView.classList.add('hidden');
    ui.groupForm.reset();
    openModal('group-modal');
});

ui.joinGroupBtn.addEventListener('click', () => {
    ui.groupModalTitle.textContent = 'Tham gia nhóm';
    ui.joinGroupView.classList.remove('hidden');
    ui.createGroupView.classList.add('hidden');
    ui.groupForm.reset();
    openModal('group-modal');
});

ui.leaveGroupBtn.addEventListener('click', () => {
    if (!activeGroupId) return;
    showConfirmation('Xác nhận rời nhóm', 'Bạn có chắc chắn muốn rời khỏi nhóm này không?', async () => {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            const groupRef = doc(db, "groups", activeGroupId);

            const batch = writeBatch(db);
            batch.update(userRef, {
                groups: arrayRemove(activeGroupId),
                activeGroupId: null
            });
            batch.update(groupRef, {
                members: arrayRemove(currentUser.uid)
            });
            await batch.commit();
            
            showMessage('Thành công', 'Bạn đã rời khỏi nhóm.');
        } catch (error) {
            console.error("Leave group error:", error);
            showMessage('Lỗi!', 'Không thể rời nhóm. Vui lòng thử lại.', true);
        }
    });
});

ui.groupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isCreating = !ui.createGroupView.classList.contains('hidden');

    try {
        if (isCreating) {
            const groupName = ui.newGroupNameInput.value.trim();
            const selectedStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1); // Default to 1st of current month

            if (!groupName) {
                showMessage('Lỗi', 'Vui lòng nhập tên nhóm.', true);
                return;
            }
            
            const groupRef = await addDoc(collection(db, "groups"), {
                name: groupName,
                adminId: currentUser.uid,
                members: [currentUser.uid],
                createdAt: Timestamp.now(),
                startDate: Timestamp.fromDate(selectedStartDate),
                public: false // Default to not public
            });
            
            await updateDoc(doc(db, "users", currentUser.uid), {
                groups: arrayUnion(groupRef.id),
                activeGroupId: groupRef.id
            });

            showMessage('Thành công!', `Đã tạo nhóm "${groupName}". Mã mời của nhóm là: ${groupRef.id}`);
        } else { // Join group logic
            const groupId = ui.joinGroupIdInput.value.trim();
            if (!groupId) {
                showMessage('Lỗi', 'Vui lòng nhập mã mời.', true);
                return;
            }

            const groupRef = doc(db, "groups", groupId);
            const userRef = doc(db, "users", currentUser.uid);

            const groupDoc = await getDoc(groupRef);
            if (!groupDoc.exists()) {
                showMessage('Lỗi', 'Mã nhóm không tồn tại hoặc không hợp lệ.', true);
                return;
            }

            const batch = writeBatch(db);
            batch.update(groupRef, { members: arrayUnion(currentUser.uid) });
            batch.update(userRef, { 
                groups: arrayUnion(groupId),
                activeGroupId: groupId
            });
            await batch.commit();

            showMessage('Thành công!', `Đã tham gia nhóm "${groupDoc.data().name}".`);
        }
        closeModal('group-modal');
    } catch (error) {
        console.error("Group form error:", error);
        let errorMessage = 'Không thể thực hiện thao tác. Vui lòng thử lại.';
        if (error.code === 'permission-denied') {
            errorMessage = 'Thao tác bị từ chối. Vui lòng kiểm tra lại mã mời.';
        } else if (error.code === 'not-found') {
            errorMessage = 'Không tìm thấy nhóm với mã mời này.';
        }
        showMessage('Lỗi!', errorMessage, true);
    }
});

async function fetchAndCacheMembers(memberUids) {
    if (!memberUids || memberUids.length === 0) {
        activeGroupMembers = [];
        return;
    }
    
    try {
        const uniqueUids = [...new Set(memberUids)];
        const memberPromises = uniqueUids.map(uid => getDoc(doc(db, "users", uid)));
        const memberDocs = await Promise.all(memberPromises);
        
        activeGroupMembers = memberDocs
            .filter(doc => doc.exists())
            .map(doc => ({ uid: doc.id, ...doc.data() }));

    } catch (error) {
        console.error("Error fetching group members:", error);
        activeGroupMembers = [];
    }
}

// --- Plan Management ---
async function loadPlanDashboard(groupId) {
    if (groupDocUnsubscribe) groupDocUnsubscribe();
    if (plansUnsubscribe) plansUnsubscribe();

    const groupDocRef = doc(db, "groups", groupId);
    groupDocUnsubscribe = onSnapshot(groupDocRef, async (groupDoc) => {
        if (!groupDoc.exists()) {
            showMessage('Thông Báo', 'Nhóm này đã bị xóa.', true);
            await updateDoc(doc(db, "users", currentUser.uid), { activeGroupId: null, activePlanId: null });
            return;
        }
        const groupData = { id: groupDoc.id, ...groupDoc.data() };
        
        updateHeaderButtons();
        updateTaskbar(groupData); // Update taskbar with group info
        ui.headerTitle.textContent = `Kế hoạch của: ${groupData.name}`;
        ui.statsContainer.classList.add('hidden');

        const plansQuery = query(collection(db, "groups", groupId, "plans"));
        plansUnsubscribe = onSnapshot(plansQuery, (snapshot) => {
            const plans = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            if (plans.length === 0) {
                ui.mainContent.innerHTML = `
                    <div class="glass-pane text-center p-8">
                        <h2 class="text-2xl font-bold mb-2">Chưa có kế hoạch nào</h2>
                        <p class="text-gray-600">Hãy tạo kế hoạch đầu tiên cho nhóm của bạn.</p>
                    </div>`;
            } else {
                const content = plans.map(plan => {
                    const startDateStr = formatFullDate(plan.startDate);
                    const endDateStr = formatFullDate(plan.endDate);
                    return `
                        <div class="group-card relative glass-pane p-5 hover:shadow-xl hover:-translate-y-1">
                            <div onclick="selectPlan('${plan.id}')" class="cursor-pointer pr-10">
                                <div class="font-bold text-lg text-gray-900">${plan.name}</div>
                                <div class="text-sm text-gray-600">Thời gian: ${startDateStr} - ${endDateStr}</div>
                            </div>
                            <button onclick="deletePlan(event, '${plan.id}', '${plan.name}')" class="absolute top-3 right-3 w-8 h-8 bg-red-100/50 text-red-600 rounded-full hover:bg-red-200/80 transition-colors flex items-center justify-center">
                                <i class="fas fa-trash-alt fa-sm"></i>
                            </button>
                        </div>
                    `;
                }).join('');
                ui.mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${content}</div>`;
            }
        });
    }, (error) => {
        console.error("Group listener failed on plan dashboard:", error);
        showMessage('Lỗi Kết Nối', 'Mất kết nối tới dữ liệu nhóm.', true);
    });
}

window.selectPlan = async (planId) => {
    await updateDoc(doc(db, "users", currentUser.uid), { activePlanId: planId });
};

window.deletePlan = async (event, planId, planName) => {
    event.stopPropagation();
    showConfirmation(`Xóa kế hoạch "${planName}"?`, 'Hành động này sẽ xóa vĩnh viễn tất cả lịch trình bên trong.', async () => {
        try {
            const batch = writeBatch(db);
            const tasksRef = collection(db, "groups", activeGroupId, "plans", planId, "tasks");
            const tasksSnapshot = await getDocs(tasksRef);
            tasksSnapshot.docs.forEach(taskDoc => batch.delete(taskDoc.ref));
            
            batch.delete(doc(db, "groups", activeGroupId, "plans", planId));
            await batch.commit();
            showMessage('Thành công', `Kế hoạch "${planName}" đã được xóa.`);
        } catch (error) {
            console.error("Delete plan error:", error);
            showMessage('Lỗi!', 'Không thể xóa kế hoạch.', true);
        }
    });
};

async function loadScheduleView(groupId, planId) {
    if (groupDocUnsubscribe) groupDocUnsubscribe();
    if (taskUnsubscribe) taskUnsubscribe();

    try {
        const planDocRef = doc(db, "groups", groupId, "plans", planId);
        const planDoc = await getDoc(planDocRef);
        if (!planDoc.exists()) {
            showMessage('Lỗi', 'Kế hoạch này không tồn tại.', true);
            await updateDoc(doc(db, "users", currentUser.uid), { activePlanId: null });
            return;
        }
        const planData = { id: planDoc.id, ...planDoc.data() };

        const groupDocRef = doc(db, "groups", groupId);
        groupDocUnsubscribe = onSnapshot(groupDocRef, async (groupDoc) => {
            if (!groupDoc.exists()) {
                showMessage('Thông Báo', 'Nhóm này đã bị xóa.', true);
                await updateDoc(doc(db, "users", currentUser.uid), { activeGroupId: null, activePlanId: null });
                return;
            }
            const groupData = { id: groupDoc.id, ...groupDoc.data() };
            groupChannelsCache = groupData.channels || []; // Cache the channels for the group
            
            updateHeaderButtons();
            updateTaskbar(groupData); // Update taskbar with group info
            ui.headerTitle.textContent = `Lịch trình: ${planData.name} (${groupData.name})`;
            ui.statsContainer.classList.remove('hidden');
            ui.mainContent.innerHTML = `<div id="schedule-container" class="glass-pane p-2 sm:p-4 md:p-6"></div>`;
    
            if (planData.startDate && typeof planData.startDate.toDate === 'function') {
                activeGroupStartDate = planData.startDate.toDate();
                activeGroupTotalWeeks = getNumberOfWeeks(activeGroupStartDate.getFullYear(), activeGroupStartDate.getMonth());
            } else {
                activeGroupStartDate = null;
                activeGroupTotalWeeks = 4;
            }
            
            await fetchAndCacheMembers(groupData.members || []);
            renderWeekNavigator();
            renderSchedule();
            addDragDropListeners();

            // Attach listener to the new filter button in the taskbar
            const filterActive = filterPartnerValue || filterAssigneeUid || filterChannelValue;
            ui.filterBtn.classList.toggle('primary', filterActive);
            ui.filterBtn.onclick = openFilterModal; // No need to remove, it's a simple assignment

    // Attach listener for statistics button
    ui.statisticsBtn.onclick = () => navigateToView('statistics');

        }, async (error) => {
            console.error("Group listener failed:", error);
            showMessage('Lỗi Kết Nối', 'Mất kết nối tới dữ liệu nhóm.', true);
            await updateDoc(doc(db, "users", currentUser.uid), { activeGroupId: null, activePlanId: null });
        });

        const tasksQuery = query(collection(db, "groups", groupId, "plans", planId, "tasks"));
        taskUnsubscribe = onSnapshot(tasksQuery, (snapshot) => {
            cachedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderSchedule(); // Re-render schedule which includes tasks
            updateStats(cachedTasks);
        }, (error) => {
            console.error("Task listener failed:", error);
            showMessage('Lỗi Lắng Nghe', 'Mất kết nối với dữ liệu lịch trình. Vui lòng tải lại trang.', true);
        });

    } catch (error) {
        console.error("Failed to load schedule view for plan:", planId, error);
        showMessage('Lỗi Tải Kế Hoạch', 'Không thể tải dữ liệu của kế hoạch này.', true);
        await updateDoc(doc(db, "users", currentUser.uid), { activePlanId: null });
    }
}

// --- Week Navigation & Schedule Grid ---
const renderFilterControls = () => {
    if (!ui.filterBtn) return;
    const filterActive = filterPartnerValue || filterAssigneeUid || filterChannelValue;
    ui.filterBtn.classList.toggle('primary', filterActive);
};

function renderWeekNavigator(isReadOnly = false) {
     const containerId = isReadOnly ? 'public-main-content' : 'schedule-container';
     const container = document.getElementById(containerId);
     if (!container) return;
     // Clear previous navigator if it exists
     const oldNav = container.querySelector('.week-navigator');
     if(oldNav) oldNav.remove();

    if (!activeGroupStartDate) return;
    const weekDates = getWeekDates(currentWeek, activeGroupStartDate);
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    
    let weekButtonsHtml = '';
    for (let i = 1; i <= activeGroupTotalWeeks; i++) {
        weekButtonsHtml += `<button class="week-num-btn ${i === currentWeek ? 'active' : ''}" onclick="setWeek(${i}, ${isReadOnly})">${i}</button>`;
    }

    let navHtml = `
    <div class="week-navigator">
        <div class="font-semibold text-gray-800">
            Tuần ${currentWeek} (${formatDate(weekStart)} - ${formatDate(weekEnd)})
        </div>
        <div class="flex items-center gap-1">
            <button class="week-btn" onclick="changeWeek(-1, ${isReadOnly})" ${currentWeek === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
            <div class="hidden sm:flex items-center gap-1">${weekButtonsHtml}</div>
            <button class="week-btn" onclick="changeWeek(1, ${isReadOnly})" ${currentWeek === activeGroupTotalWeeks ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
        </div>
    </div>`;
    
    container.insertAdjacentHTML('afterbegin', navHtml);
}

window.changeWeek = (delta, isReadOnly = false) => {
    const newWeek = currentWeek + delta;
    if (newWeek >= 1 && newWeek <= activeGroupTotalWeeks) {
        setWeek(newWeek, isReadOnly);
    }
};

window.setWeek = (week, isReadOnly = false) => {
    currentWeek = week;
    renderWeekNavigator(isReadOnly);
    if (!isReadOnly) renderFilterControls(); // Re-render filters when week changes
    renderSchedule(isReadOnly);
    updateStats(cachedTasks, isReadOnly); // Update stats when week changes
};

function renderSchedule(isReadOnly = false) {
    const containerId = isReadOnly ? 'public-main-content' : 'schedule-container';
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const oldGrid = container.querySelector('.schedule-grid-wrapper');
    if (oldGrid) oldGrid.remove();

    const days = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"];
    
    if (!activeGroupStartDate) {
        container.insertAdjacentHTML('beforeend', '<p class="text-center text-red-500 p-4">Không thể hiển thị lịch vì nhóm này không có ngày bắt đầu hợp lệ.</p>');
        return;
    }
    
    const weekDates = getWeekDates(currentWeek, activeGroupStartDate);
    const weekDateStrings = weekDates.map(d => d.toISOString().split('T')[0]);
    
    const weekTasks = cachedTasks.filter(task => {
        if (!task || !task.date || !weekDateStrings.includes(task.date)) return false;
        const partnerMatch = !filterPartnerValue || (task.partner && task.partner.toLowerCase().includes(filterPartnerValue.toLowerCase()));
        const assigneeMatch = !filterAssigneeUid || task.assigneeUid === filterAssigneeUid;
        const channelMatch = !filterChannelValue || task.channel === filterChannelValue;
        return partnerMatch && assigneeMatch && channelMatch;
    });

    const tasksByChannel = weekTasks.reduce((acc, task) => {
        const channel = task.channel || 'Chưa phân loại';
        if (!acc[channel]) {
            acc[channel] = [];
        }
        acc[channel].push(task);
        return acc;
    }, {});

    const sortedChannels = Object.keys(tasksByChannel).sort();

    let gridHtml = '<div class="schedule-grid-wrapper overflow-x-auto custom-scrollbar">';
    // The first column is for Channel/Time, so it needs to be wider.
    gridHtml += '<div class="schedule-grid grid" style="grid-template-columns: 60px repeat(7, minmax(140px, 1fr)); gap: 1px; background-color: #ffffff; border-radius: var(--border-radius-sub); overflow: hidden; min-width: 1010px;">';
    
    // Header row
    gridHtml += '<div class="bg-white/30 sticky left-0 z-20"></div>'; // Top-left corner
    days.forEach((day, index) => {
        gridHtml += `<div class="bg-white/30 text-center p-2 font-semibold text-sm text-gray-700 sticky top-0 z-10">${day}<div class="font-normal text-xs text-gray-500">${formatDate(weekDates[index])}</div></div>`;
    });

    if (sortedChannels.length === 0) {
        gridHtml += `<div class="col-span-8 text-center p-8 bg-white">Tuần này chưa có kế hoạch nào.</div>`;
    } else {
        sortedChannels.forEach(channel => {
            const { name: channelName, icon: platformIcon } = getPlatformIconAndName(channel);
            // Channel Header Row - now split into two cells
            gridHtml += `
                <div class="schedule-channel-icon-cell sticky left-0 z-10">${platformIcon}</div>
                <div class="schedule-channel-name-cell">${channelName}</div>
            `;

            const channelTasks = tasksByChannel[channel];
            const timeSlots = [...new Set(channelTasks.map(task => task.time))].sort();

            if (timeSlots.length === 0) {
                 gridHtml += `<div class="bg-white/30 text-center p-2 font-medium text-xs text-gray-500 flex items-center justify-center sticky left-0 z-10"></div><div class="col-span-7 p-4 bg-white text-gray-500 text-sm">Kênh này không có lịch trình trong tuần.</div>`;
            } else {
                timeSlots.forEach(time => {
                    // Time label cell
                    gridHtml += `<div class="bg-white/30 text-center p-2 font-medium text-xs text-gray-600 flex items-center justify-center sticky left-0 z-10 time-label-cell" data-time-row="${time}">${time}</div>`;
                    
                    // Day cells for this time slot
                    days.forEach((_, index) => {
                        const cellDate = weekDates[index];
                        const dateString = cellDate.toISOString().split('T')[0];
                        
                        const tasksForCell = channelTasks.filter(t => t.date === dateString && t.time === time);
                        
                        const cellClasses = `grid-cell bg-white min-h-[60px] p-1.5 space-y-1.5 overflow-y-auto custom-scrollbar ${isReadOnly ? '' : 'hover:bg-blue-500/10'}`;
                        const clickHandler = isReadOnly ? '' : `onclick="openTaskModal(null, '${time}', '${dateString}')"`;

                        gridHtml += `<div class="${cellClasses}" data-time="${time}" data-date="${dateString}" data-channel="${channel}" ${clickHandler}>`;
                        
                        tasksForCell.forEach(task => {
                            // This is the task card rendering logic from the old renderTasks function
                            const assignee = activeGroupMembers.find(m => m.uid === task.assigneeUid);
                            const assigneeName = assignee ? (assignee.name || assignee.email) : 'Chưa gán';
                            const assigneeColor = userColorUtil.getColor(assignee?.uid);

                            const priority = task.priority || 'Trung bình';
                            const priorityIconClass = `priority-icon-${priority.replace(/\s+/g, '-').toLowerCase()}`;
                            const priorityIcons = {
                                'Thấp': 'fa-solid fa-angle-down', 'Trung bình': 'fa-solid fa-equals',
                                'Cao': 'fa-solid fa-angle-up', 'Khẩn cấp': 'fa-solid fa-bolt'
                            };
                            const priorityIconHtml = `<div class="task-priority-icon ${priorityIconClass}"><i class="${priorityIcons[priority]}"></i></div>`;

                            const statusIcons = {
                                'Chưa làm': '<i class="fa-solid fa-inbox text-gray-500"></i>',
                                'Đang làm': '<i class="fa-solid fa-person-running text-sky-500"></i>',
                                'Hoàn thành': '<i class="fa-solid fa-circle-check text-green-500"></i>',
                                'Bù': '<i class="fa-solid fa-arrow-rotate-left text-amber-500"></i>'
                            };
                            const statusIcon = statusIcons[task.status || 'Chưa làm'] || statusIcons['Chưa làm'];

                            const avatarStyle = assignee?.avatarStyle || 'pixel-art';
                            const avatarUrl = `https://api.dicebear.com/8.x/${avatarStyle}/svg?seed=${assignee?.uid || 'unassigned'}`;

                            const taskClickHandler = isReadOnly ? '' : `onclick="event.stopPropagation(); openTaskModalWithId('${task.id}')"`;
                            
                            gridHtml += `
                                <div id="task-${task.id}" data-task-id="${task.id}" draggable="${!isReadOnly}" class="task-card ${isReadOnly ? 'cursor-default' : 'hover:shadow-lg hover:scale-[1.03]'}" ${taskClickHandler}>
                                    <div class="flex justify-between items-start w-full gap-2">
                                        <div class="flex-grow overflow-hidden">
                                            <div class="font-bold text-xs text-gray-800 truncate">${task.partner || 'N/A'}</div>
                                            <div class="text-xs font-bold truncate mt-1" style="color: ${assigneeColor};">${assigneeName}</div>
                                        </div>
                                        <div class="flex-shrink-0 flex flex-col items-center gap-1">
                                            ${priorityIconHtml}
                                            <div class="task-status-icon" title="${task.status || 'Chưa làm'}">${statusIcon}</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                        
                        gridHtml += `</div>`; // Close grid-cell
                    });
                });
            }
        });
    }
    
    gridHtml += '</div></div>'; // Close schedule-grid and wrapper
    container.insertAdjacentHTML('beforeend', gridHtml);
}

// --- Task Handling (with Drag & Drop) ---
const getPlatformIconAndName = (channelString) => {
    if (!channelString) {
        return { name: 'N/A', icon: '' };
    }
    const match = channelString.match(/(.*) \((.*)\)/);
    if (match) {
        const name = match[1];
        const platform = match[2].toLowerCase();
        let iconHtml = '';
        switch (platform) {
            case 'youtube':
                iconHtml = '<i class="fab fa-youtube text-red-600" title="YouTube"></i>';
                break;
            case 'facebook':
                iconHtml = '<i class="fab fa-facebook text-blue-600" title="Facebook"></i>';
                break;
            case 'tiktok':
                iconHtml = '<i class="fab fa-tiktok text-black" title="TikTok"></i>';
                break;
            default:
                // Fallback for unknown platforms, display as text
                iconHtml = `<span class="text-xs text-gray-400">(${match[2]})</span>`;
        }
        return { name, icon: iconHtml };
    }
    // Fallback for old data that might not have a platform in parentheses
    return { name: channelString, icon: '' };
};

function openFilterModal() {
    // Populate assignee select
    let memberOptions = '<option value="">Tất cả thành viên</option>';
    activeGroupMembers.forEach(member => {
        memberOptions += `<option value="${member.uid}">${member.name || member.email}</option>`;
    });
    ui.filterAssigneeSelect.innerHTML = memberOptions;

    // Populate channel select
    let channelOptions = '<option value="">Tất cả các kênh</option>';
    const uniqueChannels = [...new Set(cachedTasks.map(t => t.channel).filter(Boolean))];
    uniqueChannels.forEach(channel => {
        channelOptions += `<option value="${channel}">${channel}</option>`;
    });
    ui.filterChannelSelect.innerHTML = channelOptions;


    // Set current values
    ui.filterPartnerInput.value = filterPartnerValue;
    ui.filterAssigneeSelect.value = filterAssigneeUid;
    ui.filterChannelSelect.value = filterChannelValue;

    openModal('filter-modal');
}

ui.filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    filterPartnerValue = ui.filterPartnerInput.value.trim();
    filterAssigneeUid = ui.filterAssigneeSelect.value;
    filterChannelValue = ui.filterChannelSelect.value;
    renderSchedule(); // Re-render the whole schedule with filters
    
    // Update the button's appearance
    const filterActive = filterPartnerValue || filterAssigneeUid || filterChannelValue;
    ui.filterBtn.classList.toggle('primary', filterActive);

    closeModal('filter-modal');
});

ui.clearFiltersBtn.addEventListener('click', () => {
    filterPartnerValue = '';
    filterAssigneeUid = '';
    filterChannelValue = '';
    ui.filterPartnerInput.value = '';
    ui.filterAssigneeSelect.value = '';
    ui.filterChannelSelect.value = '';
    renderSchedule(); // Re-render the whole schedule without filters
    
    // Update the button's appearance
    ui.filterBtn.classList.remove('primary');

    closeModal('filter-modal');
});


ui.createPlanBtn.addEventListener('click', () => {
    // Now opens the plan modal
    ui.planForm.reset();
    ui.planIdInput.value = '';
    ui.planModalTitle.textContent = 'Tạo kế hoạch mới';
    openModal('plan-modal');
});

ui.createTaskBtn.addEventListener('click', () => {
    // This is the new button for creating tasks directly
    openTaskModal(null, null, null, true);
});

ui.planForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const planName = document.getElementById('plan-name').value.trim();
    const startDateValue = document.getElementById('plan-start-date').value;
    const endDateValue = document.getElementById('plan-end-date').value;

    if (!planName || !startDateValue || !endDateValue) {
        showMessage('Lỗi', 'Vui lòng điền đầy đủ tên kế hoạch, ngày bắt đầu và ngày kết thúc.', true);
        return;
    }

    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);

    if (endDate < startDate) {
        showMessage('Lỗi', 'Ngày kết thúc không được trước ngày bắt đầu.', true);
        return;
    }

    try {
        const planData = {
            name: planName,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            createdAt: Timestamp.now(),
        };
        const planRef = await addDoc(collection(db, "groups", activeGroupId, "plans"), planData);
        
        // Automatically select the newly created plan
        await updateDoc(doc(db, "users", currentUser.uid), { activePlanId: planRef.id });

        showMessage('Thành công!', `Đã tạo kế hoạch "${planName}".`);
        closeModal('plan-modal');
    } catch (error) {
        console.error("Plan form error:", error);
        showMessage('Lỗi!', 'Không thể tạo kế hoạch.', true);
    }
});

window.openTaskModalWithId = (taskId) => {
    const task = cachedTasks.find(t => t.id === taskId);
    if (task) {
        openTaskModal(task);
    } else {
        console.error("Could not find task with ID:", taskId);
        showMessage('Lỗi', 'Không tìm thấy thông tin công việc.', true);
    }
};

window.openTaskModal = (task, time, date, fromButton = false) => {
    ui.taskForm.reset();
    populateChannelOptions();
    
    ui.taskAssigneeInput.innerHTML = '';
    if (activeGroupMembers.length > 0) {
        activeGroupMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.uid;
            option.textContent = member.name || member.email;
            ui.taskAssigneeInput.appendChild(option);
        });
    }

    // Show date/time inputs if creating from button OR if editing an existing task
    if (fromButton || task) {
        ui.taskDatetimeInputs.classList.remove('hidden');
    } else {
        ui.taskDatetimeInputs.classList.add('hidden');
    }

    if (task) { // Editing existing task
        ui.taskModalTitle.textContent = 'Chỉnh sửa kế hoạch';
        ui.taskIdInput.value = task.id;
        ui.taskPartnerInput.value = task.partner;
        ui.taskChannelInput.value = task.channel || '';
        ui.taskContentInput.value = task.content;
        ui.taskStatusInput.value = task.status;
        ui.taskTimeInput.value = task.time; // hidden input
        ui.taskDateInput.value = task.date; // hidden input
        ui.taskAssigneeInput.value = task.assigneeUid || currentUser.uid;
        ui.taskScriptLinkInput.value = task.scriptLink || '';
        ui.taskVideoLinkInput.value = task.videoLink || '';
        ui.taskCompletedVideoLinkInput.value = task.completedVideoLink || '';
        ui.taskPriorityInput.value = task.priority || 'Trung bình';
        ui.taskPointsInput.value = task.points || 1;
        ui.deleteTaskBtn.classList.remove('hidden');

        // Populate the visible date/time inputs
        ui.taskDateInputNew.value = task.date;
        ui.taskTimeInputNew.value = task.time;

    } else { // Creating new task
        ui.taskModalTitle.textContent = 'Tạo kế hoạch mới';
        ui.taskIdInput.value = '';
        ui.taskTimeInput.value = time; // From grid click
        ui.taskDateInput.value = date; // From grid click
        ui.taskAssigneeInput.value = currentUser.uid;
        ui.taskPriorityInput.value = 'Trung bình'; // Set default priority
        ui.deleteTaskBtn.classList.add('hidden');

        if (fromButton) {
            const now = new Date();
            // Set default date to today
            ui.taskDateInputNew.value = now.toISOString().split('T')[0];
            // Set default time to the next whole hour
            now.setHours(now.getHours() + 1);
            now.setMinutes(0);
            ui.taskTimeInputNew.value = now.toTimeString().slice(0, 5);
        }
    }
    openModal('task-modal');
};

ui.taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId = ui.taskIdInput.value;

    const isDatetimeVisible = !ui.taskDatetimeInputs.classList.contains('hidden');
    let time, date;

    if (isDatetimeVisible) {
        // Get values from the visible inputs when editing or creating from button
        time = ui.taskTimeInputNew.value;
        date = ui.taskDateInputNew.value;
    } else {
        // Get values from the hidden inputs when creating from grid
        time = ui.taskTimeInput.value;
        date = ui.taskDateInput.value;
    }

    if (!time || !date) {
        showMessage('Lỗi', 'Vui lòng cung cấp ngày và giờ cho công việc.', true);
        return;
    }

    const channel = ui.taskChannelInput.value.trim();
    if (!channel) {
        showMessage('Lỗi', 'Vui lòng nhập tên kênh/page.', true);
        return;
    }

    const taskData = {
        partner: ui.taskPartnerInput.value,
        channel: ui.taskChannelInput.value,
        content: ui.taskContentInput.value,
        status: ui.taskStatusInput.value,
        time: time,
        date: date,
        assigneeUid: ui.taskAssigneeInput.value,
        authorUid: currentUser.uid,
        updatedAt: Timestamp.now(),
        scriptLink: ui.taskScriptLinkInput.value,
        videoLink: ui.taskVideoLinkInput.value,
        completedVideoLink: ui.taskCompletedVideoLinkInput.value,
        priority: ui.taskPriorityInput.value,
        points: parseInt(ui.taskPointsInput.value, 10) || 1,
    };
    
    try {
        if (taskId) {
            await updateDoc(doc(db, "groups", activeGroupId, "plans", activePlanId, "tasks", taskId), taskData);
        } else {
            taskData.createdAt = Timestamp.now();
            await addDoc(collection(db, "groups", activeGroupId, "plans", activePlanId, "tasks"), taskData);
        }
        closeModal('task-modal');
    } catch (error) {
        showMessage('Lỗi', 'Không thể lưu công việc.', true);
    }
});

ui.deleteTaskBtn.addEventListener('click', () => {
    const taskId = ui.taskIdInput.value;
    if (!taskId) return;
    
    showConfirmation('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa công việc này không?', async () => {
        try {
            await deleteDoc(doc(db, "groups", activeGroupId, "plans", activePlanId, "tasks", taskId));
            showMessage('Thành công', 'Đã xóa công việc.');
            closeModal('task-modal');
        } catch (error) {
            showMessage('Lỗi', 'Không thể xóa công việc.', true);
        }
    });
});

// --- Statistics ---
function updateStats(allTasks, isReadOnly = false) {
    const container = isReadOnly ? ui.publicStatsContainer : ui.statsContainer;
    if (!container) return;

    const statusCounts = { 'Chưa làm': 0, 'Đang làm': 0, 'Hoàn thành': 0, 'Bù': 0 };
    
    const weekDates = activeGroupStartDate ? getWeekDates(currentWeek, activeGroupStartDate) : [];
    const weekDateStrings = weekDates.map(d => d.toISOString().split('T')[0]);
    const weekTasks = allTasks.filter(task => weekDateStrings.includes(task.date));

    const totalTasks = weekTasks.length;
    
    weekTasks.forEach(task => {
        const status = task.status || 'Chưa làm';
        if (statusCounts[status] !== undefined) {
            statusCounts[status]++;
        }
    });
    
    let statsHtml = `
        <div class="stat-item"><div class="stat-icon"><i class="fa-solid fa-layer-group text-purple-500"></i></div><div><div class="stat-value text-purple-600">${totalTasks}</div><div class="stat-label">KH Tuần</div></div></div>
        <div class="stat-item"><div class="stat-icon"><i class="fa-solid fa-inbox text-gray-500"></i></div><div><div class="stat-value text-gray-600">${statusCounts['Chưa làm']}</div><div class="stat-label">Chưa làm</div></div></div>
        <div class="stat-item"><div class="stat-icon"><i class="fa-solid fa-person-running text-sky-500"></i></div><div><div class="stat-value text-sky-600">${statusCounts['Đang làm']}</div><div class="stat-label">Đang làm</div></div></div>
        <div class="stat-item"><div class="stat-icon"><i class="fa-solid fa-circle-check text-green-500"></i></div><div><div class="stat-value text-green-600">${statusCounts['Hoàn thành']}</div><div class="stat-label">Hoàn thành</div></div></div>
        <div class="stat-item"><div class="stat-icon"><i class="fa-solid fa-arrow-rotate-left text-amber-500"></i></div><div><div class="stat-value text-amber-600">${statusCounts['Bù']}</div><div class="stat-label">KH Bù</div></div></div>
        <div class="stat-item stat-item-chart">
            <canvas id="burndown-chart-small"></canvas>
        </div>
    `;

    container.innerHTML = `
        ${statsHtml}
        <style>
             .stat-item { background: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: var(--border-radius-main); padding: 0.75rem 1rem; text-align: left; display: flex; align-items: center; gap: 0.75rem; height: 4.75rem; box-sizing: border-box; }
             .stat-icon { font-size: 1.75rem; }
             .stat-value { font-size: 1.75rem; line-height: 2.25rem; font-weight: 800; }
             .stat-label { font-size: 0.75rem; line-height: 1rem; color: #6b7280; font-weight: 500; }
             .stat-item-chart {
                padding: 0.5rem;
             }
             @media (max-width: 640px) {
                 .stat-value { font-size: 1.25rem; line-height: 1.75rem;}
             }
        </style>
    `;

    if (!isReadOnly) {
        renderBurndownChart(weekTasks, weekDates);
    }
}

function renderBurndownChart(weekTasks, weekDates) {
    const ctx = document.getElementById('burndown-chart-small')?.getContext('2d');
    if (!ctx) return;

    const labels = weekDates.map(d => formatDate(d));
    const totalStoryPoints = weekTasks.reduce((sum, task) => sum + (task.points || 1), 0);

    const idealData = labels.map((_, i) => {
        const idealPoints = totalStoryPoints - (totalStoryPoints / (labels.length - 1)) * i;
        return Math.max(0, Math.round(idealPoints * 10) / 10);
    });
    if (idealData.length > 1) idealData[idealData.length - 1] = 0;

    let cumulativeCompleted = 0;
    const cumulativeActualData = weekDates.map(date => {
        const dateString = date.toISOString().split('T')[0];
        cumulativeCompleted += weekTasks
            .filter(task => task.date === dateString && task.status === 'Hoàn thành')
            .reduce((sum, task) => sum + (task.points || 1), 0);
        return totalStoryPoints - cumulativeCompleted;
    });

    if (burndownChart) {
        burndownChart.destroy();
    }

    const chartTitle = 'Biểu đồ Sprint Burndown';
    const brandColor = '#007AFF';
    const brandColorLight = 'rgba(0, 122, 255, 0.2)';

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Story Points còn lại',
            data: cumulativeActualData,
            borderColor: brandColor,
            backgroundColor: brandColorLight,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: brandColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 6,
        }, {
            label: 'Tiến độ lý tưởng',
            data: idealData,
            borderColor: 'rgba(170, 170, 170, 0.7)',
            borderDash: [6, 6],
            fill: false,
            pointRadius: 0,
            tension: 0.4,
        }]
    };

    burndownChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { display: false },
                x: { display: false }
            },
            plugins: {
                legend: { display: false },
                title: { display: false },
                tooltip: { enabled: false }
            },
            onClick: () => {
                const detailChartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)',
                                drawBorder: false,
                            },
                            ticks: {
                                precision: 0,
                                font: {
                                    family: "'Inter', sans-serif",
                                    weight: '500'
                                },
                                color: '#6b7280'
                            },
                            title: {
                                display: true,
                                text: 'Story Points',
                                font: {
                                    size: 14,
                                    family: "'Inter', sans-serif",
                                    weight: '600'
                                },
                                color: '#333'
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: {
                                    family: "'Inter', sans-serif",
                                    weight: '500'
                                },
                                color: '#6b7280'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 20,
                                font: {
                                    size: 13,
                                    family: "'Inter', sans-serif",
                                    weight: '500'
                                },
                                color: '#333'
                            }
                        },
                        title: {
                            display: true,
                            text: chartTitle,
                            font: {
                                size: 18,
                                family: "'Inter', sans-serif",
                                weight: '700'
                            },
                            padding: {
                                bottom: 20
                            },
                            color: '#1d1d1f'
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: {
                                size: 14,
                                weight: 'bold'
                            },
                            bodyFont: {
                                size: 12
                            },
                            padding: 12,
                            cornerRadius: 8,
                            usePointStyle: true,
                            boxPadding: 4,
                        }
                    }
                };
                showChartDetail({
                    type: 'line',
                    data: chartData
                }, detailChartOptions, chartTitle);
            }
        }
    });
}


// --- Drag and Drop Logic ---
function addDragDropListeners() {
    const container = document.getElementById('schedule-container');
    if (!container) return;

    // Using event delegation for drag events on dynamically created tasks
    container.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-card')) {
            dragOperation.taskId = e.target.dataset.taskId;
            dragOperation.isCopy = e.altKey; // Check if Alt key is pressed
            e.dataTransfer.setData('text/plain', dragOperation.taskId);
            e.dataTransfer.effectAllowed = e.altKey ? 'copy' : 'move';
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    container.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('task-card')) {
            e.target.classList.remove('dragging');
        }
         document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const cell = e.target.closest('.grid-cell');
        if (cell) {
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            cell.classList.add('drag-over');
        }
    });
    
    container.addEventListener('dragleave', (e) => {
         const cell = e.target.closest('.grid-cell');
         if (cell && !cell.contains(e.relatedTarget)) {
             cell.classList.remove('drag-over');
         }
    });

    container.addEventListener('drop', async (e) => {
        e.preventDefault();
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        const cell = e.target.closest('.grid-cell');
        if (cell) {
            const taskId = dragOperation.taskId;
            if (!taskId) return;

            const newDate = cell.dataset.date;
            const newTime = cell.dataset.time;

            try {
                const taskCollectionRef = collection(db, "groups", activeGroupId, "plans", activePlanId, "tasks");
                if (dragOperation.isCopy) {
                    // Copy logic
                    const taskRef = doc(taskCollectionRef, taskId);
                    const taskSnap = await getDoc(taskRef);
                    if (taskSnap.exists()) {
                        const originalTaskData = taskSnap.data();
                        const newTaskData = {
                            ...originalTaskData,
                            date: newDate,
                            time: newTime,
                            createdAt: Timestamp.now(),
                            updatedAt: Timestamp.now()
                        };
                        delete newTaskData.id;
                        await addDoc(taskCollectionRef, newTaskData);
                        showMessage('Thành công', 'Đã sao chép công việc.');
                    }
                } else {
                    // Move logic
                    const taskRef = doc(taskCollectionRef, taskId);
                    await updateDoc(taskRef, {
                        date: newDate,
                        time: newTime,
                        updatedAt: Timestamp.now()
                    });
                }
            } catch (err) {
                console.error("Drag/drop error:", err);
                showMessage("Lỗi", "Không thể di chuyển/sao chép công việc.", true);
            } finally {
                // Reset drag operation state
                dragOperation = { taskId: null, isCopy: false };
            }
        }
    });
}


// ======================================================================
// ==================== GENERIC CUSTOM SELECT LOGIC =====================
// ======================================================================

function initCustomSelect(wrapper) {
    const originalSelect = wrapper.querySelector('.original-select');
    if (!originalSelect || wrapper.querySelector('.custom-select-trigger')) {
        return; // Already initialized or no select found
    }

    // Create the trigger element
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger glass-input';
    trigger.innerHTML = `
        <span class="truncate"></span>
        <i class="fas fa-chevron-down"></i>
    `;
    wrapper.appendChild(trigger);

    // Create the options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options custom-scrollbar';
    wrapper.appendChild(optionsContainer);

    const updateTriggerText = () => {
        const selectedOption = originalSelect.options[originalSelect.selectedIndex];
        trigger.querySelector('span').textContent = selectedOption ? selectedOption.textContent : '';
    };

    const populateOptions = () => {
        optionsContainer.innerHTML = [...originalSelect.options].map(option => `
            <div class="custom-select-option ${option.selected ? 'selected' : ''}" data-value="${option.value}">
                ${option.textContent}
            </div>
        `).join('');
    };

    // Event listener for the trigger
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains('open');
        // Close all other open selects
        document.querySelectorAll('.custom-select-wrapper.open').forEach(openWrapper => {
            if (openWrapper !== wrapper) {
                openWrapper.classList.remove('open');
                openWrapper.querySelector('.custom-select-options').classList.remove('visible');
            }
        });
        // Toggle current select
        wrapper.classList.toggle('open', !isOpen);
        optionsContainer.classList.toggle('visible', !isOpen);
    });

    // Event listener for options
    optionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-select-option');
        if (option && option.dataset.value) {
            originalSelect.value = option.dataset.value;
            // Manually trigger a 'change' event on the original select
            const changeEvent = new Event('change', { bubbles: true });
            originalSelect.dispatchEvent(changeEvent);
            
            updateTriggerText();
            populateOptions(); // Re-populate to update 'selected' class
            wrapper.classList.remove('open');
            optionsContainer.classList.remove('visible');
        }
    });

    // Initial setup
    populateOptions();
    updateTriggerText();

    // Update custom select when original select changes programmatically
    originalSelect.addEventListener('change', updateTriggerText);
}

// Hide dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-wrapper.open').forEach(wrapper => {
        wrapper.classList.remove('open');
        wrapper.querySelector('.custom-select-options').classList.remove('visible');
    });
});


// ======================================================================
// ======================= CHANNEL SELECTION ============================
// ======================================================================

let groupChannelsCache = []; // Cache for the current group's channels
let channelOptionsVisible = false;
let highlightedOptionIndex = -1;

const populateChannelOptions = (filter = '') => {
    if (!ui.taskChannelOptionsContainer) return;

    const filteredChannels = groupChannelsCache.filter(channel => 
        channel.toLowerCase().includes(filter.toLowerCase())
    );

    if (filteredChannels.length === 0) {
        ui.taskChannelOptionsContainer.innerHTML = `<div class="custom-select-option text-gray-500">Không tìm thấy kênh nào.</div>`;
    } else {
        ui.taskChannelOptionsContainer.innerHTML = filteredChannels.map((channel, index) => `
            <div class="custom-select-option" data-value="${channel}" data-index="${index}">
                ${channel}
            </div>
        `).join('');
    }
    highlightedOptionIndex = -1; // Reset highlight
};

const setChannelOptionsVisible = (visible) => {
    if (visible) {
        ui.taskChannelOptionsContainer.classList.add('visible');
    } else {
        ui.taskChannelOptionsContainer.classList.remove('visible');
    }
    channelOptionsVisible = visible;
};

ui.taskChannelInput.addEventListener('focus', () => {
    populateChannelOptions(ui.taskChannelInput.value);
    setChannelOptionsVisible(true);
});

ui.taskChannelInput.addEventListener('input', () => {
    populateChannelOptions(ui.taskChannelInput.value);
    if (!channelOptionsVisible) {
        setChannelOptionsVisible(true);
    }
});

ui.taskChannelInput.addEventListener('keydown', (e) => {
    const options = ui.taskChannelOptionsContainer.querySelectorAll('.custom-select-option');
    if (!options.length) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            highlightedOptionIndex = (highlightedOptionIndex + 1) % options.length;
            break;
        case 'ArrowUp':
            e.preventDefault();
            highlightedOptionIndex = (highlightedOptionIndex - 1 + options.length) % options.length;
            break;
        case 'Enter':
            e.preventDefault();
            if (highlightedOptionIndex > -1) {
                options[highlightedOptionIndex].click();
            }
            setChannelOptionsVisible(false);
            break;
        case 'Escape':
            setChannelOptionsVisible(false);
            break;
    }

    options.forEach((opt, i) => {
        opt.classList.toggle('highlighted', i === highlightedOptionIndex);
    });
    if (highlightedOptionIndex > -1) {
        options[highlightedOptionIndex].scrollIntoView({ block: 'nearest' });
    }
});

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-container')) {
        setChannelOptionsVisible(false);
    }
});

// Handle option selection
ui.taskChannelOptionsContainer.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (option && option.dataset.value) {
        ui.taskChannelInput.value = option.dataset.value;
        setChannelOptionsVisible(false);
    }
});


const addChannelRow = (channel = { name: '', platform: 'YouTube' }) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 channel-row';
    row.innerHTML = `
        <input type="text" class="glass-input flex-grow" placeholder="Tên kênh/trang" value="${channel.name}" data-type="channel-name">
        <select class="glass-input w-32" data-type="channel-platform">
            <option value="YouTube" ${channel.platform === 'YouTube' ? 'selected' : ''}>YouTube</option>
            <option value="Facebook" ${channel.platform === 'Facebook' ? 'selected' : ''}>Facebook</option>
            <option value="TikTok" ${channel.platform === 'TikTok' ? 'selected' : ''}>TikTok</option>
        </select>
        <button type="button" class="glass-btn danger icon-btn !w-10 !h-10 flex-shrink-0" onclick="this.parentElement.remove()">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;
    ui.channelInputContainer.appendChild(row);
};

const openChannelModal = () => {
    ui.channelInputContainer.innerHTML = ''; // Clear previous rows
    
    if (groupChannelsCache.length > 0) {
        groupChannelsCache.forEach(channelStr => {
            const match = channelStr.match(/(.*) \((.*)\)/);
            if (match) {
                addChannelRow({ name: match[1], platform: match[2] });
            } else {
                addChannelRow({ name: channelStr, platform: 'YouTube' }); // Fallback for old data
            }
        });
    } else {
        addChannelRow(); // Add one empty row if no channels exist
    }

    openModal('channel-modal');
};

ui.addChannelBtn.addEventListener('click', openChannelModal);
ui.addChannelRowBtn.addEventListener('click', () => addChannelRow());

ui.channelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rows = ui.channelInputContainer.querySelectorAll('.channel-row');
    const newChannelList = [];
    let hasDuplicates = false;
    const channelNames = new Set();

    rows.forEach(row => {
        const nameInput = row.querySelector('[data-type="channel-name"]');
        const platformSelect = row.querySelector('[data-type="channel-platform"]');
        const name = nameInput.value.trim();
        
        if (name) {
            const formattedChannel = `${name} (${platformSelect.value})`;
            if (channelNames.has(formattedChannel)) {
                hasDuplicates = true;
            }
            channelNames.add(formattedChannel);
            newChannelList.push(formattedChannel);
        }
    });

    if (hasDuplicates) {
        showMessage('Lỗi', 'Tên kênh bị trùng lặp. Vui lòng kiểm tra lại.', true);
        return;
    }

    try {
        const groupRef = doc(db, "groups", activeGroupId);
        await updateDoc(groupRef, { channels: newChannelList });
        groupChannelsCache = newChannelList; // Update cache
        populateChannelOptions(); // Re-populate options
        showMessage('Thành công', 'Danh sách kênh đã được cập nhật.');
        closeModal('channel-modal');
    } catch (error) {
        console.error("Error updating channels:", error);
        showMessage('Lỗi', 'Không thể lưu danh sách kênh.', true);
    }
});


// ======================================================================
// ======================== SHARING SECTION =============================
// ======================================================================
ui.sharePlanBtn.addEventListener('click', async () => {
    if (!activeGroupId || !activePlanId) return;
    try {
        const groupRef = doc(db, 'groups', activeGroupId);
        const groupDoc = await getDoc(groupRef);
        if (groupDoc.exists()) {
            const isPublic = groupDoc.data().public || false;
            ui.publicShareToggle.checked = isPublic;
            
            const shareId = `${activeGroupId}_${activePlanId}`;
            const shareUrl = `${window.location.origin}${window.location.pathname}?share=${shareId}`;
            ui.shareLinkInput.value = shareUrl;

            if (isPublic) {
                ui.shareLinkContainer.classList.remove('hidden');
            } else {
                ui.shareLinkContainer.classList.add('hidden');
            }
            openModal('share-modal');
        }
    } catch (error) {
        console.error("Error opening share modal:", error);
        showMessage('Lỗi', 'Không thể lấy thông tin chia sẻ.', true);
    }
});

ui.publicShareToggle.addEventListener('change', async (e) => {
    if (!activeGroupId || !activePlanId) return;
    const isPublic = e.target.checked;
    try {
        const groupRef = doc(db, 'groups', activeGroupId);
        await updateDoc(groupRef, { public: isPublic });

        if (isPublic) {
            ui.shareLinkContainer.classList.remove('hidden');
        } else {
            ui.shareLinkContainer.classList.add('hidden');
        }
        showMessage('Thành công', `Chế độ xem công khai đã được ${isPublic ? 'bật' : 'tắt'}.`);

    } catch (error) {
        console.error("Error toggling public share:", error);
        showMessage('Lỗi', 'Không thể thay đổi cài đặt chia sẻ. Vui lòng kiểm tra Security Rules.', true);
        e.target.checked = !isPublic; // Revert toggle on error
    }
});

ui.copyShareLinkBtn.addEventListener('click', () => {
    const linkInput = ui.shareLinkInput;
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile devices

    try {
        // Use the Clipboard API if available, otherwise fallback
         if (navigator.clipboard) {
              navigator.clipboard.writeText(linkInput.value).then(() => {
                  showMessage('Đã sao chép!', 'Liên kết đã được sao chép vào bộ nhớ tạm.');
              });
         } else {
              document.execCommand('copy');
              showMessage('Đã sao chép!', 'Liên kết đã được sao chép vào bộ nhớ tạm.');
         }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showMessage('Lỗi', 'Không thể sao chép liên kết.', true);
    }
});

// ======================================================================
// ======================== FRIENDS SECTION =============================
// ======================================================================

ui.friendsBtn.addEventListener('click', async () => {
    if (!currentUserData) return;
    // The onSnapshot listener will keep these up to date, just need to render
    renderFriendsUI(currentUserData.friendRequests || []);
    await loadAndRenderFriendsList(currentUserData.friends || []);
    openModal('friends-modal');
});

const showView = (viewName) => {
    const isProfile = viewName === 'profile';
    const isStats = viewName === 'statistics';
    const isTools = viewName === 'tools';
    const isAiTools = viewName === 'ai-tools';
    const isContentWriterAssistant = viewName === 'content-writer-assistant';
    const isFacebookTools = viewName === 'facebook-tools';
    const isFacebookMcvReport = viewName === 'facebook-mcv-report';
    const isFacebookReport = viewName === 'facebook-report';
    const isReportManagement = viewName === 'report-management';
    const isMainView = !isProfile && !isStats && !isTools && !isFacebookTools && !isFacebookMcvReport && !isFacebookReport && !isAiTools && !isContentWriterAssistant && !isReportManagement;

    // Hide stats container for all special views. It will be re-enabled by loadScheduleView if needed.
    if (!isMainView) {
        ui.statsContainer.classList.add('hidden');
    }

    // Determine which top-level container to show
    const showMainContainer = isMainView || isTools || isFacebookTools || isFacebookMcvReport || isFacebookReport || isAiTools || isContentWriterAssistant || isReportManagement;
    ui.mainContentContainer.classList.toggle('hidden', !showMainContainer);
    ui.profileContent.classList.toggle('hidden', !isProfile);
    ui.statisticsContent.classList.toggle('hidden', !isStats);

    // Within the main container, show the correct sub-view
    if (showMainContainer) {
        ui.mainContent.classList.toggle('hidden', !isMainView);
        ui.toolsContent.classList.toggle('hidden', !isTools);
        ui.aiToolsContent.classList.toggle('hidden', !isAiTools);
        ui.contentWriterAssistantContent.classList.toggle('hidden', !isContentWriterAssistant);
        ui.facebookToolsContent.classList.toggle('hidden', !isFacebookTools);
        ui.facebookMcvReportContent.classList.toggle('hidden', !isFacebookMcvReport);
        ui.facebookReportContent.classList.toggle('hidden', !isFacebookReport);
        ui.reportManagementContent.classList.toggle('hidden', !isReportManagement);
    }

    if (isProfile) {
        ui.headerTitle.textContent = 'Hồ Sơ Của Bạn';
    } else if (isStats) {
        ui.headerTitle.textContent = 'Thống kê công việc';
        renderStatisticsView();
    } else if (isTools) {
        ui.headerTitle.textContent = 'Danh mục Công Cụ';
    } else if (isAiTools) {
        ui.headerTitle.textContent = 'Công Cụ AI';
    } else if (isContentWriterAssistant) {
        ui.headerTitle.textContent = 'Trợ lý Viết Content';
    } else if (isFacebookTools) {
        ui.headerTitle.textContent = 'Công Cụ Facebook';
        renderFacebookTools();
    } else if (isFacebookMcvReport) {
        ui.headerTitle.textContent = 'Báo cáo tuần Facebook MCV';
    } else if (isFacebookReport) {
        ui.headerTitle.textContent = 'Báo cáo Facebook';
    } else if (isReportManagement) {
        ui.headerTitle.textContent = 'Quản lý báo cáo';
    } else {
        // Restore original header logic
        if (activeGroupId && activePlanId) {
            const plan = cachedTasks.length > 0 ? { name: '...' } : { name: '...' }; // Simplified
            ui.headerTitle.textContent = `Lịch trình: ${plan.name}`;
        } else if (activeGroupId) {
            ui.headerTitle.textContent = `Kế hoạch của: ...`;
        } else {
            ui.headerTitle.textContent = 'Các Nhóm Của Tôi';
        }
    }
    
    updateHeaderButtons(viewName);
};

const renderAvatarSelection = () => {
    if (!ui.avatarSelectionGrid || !currentUser) return;

    const currentStyle = currentUserData.avatarStyle || 'pixel-art';

    ui.avatarSelectionGrid.innerHTML = AVATAR_STYLES.map(style => `
        <div class="avatar-option ${style === currentStyle ? 'selected' : ''}" data-style="${style}">
            <img src="https://api.dicebear.com/8.x/${style}/svg?seed=${currentUser.uid}" alt="${style}">
        </div>
    `).join('');

    // Add event listeners
    ui.avatarSelectionGrid.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', async () => {
            const newStyle = option.dataset.style;
            // Update UI immediately for responsiveness
            updateUserAvatar(currentUser.uid, newStyle);
            
            // Update in Firestore
            const userRef = doc(db, "users", currentUser.uid);
            try {
                await updateDoc(userRef, { avatarStyle: newStyle });
                currentUserData.avatarStyle = newStyle; // Update local cache
            } catch (error) {
                console.error("Error updating avatar:", error);
                // Revert UI if DB update fails
                updateUserAvatar(currentUser.uid, currentUserData.avatarStyle);
                showMessage('Lỗi', 'Không thể lưu avatar mới.', true);
            }

            closeModal('avatar-modal');
        });
    });
};

ui.profileBtn.addEventListener('click', () => {
    if (!currentUserData) return;
    
    // Populate the form
    ui.profileNameInput.value = currentUserData.name || '';
    ui.profileEmailInput.value = currentUser.email || '';
    updateUserAvatar(currentUser.uid, currentUserData.avatarStyle || 'pixel-art');
    
    // Clear password fields and error message
    ui.profileNewPasswordInput.value = '';
    ui.profileConfirmPasswordInput.value = '';
    ui.profileError.classList.add('hidden');
    ui.profileError.textContent = '';
    
    navigateToView('profile');
});

if (ui.navigateToAiToolsBtn) {
    ui.navigateToAiToolsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('ai-tools');
    });
}

if (ui.contentWriterBtn) {
    ui.contentWriterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('content-writer-assistant');
    });
}

if (ui.sidebarAiToolsBtn) {
    ui.sidebarAiToolsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('ai-tools');
    });
}

if (ui.sidebarMcvReportBtn) {
    ui.sidebarMcvReportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('facebook-mcv-report');
    });
}

if (ui.navigateToMcvReportCard) {
    ui.navigateToMcvReportCard.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('facebook-mcv-report');
    });
}

if (ui.sidebarFacebookReportBtn) {
    ui.sidebarFacebookReportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('facebook-report');
    });
}

if (ui.navigateToFacebookReportCard) {
    ui.navigateToFacebookReportCard.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToView('facebook-report');
    });
}

if (ui.profileAvatarContainer) {
    ui.profileAvatarContainer.addEventListener('click', () => {
        renderAvatarSelection();
        openModal('avatar-modal');
    });
}

function renderFacebookTools() {
}

// --- Statistics View Logic ---
function renderStatisticsView() {
    // Populate assignee filter
    let memberOptions = '<option value="">Tất cả thành viên</option>';
    activeGroupMembers.forEach(member => {
        memberOptions += `<option value="${member.uid}">${member.name || member.email}</option>`;
    });
    ui.statFilterAssignee.innerHTML = memberOptions;

    // Populate channel filter
    let channelOptions = '<option value="">Tất cả các kênh</option>';
    const uniqueChannels = [...new Set(cachedTasks.map(t => t.channel).filter(Boolean))];
    uniqueChannels.forEach(channel => {
        channelOptions += `<option value="${channel}">${channel}</option>`;
    });
    ui.statFilterChannel.innerHTML = channelOptions;


    // Add event listeners to filters
    [ui.statFilterAssignee, ui.statFilterDate, ui.statFilterPartner, ui.statFilterTime, ui.statFilterChannel].forEach(el => {
        el.addEventListener('change', renderStatisticsTable);
    });
    ui.statFilterPartner.addEventListener('keyup', renderStatisticsTable);


    // Initialize custom selects for the new filters
    initCustomSelect(ui.statFilterAssignee.closest('.custom-select-wrapper'));
    initCustomSelect(ui.statFilterChannel.closest('.custom-select-wrapper'));

    // Initial render
    renderStatisticsTable();
}

function renderStatisticsTable() {
    const assigneeFilter = ui.statFilterAssignee.value;
    const dateFilter = ui.statFilterDate.value;
    const partnerFilter = ui.statFilterPartner.value.toLowerCase();
    const timeFilter = ui.statFilterTime.value;
    const channelFilter = ui.statFilterChannel.value;

    const filteredTasks = cachedTasks.filter(task => {
        const assigneeMatch = !assigneeFilter || task.assigneeUid === assigneeFilter;
        const dateMatch = !dateFilter || task.date === dateFilter;
        const partnerMatch = !partnerFilter || (task.partner && task.partner.toLowerCase().includes(partnerFilter));
        const timeMatch = !timeFilter || task.time === timeFilter;
        const channelMatch = !channelFilter || task.channel === channelFilter;
        return assigneeMatch && dateMatch && partnerMatch && timeMatch && channelMatch;
    });

    if (filteredTasks.length === 0) {
        ui.statisticsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-gray-500">Không có dữ liệu phù hợp.</td></tr>`;
        return;
    }

    const tableRows = filteredTasks.map((task, index) => {
        const assignee = activeGroupMembers.find(m => m.uid === task.assigneeUid);
        const assigneeName = assignee ? (assignee.name || assignee.email) : 'Chưa gán';
        const assigneeColor = userColorUtil.getColor(assignee?.uid);
        const endDate = task.date ? new Date(task.date).toLocaleDateString('vi-VN') : 'N/A';

        return `
            <tr class="border-b border-gray-200/50 hover:bg-gray-500/5">
                <td class="px-6 py-4 font-medium text-gray-900">${index + 1}</td>
                <td class="px-6 py-4">${task.partner || ''}</td>
                <td class="px-6 py-4"><a href="${task.videoLink || '#'}" target="_blank" class="text-blue-600 hover:underline">${task.videoLink ? 'Link' : ''}</a></td>
                <td class="px-6 py-4"><a href="${task.scriptLink || '#'}" target="_blank" class="text-blue-600 hover:underline">${task.scriptLink ? 'Link' : ''}</a></td>
                <td class="px-6 py-4"><a href="${task.completedVideoLink || '#'}" target="_blank" class="text-green-600 hover:underline">${task.completedVideoLink ? 'Link' : ''}</a></td>
                <td class="px-6 py-4 font-bold" style="color: ${assigneeColor};">${assigneeName}</td>
                <td class="px-6 py-4">${endDate}</td>
            </tr>
        `;
    }).join('');

    ui.statisticsTableBody.innerHTML = tableRows;
}

// --- NEW: Excel Export Logic ---
const exportStatisticsToExcel = () => {
    const table = document.querySelector('#statistics-content table');
    if (!table) {
        showMessage('Lỗi', 'Không tìm thấy bảng dữ liệu để xuất.', true);
        return;
    }

    // 1. Get headers
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);
    
    // 2. Get data from the currently displayed rows
    const dataRows = Array.from(table.querySelectorAll('tbody tr'));
    
    if (dataRows.length === 0 || (dataRows.length === 1 && dataRows[0].textContent.includes("Không có dữ liệu"))) {
        showMessage('Thông báo', 'Không có dữ liệu để xuất ra file Excel.', true);
        return;
    }

    const data = dataRows.map(row => {
        return Array.from(row.querySelectorAll('td')).map(td => {
            // If the cell contains a link, extract the URL, otherwise get text content
            const link = td.querySelector('a');
            return link ? link.href : td.textContent;
        });
    });

    // 3. Create worksheet and workbook
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Set column widths for better readability
    const colWidths = headers.map((_, i) => {
        const maxLength = Math.max(
            headers[i]?.length || 0,
            ...data.map(row => row[i]?.toString().length || 0)
        );
        // Set a minimum width of 15 and max of 60
        return { wch: Math.max(15, Math.min(maxLength + 2, 60)) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ThongKeCongViec');

    // 4. Generate and download the file
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `ThongKeCongViec_${activeGroupId}_${today}.xlsx`;
    XLSX.writeFile(workbook, fileName);
};

// Add event listener to the new button
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('export-excel-btn');
    if(exportBtn) {
        exportBtn.addEventListener('click', exportStatisticsToExcel);
    }
});


ui.profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newName = ui.profileNameInput.value.trim();
    const newPassword = ui.profileNewPasswordInput.value;
    const confirmPassword = ui.profileConfirmPasswordInput.value;
    const selectedAvatarStyle = ui.avatarSelectionGrid.querySelector('.selected')?.dataset.style;

    ui.profileError.classList.add('hidden');

    // --- Password Validation ---
    if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
            ui.profileError.textContent = 'Mật khẩu xác nhận không khớp.';
            ui.profileError.classList.remove('hidden');
            return;
        }
        if (newPassword.length < 6) {
            ui.profileError.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
            ui.profileError.classList.remove('hidden');
            return;
        }
    }

    // --- Update Logic ---
    try {
        const userRef = doc(db, "users", currentUser.uid);
        const updates = {};

        // Update name in Firestore if it has changed
        if (newName !== currentUserData.name) {
            updates.name = newName;
        }

        // Update avatar style if it has changed
        if (selectedAvatarStyle && selectedAvatarStyle !== currentUserData.avatarStyle) {
            updates.avatarStyle = selectedAvatarStyle;
        }

        if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
            // Update local cache
            currentUserData = { ...currentUserData, ...updates };
        }

        // Update password in Firebase Auth if a new one is provided
        if (newPassword) {
            await updatePassword(currentUser, newPassword);
        }

        showMessage('Thành công', 'Hồ sơ của bạn đã được cập nhật.');
        showView('main');

    } catch (error) {
        console.error("Profile update error:", error);
        let errorMessage = 'Không thể cập nhật hồ sơ. Vui lòng thử lại.';
        if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Để thay đổi mật khẩu, bạn cần đăng xuất và đăng nhập lại gần đây.';
        }
        ui.profileError.textContent = errorMessage;
        ui.profileError.classList.remove('hidden');
    }
});


function listenToFriendRequests(uid) {
    if (friendRequestsUnsubscribe) friendRequestsUnsubscribe();
    const userRef = doc(db, 'users', uid);
    // This listener is part of the main `listenToUserData`, so friend data
    // will be updated automatically. We just need to ensure the UI is rendered
    // when the friends modal is opened.
}

async function loadAndRenderFriendsList(friendUids) {
    ui.friendsList.innerHTML = '<li class="text-gray-400 p-2">Đang tải...</li>';
    if (friendUids.length === 0) {
        currentFriendsData = [];
        ui.friendsList.innerHTML = '<li class="text-gray-400 p-2">Chưa có bạn bè.</li>';
        return;
    }
    try {
        const friendPromises = friendUids.map(uid => getDoc(doc(db, 'users', uid)));
        const friendDocs = await Promise.all(friendPromises);
        currentFriendsData = friendDocs
            .filter(d => d.exists())
            .map(d => ({ uid: d.id, ...d.data() }));

        if (currentFriendsData.length === 0) {
             ui.friendsList.innerHTML = '<li class="text-gray-400 p-2">Chưa có bạn bè.</li>';
             return;
        }

        ui.friendsList.innerHTML = currentFriendsData.map(friend => {
            const friendColor = userColorUtil.getColor(friend.uid);
            return `
            <li class="px-3 py-2 bg-black/5 rounded-lg flex justify-between items-center">
                <span class="font-semibold" style="color: ${friendColor};">${friend.name || friend.email}</span>
                <button onclick="unfriend('${friend.uid}', '${friend.name}')" class="text-xs text-red-500 hover:underline">Hủy kết bạn</button>
            </li>
        `}).join('');
    } catch (error) {
        console.error("Error loading friends list:", error);
        ui.friendsList.innerHTML = '<li class="text-red-500 p-2">Lỗi tải danh sách bạn bè.</li>';
    }
}

async function renderFriendsUI(requests) {
    const pendingRequests = requests.filter(r => r.status === 'pending');
    if (pendingRequests.length > 0) {
         ui.friendRequestsList.innerHTML = pendingRequests.map(r => {
            const requesterColor = userColorUtil.getColor(r.fromUid);
            return `
            <li class="px-3 py-2 bg-yellow-400/20 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span class="font-semibold" style="color: ${requesterColor};">${r.fromName || r.fromEmail}</span>
                <div class="flex gap-2 self-end sm:self-center">
                    <button class="text-green-600 hover:underline text-sm font-semibold" onclick="handleFriendRequest('${r.fromUid}', true)">Chấp nhận</button>
                    <button class="text-red-600 hover:underline text-sm font-semibold" onclick="handleFriendRequest('${r.fromUid}', false)">Từ chối</button>
                </div>
            </li>
        `}).join('');
    } else {
         ui.friendRequestsList.innerHTML = '<li class="text-gray-400 p-2">Không có lời mời mới.</li>';
    }
}

const showFriendRequestMessage = (message, isError = false) => {
    ui.friendRequestMessage.textContent = message;
    ui.friendRequestMessage.className = `text-sm mb-2 ${isError ? 'text-red-600' : 'text-green-600'}`;
};

ui.sendFriendRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showFriendRequestMessage('', false);
    const email = ui.friendEmailInput.value.trim().toLowerCase();
    if (!email || !currentUser) return;
    if (email === currentUser.email) {
        showFriendRequestMessage('Không thể kết bạn với chính mình!', true);
        return;
    }
    try {
        // NOTE: This query requires a Firestore index on the 'email' field in the 'users' collection.
        // If you get a permission error in the console, create this index in the Firebase console.
        const q = query(collection(db, 'users'), where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showFriendRequestMessage('Không tìm thấy người dùng với email này.', true);
            return;
        }
        const foundUserDoc = querySnapshot.docs[0];
        const foundUser = { id: foundUserDoc.id, ...foundUserDoc.data() };


        if ((currentUserData.friends || []).includes(foundUser.id)) {
            showFriendRequestMessage('Hai bạn đã là bạn bè.', true);
            return;
        }

        const existingRequest = (foundUser.friendRequests || []).find(r => r.fromUid === currentUser.uid && r.status === 'pending');
        if(existingRequest) {
            showFriendRequestMessage('Đã gửi lời mời, vui lòng chờ xác nhận.', false);
            return;
        }
        
        const newRequest = {
            fromUid: currentUser.uid,
            fromEmail: currentUser.email,
            fromName: currentUserData.name || currentUser.email,
            status: 'pending',
            sentAt: Timestamp.now()
        };

        await updateDoc(doc(db, 'users', foundUser.id), {
            friendRequests: arrayUnion(newRequest)
        });
        
        showFriendRequestMessage('Đã gửi lời mời kết bạn!', false);
        ui.friendEmailInput.value = '';
    } catch (err) {
        console.error("Error sending friend request", err);
        showFriendRequestMessage('Lỗi gửi lời mời! Vui lòng thử lại.', true);
    }
});

window.handleFriendRequest = async (fromUid, accept) => {
    if (!currentUser || !currentUserData) return;

    const requestToHandle = (currentUserData.friendRequests || []).find(r => r.fromUid === fromUid && r.status === 'pending');

    if (!requestToHandle) {
        console.log("Không tìm thấy lời mời kết bạn hoặc đã được xử lý.");
        return;
    }

    const userRef = doc(db, 'users', currentUser.uid);
    const batch = writeBatch(db);

    try {
        // Luôn xóa lời mời kết bạn khỏi danh sách
        batch.update(userRef, { friendRequests: arrayRemove(requestToHandle) });

        if (accept) {
            const friendRef = doc(db, 'users', fromUid);
            // Thêm bạn bè cho cả hai người dùng
            batch.update(userRef, { friends: arrayUnion(fromUid) });
            batch.update(friendRef, { friends: arrayUnion(currentUser.uid) });
        }

        await batch.commit();

        // Cập nhật giao diện ngay lập tức thay vì chờ onSnapshot
        // 1. Cập nhật danh sách lời mời trong cache và re-render
        currentUserData.friendRequests = (currentUserData.friendRequests || []).filter(r => r.fromUid !== fromUid);
        renderFriendsUI(currentUserData.friendRequests);
        
        // 2. Nếu chấp nhận, cập nhật danh sách bạn bè trong cache và re-render
        if (accept) {
            // Đảm bảo không thêm trùng lặp
            if (!(currentUserData.friends || []).includes(fromUid)) {
                currentUserData.friends.push(fromUid);
            }
            await loadAndRenderFriendsList(currentUserData.friends); // Tải lại toàn bộ list để có tên bạn mới
        }

    } catch (error) {
        console.error("Lỗi khi xử lý lời mời kết bạn: ", error);
        showMessage('Lỗi', 'Không thể xử lý lời mời. Vui lòng thử lại.', true);
    }
};

window.unfriend = async (friendUid, friendName) => {
     showConfirmation(`Hủy kết bạn với ${friendName || 'người này'}?`, 
     'Bạn có chắc muốn hủy kết bạn không?', 
     async () => {
         try {
              const userRef = doc(db, 'users', currentUser.uid);
              const friendRef = doc(db, 'users', friendUid);
            
              const batch = writeBatch(db);
              batch.update(userRef, { friends: arrayRemove(friendUid) });
              batch.update(friendRef, { friends: arrayRemove(currentUser.uid) });
              await batch.commit();
            
              // Cập nhật cache cục bộ và re-render UI ngay lập tức
              currentUserData.friends = (currentUserData.friends || []).filter(uid => uid !== friendUid);
              await loadAndRenderFriendsList(currentUserData.friends);
            
              showMessage('Thành công', 'Đã hủy kết bạn.');
         } catch(error) {
              console.error("Lỗi khi hủy kết bạn: ", error);
              showMessage('Lỗi', 'Không thể hủy kết bạn. Vui lòng thử lại.', true);
         }
     });
}

// ======================================================================
// ========================== CHAT SECTION ==============================
// ======================================================================

const alignChatPopup = () => {
    const btn = ui.openChatBtn;
    const popup = ui.chatPopup;
    if (!btn || !popup) return;

    const btnRect = btn.getBoundingClientRect();
    popup.style.right = `${window.innerWidth - btnRect.right}px`;
};

const toggleChatPopup = (show) => {
    const popup = ui.chatPopup;
    if (show) {
        alignChatPopup(); // Align before showing
        popup.classList.remove('hidden');
        setTimeout(() => {
            popup.classList.remove('translate-y-full', 'opacity-0', 'scale-95');
        }, 10);
    } else {
        popup.classList.add('translate-y-full', 'opacity-0', 'scale-95');
        setTimeout(() => {
            popup.classList.add('hidden');
            ui.chatSidebar.classList.remove('-translate-x-full');
            ui.chatView.classList.add('translate-x-full');
        }, 300);
    }
};

window.addEventListener('resize', () => {
    alignChatPopup();
    handleResize(); // Handle header buttons on resize
});

ui.openChatBtn.addEventListener('click', () => {
    toggleChatPopup(true);
    // Default to "All" tab and render both groups and friends
    ui.chatTabAll.classList.add('primary', 'bg-white/80');
    ui.chatTabUnread.classList.remove('primary', 'bg-white/80');
    renderChatSidebar('all');
});

ui.closeChatPopupBtn.addEventListener('click', () => toggleChatPopup(false));

ui.chatTabAll.addEventListener('click', () => {
    ui.chatTabAll.classList.add('primary', 'bg-white/80');
    ui.chatTabUnread.classList.remove('primary', 'bg-white/80');
    renderChatSidebar('all');
});

ui.chatTabUnread.addEventListener('click', () => {
    // This is a placeholder for unread functionality
    ui.chatTabUnread.classList.add('primary', 'bg-white/80');
    ui.chatTabAll.classList.remove('primary', 'bg-white/80');
    ui.chatConversationsList.innerHTML = `<div class="text-gray-400 text-center p-4">Chức năng xem tin nhắn chưa đọc đang được phát triển.</div>`;
});

async function renderChatSidebar(type) {
    ui.chatConversationsList.innerHTML = '<div class="text-gray-400 text-center p-4">Đang tải...</div>';
    let conversations = [];

    // Fetch groups
    if (currentUserData.groups && currentUserData.groups.length > 0) {
        const groupPromises = currentUserData.groups.map(id => getDoc(doc(db, "groups", id)));
        const groupDocs = await Promise.all(groupPromises);
        const groupConversations = groupDocs.filter(d => d.exists()).map(d => ({
            id: d.id,
            name: d.data().name,
            subtitle: `${d.data().members.length} thành viên`,
            type: 'group'
        }));
        conversations.push(...groupConversations);
    }

    // Fetch friends
    if (currentUserData.friends && currentUserData.friends.length > 0) {
        if (currentFriendsData.length !== currentUserData.friends.length) {
            await loadAndRenderFriendsList(currentUserData.friends);
        }
        const friendConversations = currentFriendsData.map(f => ({
            id: f.uid,
            name: f.name || f.email,
            subtitle: 'Bạn bè',
            type: 'friend'
        }));
        conversations.push(...friendConversations);
    }

    if (conversations.length > 0) {
        ui.chatConversationsList.innerHTML = conversations.map(convo => `
            <div onclick="openChatConversation('${convo.id}', '${convo.type}')" 
                class="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 cursor-pointer transition-colors">
                <div class="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center font-bold text-white flex-shrink-0 text-xl">
                    ${(convo.name[0] || '?').toUpperCase()}
                </div>
                <div class="flex-1 overflow-hidden">
                    <div class="font-semibold text-gray-800 truncate">${convo.name}</div>
                    <div class="text-xs text-gray-500 truncate">${convo.subtitle}</div>
                </div>
                <div class="flex flex-col items-end text-xs text-gray-400">
                    <span>10 giờ</span>
                    <span class="w-3 h-3 bg-blue-500 rounded-full mt-1"></span>
                </div>
            </div>
        `).join('');
    } else {
        ui.chatConversationsList.innerHTML = `<div class="text-gray-400 text-center p-4">Không có cuộc trò chuyện nào.</div>`;
    }
}

window.openChatConversation = async (id, type) => {
    if (chatMessagesUnsubscribe) chatMessagesUnsubscribe();

    // Animate views
    ui.chatSidebar.classList.add('-translate-x-full');
    ui.chatView.classList.remove('translate-x-full');

    let conversationRef;
    let title, subtitle;
    let membersForAvatar = [];

    if (type === 'group') {
        const groupDoc = await getDoc(doc(db, 'groups', id));
        if (!groupDoc.exists()) return;
        const groupData = groupDoc.data();
        title = groupData.name;
        subtitle = `${groupData.members.length} thành viên`;
        conversationRef = collection(db, 'groups', id, 'messages');
        if (activeGroupId !== id || activeGroupMembers.length === 0) {
            await fetchAndCacheMembers(groupData.members);
        }
        membersForAvatar = activeGroupMembers;
    } else { // friend
        const friendDoc = await getDoc(doc(db, 'users', id));
        if (!friendDoc.exists()) return;
        title = friendDoc.data().name || friendDoc.data().email;
        subtitle = 'Bạn bè';
        const chatId = [currentUser.uid, id].sort().join('_');
        conversationRef = collection(db, 'chats', chatId, 'messages');
        membersForAvatar = [currentUserData, { uid: friendDoc.id, ...friendDoc.data() }];
    }

    currentChatContext = { id, type, name: title, members: membersForAvatar };

    ui.chatTitle.textContent = title;
    ui.chatSubtitle.textContent = subtitle;
    ui.chatAvatar.textContent = (title[0] || '?').toUpperCase();

    const q = query(conversationRef, orderBy("sentAt", "desc"), limit(50));
    chatMessagesUnsubscribe = onSnapshot(q, (snapshot) => {
        ui.chatMessages.innerHTML = ''; // Xóa tin nhắn cũ
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
        messages.forEach(msg => renderSingleChatMessage(msg)); // Render từng tin nhắn
        ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
    });
};

function renderSingleChatMessage(msg, isOptimistic = false) {
    const isMe = msg.senderUid === currentUser.uid;
    const sender = currentChatContext.members.find(m => m.uid === msg.senderUid) || { name: '...', email: '...' };
    const senderName = isMe ? 'Bạn' : sender.name || sender.email;
    const senderColor = userColorUtil.getColor(msg.senderUid);

    const messageActions = isMe && !isOptimistic ? `
        <div class="message-actions">
            <button class="message-action-btn" onclick="toggleEditMode('${msg.id}')"><i class="fas fa-pencil-alt"></i></button>
            <button class="message-action-btn" onclick="deleteMessage('${msg.id}')"><i class="fas fa-trash-alt"></i></button>
        </div>
    ` : '';

    const messageContainerClasses = `message-container ${isMe ? 'flex-row-reverse' : ''}`;
    const optimisticClass = isOptimistic ? 'optimistic-message' : '';

    const messageHtml = `
        <div class="flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} ${optimisticClass}" id="message-${msg.id}">
            ${!isMe ? `<div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm text-white font-bold" style="background-color: ${senderColor};" title="${senderName}">${(senderName[0] || '?').toUpperCase()}</div>` : ''}
            <div class="${messageContainerClasses}">
                <div class="flex flex-col gap-1 max-w-[80%] w-full">
                    <div class="flex items-center space-x-2 rtl:space-x-reverse ${isMe ? 'justify-end' : ''}">
                        <span class="text-xs font-bold sender-name" style="color: ${senderColor};">${senderName}</span>
                        <span class="text-xs font-normal text-gray-500 flex-shrink-0">${msg.sentAt ? formatTime(msg.sentAt) : 'Đang gửi...'}</span>
                    </div>
                    <div class="message-content-wrapper leading-snug p-2.5 rounded-xl ${isMe ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white/80 text-gray-800 rounded-bl-none shadow-sm'}">
                        <p class="message-text text-sm font-normal break-words">${msg.text}</p>
                        <div class="message-edit-container hidden">
                            <div class="message-edit-box">
                                <textarea class="message-edit-input-inner w-full bg-transparent border-none focus:ring-0 p-0 resize-none text-sm"></textarea>
                                <div class="flex justify-end gap-2 mt-2">
                                    <button class="glass-btn message-edit-btn" onclick="toggleEditMode('${msg.id}')">Hủy</button>
                                    <button class="glass-btn primary message-edit-btn" onclick="saveMessageEdit('${msg.id}')">Lưu</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ${messageActions}
            </div>
        </div>
    `;
    
    ui.chatMessages.insertAdjacentHTML('beforeend', messageHtml);
}

function renderChatMessages(messages) {
    ui.chatMessages.innerHTML = ''; // Clear existing messages
    messages.forEach(msg => renderSingleChatMessage(msg));
    ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

ui.chatInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ui.chatInput.value.trim();
    if (!text || !currentChatContext.id) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
        id: tempId,
        text: text,
        senderUid: currentUser.uid,
        sentAt: null // Indicate it's being sent
    };

    // Optimistic UI update
    renderSingleChatMessage(optimisticMessage, true);
    ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
    ui.chatInput.value = '';


    let conversationRef;
    if (currentChatContext.type === 'group') {
        conversationRef = collection(db, 'groups', currentChatContext.id, 'messages');
    } else {
        const chatId = [currentUser.uid, currentChatContext.id].sort().join('_');
        conversationRef = collection(db, 'chats', chatId, 'messages');
    }

    try {
        await addDoc(conversationRef, {
            text: text,
            senderUid: currentUser.uid,
            sentAt: Timestamp.now()
        });
        // Firestore listener will handle replacing the optimistic message
    } catch (error) {
        console.error("Error sending message:", error);
        // Handle error: for example, mark the optimistic message as failed
        const failedMsgElement = document.getElementById(`message-${tempId}`);
        if (failedMsgElement) {
            failedMsgElement.classList.add('message-failed');
            failedMsgElement.title = 'Gửi thất bại';
        }
        showMessage('Lỗi', 'Không thể gửi tin nhắn.', true);
    }
});

window.toggleEditMode = (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (!messageElement) return;

    const contentWrapper = messageElement.querySelector('.message-content-wrapper');
    const textElement = messageElement.querySelector('.message-text');
    const editContainer = messageElement.querySelector('.message-edit-container');
    const editInput = messageElement.querySelector('.message-edit-input-inner');

    const isEditing = editContainer.classList.contains('hidden');

    if (isEditing) {
        // Enter edit mode
        contentWrapper.classList.add('is-editing');
        editInput.value = textElement.textContent;
        textElement.classList.add('hidden');
        editContainer.classList.remove('hidden');
        editInput.focus();
    } else {
        // Exit edit mode
        contentWrapper.classList.remove('is-editing');
        textElement.classList.remove('hidden');
        editContainer.classList.add('hidden');
    }
};

window.saveMessageEdit = async (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (!messageElement) return;

    const editInput = messageElement.querySelector('.message-edit-input-inner');
    const newText = editInput.value.trim();

    if (!newText || !currentChatContext.id) return;

    let messageRef;
    if (currentChatContext.type === 'group') {
        messageRef = doc(db, 'groups', currentChatContext.id, 'messages', messageId);
    } else {
        const chatId = [currentUser.uid, currentChatContext.id].sort().join('_');
        messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    }

    try {
        await updateDoc(messageRef, {
            text: newText,
            updatedAt: Timestamp.now()
        });
        // The onSnapshot listener will automatically re-render the message
    } catch (error) {
        console.error("Error updating message:", error);
        showMessage('Lỗi', 'Không thể cập nhật tin nhắn.', true);
    }
};

window.deleteMessage = async (messageId) => {
    if (!messageId || !currentChatContext.id) return;

    showConfirmation('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa tin nhắn này không?', async () => {
        let messageRef;
        if (currentChatContext.type === 'group') {
            messageRef = doc(db, 'groups', currentChatContext.id, 'messages', messageId);
        } else {
            const chatId = [currentUser.uid, currentChatContext.id].sort().join('_');
            messageRef = doc(db, 'chats', chatId, 'messages', messageId);
        }

        try {
            await deleteDoc(messageRef);
        } catch (error) {
            console.error("Error deleting message:", error);
            showMessage('Lỗi', 'Không thể xóa tin nhắn.', true);
        }
    });
};

ui.backToConversationsBtn.addEventListener('click', () => {
    ui.chatSidebar.classList.remove('-translate-x-full');
    ui.chatView.classList.add('translate-x-full');
});

// --- NEW: Mobile Menu Logic ---
function updateMobileMenu() {
    const menu = ui.mobileMenu;
    if (!menu) return;

    const isGroupDashboard = !activeGroupId && !activePlanId;
    const isPlanDashboard = activeGroupId && !activePlanId;
    const isScheduleView = activeGroupId && activePlanId;

    let menuItems = `
        <a href="#" data-action="profile" class="mobile-menu-item"><i class="fas fa-user-circle fa-fw mr-3"></i>Hồ sơ</a>
        <a href="#" data-action="friends" class="mobile-menu-item"><i class="fas fa-user-friends fa-fw mr-3"></i>Bạn bè</a>
        <a href="#" data-action="chat" class="mobile-menu-item"><i class="fas fa-comments fa-fw mr-3"></i>Tin nhắn</a>
    `;

    if (isScheduleView) {
        menuItems += `<a href="#" data-action="create-task" class="mobile-menu-item"><i class="fas fa-plus fa-fw mr-3"></i>Tạo Công Việc</a>`;
        menuItems += `<a href="#" data-action="share" class="mobile-menu-item"><i class="fas fa-share-alt fa-fw mr-3"></i>Chia sẻ</a>`;
    }
    if (isPlanDashboard) {
        menuItems += `<a href="#" data-action="create-plan" class="mobile-menu-item"><i class="fas fa-plus fa-fw mr-3"></i>Tạo Kế Hoạch</a>`;
    }
    if (isPlanDashboard || isScheduleView) {
        menuItems += `<a href="#" data-action="leave-group" class="mobile-menu-item text-red-500"><i class="fas fa-sign-out-alt fa-fw mr-3"></i>Rời nhóm</a>`;
    }
    if (isGroupDashboard) {
        menuItems += `<a href="#" data-action="create-group" class="mobile-menu-item"><i class="fas fa-plus fa-fw mr-3"></i>Tạo nhóm</a>`;
        menuItems += `<a href="#" data-action="join-group" class="mobile-menu-item"><i class="fas fa-user-plus fa-fw mr-3"></i>Tham gia</a>`;
    }

    menuItems += `<hr class="my-1 border-black/10">`;
    menuItems += `<a href="#" data-action="logout" class="mobile-menu-item text-red-500"><i class="fas fa-sign-out-alt fa-fw mr-3"></i>Đăng xuất</a>`;

    menu.innerHTML = menuItems;

    // Generic event listener for the menu
    menu.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target.closest('.mobile-menu-item');
        if (!target) return;

        const action = target.dataset.action;
        const closeMenu = () => ui.mobileMenu.classList.add('hidden');

        const actions = {
            'profile': () => ui.profileBtn.click(),
            'friends': () => ui.friendsBtn.click(),
            'chat': () => ui.openChatBtn.click(),
            'create-task': () => ui.createTaskBtn.click(),
            'share': () => ui.sharePlanBtn.click(),
            'create-plan': () => ui.createPlanBtn.click(),
            'leave-group': () => ui.leaveGroupBtn.click(),
            'create-group': () => ui.createGroupBtn.click(),
            'join-group': () => ui.joinGroupBtn.click(),
            'logout': () => ui.logoutBtn.click(),
        };

        if (actions[action]) {
            actions[action]();
            closeMenu();
        }
    });
}

ui.mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.mobileMenu.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    // Close mobile menu if clicked outside
    if (!ui.mobileMenu.classList.contains('hidden') && !ui.mobileMenu.contains(e.target) && !ui.mobileMenuBtn.contains(e.target)) {
        ui.mobileMenu.classList.add('hidden');
    }

    // Close chat popup if clicked outside
    const isChatPopupVisible = !ui.chatPopup.classList.contains('hidden');
    if (isChatPopupVisible && !ui.chatPopup.contains(e.target) && !e.target.closest('#open-chat-btn')) {
        toggleChatPopup(false);
    }
});


// --- App Entry Point ---
// --- Mobile Bottom Nav Logic ---
const handleMobileNav = (e) => {
    const button = e.target.closest('.mobile-nav-btn');
    if (!button) return;

    // Remove active class from all buttons
    ui.mobileBottomNav.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Add active class to the clicked button
    button.classList.add('active');

    // Handle navigation
    switch (button.id) {
        case 'mobile-nav-home':
            // Navigate to the main dashboard view
            if (activeGroupId) {
                navigateToGroup(activeGroupId);
            } else {
                showView('main');
                viewHistory = [];
                updateDoc(doc(db, "users", currentUser.uid), { 
                    activeGroupId: null,
                    activePlanId: null 
                });
            }
            break;
        case 'mobile-nav-tools':
            navigateToView('tools');
            break;
        case 'mobile-nav-chat':
            ui.openChatBtn.click();
            break;
        case 'mobile-nav-friends':
            ui.friendsBtn.click();
            break;
        case 'mobile-nav-profile':
            navigateToView('profile');
            break;
    }
};


document.addEventListener('DOMContentLoaded', () => {
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebar = document.getElementById('sidebar');

    if (ui.mobileBottomNav) {
        ui.mobileBottomNav.addEventListener('click', handleMobileNav);
    }

    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-collapsed');
        });
    }

    if (ui.toggleGroupCategoryBtn) {
        ui.toggleGroupCategoryBtn.addEventListener('click', async () => {
            // Navigate to the main group dashboard view
            showView('main');
            viewHistory = [];
            await updateDoc(doc(db, "users", currentUser.uid), { 
                activeGroupId: null,
                activePlanId: null 
            });

            // Also keep the toggle functionality
            const isExpanded = ui.toggleGroupCategoryBtn.getAttribute('aria-expanded') === 'true';
            ui.toggleGroupCategoryBtn.setAttribute('aria-expanded', !isExpanded);
            ui.groupListContainer.classList.toggle('hidden', isExpanded);
            ui.toggleGroupCategoryBtn.querySelector('i').classList.toggle('rotate-180', !isExpanded);
        });
    }

    if (ui.toggleToolCategoryBtn) {
        ui.toggleToolCategoryBtn.addEventListener('click', () => {
            // Navigate to the main tools view
            navigateToView('tools');

            // Also keep the toggle functionality
            const isExpanded = ui.toggleToolCategoryBtn.getAttribute('aria-expanded') === 'true';
            ui.toggleToolCategoryBtn.setAttribute('aria-expanded', !isExpanded);
            ui.toolListContainer.classList.toggle('hidden', isExpanded);
            ui.toggleToolCategoryBtn.querySelector('.sidebar-chevron').classList.toggle('rotate-180', !isExpanded);
        });
    }

    if (ui.toggleReportCategoryBtn) {
        ui.toggleReportCategoryBtn.addEventListener('click', () => {
            // Navigate to the main tools view
            navigateToView('report-management');

            // Also keep the toggle functionality
            const isExpanded = ui.toggleReportCategoryBtn.getAttribute('aria-expanded') === 'true';
            ui.toggleReportCategoryBtn.setAttribute('aria-expanded', !isExpanded);
            ui.reportListContainer.classList.toggle('hidden', isExpanded);
            ui.toggleReportCategoryBtn.querySelector('.sidebar-chevron').classList.toggle('rotate-180', !isExpanded);
        });
    }
});

window.onload = () => {
    handleRouting();
    handleResize(); // Initial check
};

// ======================================================================
// ===================== UTILITY POPUP SECTION ==========================
// ======================================================================
const utilityUI = {
    fab: document.getElementById('utility-fab'),
    popup: document.getElementById('utility-popup'),
    closeBtn: document.getElementById('close-utility-popup-btn'),
    notesTab: document.getElementById('utility-tab-notes'),
    linksTab: document.getElementById('utility-tab-links'),
    notesContent: document.getElementById('utility-notes-content'),
    linksContent: document.getElementById('utility-links-content'),
    // Notes UI
    showNoteFormBtn: document.getElementById('show-note-form-btn'),
    newNoteForm: document.getElementById('new-note-form'),
    noteInput: document.getElementById('note-input'),
    addNoteBtn: document.getElementById('add-note-btn'),
    notesList: document.getElementById('notes-list'),
    // Links UI
    showLinkFormBtn: document.getElementById('show-link-form-btn'),
    newLinkForm: document.getElementById('new-link-form'),
    linkUrlInput: document.getElementById('link-url-input'),
    linkNameInput: document.getElementById('link-name-input'),
    linkCategoryInput: document.getElementById('link-category-input'),
    linkCategoryOptions: document.getElementById('link-category-options'),
    addNewCategoryBtn: document.getElementById('add-new-category-btn'),
    addLinkBtn: document.getElementById('add-link-btn'),
    linksList: document.getElementById('links-list'),
};

// --- Data Storage ---
const getStoredData = (key) => {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error(`Error reading ${key} from localStorage`, e);
        return [];
    }
};

const setStoredData = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Error writing ${key} to localStorage`, e);
    }
};

// --- Notes Logic ---
const renderNotes = () => {
    const notes = getStoredData('userNotes');
    if (notes.length === 0) {
        utilityUI.notesList.innerHTML = `<p class="text-sm text-gray-500 text-center">Chưa có ghi chú nào.</p>`;
        return;
    }
    utilityUI.notesList.innerHTML = notes.sort((a, b) => b.createdAt - a.createdAt).map(note => `
        <div class="note-item">
            <p class="note-content">${note.content}</p>
            <div class="note-actions">
                <span class="text-xs text-gray-400 mr-2">${new Date(note.createdAt).toLocaleString('vi-VN')}</span>
                <button data-note-id="${note.id}" class="delete-note-btn"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `).join('');
};

const addNote = () => {
    const content = utilityUI.noteInput.value.trim();
    if (!content) return;

    const notes = getStoredData('userNotes');
    const newNote = {
        id: `note_${Date.now()}`,
        content: content,
        createdAt: Date.now(),
    };
    notes.push(newNote);
    setStoredData('userNotes', notes);
    utilityUI.noteInput.value = '';
    renderNotes();
    // Hide form and show button again
    utilityUI.newNoteForm.classList.add('hidden');
    utilityUI.showNoteFormBtn.classList.remove('hidden');
};

const deleteNote = (noteId) => {
    let notes = getStoredData('userNotes');
    notes = notes.filter(note => note.id !== noteId);
    setStoredData('userNotes', notes);
    renderNotes();
};

// --- Links Logic ---
const renderLinks = () => {
    const links = getStoredData('userLinks');
    if (links.length === 0) {
        utilityUI.linksList.innerHTML = `<p class="text-sm text-gray-500 text-center">Chưa có link nào được lưu.</p>`;
        return;
    }

    const linksByCategory = links.reduce((acc, link) => {
        const category = link.category || 'Chưa phân loại';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(link);
        return acc;
    }, {});

    utilityUI.linksList.innerHTML = Object.keys(linksByCategory).sort().map(category => `
        <div class="link-category">
            <h4 class="link-category-title">${category}</h4>
            <div class="space-y-1">
                ${linksByCategory[category].map(link => `
                    <div class="link-item">
                        <a href="${link.url}" target="_blank" rel="noopener noreferrer" title="${link.url}">${link.name}</a>
                        <div class="link-item-actions">
                            <button data-link-id="${link.id}" class="delete-link-btn"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
};

const populateLinkCategoryOptions = (filter = '') => {
    const links = getStoredData('userLinks');
    const categories = [...new Set(links.map(link => link.category).filter(Boolean))].sort();
    
    const filtered = categories.filter(c => c.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0 && !filter) {
        utilityUI.linkCategoryOptions.innerHTML = `<div class="custom-select-option text-gray-500">Chưa có danh mục.</div>`;
    } else {
        utilityUI.linkCategoryOptions.innerHTML = filtered.map(c => `
            <div class="custom-select-option" data-value="${c}">${c}</div>
        `).join('');
    }
};

const setLinkCategoryOptionsVisible = (visible) => {
    utilityUI.linkCategoryOptions.classList.toggle('visible', visible);
};

const addLink = () => {
    const url = utilityUI.linkUrlInput.value.trim();
    const name = utilityUI.linkNameInput.value.trim();
    const category = utilityUI.linkCategoryInput.value.trim();

    if (!url || !name || !category) {
        showMessage('Lỗi', 'Vui lòng điền đầy đủ URL, Tên link và Danh mục.', true);
        return;
    }
    
    // Basic URL validation
    try {
        new URL(url);
    } catch (_) {
        showMessage('Lỗi', 'URL không hợp lệ. Vui lòng bao gồm http:// hoặc https://', true);
        return;
    }

    const links = getStoredData('userLinks');
    const newLink = {
        id: `link_${Date.now()}`,
        url,
        name,
        category,
    };
    links.push(newLink);
    setStoredData('userLinks', links);
    
    // Reset form
    utilityUI.linkUrlInput.value = '';
    utilityUI.linkNameInput.value = '';
    utilityUI.linkCategoryInput.value = '';
    
    renderLinks();

    // Hide form and show button again
    utilityUI.newLinkForm.classList.add('hidden');
    utilityUI.showLinkFormBtn.classList.remove('hidden');
};

const deleteLink = (linkId) => {
    let links = getStoredData('userLinks');
    links = links.filter(link => link.id !== linkId);
    setStoredData('userLinks', links);
    renderLinks();
};


// --- Event Listeners ---
if (utilityUI.fab) {
    utilityUI.fab.addEventListener('click', () => {
        utilityUI.popup.classList.toggle('hidden');
    });

    utilityUI.closeBtn.addEventListener('click', () => {
        utilityUI.popup.classList.add('hidden');
    });

    utilityUI.notesTab.addEventListener('click', () => {
        utilityUI.notesTab.classList.add('active');
        utilityUI.linksTab.classList.remove('active');
        utilityUI.notesContent.classList.remove('hidden');
        utilityUI.linksContent.classList.add('hidden');
    });

    utilityUI.linksTab.addEventListener('click', () => {
        utilityUI.linksTab.classList.add('active');
        utilityUI.notesTab.classList.remove('active');
        utilityUI.linksContent.classList.remove('hidden');
        utilityUI.notesContent.classList.add('hidden');
    });

    utilityUI.addNoteBtn.addEventListener('click', addNote);
    utilityUI.addLinkBtn.addEventListener('click', addLink);

    utilityUI.showNoteFormBtn.addEventListener('click', () => {
        utilityUI.newNoteForm.classList.remove('hidden');
        utilityUI.showNoteFormBtn.classList.add('hidden');
    });

    utilityUI.showLinkFormBtn.addEventListener('click', () => {
        utilityUI.newLinkForm.classList.remove('hidden');
        utilityUI.showLinkFormBtn.classList.add('hidden');
    });

    // --- Link Category Input Logic ---
    utilityUI.linkCategoryInput.addEventListener('focus', () => {
        populateLinkCategoryOptions(utilityUI.linkCategoryInput.value);
        setLinkCategoryOptionsVisible(true);
    });

    utilityUI.linkCategoryInput.addEventListener('input', () => {
        populateLinkCategoryOptions(utilityUI.linkCategoryInput.value);
        if (!utilityUI.linkCategoryOptions.classList.contains('visible')) {
            setLinkCategoryOptionsVisible(true);
        }
    });

    utilityUI.linkCategoryOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-select-option');
        if (option && option.dataset.value) {
            utilityUI.linkCategoryInput.value = option.dataset.value;
            setLinkCategoryOptionsVisible(false);
        }
    });

    utilityUI.addNewCategoryBtn.addEventListener('click', () => {
        const newCategory = utilityUI.linkCategoryInput.value.trim();
        if (!newCategory) {
            showMessage('Thông báo', 'Vui lòng nhập tên danh mục để thêm.');
            return;
        }
        
        const links = getStoredData('userLinks');
        const categories = [...new Set(links.map(link => link.category).filter(Boolean))];
        
        if (categories.includes(newCategory)) {
            showMessage('Thông báo', `Danh mục "${newCategory}" đã tồn tại.`);
        } else {
            // To "add" a category, we just need to ensure it's in the list for the next render.
            // A simple way is to add a dummy link and then immediately remove it,
            // or more cleanly, just add it to the list of categories for the dropdown.
            // For now, we can just let the `addLink` function handle the creation of a new category.
            showMessage('Thành công', `Danh mục "${newCategory}" sẽ được tạo khi bạn lưu link.`);
        }
        setLinkCategoryOptionsVisible(false);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-container')) {
            setLinkCategoryOptionsVisible(false);
        }
    });

    utilityUI.notesList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-note-btn');
        if (deleteBtn) {
            const noteId = deleteBtn.dataset.noteId;
            showConfirmation('Xóa ghi chú?', 'Bạn có chắc chắn muốn xóa ghi chú này không?', () => deleteNote(noteId));
        }
    });

    utilityUI.linksList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-link-btn');
        if (deleteBtn) {
            const linkId = deleteBtn.dataset.linkId;
            deleteLink(linkId);
        }
    });

// Initial render on load
document.addEventListener('DOMContentLoaded', () => {
    renderNotes();
    renderLinks();
    // Add a general click listener to hide the link category options
    document.addEventListener('click', (e) => {
        if (!utilityUI.linkCategoryInput.contains(e.target) && !utilityUI.linkCategoryOptions.contains(e.target)) {
            setLinkCategoryOptionsVisible(false);
        }
    });
});

// --- Collapse forms on empty area click ---
if (utilityUI.notesContent) {
    utilityUI.notesContent.addEventListener('click', (e) => {
        if (!utilityUI.newNoteForm.contains(e.target) && !utilityUI.showNoteFormBtn.contains(e.target)) {
            utilityUI.newNoteForm.classList.add('hidden');
            utilityUI.showNoteFormBtn.classList.remove('hidden');
        }
    });
}

if (utilityUI.linksContent) {
    utilityUI.linksContent.addEventListener('click', (e) => {
        if (!utilityUI.newLinkForm.contains(e.target) && !utilityUI.showLinkFormBtn.contains(e.target)) {
            utilityUI.newLinkForm.classList.add('hidden');
            utilityUI.showLinkFormBtn.classList.remove('hidden');
        }
    });
}
}
