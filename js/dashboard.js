import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// AUTH LOGIC
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('adminEmailDisplay').innerText = user.email;
        document.getElementById('adminAvatarLetter').innerText = user.email.charAt(0).toUpperCase();
    } else {
        window.location.href = "index.html";
    }
});
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

// DOM ELEMENTS
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

const today = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const date = today.getDate();
const monthStr = months[today.getMonth()];
const year = today.getFullYear();
const dateString1 = `${date} ${monthStr} ${year}`;
const dateString2 = `${date < 10 ? '0' + date : date} ${monthStr} ${year}`;

let allStudentsDict = JSON.parse(localStorage.getItem('allStudentsDataCache')) || {}; 
let globalTotalSeats = 100; 

// Helper: Parse DD-MM-YYYY__HH-mm string to Real Date for precise sorting
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

// 🔥 CACHE MANAGER
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
    }
    renderSeatMap(); // Render seats from local dict instantly
}
loadCachedDashboard();

// FETCH SEATS CONFIG
onValue(ref(db, 'totalSeat'), (snapshot) => {
    if (snapshot.exists()) {
        globalTotalSeats = snapshot.val();
        statTotalCapacity.innerText = globalTotalSeats;
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalSeats = globalTotalSeats;
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
        renderSeatMap(); // Refresh matrix if max limit changes
    }
});

// MAIN STUDENTS ENGINE
onValue(ref(db, 'Students'), (snapshot) => {
    let totalActive = 0, occupiedSeats = 0;
    let pendingHTML = '', allHTML = '';
    
    let activeStudentsList = [];
    let pendingFeeNames = [];
    
    allStudentsDict = {}; 

    if (snapshot.exists()) {
        snapshot.forEach((childSnap) => {
            const student = childSnap.val();
            const studentKey = childSnap.key;
            allStudentsDict[studentKey] = student;
            
            const photo = student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName || 'User'}&background=0D8ABC&color=fff`;
            let feeColor = student.feeStatus !== "Paid" ? "text-red-400 font-bold" : "text-emerald-400";
            let feeText = student.feeStatus !== "Paid" ? `Due: ₹${student.dueAmount || 0}` : "Paid";
            
            if (student.feeStatus !== "Paid" || (student.dueAmount && student.dueAmount > 0)) {
                pendingFeeNames.push(student.fullName || studentKey);
            }

            if (student.status === "Approved") {
                totalActive++;
                if (student.seatNumber && student.seatNumber.trim() !== "") occupiedSeats++;
                
                // Add to array for perfect Time Sorting
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

        // SORTING: Newest Registration first
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
        
        // Update Stats & UI
        statTotalStudents.innerText = totalActive; 
        statPendingFees.innerText = pendingFeeNames.length; 
        statAvailableSeats.innerText = globalTotalSeats - occupiedSeats; 
        
        const pendingNamesStr = pendingFeeNames.length > 0 ? pendingFeeNames.join(', ') : "No dues pending 🎉";
        pendingFeesNamesDiv.innerText = pendingNamesStr;

        recentActivityTable.innerHTML = recentHTML !== '' ? recentHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No active students.</td></tr>`;
        pendingApprovalsTable.innerHTML = pendingHTML !== '' ? pendingHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No pending approvals! 🎉</td></tr>`;
        allStudentsTable.innerHTML = allHTML !== '' ? allHTML : `<tr><td colspan="5" class="text-center py-8 text-slate-500">No active students found.</td></tr>`;

        // Save Cache
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalActive = totalActive; cache.pendingFees = pendingFeeNames.length; cache.occupiedSeats = occupiedSeats;
        cache.pendingNamesStr = pendingNamesStr;
        cache.recentHTML = recentHTML; cache.pendingHTML = pendingHTML; cache.allStudentsHTML = allHTML;
        
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
        localStorage.setItem('allStudentsDataCache', JSON.stringify(allStudentsDict));
        
        renderSeatMap();
    }
});

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

// 🔥 NEW: SEAT MATRIX RENDER ENGINE
const seatSearchQuery = document.getElementById('seatSearchQuery');
const seatFilterStatus = document.getElementById('seatFilterStatus');

function renderSeatMap() {
    const query = seatSearchQuery.value.toLowerCase();
    const status = seatFilterStatus.value;
    const seatGrid = document.getElementById('seatGrid');
    
    let occupiedSeatsList = [];
    let emptyCount = globalTotalSeats;

    // Grab Occupied
    for (let key in allStudentsDict) {
        const student = allStudentsDict[key];
        if (student.status === "Approved" && student.seatNumber && student.seatNumber.trim() !== "") {
            occupiedSeatsList.push({
                type: 'occupied', seat: student.seatNumber.trim(), name: student.fullName || key,
                photo: student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName || 'User'}&background=0D8ABC&color=fff`,
                key: key
            });
            emptyCount--;
        }
    }
    if(emptyCount < 0) emptyCount = 0;

    let allSeats = [...occupiedSeatsList];
    
    // Fill the rest with Empty Virtual Seats
    for(let i=0; i<emptyCount; i++) {
        allSeats.push({ type: 'empty', seat: `Free Seat`, name: 'Available', photo: null, key: null });
    }

    // Apply Filters
    let filtered = allSeats.filter(s => {
        let matchStatus = true;
        if(status === 'occupied' && s.type !== 'occupied') matchStatus = false;
        if(status === 'empty' && s.type !== 'empty') matchStatus = false;
        
        let matchQuery = true;
        if(query !== '') matchQuery = s.seat.toLowerCase().includes(query) || s.name.toLowerCase().includes(query);
        
        return matchStatus && matchQuery;
    });

    // Draw Grid
    let html = '';
    filtered.forEach(s => {
        if (s.type === 'occupied') {
            html += `
            <div class="glass-card bg-slate-800/80 border-t-4 border-t-red-500 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-700 transition-colors btn-open-profile shadow-[0_4px_10px_rgba(239,68,68,0.15)]" data-key="${s.key}" title="Click to view profile">
                <img src="${s.photo}" class="w-12 h-12 rounded-full border-2 border-red-500/50 mb-2 object-cover">
                <h4 class="text-white font-bold text-sm w-full truncate">${s.seat}</h4>
                <p class="text-xs text-slate-400 w-full truncate">${s.name}</p>
            </div>`;
        } else {
            html += `
            <div class="glass-card bg-slate-800/40 border-t-4 border-t-emerald-500 rounded-xl p-3 flex flex-col items-center justify-center text-center border-dashed border-slate-600">
                <div class="w-12 h-12 rounded-full border-2 border-emerald-500/30 mb-2 flex items-center justify-center bg-emerald-900/20"><span class="text-xl">🪑</span></div>
                <h4 class="text-emerald-400 font-bold text-sm truncate">Empty</h4>
                <p class="text-[10px] text-slate-500">Available</p>
            </div>`;
        }
    });

    seatGrid.innerHTML = html !== '' ? html : `<div class="col-span-full text-center text-slate-500 py-10">No seats match your search.</div>`;
    document.getElementById('countOccupiedSeats').innerText = occupiedSeatsList.length;
    document.getElementById('countEmptySeats').innerText = emptyCount;
}

