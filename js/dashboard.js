import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// 1. AUTHENTICATION & GLOBALS
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('adminEmailDisplay').innerText = user.email;
        document.getElementById('adminAvatarLetter').innerText = user.email.charAt(0).toUpperCase();
    } else {
        window.location.href = "index.html";
    }
});
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

const statTotalStudents = document.getElementById('statTotalStudents');
const statPresentToday = document.getElementById('statPresentToday');
const statPendingFees = document.getElementById('statPendingFees');
const pendingFeesNamesDiv = document.getElementById('pendingFeesNames');
const statAvailableSeats = document.getElementById('statAvailableSeats');
const statTotalCapacity = document.getElementById('statTotalCapacity');

const recentActivityTable = document.getElementById('recentActivityTable');
const pendingApprovalsTable = document.getElementById('pendingApprovalsTable');
const allStudentsTable = document.getElementById('allStudentsTable');
const profileModal = document.getElementById('profileModal');
const feesTable = document.getElementById('feesTable');

// Filters & Badges
const searchAllStudents = document.getElementById('searchAllStudents');
const filterAllStudentsStatus = document.getElementById('filterAllStudentsStatus');
const pendingBadgeSidebar = document.getElementById('pendingBadgeSidebar');

const seatSearchQuery = document.getElementById('seatSearchQuery');
const seatFilterStatus = document.getElementById('seatFilterStatus');
const seatGrid = document.getElementById('seatGrid');
const countOccupiedSeats = document.getElementById('countOccupiedSeats');
const countEmptySeats = document.getElementById('countEmptySeats');

const toggleEditModeBtn = document.getElementById('toggleEditModeBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');

// QR, Features & Attendance Elements
const qrIpAddress = document.getElementById('qrIpAddress');
const btnFetchIp = document.getElementById('btnFetchIp');
const btnGenerateQR = document.getElementById('btnGenerateQR');
const btnUpdateIpOnly = document.getElementById('btnUpdateIpOnly');
const qrCodeContainer = document.getElementById('qrCodeContainer');
const qrCodeImage = document.getElementById('qrCodeImage');
const qrStatusText = document.getElementById('qrStatusText');
const toggleIpFeature = document.getElementById('toggleIpFeature');
const toggleQrUploadFeature = document.getElementById('toggleQrUploadFeature');
const manualAttendanceTable = document.getElementById('manualAttendanceTable');
const searchAttendance = document.getElementById('searchAttendance');

let currentAttendanceData = {};
let currentQRHash = ""; // Global state for current Hash

// Date Variables
const today = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const date = today.getDate();
const monthStr = months[today.getMonth()];
const year = today.getFullYear();
const dateString1 = `${date < 10 ? '0'+date : date} ${monthStr} ${year}`;
const dateString2 = `${date} ${monthStr} ${year}`;

// Initialize Display
document.getElementById('todayDateDisplay').innerText = dateString1; 

let allStudentsDict = JSON.parse(localStorage.getItem('allStudentsDataCache')) || {}; 
let allPaymentsDict = JSON.parse(localStorage.getItem('allPaymentsDataCache')) || {};
let globalTotalSeats = 100; 

function parseRegDate(dateStr) {
    if(!dateStr) return new Date(0); 
    try {
        const parts = dateStr.split('__');
        if(parts.length !== 2) return new Date(0);
        const dParts = parts[0].split('-');
        const tParts = parts[1].split('-');
        return new Date(dParts[2], dParts[1]-1, dParts[0], tParts[0], tParts[1]);
    } catch(e) { return new Date(0); }
}

// 🔥 FEE CALCULATORS 
function checkFeeStatus(validTillStr) {
    if(!validTillStr) return "Due";
    try {
        const parts = validTillStr.trim().split(' ');
        if(parts.length < 3) return "Due";
        const day = parseInt(parts[0]);
        const monthName = parts[1];
        const yr = parseInt(parts[2]);
        const monthIdx = months.indexOf(monthName);
        if(monthIdx === -1) return "Due";

        const validDate = new Date(yr, monthIdx, day, 23, 59, 59);
        return today <= validDate ? "Paid" : "Due";
    } catch(e) { return "Due"; }
}

function getLatestPaidMonth(studentKey) {
    const studentPayments = allPaymentsDict[studentKey];
    if(!studentPayments) return "No Payment Record";
    let monthsList = Object.keys(studentPayments);
    if(monthsList.length === 0) return "No Payment Record";
    monthsList.sort((a, b) => new Date("01 " + b) - new Date("01 " + a));
    return monthsList[0]; 
}

