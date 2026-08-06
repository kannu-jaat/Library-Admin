import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const seatSearchQuery = document.getElementById('seatSearchQuery');
const seatFilterStatus = document.getElementById('seatFilterStatus');
const seatGrid = document.getElementById('seatGrid');
const countOccupiedSeats = document.getElementById('countOccupiedSeats');
const countEmptySeats = document.getElementById('countEmptySeats');

const toggleEditModeBtn = document.getElementById('toggleEditModeBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');

const today = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const date = today.getDate();
const monthStr = months[today.getMonth()];
const year = today.getFullYear();
const dateString1 = `${date} ${monthStr} ${year}`;
const dateString2 = `${date < 10 ? '0' + date : date} ${monthStr} ${year}`;

let allStudentsDict = JSON.parse(localStorage.getItem('allStudentsDataCache')) || {}; 
let allPaymentsDict = JSON.parse(localStorage.getItem('allPaymentsDataCache')) || {};
let globalTotalSeats = 100; 

// 🔥 Helper Functions for Date Pickers (Converts YYYY-MM-DD to DD Month YYYY and vice-versa)
function getDbDate(yyyy_mm_dd) {
    if(!yyyy_mm_dd) return "";
    const parts = yyyy_mm_dd.split('-');
    if(parts.length !== 3) return "";
    return `${parseInt(parts[2])} ${months[parseInt(parts[1])-1]} ${parts[0]}`;
}
function getShortMonthStr(yyyy_mm_dd) {
    if(!yyyy_mm_dd) return "";
    const parts = yyyy_mm_dd.split('-');
    if(parts.length !== 3) return "";
    return `${parts[2]} ${months[parseInt(parts[1])-1].substring(0,3)}`;
}
function getDbMonthKey(yyyy_mm) {
    if(!yyyy_mm) return "";
    const parts = yyyy_mm.split('-');
    return `${months[parseInt(parts[1])-1]} ${parts[0]}`;
}

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

function checkFeeStatus(validTillStr) {
    if(!validTillStr) return "Due";
    try {
        const parts = validTillStr.trim().split(' ');
        if(parts.length < 3) return "Due";
        const day = parseInt(parts[0]);
        const monthIdx = months.indexOf(parts[1]);
        const yr = parseInt(parts[2]);
        if(monthIdx === -1) return "Due";
        const validDate = new Date(yr, monthIdx, day, 23, 59, 59);
        return today <= validDate ? "Paid" : "Due";
    } catch(e) { return "Due"; }
}

function getLatestPaidMonth(studentKey) {
    const studentPayments = allPaymentsDict[studentKey];
    if(!studentPayments) return "No Payment";
    let monthsList = Object.keys(studentPayments);
    if(monthsList.length === 0) return "No Payment";
    monthsList.sort((a, b) => new Date(b) - new Date(a));
    return monthsList[0]; 
}

