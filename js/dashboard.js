import { db } from './firebase-config.js';
import { ref, onValue, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// DOM Elements
const statTotalStudents = document.getElementById('statTotalStudents');
const statPresentToday = document.getElementById('statPresentToday');
const statPendingFees = document.getElementById('statPendingFees');
const statAvailableSeats = document.getElementById('statAvailableSeats');
const statTotalCapacity = document.getElementById('statTotalCapacity');
const recentActivityTable = document.getElementById('recentActivityTable');
const pendingApprovalsTable = document.getElementById('pendingApprovalsTable');
const approvalModal = document.getElementById('approvalModal');

// Dates configuration
const today = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const date = today.getDate();
const monthStr = months[today.getMonth()];
const year = today.getFullYear();

const dateString1 = `${date} ${monthStr} ${year}`;
const dateString2 = `${date < 10 ? '0' + date : date} ${monthStr} ${year}`;

// Global data holder for modals
let pendingStudentsData = {};

// 🔥 CACHE MANAGER
function loadCachedDashboard() {
    const cachedData = localStorage.getItem('adminDashboardCache');
    if (cachedData) {
        const data = JSON.parse(cachedData);
        statTotalStudents.innerText = data.totalActive || 0;
        statPendingFees.innerText = data.pendingFees || 0;
        statTotalCapacity.innerText = data.totalSeats || 100;
        statAvailableSeats.innerText = (data.totalSeats || 100) - (data.occupiedSeats || 0);
        statPresentToday.innerText = data.presentCount || 0;
        if(data.tableHTML) recentActivityTable.innerHTML = data.tableHTML;
    }
}
loadCachedDashboard();

let globalTotalSeats = 100; 

// --- 1. FETCH TOTAL SEATS CONFIG ---
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

// --- 2. FETCH STUDENTS DATA ---
const studentsRef = ref(db, 'Students');
onValue(studentsRef, (snapshot) => {
    let totalActive = 0;
    let pendingFeesCount = 0;
    let occupiedSeats = 0;
    let tableHTML = '';
    let pendingHTML = '';
    let studentCount = 0;
    
    pendingStudentsData = {}; // Reset

    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const student = childSnapshot.val();
            const studentKey = childSnapshot.key;
            
            // Calculate Active & Occupied
            if (student.status === "Approved") {
                totalActive++;
                if (student.seatNumber && student.seatNumber.trim() !== "") occupiedSeats++;
            }

            // Calculate Pending Fees
            if (student.feeStatus !== "Paid" || (student.dueAmount && student.dueAmount > 0)) {
                pendingFeesCount++;
            }

            // Populate Dashboard Recent Table (Top 6)
            if(studentCount < 6) {
                const photo = student.photoUrl || 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
                let accStatusColor = student.status === "Approved" ? "bg-emerald-900/60 text-emerald-400 border border-emerald-500/30" : "bg-amber-900/60 text-amber-400 border border-amber-500/30";
                let feeColor = student.feeStatus !== "Paid" ? "text-red-400 font-bold" : "text-emerald-400";
                let feeText = student.feeStatus !== "Paid" ? `Due: ₹${student.dueAmount || 0}` : "Paid";
                
                tableHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                        <td class="px-4 py-4 flex items-center">
                            <img src="${photo}" class="w-10 h-10 rounded-full border-2 border-slate-600 mr-3 object-cover">
                            <div>
                                <div class="text-white font-medium">${student.fullName || studentKey}</div>
                                <div class="text-xs text-slate-500">Seat: ${student.seatNumber || 'N/A'}</div>
                            </div>
                        </td>
                        <td class="px-4 py-4 ${feeColor}">${feeText}</td>
                        <td class="px-4 py-4 text-slate-300">${student.validTill || '--'}</td>
                        <td class="px-4 py-4">
                            <span class="${accStatusColor} px-2 py-1.5 rounded text-xs tracking-wide">${student.status || 'Unknown'}</span>
                        </td>
                    </tr>
                `;
                studentCount++;
            }

            // Populate Pending Approvals View Table
            if (student.status === "Pending") {
                pendingStudentsData[studentKey] = student;
                const photoPending = student.photoUrl || 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
                
                pendingHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                        <td class="px-4 py-4 flex items-center">
                            <img src="${photoPending}" class="w-10 h-10 rounded-full border-2 border-amber-500 mr-3 object-cover shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                            <div>
                                <div class="text-white font-medium">${student.fullName || studentKey}</div>
                                <div class="text-xs text-slate-500">${studentKey}</div>
                            </div>
                        </td>
                        <td class="px-4 py-4">
                            <div class="text-slate-300">${student.mobile || 'N/A'}</div>
                            <div class="text-xs text-slate-500 truncate w-32" title="${student.address || ''}">${student.address || 'N/A'}</div>
                        </td>
                        <td class="px-4 py-4 text-amber-400 font-medium">${student.membership || 'N/A'}</td>
                        <td class="px-4 py-4">
                            <button class="btn-review bg-cyan-600/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-600 hover:text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-all" data-key="${studentKey}">
                                Review
                            </button>
                        </td>
                    </tr>
                `;
            }
        });
        
        statTotalStudents.innerText = totalActive;
        statPendingFees.innerText = pendingFeesCount;
        statAvailableSeats.innerText = globalTotalSeats - occupiedSeats; 
        
        if(tableHTML !== '') recentActivityTable.innerHTML = tableHTML;
        else recentActivityTable.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">No students found.</td></tr>`;

        if (pendingHTML !== '') pendingApprovalsTable.innerHTML = pendingHTML;
        else pendingApprovalsTable.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">No pending approvals! You are all caught up. 🎉</td></tr>`;

        // Save Dashboard Stats to Cache
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalActive = totalActive;
        cache.pendingFees = pendingFeesCount;
        cache.occupiedSeats = occupiedSeats;
        cache.tableHTML = tableHTML;
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));

    } else {
        recentActivityTable.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">No students found.</td></tr>`;
        pendingApprovalsTable.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">No pending approvals! You are all caught up. 🎉</td></tr>`;
    }
});

