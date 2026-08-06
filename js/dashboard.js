import { db } from './firebase-config.js';
import { ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// [KEEP ALL YOUR PREVIOUS LOGIC (Cache, Stats, Tables, Modal) EXACTLY HERE]
// No need to change the upper part, it remains exactly as is.

const statTotalStudents = document.getElementById('statTotalStudents');
const statPresentToday = document.getElementById('statPresentToday');
const statPendingFees = document.getElementById('statPendingFees');
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

function loadCachedDashboard() {
    const cachedData = JSON.parse(localStorage.getItem('adminDashboardCache'));
    if (cachedData) {
        statTotalStudents.innerText = cachedData.totalActive || 0;
        statPendingFees.innerText = cachedData.pendingFees || 0;
        statTotalCapacity.innerText = cachedData.totalSeats || 100;
        statAvailableSeats.innerText = (cachedData.totalSeats || 100) - (cachedData.occupiedSeats || 0);
        statPresentToday.innerText = cachedData.presentCount || 0;
        if(cachedData.recentHTML) recentActivityTable.innerHTML = cachedData.recentHTML;
        if(cachedData.pendingHTML) pendingApprovalsTable.innerHTML = cachedData.pendingHTML;
        if(cachedData.allStudentsHTML) allStudentsTable.innerHTML = cachedData.allStudentsHTML;
    }
}
loadCachedDashboard();

const seatConfigRef = ref(db, 'totalSeat');
onValue(seatConfigRef, (snapshot) => {
    if (snapshot.exists()) {
        globalTotalSeats = snapshot.val();
        statTotalCapacity.innerText = globalTotalSeats;
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalSeats = globalTotalSeats;
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
    }
});

const studentsRef = ref(db, 'Students');
onValue(studentsRef, (snapshot) => {
    let totalActive = 0, pendingFeesCount = 0, occupiedSeats = 0;
    let recentHTML = '', pendingHTML = '', allHTML = '';
    let studentCount = 0;
    allStudentsDict = {}; 

    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const student = childSnapshot.val();
            const studentKey = childSnapshot.key;
            allStudentsDict[studentKey] = student;
            const photo = student.photoUrl || 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
            let feeColor = student.feeStatus !== "Paid" ? "text-red-400 font-bold" : "text-emerald-400";
            let feeText = student.feeStatus !== "Paid" ? `Due: ₹${student.dueAmount || 0}` : "Paid";
            
            if (student.status === "Approved") {
                totalActive++;
                if (student.seatNumber && student.seatNumber.trim() !== "") occupiedSeats++;
                if(studentCount < 6) {
                    recentHTML += `
                        <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                            <td class="px-4 py-3 flex items-center">
                                <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-slate-600 mr-3 object-cover">
                                <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">Seat: ${student.seatNumber || 'N/A'}</div></div>
                            </td>
                            <td class="px-4 py-3 text-xs md:text-sm ${feeColor}">${feeText}</td>
                            <td class="px-4 py-3 text-xs md:text-sm text-slate-300">${student.validTill || '--'}</td>
                            <td class="px-4 py-3"><span class="bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-[10px] md:text-xs tracking-wide">Active</span></td>
                        </tr>`;
                    studentCount++;
                }
                allHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                        <td class="px-4 py-3 flex items-center">
                            <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border border-cyan-500/50 mr-3 object-cover">
                            <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">${student.mobile || 'No Mobile'}</div></div>
                        </td>
                        <td class="px-4 py-3 text-xs md:text-sm text-cyan-400 font-bold">${student.seatNumber || 'N/A'}</td>
                        <td class="px-4 py-3 text-xs md:text-sm ${feeColor}">${feeText}</td>
                        <td class="px-4 py-3 text-xs md:text-sm text-slate-300">${student.validTill || '--'}</td>
                        <td class="px-4 py-3"><button class="btn-open-profile bg-slate-700 hover:bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" data-key="${studentKey}">View Profile</button></td>
                    </tr>`;
            }
            if (student.feeStatus !== "Paid" || (student.dueAmount && student.dueAmount > 0)) pendingFeesCount++;
            if (student.status === "Pending") {
                pendingHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                        <td class="px-4 py-3 flex items-center">
                            <img src="${photo}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-amber-500 mr-3 object-cover shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                            <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || studentKey}</div><div class="text-[10px] md:text-xs text-slate-500">${studentKey}</div></div>
                        </td>
                        <td class="px-4 py-3"><div class="text-slate-300 text-xs md:text-sm">${student.mobile || 'N/A'}</div><div class="text-[10px] md:text-xs text-slate-500 truncate w-24 md:w-32" title="${student.address || ''}">${student.address || 'N/A'}</div></td>
                        <td class="px-4 py-3 text-amber-400 font-medium text-xs md:text-sm">${student.membership || 'N/A'}</td>
                        <td class="px-4 py-3"><button class="btn-open-profile bg-amber-600/20 text-amber-400 border border-amber-500/50 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" data-key="${studentKey}" data-type="approve">Review</button></td>
                    </tr>`;
            }
        });
        statTotalStudents.innerText = totalActive; statPendingFees.innerText = pendingFeesCount; statAvailableSeats.innerText = globalTotalSeats - occupiedSeats; 
        recentActivityTable.innerHTML = recentHTML !== '' ? recentHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No recent active students.</td></tr>`;
        pendingApprovalsTable.innerHTML = pendingHTML !== '' ? pendingHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No pending approvals! 🎉</td></tr>`;
        allStudentsTable.innerHTML = allHTML !== '' ? allHTML : `<tr><td colspan="5" class="text-center py-8 text-slate-500">No active students found.</td></tr>`;
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalActive = totalActive; cache.pendingFees = pendingFeesCount; cache.occupiedSeats = occupiedSeats;
        cache.recentHTML = recentHTML; cache.pendingHTML = pendingHTML; cache.allStudentsHTML = allHTML;
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
        localStorage.setItem('allStudentsDataCache', JSON.stringify(allStudentsDict));
    }
});