function renderSeatMap() {
    if(!seatSearchQuery || !seatFilterStatus) return;
    const query = seatSearchQuery.value.toLowerCase();
    const status = seatFilterStatus.value;
    
    let seatMap = {};
    let occupiedCount = 0;

    for (let key in allStudentsDict) {
        const student = allStudentsDict[key];
        if (student.status === "Approved" && student.seatNumber && student.seatNumber.trim() !== "") {
            seatMap[student.seatNumber.trim().toLowerCase()] = {
                seatNum: student.seatNumber.trim(), name: student.fullName || key,
                photo: student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName || 'User'}&background=0D8ABC&color=fff`,
                key: key
            };
        }
    }

    let allSeats = [];
    let emptyCount = 0;

    for (let i = 1; i <= globalTotalSeats; i++) {
        let seatStr = i.toString();
        let occupant = seatMap[seatStr.toLowerCase()];
        if (occupant) {
            allSeats.push({ type: 'occupied', seat: occupant.seatNum, name: occupant.name, photo: occupant.photo, key: occupant.key });
            occupiedCount++;
        } else {
            allSeats.push({ type: 'empty', seat: seatStr, name: 'Available', photo: null, key: null });
            emptyCount++;
        }
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
                <img src="${s.photo}" class="w-12 h-12 rounded-full border-2 border-red-500/50 mb-2 object-cover">
                <h4 class="text-white font-bold text-sm w-full truncate">Seat #${s.seat}</h4>
                <p class="text-xs text-slate-400 w-full truncate">${s.name}</p>
            </div>`;
        } else {
            html += `
            <div class="glass-card bg-slate-800/40 border-t-4 border-t-emerald-500 rounded-xl p-3 flex flex-col items-center justify-center text-center border-dashed border-slate-600">
                <div class="w-10 h-10 rounded-full border-2 border-emerald-500/30 mb-1 flex items-center justify-center bg-emerald-900/20"><span class="text-xs text-emerald-400 font-bold">${s.seat}</span></div>
                <h4 class="text-emerald-400 font-bold text-xs truncate">Empty</h4>
                <p class="text-[9px] text-slate-500">Available</p>
            </div>`;
        }
    });

    seatGrid.innerHTML = html !== '' ? html : `<div class="col-span-full text-center text-slate-500 py-10">No seats match your search.</div>`;
    countOccupiedSeats.innerText = occupiedCount;
    countEmptySeats.innerText = globalTotalSeats - occupiedCount >= 0 ? globalTotalSeats - occupiedCount : emptyCount;
}