// ==========================================
// 2. CACHE MANAGER
// ==========================================
function loadCachedDashboard() {
    const cachedData = JSON.parse(localStorage.getItem('adminDashboardCache'));
    if (cachedData) {
        statTotalStudents.innerText = cachedData.totalActive || 0;
        statPendingFees.innerText = cachedData.pendingFees || 0;
        statTotalCapacity.innerText = cachedData.totalSeats || 100;
        statAvailableSeats.innerText = (cachedData.totalSeats || 100) - (cachedData.occupiedSeats || 0);
        statPresentToday.innerText = cachedData.presentCount || 0;
        pendingFeesNamesDiv.innerText = cachedData.pendingNamesStr || "No dues pending";
        
        if(cachedData.recentHTML) recentActivityTable.innerHTML = cachedData.recentHTML;
        if(cachedData.pendingHTML) pendingApprovalsTable.innerHTML = cachedData.pendingHTML;
        if(cachedData.allStudentsHTML) allStudentsTable.innerHTML = cachedData.allStudentsHTML;
        if(cachedData.feesHTML) feesTable.innerHTML = cachedData.feesHTML;
        
        if(cachedData.pendingCountBadge && cachedData.pendingCountBadge > 0) {
            pendingBadgeSidebar.innerText = cachedData.pendingCountBadge;
            pendingBadgeSidebar.classList.remove('hidden');
        } else {
            pendingBadgeSidebar.classList.add('hidden');
        }
    }
    renderSeatMap(); 
}
loadCachedDashboard();

// ==========================================
// 3. FIREBASE REALTIME FETCHERS
// ==========================================
onValue(ref(db, 'Payments'), (snapshot) => {
    if(snapshot.exists()) {
        allPaymentsDict = snapshot.val();
        localStorage.setItem('allPaymentsDataCache', JSON.stringify(allPaymentsDict));
        onValue(ref(db, 'Students'), studentSnapshotHandler);
    }
});

onValue(ref(db, 'totalSeat'), (snapshot) => {
    if (snapshot.exists()) {
        globalTotalSeats = snapshot.val();
        statTotalCapacity.innerText = globalTotalSeats;
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalSeats = globalTotalSeats;
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
        renderSeatMap();
    }
});