const attendanceRef = ref(db, 'Attendance');
onValue(attendanceRef, (snapshot) => {
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

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-open-profile');
    if (btn) {
        const key = btn.getAttribute('data-key');
        const mode = btn.getAttribute('data-type'); 
        openProfileModal(key, mode === 'approve');
    }
});

function openProfileModal(studentKey, isApprovalMode = false) {
    const student = allStudentsDict[studentKey];
    if(!student) return alert("Student data not found.");
    document.getElementById('modalStudentKey').value = studentKey;
    document.getElementById('editFullName').value = student.fullName || ''; document.getElementById('editMobile').value = student.mobile || '';
    document.getElementById('editPassword').value = student.password || ''; document.getElementById('editAddress').value = student.address || '';
    document.getElementById('editMembership').value = student.membership || ''; document.getElementById('editRegTime').value = student.registrationTime || '';
    document.getElementById('editPhotoUrl').value = student.photoUrl || ''; document.getElementById('editIdProofUrl').value = student.idProofUrl || '';
    const photo = student.photoUrl || 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
    document.getElementById('modalPhotoPreview').src = photo;
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

document.getElementById('editPhotoUrl').addEventListener('input', (e) => { document.getElementById('modalPhotoPreview').src = e.target.value || 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff'; });
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
    if (updates.status === "Approved" && (!updates.seatNumber || !updates.validTill)) { alert("Please allot a Seat Number and Valid Till date to keep status Approved."); return; }
    try {
        btn.innerHTML = `<span class="mr-2">⏳</span> Saving...`; btn.disabled = true;
        await update(ref(db, `Students/${studentKey}`), updates);
        closeModal(); alert(`Success! Data for ${studentKey} updated.`);
    } catch (error) { console.error("Error:", error); alert("Something went wrong!"); } 
    finally { btn.innerHTML = `<span class="mr-2" id="saveProfileIcon">✅</span> <span id="saveProfileText">${originalText}</span>`; btn.disabled = false; }
});

document.getElementById('searchAllStudents').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase(); const rows = allStudentsTable.getElementsByTagName('tr');
    for (let row of rows) { const text = row.innerText.toLowerCase(); row.style.display = text.includes(query) ? '' : 'none'; }
});


// ==========================================
// 🔥 NEW: MANUAL ENTRY FORM ENGINE
// ==========================================

const manualEntryForm = document.getElementById('manualEntryForm');
const btnSaveManualEntry = document.getElementById('btnSaveManualEntry');

// Automatically set default date hint
document.getElementById('manualValidTill').placeholder = `e.g., 30 ${monthStr} ${year}`;
document.getElementById('manualLastPaid').placeholder = `e.g., ${monthStr} ${year}`;
document.getElementById('manualLastPaid').value = `${monthStr} ${year}`;

manualEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop normal form submit

    const username = document.getElementById('manualUsername').value.trim();
    if(username.includes(' ')) {
        alert("Username cannot contain spaces!");
        return;
    }

    try {
        btnSaveManualEntry.innerHTML = `<span class="mr-2">⏳</span> Processing...`;
        btnSaveManualEntry.disabled = true;

        // 1. CHCEK AVAILABILITY IN FIREBASE
        const snapshot = await get(ref(db, `Students/${username}`));
        
        if (snapshot.exists()) {
            alert(`🚨 The username "${username}" is already taken by someone else. Please choose a different unique ID.`);
            btnSaveManualEntry.innerHTML = `<span class="mr-2">💾</span> Save Student Direct to System`;
            btnSaveManualEntry.disabled = false;
            return; // Stop right here
        }

        // 2. BUILD STUDENT DATA OBJECT
        const currentDateTime = `${date < 10 ? '0'+date : date}-${today.getMonth()+1 < 10 ? '0'+(today.getMonth()+1) : today.getMonth()+1}-${year}__${today.getHours()}-${today.getMinutes()}`;
        
        const newStudentData = {
            fullName: document.getElementById('manualFullName').value.trim(),
            mobile: document.getElementById('manualMobile').value.trim(),
            password: document.getElementById('manualPassword').value.trim(),
            membership: document.getElementById('manualMembership').value.trim(),
            address: document.getElementById('manualAddress').value.trim(),
            
            seatNumber: document.getElementById('manualSeat').value.trim(),
            validTill: document.getElementById('manualValidTill').value.trim(),
            feeStatus: document.getElementById('manualFeeStatus').value,
            dueAmount: parseInt(document.getElementById('manualDueAmount').value) || 0,
            lastPaidMonth: document.getElementById('manualLastPaid').value.trim(),
            
            status: "Approved", // Admin directly approves manual entry
            registrationTime: currentDateTime,
            photoUrl: "", // Blank by default
            idProofUrl: ""
        };

        // 3. SAVE TO FIREBASE
        await set(ref(db, `Students/${username}`), newStudentData);
        
        // Success Action
        alert(`✅ Success! Student "${username}" has been manually registered and approved.`);
        manualEntryForm.reset();
        
        // Switch back to dashboard view to see the new entry
        document.getElementById('nav-dashboard').click();
        
    } catch (error) {
        console.error("Error creating student:", error);
        alert("Network Error: Could not save student data.");
    } finally {
        btnSaveManualEntry.innerHTML = `<span class="mr-2">💾</span> Save Student Direct to System`;
        btnSaveManualEntry.disabled = false;
    }
});