// --- 3. FETCH ATTENDANCE DATA ---
const attendanceRef = ref(db, 'Attendance');
onValue(attendanceRef, (snapshot) => {
    let presentCount = 0;
    if (snapshot.exists()) {
        snapshot.forEach((studentSnap) => {
            const studentAttendance = studentSnap.val();
            if (studentAttendance[dateString1] || studentAttendance[dateString2]) {
                presentCount++;
            }
        });
    }
    
    statPresentToday.innerText = presentCount;

    let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
    cache.presentCount = presentCount;
    localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
});

// --- 4. MODAL & APPROVAL LOGIC ---

// Listen for "Review" button clicks
pendingApprovalsTable.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-review');
    if (btn) {
        const key = btn.getAttribute('data-key');
        openApprovalModal(key);
    }
});

function openApprovalModal(studentKey) {
    const student = pendingStudentsData[studentKey];
    if(!student) return;

    // Set Read-Only UI
    document.getElementById('modalStudentKey').value = studentKey;
    document.getElementById('modalName').innerText = student.fullName || studentKey;
    document.getElementById('modalRegTime').innerText = "Reg: " + (student.registrationTime || 'N/A');
    document.getElementById('modalMobile').innerText = student.mobile || 'N/A';
    document.getElementById('modalMembership').innerText = student.membership || 'N/A';
    document.getElementById('modalAddress').innerText = student.address || 'N/A';
    
    const photo = student.photoUrl || 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
    document.getElementById('modalPhoto').src = photo;
    
    if (student.idProofUrl) {
        document.getElementById('modalIdProof').href = student.idProofUrl;
        document.getElementById('modalIdProof').classList.remove('hidden');
    } else {
        document.getElementById('modalIdProof').classList.add('hidden');
    }

    // Reset Admin Inputs
    document.getElementById('adminSeatNumber').value = '';
    document.getElementById('adminValidTill').value = `30 ${monthStr} ${year}`; 
    document.getElementById('adminLastPaid').value = `${monthStr} ${year}`;
    document.getElementById('adminFeeStatus').value = 'Paid';
    document.getElementById('adminDueAmount').value = '0';

    approvalModal.classList.remove('hidden');
}

// Close Modal
const closeModal = () => approvalModal.classList.add('hidden');
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('cancelApproveBtn').addEventListener('click', closeModal);

// Approve Action
document.getElementById('confirmApproveBtn').addEventListener('click', async () => {
    const studentKey = document.getElementById('modalStudentKey').value;
    const btn = document.getElementById('confirmApproveBtn');
    
    const seatNumber = document.getElementById('adminSeatNumber').value.trim();
    const validTill = document.getElementById('adminValidTill').value.trim();
    const feeStatus = document.getElementById('adminFeeStatus').value;
    const dueAmount = parseInt(document.getElementById('adminDueAmount').value) || 0;
    const lastPaidMonth = document.getElementById('adminLastPaid').value.trim();

    if (!seatNumber || !validTill || !lastPaidMonth) {
        alert("Please fill all admin fields (Seat, Valid Till, Last Paid Month) before approving.");
        return;
    }

    const updates = {
        status: "Approved",
        seatNumber: seatNumber,
        validTill: validTill,
        feeStatus: feeStatus,
        dueAmount: dueAmount,
        lastPaidMonth: lastPaidMonth
    };

    try {
        btn.innerHTML = `<span class="mr-2">⏳</span> Saving...`;
        btn.disabled = true;

        await update(ref(db, `Students/${studentKey}`), updates);
        
        closeModal();
        alert(`Success! ${studentKey} has been approved.`);
    } catch (error) {
        console.error("Error approving student:", error);
        alert("Something went wrong! Check console.");
    } finally {
        btn.innerHTML = `<span class="mr-2">✅</span> Approve & Save`;
        btn.disabled = false;
    }
});