const studentSnapshotHandler = (snapshot) => {
    let totalActive = 0, occupiedSeats = 0, pendingCount = 0;
    let pendingHTML = '', allHTML = '', feesHTML = '';
    let activeStudentsList = [];
    let pendingFeeNames = [];
    
    allStudentsDict = {}; 

    if (snapshot.exists()) {
        snapshot.forEach((childSnap) => {
            const student = childSnap.val();
            const studentKey = childSnap.key;
            allStudentsDict[studentKey] = student;
            
            const photo = student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName || 'User'}&background=0D8ABC&color=fff`;
            const currentFeeStatus = checkFeeStatus(student.validTill);
            const latestPaid = getLatestPaidMonth(studentKey);
            
            let feeColor = currentFeeStatus === "Paid" ? "text-emerald-400" : "text-red-400 font-bold";
            let feeText = currentFeeStatus === "Paid" ? "Paid" : `Due (₹${student.dueAmount || 0})`;
            let feeChipColor = currentFeeStatus === "Paid" ? "bg-emerald-900/40 border-emerald-500/30 text-emerald-400" : "bg-red-900/40 border-red-500/30 text-red-400 font-bold shadow-[0_0_8px_rgba(239,68,68,0.3)]";

            let statusChipColor = "bg-slate-900/60 text-slate-400 border border-slate-500/30";
            if(student.status === "Approved") statusChipColor = "bg-emerald-900/60 text-emerald-400 border border-emerald-500/30";
            else if(student.status === "Pending") statusChipColor = "bg-amber-900/60 text-amber-400 border border-amber-500/30";
            else if(student.status === "Rejected") statusChipColor = "bg-red-900/60 text-red-400 border border-red-500/30";

            allHTML += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800/60 transition-all cursor-pointer btn-open-profile" data-key="${studentKey}" data-status="${student.status || 'Unknown'}">
                    <td class="px-4 py-3 flex items-center pointer-events-none">
                        <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border border-cyan-500/50 mr-3 object-cover">
                        <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">${student.mobile || 'No Mobile'}</div></div>
                    </td>
                    <td class="px-4 py-3 text-xs md:text-sm text-cyan-400 font-bold pointer-events-none">${student.seatNumber || 'N/A'}</td>
                    <td class="px-4 py-3 text-xs md:text-sm ${feeColor} pointer-events-none">${feeText}</td>
                    <td class="px-4 py-3 text-xs md:text-sm text-slate-300 pointer-events-none">${student.validTill || '--'}</td>
                    <td class="px-4 py-3 pointer-events-none"><span class="px-2 py-1 rounded text-[10px] md:text-xs tracking-wide ${statusChipColor}">${student.status || 'Unknown'}</span></td>
                </tr>`;

            if (student.status === "Approved") {
                totalActive++;
                if (student.seatNumber && student.seatNumber.trim() !== "") occupiedSeats++;
                if (currentFeeStatus === "Due") pendingFeeNames.push(student.fullName || studentKey);
                activeStudentsList.push({ ...student, key: studentKey, photo, feeColor, feeText });

                feesHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/60 transition-all cursor-pointer btn-open-fee-history" data-key="${studentKey}" data-name="${student.fullName || studentKey}">
                        <td class="px-4 py-4 flex items-center pointer-events-none">
                            <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border border-slate-600 mr-3 object-cover">
                            <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">Seat: ${student.seatNumber || 'N/A'}</div></div>
                        </td>
                        <td class="px-4 py-4 text-xs md:text-sm text-slate-300 pointer-events-none">${student.validTill || '--'}</td>
                        <td class="px-4 py-4 pointer-events-none"><span class="px-2 py-1 rounded border text-xs ${feeChipColor}">${feeText}</span></td>
                        <td class="px-4 py-4 text-xs md:text-sm text-amber-400 pointer-events-none">${latestPaid}</td>
                        <td class="px-4 py-4 pointer-events-none"><button class="bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-[0_0_8px_rgba(16,185,129,0.2)]">History</button></td>
                    </tr>`;
            }

            if (student.status === "Pending") {
                pendingCount++;
                pendingHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/60 transition-all cursor-pointer btn-open-profile" data-key="${studentKey}" data-type="approve">
                        <td class="px-4 py-3 flex items-center pointer-events-none">
                            <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-amber-500 mr-3 object-cover shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                            <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">${studentKey}</div></div>
                        </td>
                        <td class="px-4 py-3 pointer-events-none"><div class="text-slate-300 text-xs md:text-sm">${student.mobile || 'N/A'}</div><div class="text-[10px] md:text-xs text-slate-500 truncate w-24 md:w-32" title="${student.address || ''}">${student.address || 'N/A'}</div></td>
                        <td class="px-4 py-3 text-amber-400 font-medium text-xs md:text-sm pointer-events-none">${student.membership || 'N/A'}</td>
                        <td class="px-4 py-3 pointer-events-none"><button class="bg-amber-600/20 text-amber-400 border border-amber-500/50 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">Review</button></td>
                    </tr>`;
            }
        });

        activeStudentsList.sort((a, b) => parseRegDate(b.registrationTime) - parseRegDate(a.registrationTime));
        let recentHTML = '';
        activeStudentsList.slice(0, 6).forEach(s => {
            recentHTML += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800/60 transition-all cursor-pointer btn-open-profile" data-key="${s.key}">
                    <td class="px-4 py-3 flex items-center pointer-events-none">
                        <img src="${s.photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-slate-600 mr-3 object-cover">
                        <div><div class="text-white font-medium text-xs md:text-sm">${s.fullName || s.key}</div><div class="text-[10px] md:text-xs text-slate-500">Seat: ${s.seatNumber || 'N/A'}</div></div>
                    </td>
                    <td class="px-4 py-3 text-xs md:text-sm ${s.feeColor} pointer-events-none">${s.feeText}</td>
                    <td class="px-4 py-3 text-xs md:text-sm text-slate-300 pointer-events-none">${s.validTill || '--'}</td>
                    <td class="px-4 py-3 pointer-events-none"><span class="bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-[10px] md:text-xs tracking-wide">Active</span></td>
                </tr>`;
        });
        
        statTotalStudents.innerText = totalActive; 
        statPendingFees.innerText = pendingFeeNames.length; 
        statAvailableSeats.innerText = globalTotalSeats - occupiedSeats; 
        
        const pendingNamesStr = pendingFeeNames.length > 0 ? pendingFeeNames.join(', ') : "No dues pending 🎉";
        pendingFeesNamesDiv.innerText = pendingNamesStr;

        recentActivityTable.innerHTML = recentHTML !== '' ? recentHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No active students.</td></tr>`;
        pendingApprovalsTable.innerHTML = pendingHTML !== '' ? pendingHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No pending approvals! 🎉</td></tr>`;
        allStudentsTable.innerHTML = allHTML !== '' ? allHTML : `<tr><td colspan="5" class="text-center py-8 text-slate-500">No active students found.</td></tr>`;
        feesTable.innerHTML = feesHTML !== '' ? feesHTML : `<tr><td colspan="5" class="text-center py-8 text-slate-500">No records found.</td></tr>`;

        if (pendingCount > 0) {
            pendingBadgeSidebar.innerText = pendingCount; pendingBadgeSidebar.classList.remove('hidden');
        } else {
            pendingBadgeSidebar.classList.add('hidden');
        }

        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalActive = totalActive; cache.pendingFees = pendingFeeNames.length; cache.occupiedSeats = occupiedSeats;
        cache.pendingNamesStr = pendingNamesStr; cache.pendingCountBadge = pendingCount;
        cache.recentHTML = recentHTML; cache.pendingHTML = pendingHTML; cache.allStudentsHTML = allHTML; cache.feesHTML = feesHTML;
        
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
        localStorage.setItem('allStudentsDataCache', JSON.stringify(allStudentsDict));
        
        renderSeatMap();
        filterAllStudentsTable(); 
        renderManualAttendanceTable(searchAttendance.value); 
    }
};
onValue(ref(db, 'Students'), studentSnapshotHandler);

// ==========================================
// 4. SEAT MATRIX RENDER ENGINE
// ==========================================
function renderSeatMap() {
    if(!seatSearchQuery || !seatFilterStatus) return;
    const query = seatSearchQuery.value.toLowerCase();
    const status = seatFilterStatus.value;
    
    let seatMap = {}; let occupiedCount = 0;
    for (let key in allStudentsDict) {
        const student = allStudentsDict[key];
        if (student.status === "Approved" && student.seatNumber && student.seatNumber.trim() !== "") {
            seatMap[student.seatNumber.trim().toLowerCase()] = {
                seatNum: student.seatNumber.trim(), name: student.fullName || key,
                photo: student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName || 'User'}&background=0D8ABC&color=fff`, key: key
            };
        }
    }

    let allSeats = []; let emptyCount = 0;
    for (let i = 1; i <= globalTotalSeats; i++) {
        let seatStr = i.toString(); let occupant = seatMap[seatStr.toLowerCase()];
        if (occupant) { allSeats.push({ type: 'occupied', seat: occupant.seatNum, name: occupant.name, photo: occupant.photo, key: occupant.key }); occupiedCount++; } 
        else { allSeats.push({ type: 'empty', seat: seatStr, name: 'Available', photo: null, key: null }); emptyCount++; }
    }

    let filtered = allSeats.filter(s => {
        let matchStatus = true;
        if(status === 'occupied' && s.type !== 'occupied') matchStatus = false;
        if(status === 'empty' && s.type !== 'empty') matchStatus = false;
        let matchQuery = true;
        if(query !== '') matchQuery = s.seat.toLowerCase().includes(query) || s.name.toLowerCase().includes(query);
        return matchStatus && matchQuery;
    });

    let html = '';
    filtered.forEach(s => {
        if (s.type === 'occupied') {
            html += `
            <div class="glass-card bg-slate-800/80 border-t-4 border-t-red-500 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-700 transition-colors btn-open-profile shadow-[0_4px_10px_rgba(239,68,68,0.15)]" data-key="${s.key}" title="Click to view profile">
                <img src="${s.photo}" class="w-12 h-12 rounded-full border-2 border-red-500/50 mb-2 object-cover pointer-events-none">
                <h4 class="text-white font-bold text-sm w-full truncate pointer-events-none">Seat #${s.seat}</h4>
                <p class="text-xs text-slate-400 w-full truncate pointer-events-none">${s.name}</p>
            </div>`;
        } else {
            html += `
            <div class="glass-card bg-slate-800/40 border-t-4 border-t-emerald-500 rounded-xl p-3 flex flex-col items-center justify-center text-center border-dashed border-slate-600">
                <div class="w-10 h-10 rounded-full border-2 border-emerald-500/30 mb-1 flex items-center justify-center bg-emerald-900/20"><span class="text-xs text-emerald-400 font-bold">${s.seat}</span></div>
                <h4 class="text-emerald-400 font-bold text-xs truncate">Empty</h4><p class="text-[9px] text-slate-500">Available</p>
            </div>`;
        }
    });
    seatGrid.innerHTML = html !== '' ? html : `<div class="col-span-full text-center text-slate-500 py-10">No seats match your search.</div>`;
    countOccupiedSeats.innerText = occupiedCount; countEmptySeats.innerText = globalTotalSeats - occupiedCount >= 0 ? globalTotalSeats - occupiedCount : emptyCount;
}
seatSearchQuery.addEventListener('input', renderSeatMap); seatFilterStatus.addEventListener('change', renderSeatMap);