seatSearchQuery.addEventListener('input', renderSeatMap);
seatFilterStatus.addEventListener('change', renderSeatMap);

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
    }
    renderSeatMap(); 
}
loadCachedDashboard();

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
    let totalActive = 0, occupiedSeats = 0;
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
            let feeText = currentFeeStatus === "Paid" ? "Paid" : `Due`;
            let feeChipColor = currentFeeStatus === "Paid" ? "bg-emerald-900/40 border-emerald-500/30 text-emerald-400" : "bg-red-900/40 border-red-500/30 text-red-400";

            if (student.status === "Approved") {
                totalActive++;
                if (student.seatNumber && student.seatNumber.trim() !== "") occupiedSeats++;
                
                if (currentFeeStatus === "Due") pendingFeeNames.push(student.fullName || studentKey);

                activeStudentsList.push({ ...student, key: studentKey, photo, feeColor, feeText });

                allHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                        <td class="px-4 py-3 flex items-center">
                            <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border border-cyan-500/50 mr-3 object-cover btn-open-profile cursor-pointer" data-key="${studentKey}" title="View Profile">
                            <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">${student.mobile || 'No Mobile'}</div></div>
                        </td>
                        <td class="px-4 py-3 text-xs md:text-sm text-cyan-400 font-bold">${student.seatNumber || 'N/A'}</td>
                        <td class="px-4 py-3 text-xs md:text-sm ${feeColor}">${feeText}</td>
                        <td class="px-4 py-3 text-xs md:text-sm text-slate-300">${student.validTill || '--'}</td>
                        <td class="px-4 py-3"><button class="btn-open-profile bg-slate-700 hover:bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" data-key="${studentKey}">Profile</button></td>
                    </tr>`;

                feesHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                        <td class="px-4 py-4 flex items-center">
                            <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border border-slate-600 mr-3 object-cover">
                            <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">Seat: ${student.seatNumber || 'N/A'}</div></div>
                        </td>
                        <td class="px-4 py-4 text-xs md:text-sm text-slate-300">${student.validTill || '--'}</td>
                        <td class="px-4 py-4"><span class="px-2 py-1 rounded border text-xs ${feeChipColor}">${feeText}</span></td>
                        <td class="px-4 py-4 text-xs md:text-sm text-amber-400">${latestPaid}</td>
                        <td class="px-4 py-4"><button class="btn-open-history bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-[0_0_8px_rgba(16,185,129,0.2)]" data-key="${studentKey}" data-name="${student.fullName || studentKey}">Manage Fees</button></td>
                    </tr>`;
            }

            if (student.status === "Pending") {
                pendingHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                        <td class="px-4 py-3 flex items-center">
                            <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-amber-500 mr-3 object-cover shadow-[0_0_8px_rgba(245,158,11,0.4)] btn-open-profile cursor-pointer" data-key="${studentKey}" data-type="approve">
                            <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">${studentKey}</div></div>
                        </td>
                        <td class="px-4 py-3"><div class="text-slate-300 text-xs md:text-sm">${student.mobile || 'N/A'}</div><div class="text-[10px] md:text-xs text-slate-500 truncate w-24 md:w-32" title="${student.address || ''}">${student.address || 'N/A'}</div></td>
                        <td class="px-4 py-3 text-amber-400 font-medium text-xs md:text-sm">${student.membership || 'N/A'}</td>
                        <td class="px-4 py-3"><button class="btn-open-profile bg-amber-600/20 text-amber-400 border border-amber-500/50 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" data-key="${studentKey}" data-type="approve">Review</button></td>
                    </tr>`;
            }
        });

        activeStudentsList.sort((a, b) => parseRegDate(b.registrationTime) - parseRegDate(a.registrationTime));
        
        let recentHTML = '';
        activeStudentsList.slice(0, 6).forEach(s => {
            recentHTML += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                    <td class="px-4 py-3 flex items-center">
                        <img src="${s.photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-slate-600 mr-3 object-cover btn-open-profile cursor-pointer" data-key="${s.key}" title="View Profile">
                        <div><div class="text-white font-medium text-xs md:text-sm">${s.fullName || s.key}</div><div class="text-[10px] md:text-xs text-slate-500">Seat: ${s.seatNumber || 'N/A'}</div></div>
                    </td>
                    <td class="px-4 py-3 text-xs md:text-sm ${s.feeColor}">${s.feeText}</td>
                    <td class="px-4 py-3 text-xs md:text-sm text-slate-300">${s.validTill || '--'}</td>
                    <td class="px-4 py-3"><span class="bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-[10px] md:text-xs tracking-wide">Active</span></td>
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

        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalActive = totalActive; cache.pendingFees = pendingFeeNames.length; cache.occupiedSeats = occupiedSeats;
        cache.pendingNamesStr = pendingNamesStr;
        cache.recentHTML = recentHTML; cache.pendingHTML = pendingHTML; cache.allStudentsHTML = allHTML; cache.feesHTML = feesHTML;
        
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
        localStorage.setItem('allStudentsDataCache', JSON.stringify(allStudentsDict));
        
        renderSeatMap();
    }
};
onValue(ref(db, 'Students'), studentSnapshotHandler);

onValue(ref(db, 'Attendance'), (snapshot) => {
    let presentCount = 0;
    if (snapshot.exists()) {
        snapshot.forEach((studentSnap) => {
            const studentAttendance = studentSnap.val();
            if (studentAttendance[dateString1] || studentAttendance[dateString2]) presentCount++;
        });
    }
    statPresentToday.innerText = presentCount;
    let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
    cache.presentCount = presentCount; localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
});

// ==========================================
// 5. PROFILE MODAL LOGIC
// ==========================================
let isEditingMode = false;

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-open-profile');
    if (btn) openProfileModal(btn.getAttribute('data-key'), btn.getAttribute('data-type') === 'approve');
});

function openProfileModal(studentKey, isApprovalMode = false) {
    const student = allStudentsDict[studentKey];
    if(!student) return alert("Data not synced yet.");
    
    isEditingMode = false;
    setProfileInputsEditable(false);

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
    document.getElementById('displayFeeStatus').value = checkFeeStatus(student.validTill);
    document.getElementById('displayLastPaid').value = getLatestPaidMonth(studentKey);

    if (isApprovalMode) {
        document.getElementById('modalMainTitle').innerText = "Review & Approve Student"; document.getElementById('modalIcon').innerText = "⚡"; 
        toggleEditModeBtn.classList.add('hidden'); saveProfileBtn.classList.remove('hidden');
        setProfileInputsEditable(true);
        document.getElementById('adminAccountStatus').value = 'Approved'; 
        document.getElementById('adminValidTill').value = `30 ${monthStr} ${year}`; 
    } else {
        document.getElementById('modalMainTitle').innerText = "Student Profile (View Mode)"; document.getElementById('modalIcon').innerText = "👁️"; 
        toggleEditModeBtn.classList.remove('hidden'); toggleEditModeBtn.innerHTML = `<span class="mr-2">✏️</span> Enable Edit Mode`;
        saveProfileBtn.classList.add('hidden');
    }
    profileModal.classList.remove('hidden');
}

function setProfileInputsEditable(enable) { document.querySelectorAll('.profile-input').forEach(input => input.disabled = !enable); }

toggleEditModeBtn.addEventListener('click', () => {
    isEditingMode = !isEditingMode;
    setProfileInputsEditable(isEditingMode);
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
    const studentKey = document.getElementById('modalStudentKey').value; 
    const btn = document.getElementById('saveProfileBtn');
    const updates = {
        fullName: document.getElementById('editFullName').value.trim(), mobile: document.getElementById('editMobile').value.trim(),
        password: document.getElementById('editPassword').value.trim(), address: document.getElementById('editAddress').value.trim(),
        membership: document.getElementById('editMembership').value.trim(), photoUrl: document.getElementById('editPhotoUrl').value.trim(),
        idProofUrl: document.getElementById('editIdProofUrl').value.trim(), status: document.getElementById('adminAccountStatus').value,
        seatNumber: document.getElementById('adminSeatNumber').value.trim(), validTill: document.getElementById('adminValidTill').value.trim()
    };
    if (updates.status === "Approved" && (!updates.seatNumber || !updates.validTill)) return alert("Please allot a Seat Number and Valid Till date.");
    try {
        btn.innerHTML = `<span class="mr-2">⏳</span> Saving...`; btn.disabled = true;
        await update(ref(db, `Students/${studentKey}`), updates);
        alert(`Success! Profile updated.`); closeModal();
    } catch (error) { alert("Something went wrong!"); } 
    finally { btn.innerHTML = `<span class="mr-2">✅</span> Save Changes`; btn.disabled = false; }
});

document.getElementById('searchAllStudents').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase(); const rows = allStudentsTable.getElementsByTagName('tr');
    for (let row of rows) { row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none'; }
});
document.getElementById('searchFeesStudents').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase(); const rows = feesTable.getElementsByTagName('tr');
    for (let row of rows) { row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none'; }
});

// ==========================================
// 6. DUAL-PANE FEE HISTORY & PAYMENT ENGINE
// ==========================================
const feeHistoryModal = document.getElementById('feeHistoryModal');
const closeFeeModal = () => feeHistoryModal.classList.add('hidden');
document.getElementById('closeFeeModalBtn').addEventListener('click', closeFeeModal);
document.getElementById('cancelFeeModalBtn').addEventListener('click', closeFeeModal);

const payMonthPicker = document.getElementById('payMonthPicker');
const payD2DEnd = document.getElementById('payD2DEnd');
const payNewValidTill = document.getElementById('payNewValidTill');

// Auto-fill validTill when D2D End is picked
payD2DEnd.addEventListener('input', (e) => {
    payNewValidTill.value = e.target.value; 
});

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-open-history');
    if (btn) {
        const key = btn.getAttribute('data-key');
        const name = btn.getAttribute('data-name');
        
        document.getElementById('payStudentKey').value = key;
        document.getElementById('payStudentName').innerText = `${name} (${key})`;
        
        // Populate History Left Pane
        const historyContainer = document.getElementById('historyTableContainer');
        const studentPayments = allPaymentsDict[key];
        
        if(!studentPayments || Object.keys(studentPayments).length === 0) {
            historyContainer.innerHTML = `<div class="text-center text-slate-500 py-4 text-sm">No payment history found.</div>`;
        } else {
            let histHtml = '';
            let monthsList = Object.keys(studentPayments).sort((a, b) => new Date(b) - new Date(a));
            monthsList.forEach(m => {
                let p = studentPayments[m];
                histHtml += `
                <div class="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                    <div>
                        <p class="text-emerald-400 font-bold text-sm">${m}</p>
                        <p class="text-[10px] text-slate-400">D2D: ${p.d2d || 'N/A'} <br>Paid On: ${p.payDate || 'N/A'}</p>
                    </div>
                    <div class="text-white font-bold bg-slate-900 px-3 py-1 rounded-md border border-slate-600">₹${p.amount}</div>
                </div>`;
            });
            historyContainer.innerHTML = histHtml;
        }

        // Set Defaults for Add Payment Right Pane
        const tDate = new Date();
        const curY = tDate.getFullYear();
        const curM = (tDate.getMonth() + 1).toString().padStart(2, '0');
        
        payMonthPicker.value = `${curY}-${curM}`; // Current Month
        document.getElementById('payAmount').value = '';
        document.getElementById('payD2DStart').value = '';
        document.getElementById('payD2DEnd').value = '';
        payNewValidTill.value = '';
        
        feeHistoryModal.classList.remove('hidden');
    }
});

document.getElementById('confirmPaymentBtn').addEventListener('click', async () => {
    const studentKey = document.getElementById('payStudentKey').value;
    const btn = document.getElementById('confirmPaymentBtn');
    
    const mValue = document.getElementById('payMonthPicker').value; // YYYY-MM
    const amount = document.getElementById('payAmount').value.trim();
    const dStart = document.getElementById('payD2DStart').value; // YYYY-MM-DD
    const dEnd = document.getElementById('payD2DEnd').value; // YYYY-MM-DD
    const validVal = payNewValidTill.value; // YYYY-MM-DD

    if (!mValue || !amount || !dStart || !dEnd || !validVal) return alert("Please fill all payment details and dates.");

    // Convert Date Formats for Database
    const dbMonthYear = getDbMonthKey(mValue); // "August 2026"
    const d2dString = `${getShortMonthStr(dStart)} - ${getShortMonthStr(dEnd)}`; // "01 Aug - 30 Aug"
    const dbValidTillDate = getDbDate(validVal); // "30 August 2026"

    try {
        btn.innerHTML = `⏳ Saving...`; btn.disabled = true;

        const updates = {};
        updates[`Payments/${studentKey}/${dbMonthYear}`] = {
            amount: parseInt(amount),
            d2d: d2dString,
            payDate: dateString1 // Today's date
        };
        updates[`Students/${studentKey}/validTill`] = dbValidTillDate;

        await update(ref(db), updates);
        
        alert(`✅ Payment Saved for ${studentKey}`);
        closeFeeModal();
    } catch (error) {
        console.error(error);
        alert("Failed to save payment.");
    } finally {
        btn.innerHTML = `✅ Save New Payment`; btn.disabled = false;
    }
});

// ==========================================
// 7. MANUAL ENTRY LOGIC
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
            validTill: document.getElementById('manualValidTill').value.trim(),
            status: "Approved", registrationTime: currentDateTime, photoUrl: "", idProofUrl: ""
        });
        alert(`✅ Success! Student "${username}" registered.`);
        document.getElementById('manualEntryForm').reset();
        document.getElementById('nav-dashboard').click();
    } catch (error) { alert("Network Error"); } 
    finally { btn.innerHTML = `<span class="mr-2">💾</span> Save Student Direct to System`; btn.disabled = false; }
});