seatSearchQuery.addEventListener('input', renderSeatMap);
seatFilterStatus.addEventListener('change', renderSeatMap);


// MODAL & PROFILE LOGIC
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-open-profile');
    if (btn) openProfileModal(btn.getAttribute('data-key'), btn.getAttribute('data-type') === 'approve');
});

function openProfileModal(studentKey, isApprovalMode = false) {
    const student = allStudentsDict[studentKey];
    if(!student) return alert("Data not synced yet.");
    document.getElementById('modalStudentKey').value = studentKey;
    document.getElementById('editFullName').value = student.fullName || ''; document.getElementById('editMobile').value = student.mobile || '';
    document.getElementById('editPassword').value = student.password || ''; document.getElementById('editAddress').value = student.address || '';
    document.getElementById('editMembership').value = student.membership || ''; document.getElementById('editRegTime').value = student.registrationTime || '';
    document.getElementById('editPhotoUrl').value = student.photoUrl || ''; document.getElementById('editIdProofUrl').value = student.idProofUrl || '';
    document.getElementById('modalPhotoPreview').src = student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName || 'User'}&background=0D8ABC&color=fff`;
    
    const idBtn = document.getElementById('btnViewId');
    if (student.idProofUrl) { idBtn.href = student.idProofUrl; idBtn.classList.remove('opacity-50', 'pointer-events-none'); } 
    else { idBtn.href = '#'; idBtn.classList.add('opacity-50', 'pointer-events-none'); }
    
    if (isApprovalMode) {
        document.getElementById('modalMainTitle').innerText = "Review & Approve Student"; document.getElementById('modalIcon').innerText = "⚡"; document.getElementById('saveProfileIcon').innerText = "✅"; document.getElementById('saveProfileText').innerText = "Approve & Save"; document.getElementById('adminAccountStatus').value = 'Approved'; 
        document.getElementById('adminSeatNumber').value = student.seatNumber || ''; document.getElementById('adminValidTill').value = student.validTill || `30 ${monthStr} ${year}`; 
        document.getElementById('adminFeeStatus').value = student.feeStatus || 'Paid'; document.getElementById('adminDueAmount').value = student.dueAmount || '0'; document.getElementById('adminLastPaid').value = student.lastPaidMonth || `${monthStr} ${year}`;
    } else {
        document.getElementById('modalMainTitle').innerText = "Edit Student Profile"; document.getElementById('modalIcon').innerText = "✏️"; document.getElementById('saveProfileIcon').innerText = "💾"; document.getElementById('saveProfileText').innerText = "Update Profile";
        document.getElementById('adminAccountStatus').value = student.status || 'Approved'; document.getElementById('adminSeatNumber').value = student.seatNumber || ''; document.getElementById('adminValidTill').value = student.validTill || ''; 
        document.getElementById('adminFeeStatus').value = student.feeStatus || 'Paid'; document.getElementById('adminDueAmount').value = student.dueAmount || '0'; document.getElementById('adminLastPaid').value = student.lastPaidMonth || '';
    }
    profileModal.classList.remove('hidden');
}

const closeModal = () => profileModal.classList.add('hidden');
document.getElementById('closeProfileModalBtn').addEventListener('click', closeModal); document.getElementById('cancelProfileBtn').addEventListener('click', closeModal);

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const studentKey = document.getElementById('modalStudentKey').value; const btn = document.getElementById('saveProfileBtn'); const originalText = document.getElementById('saveProfileText').innerText;
    const updates = {
        fullName: document.getElementById('editFullName').value.trim(), mobile: document.getElementById('editMobile').value.trim(),
        password: document.getElementById('editPassword').value.trim(), address: document.getElementById('editAddress').value.trim(),
        membership: document.getElementById('editMembership').value.trim(), photoUrl: document.getElementById('editPhotoUrl').value.trim(),
        idProofUrl: document.getElementById('editIdProofUrl').value.trim(), status: document.getElementById('adminAccountStatus').value,
        seatNumber: document.getElementById('adminSeatNumber').value.trim(), validTill: document.getElementById('adminValidTill').value.trim(),
        feeStatus: document.getElementById('adminFeeStatus').value, dueAmount: parseInt(document.getElementById('adminDueAmount').value) || 0,
        lastPaidMonth: document.getElementById('adminLastPaid').value.trim()
    };
    if (updates.status === "Approved" && (!updates.seatNumber || !updates.validTill)) return alert("Please allot a Seat Number and Valid Till date.");
    try {
        btn.innerHTML = `<span class="mr-2">⏳</span> Saving...`; btn.disabled = true;
        await update(ref(db, `Students/${studentKey}`), updates);
        closeModal();
    } catch (error) { alert("Something went wrong!"); } 
    finally { btn.innerHTML = `<span class="mr-2" id="saveProfileIcon">✅</span> <span id="saveProfileText">${originalText}</span>`; btn.disabled = false; }
});

document.getElementById('searchAllStudents').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase(); const rows = allStudentsTable.getElementsByTagName('tr');
    for (let row of rows) { row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none'; }
});

// MANUAL ENTRY LOGIC
document.getElementById('manualValidTill').placeholder = `e.g., 30 ${monthStr} ${year}`;
document.getElementById('manualLastPaid').value = `${monthStr} ${year}`;

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
            validTill: document.getElementById('manualValidTill').value.trim(), feeStatus: document.getElementById('manualFeeStatus').value,
            dueAmount: parseInt(document.getElementById('manualDueAmount').value) || 0, lastPaidMonth: document.getElementById('manualLastPaid').value.trim(),
            status: "Approved", registrationTime: currentDateTime, photoUrl: "", idProofUrl: ""
        });
        alert(`✅ Success! Student "${username}" has been manually registered.`);
        document.getElementById('manualEntryForm').reset();
        document.getElementById('nav-dashboard').click();
    } catch (error) { alert("Network Error: Could not save student data."); } 
    finally { btn.innerHTML = `<span class="mr-2">💾</span> Save Student Direct to System`; btn.disabled = false; }
});