// ==========================================
// 5. ALL STUDENTS FILTER ENGINE
// ==========================================
function filterAllStudentsTable() {
    const query = searchAllStudents.value.toLowerCase();
    const status = filterAllStudentsStatus.value;
    const rows = allStudentsTable.getElementsByTagName('tr');
    for (let row of rows) {
        if(row.children.length === 1) continue; 
        const text = row.innerText.toLowerCase();
        const rowStatus = row.getAttribute('data-status');
        const matchQuery = text.includes(query);
        const matchStatus = (status === 'All' || rowStatus === status);
        row.style.display = (matchQuery && matchStatus) ? '' : 'none';
    }
}
searchAllStudents.addEventListener('input', filterAllStudentsTable); filterAllStudentsStatus.addEventListener('change', filterAllStudentsTable);

// ==========================================
// 6. PROFILE MODAL LOGIC 
// ==========================================
let isEditingMode = false;
document.addEventListener('click', (e) => {
    const btnProfile = e.target.closest('.btn-open-profile');
    if (btnProfile) openProfileModal(btnProfile.getAttribute('data-key'), btnProfile.getAttribute('data-type') === 'approve');
    const btnFee = e.target.closest('.btn-open-fee-history');
    if (btnFee) openFeeHistoryModal(btnFee.getAttribute('data-key'), btnFee.getAttribute('data-name'));
});

function openProfileModal(studentKey, isApprovalMode = false) {
    const student = allStudentsDict[studentKey];
    if(!student) return alert("Data not synced yet.");
    isEditingMode = false; setProfileInputsEditable(false);
    document.getElementById('modalStudentKey').value = studentKey;
    document.getElementById('editFullName').value = student.fullName || ''; document.getElementById('editMobile').value = student.mobile || '';
    document.getElementById('editPassword').value = student.password || ''; document.getElementById('editAddress').value = student.address || '';
    document.getElementById('editMembership').value = student.membership || ''; document.getElementById('editRegTime').value = student.registrationTime || '';
    document.getElementById('editPhotoUrl').value = student.photoUrl || ''; document.getElementById('editIdProofUrl').value = student.idProofUrl || '';
    document.getElementById('modalPhotoPreview').src = student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName || 'User'}&background=0D8ABC&color=fff`;
    
    const idBtn = document.getElementById('btnViewId');
    if (student.idProofUrl) { idBtn.href = student.idProofUrl; idBtn.classList.remove('opacity-50', 'pointer-events-none'); } 
    else { idBtn.href = '#'; idBtn.classList.add('opacity-50', 'pointer-events-none'); }
    
    document.getElementById('adminAccountStatus').value = student.status || 'Approved'; 
    document.getElementById('adminSeatNumber').value = student.seatNumber || '';
    document.getElementById('adminValidTill').value = student.validTill || ''; 
    document.getElementById('adminDueAmount').value = student.dueAmount || '0';
    document.getElementById('displayFeeStatus').value = checkFeeStatus(student.validTill);
    document.getElementById('displayLastPaid').value = getLatestPaidMonth(studentKey);

    if (isApprovalMode) {
        document.getElementById('modalMainTitle').innerText = "Review & Approve Student"; document.getElementById('modalIcon').innerText = "⚡"; 
        toggleEditModeBtn.classList.add('hidden'); saveProfileBtn.classList.remove('hidden'); setProfileInputsEditable(true);
        document.getElementById('adminAccountStatus').value = 'Approved'; document.getElementById('adminValidTill').value = `30 ${monthStr} ${year}`; 
    } else {
        document.getElementById('modalMainTitle').innerText = "Student Profile (View Mode)"; document.getElementById('modalIcon').innerText = "👁️"; 
        toggleEditModeBtn.classList.remove('hidden'); toggleEditModeBtn.innerHTML = `<span class="mr-2">✏️</span> Enable Edit Mode`; saveProfileBtn.classList.add('hidden');
    }
    profileModal.classList.remove('hidden');
}

function setProfileInputsEditable(enable) { document.querySelectorAll('.profile-input').forEach(input => input.disabled = !enable); }

toggleEditModeBtn.addEventListener('click', () => {
    isEditingMode = !isEditingMode; setProfileInputsEditable(isEditingMode);
    if(isEditingMode) {
        document.getElementById('modalMainTitle').innerText = "Edit Student Profile"; document.getElementById('modalIcon').innerText = "✏️";
        toggleEditModeBtn.innerHTML = `<span class="mr-2">🔒</span> Lock / View Mode`; saveProfileBtn.classList.remove('hidden');
    } else {
        document.getElementById('modalMainTitle').innerText = "Student Profile (View Mode)"; document.getElementById('modalIcon').innerText = "👁️";
        toggleEditModeBtn.innerHTML = `<span class="mr-2">✏️</span> Enable Edit Mode`; saveProfileBtn.classList.add('hidden');
    }
});

const closeModal = () => profileModal.classList.add('hidden');
document.getElementById('closeProfileModalBtn').addEventListener('click', closeModal); document.getElementById('cancelProfileBtn').addEventListener('click', closeModal);

saveProfileBtn.addEventListener('click', async () => {
    const studentKey = document.getElementById('modalStudentKey').value; const btn = document.getElementById('saveProfileBtn');
    const updates = {
        fullName: document.getElementById('editFullName').value.trim(), mobile: document.getElementById('editMobile').value.trim(),
        password: document.getElementById('editPassword').value.trim(), address: document.getElementById('editAddress').value.trim(),
        membership: document.getElementById('editMembership').value.trim(), photoUrl: document.getElementById('editPhotoUrl').value.trim(),
        idProofUrl: document.getElementById('editIdProofUrl').value.trim(), status: document.getElementById('adminAccountStatus').value,
        seatNumber: document.getElementById('adminSeatNumber').value.trim(), validTill: document.getElementById('adminValidTill').value.trim(),
        dueAmount: parseInt(document.getElementById('adminDueAmount').value) || 0
    };
    if (updates.status === "Approved" && (!updates.seatNumber || !updates.validTill)) return alert("Please allot a Seat Number and Valid Till date.");
    try {
        btn.innerHTML = `<span class="mr-2">⏳</span> Saving...`; btn.disabled = true;
        await update(ref(db, `Students/${studentKey}`), updates);
        alert(`Success! Profile updated.`); closeModal();
    } catch (error) { alert("Something went wrong!"); } 
    finally { btn.innerHTML = `<span class="mr-2">✅</span> Save Changes`; btn.disabled = false; }
});

// ==========================================
// 7. FEES HISTORY & ADD PAYMENT ENGINE
// ==========================================
const feeHistoryModal = document.getElementById('feeHistoryModal');
const closeFeeHistoryModal = () => feeHistoryModal.classList.add('hidden');
document.getElementById('closeFeeHistoryBtn').addEventListener('click', closeFeeHistoryModal);

function openFeeHistoryModal(studentKey, studentName) {
    document.getElementById('feeStudentKey').value = studentKey; document.getElementById('feeStudentName').innerText = studentName;
    const historyList = document.getElementById('feeHistoryList');
    const payments = allPaymentsDict[studentKey] || {}; let keys = Object.keys(payments);
    if(keys.length === 0) { historyList.innerHTML = `<div class="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-700 rounded-lg">No payment history found.</div>`; } 
    else {
        keys.sort((a, b) => new Date("01 " + b) - new Date("01 " + a));
        let hHTML = '';
        keys.forEach(k => {
            let p = payments[k];
            hHTML += `<div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex justify-between items-center hover:bg-slate-800 transition-colors shadow-sm">
                <div><h4 class="text-emerald-400 font-bold text-sm mb-1">${k}</h4><p class="text-[11px] text-slate-400">Duration: <span class="text-slate-200">${p.d2d || '--'}</span></p><p class="text-[10px] text-slate-500 mt-0.5">Paid on: ${p.payDate || '--'}</p></div>
                <div class="text-white font-bold text-lg bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-500/20">₹${p.amount || 0}</div></div>`;
        });
        historyList.innerHTML = hHTML;
    }
    const todayStr = `${year}-${(today.getMonth()+1).toString().padStart(2, '0')}`;
    document.getElementById('payMonthInput').value = todayStr; document.getElementById('payMonthPreview').innerText = `${monthStr} ${year}`;
    document.getElementById('payAmount').value = ''; document.getElementById('payD2DStart').value = ''; document.getElementById('payD2DEnd').value = ''; document.getElementById('payD2DPreview').innerText = '--';
    const currDue = (allStudentsDict[studentKey] && allStudentsDict[studentKey].dueAmount) ? allStudentsDict[studentKey].dueAmount : 0;
    document.getElementById('payNewValidTill').value = ''; document.getElementById('payNewDue').value = currDue;
    feeHistoryModal.classList.remove('hidden');
}

document.getElementById('payMonthInput').addEventListener('change', (e) => {
    let val = e.target.value;
    if(val) { let [yr, mo] = val.split('-'); document.getElementById('payMonthPreview').innerText = `${months[parseInt(mo)-1]} ${yr}`; }
});
function updateD2DAndValidTill() {
    const startVal = document.getElementById('payD2DStart').value; const endVal = document.getElementById('payD2DEnd').value;
    if(startVal && endVal) {
        let sDate = new Date(startVal); let eDate = new Date(endVal);
        let sDay = sDate.getDate() < 10 ? '0'+sDate.getDate() : sDate.getDate(); let sMon = months[sDate.getMonth()].substring(0,3);
        let eDay = eDate.getDate() < 10 ? '0'+eDate.getDate() : eDate.getDate(); let eMon = months[eDate.getMonth()].substring(0,3);
        let eMonFull = months[eDate.getMonth()]; let eYear = eDate.getFullYear();
        document.getElementById('payD2DPreview').innerText = `${sDay} ${sMon} - ${eDay} ${eMon}`;
        document.getElementById('payNewValidTill').value = `${eDay} ${eMonFull} ${eYear}`;
    }
}
document.getElementById('payD2DStart').addEventListener('change', updateD2DAndValidTill); document.getElementById('payD2DEnd').addEventListener('change', updateD2DAndValidTill);

document.getElementById('confirmFeePaymentBtn').addEventListener('click', async () => {
    const studentKey = document.getElementById('feeStudentKey').value; const btn = document.getElementById('confirmFeePaymentBtn');
    const monthVal = document.getElementById('payMonthInput').value; const amount = document.getElementById('payAmount').value.trim();
    const d2dStr = document.getElementById('payD2DPreview').innerText; const newValidTill = document.getElementById('payNewValidTill').value.trim();
    const newDue = document.getElementById('payNewDue').value.trim();
    if (!monthVal || !amount || d2dStr === '--' || !newValidTill) return alert("Please fill Month, Amount, and D2D Dates.");
    const [yr, mo] = monthVal.split('-'); const formattedMonthYear = `${months[parseInt(mo)-1]} ${yr}`;
    try {
        btn.innerHTML = `⏳ Processing Data...`; btn.disabled = true;
        const updates = {};
        updates[`Payments/${studentKey}/${formattedMonthYear}`] = { amount: parseInt(amount), d2d: d2dStr, payDate: dateString1 };
        updates[`Students/${studentKey}/validTill`] = newValidTill; updates[`Students/${studentKey}/dueAmount`] = parseInt(newDue) || 0;
        await update(ref(db), updates); alert(`✅ Payment Saved`); closeFeeHistoryModal();
    } catch (error) { alert("Failed to save payment."); } 
    finally { btn.innerHTML = `✅ Save Payment & Update Valid Till`; btn.disabled = false; }
});
document.getElementById('searchFeesStudents').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase(); const rows = feesTable.getElementsByTagName('tr');
    for (let row of rows) { row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none'; }
});

// ==========================================
// 8. MANUAL ENTRY LOGIC
// ==========================================
document.getElementById('manualEntryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('manualUsername').value.trim();
    if(username.includes(' ')) return alert("Username cannot contain spaces!");
    const btn = document.getElementById('btnSaveManualEntry');
    try {
        btn.innerHTML = `<span class="mr-2">⏳</span> Processing...`; btn.disabled = true;
        const snapshot = await get(ref(db, `Students/${username}`));
        if (snapshot.exists()) return alert(`🚨 Username "${username}" is already taken!`);
        const currentDateTime = `${date < 10 ? '0'+date : date}-${today.getMonth()+1 < 10 ? '0'+(today.getMonth()+1) : today.getMonth()+1}-${year}__${today.getHours()}-${today.getMinutes()}`;
        await set(ref(db, `Students/${username}`), {
            fullName: document.getElementById('manualFullName').value.trim(), mobile: document.getElementById('manualMobile').value.trim(),
            password: document.getElementById('manualPassword').value.trim(), membership: document.getElementById('manualMembership').value.trim(),
            address: document.getElementById('manualAddress').value.trim(), seatNumber: document.getElementById('manualSeat').value.trim(),
            validTill: document.getElementById('manualValidTill').value.trim(), status: "Approved", registrationTime: currentDateTime, photoUrl: "", idProofUrl: ""
        });
        alert(`✅ Success! Student "${username}" registered.`);
        document.getElementById('manualEntryForm').reset(); document.getElementById('nav-dashboard').click();
    } catch (error) { alert("Network Error"); } 
    finally { btn.innerHTML = `<span class="mr-2">💾</span> Save Student Direct to System`; btn.disabled = false; }
});

// ==========================================
// 9. QR GENERATOR, IP FETCH & FEATURES
// ==========================================
// A. IP Fetcher
async function fetchMyIp() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        if(!qrIpAddress.value) qrIpAddress.value = data.ip; // Set only if empty initially
    } catch(e) { console.log("Failed to fetch public IP automatically."); }
}
fetchMyIp(); 
btnFetchIp.addEventListener('click', async () => {
    btnFetchIp.innerText = '⏳';
    try {
        const res = await fetch('https://api.ipify.org?format=json'); const data = await res.json();
        qrIpAddress.value = data.ip; 
    } catch(e) {}
    finally { btnFetchIp.innerText = '🔄'; }
});

// B. QR Logic
onValue(ref(db, 'QRConfig/current'), (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();
        currentQRHash = data.hash; 
        
        // Show existing QR info (Old QR remains valid until manually changed)
        qrIpAddress.value = data.allowedIP || data.wifi || qrIpAddress.value; 
        const qrDataString = JSON.stringify({ hash: data.hash }); // Minimal data for actual visual code
        qrCodeImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDataString)}`;
        qrCodeContainer.classList.remove('hidden');
        qrStatusText.innerHTML = `
            <span class="text-emerald-400 font-bold block mb-1">✅ Active QR Loaded</span>
            Current Binding: <span class="text-white">${data.allowedIP || 'None'}</span><br>
            Secret Hash: <span class="font-mono text-slate-500">${data.hash.substring(0,8)}...</span><br>
            <span class="text-[9px] mt-1 block">Created: ${data.date}</span>
        `;
    } else {
        qrStatusText.innerText = "No QR configuration found in database.";
        qrCodeContainer.classList.add('hidden');
    }
});

btnGenerateQR.addEventListener('click', async () => {
    const ip = qrIpAddress.value.trim() || "0.0.0.0";
    const randomHash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const qrPayload = { allowedIP: ip, hash: randomHash, date: dateString1, timestamp: Date.now() };

    try {
        btnGenerateQR.innerHTML = `⏳ Working...`; btnGenerateQR.disabled = true;
        await set(ref(db, 'QRConfig/current'), qrPayload);
    } catch(e) { alert("Error generating QR."); } 
    finally { btnGenerateQR.innerHTML = `✨ Generate New QR`; btnGenerateQR.disabled = false; }
});

btnUpdateIpOnly.addEventListener('click', async () => {
    const ip = qrIpAddress.value.trim();
    if(!ip) return alert("Please enter the Library Public IP first.");
    if(!currentQRHash) return alert("Please Generate a QR first before updating the IP.");
    
    try {
        btnUpdateIpOnly.innerHTML = `⏳ Working...`; btnUpdateIpOnly.disabled = true;
        await update(ref(db, 'QRConfig/current'), { allowedIP: ip });
        alert("✅ IP updated successfully without changing the QR Hash!");
    } catch(e) { alert("Error updating IP."); } 
    finally { btnUpdateIpOnly.innerHTML = `💾 Update IP Only`; btnUpdateIpOnly.disabled = false; }
});

// C. App Features Toggles
function syncAppToggle(elementId, statusValue) {
    const el = document.getElementById(elementId);
    el.setAttribute('data-status', statusValue || 'no');
}

onValue(ref(db, 'AppFeatures'), (snapshot) => {
    if(snapshot.exists()) {
        const data = snapshot.val();
        syncAppToggle('toggleIpFeature', data.Ip);
        syncAppToggle('toggleQrUploadFeature', data.QrUpload);
    }
});

toggleIpFeature.addEventListener('click', async function() {
    const current = this.getAttribute('data-status'); const newVal = current === 'yes' ? 'no' : 'yes';
    this.setAttribute('data-status', newVal);
    await update(ref(db, 'AppFeatures'), { Ip: newVal });
});

toggleQrUploadFeature.addEventListener('click', async function() {
    const current = this.getAttribute('data-status'); const newVal = current === 'yes' ? 'no' : 'yes';
    this.setAttribute('data-status', newVal);
    await update(ref(db, 'AppFeatures'), { QrUpload: newVal });
});


// ==========================================
// 10. MANUAL ATTENDANCE 
// ==========================================
onValue(ref(db, 'Attendance'), (snapshot) => {
    let presentCount = 0;
    if (snapshot.exists()) {
        currentAttendanceData = snapshot.val();
        snapshot.forEach((studentSnap) => {
            const studentAttendance = studentSnap.val();
            if (studentAttendance[dateString1] || studentAttendance[dateString2]) presentCount++;
        });
    } else { currentAttendanceData = {}; }
    
    statPresentToday.innerText = presentCount;
    let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
    cache.presentCount = presentCount; localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
    
    renderManualAttendanceTable(searchAttendance.value);
});

function renderManualAttendanceTable(searchQuery = "") {
    let html = '';
    for (const key in allStudentsDict) {
        const student = allStudentsDict[key];
        if (student.status !== "Approved") continue;
        if (searchQuery && !student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) && !key.toLowerCase().includes(searchQuery.toLowerCase())) continue;
        const isPresent = currentAttendanceData[key] && (currentAttendanceData[key][dateString1] || currentAttendanceData[key][dateString2]);
        const actionBtn = isPresent 
            ? `<button onclick="toggleAttendance('${key}', false)" class="bg-red-900/40 text-red-400 border border-red-500/30 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)]">Revoke</button>`
            : `<button onclick="toggleAttendance('${key}', true)" class="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all">Mark Present</button>`;
        const photoUrl = student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName}&background=0D8ABC&color=fff`;

        html += `<tr class="border-b border-slate-700/50 hover:bg-slate-800/60 transition-all">
            <td class="px-4 py-3 flex items-center"><img src="${photoUrl}" class="w-8 h-8 rounded-full border border-slate-500 mr-3 object-cover">
                <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName}</div><div class="text-[10px] text-slate-500">${key}</div></div></td>
            <td class="px-4 py-3 text-cyan-400 text-xs md:text-sm font-bold">${student.seatNumber || '--'}</td><td class="px-4 py-3">${actionBtn}</td></tr>`;
    }
    manualAttendanceTable.innerHTML = html !== '' ? html : `<tr><td colspan="3" class="text-center py-6 text-slate-400">No students matched.</td></tr>`;
}

window.toggleAttendance = async function(studentKey, markPresent) {
    try {
        const attendanceRef = ref(db, `Attendance/${studentKey}/${dateString1}`);
        if (markPresent) await set(attendanceRef, { timeIn: new Date().toLocaleTimeString(), status: "Present", markedBy: "Admin Manual" });
        else await set(attendanceRef, null); 
    } catch(e) { alert("Failed to update attendance on server!"); }
};
searchAttendance.addEventListener('input', (e) => renderManualAttendanceTable(e.target.value));
