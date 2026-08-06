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

// DOM Elements
const statTotalStudents = document.getElementById('statTotalStudents');
const statPresentToday = document.getElementById('statPresentToday');
const statPendingFees = document.getElementById('statPendingFees');
const pendingFeesNamesDiv = document.getElementById('pendingFeesNames');
const statAvailableSeats = document.getElementById('statAvailableSeats');
const statTotalCapacity = document.getElementById('statTotalCapacity');
const recentActivityTable = document.getElementById('recentActivityTable');
const allStudentsTable = document.getElementById('allStudentsTable');
const feesTableBody = document.getElementById('feesTableBody');
const feeFilterStatus = document.getElementById('feeFilterStatus');
const paymentModal = document.getElementById('paymentModal');

const today = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

let allStudentsDict = {}; 
let globalTotalSeats = 100; 
let activeStudentsList = []; // Array for sorting & filtering

// Main Engine
onValue(ref(db, 'Students'), (snapshot) => {
    let totalActive = 0, occupiedSeats = 0;
    let recentHTML = '', allHTML = '';
    activeStudentsList = [];
    let pendingFeeNames = [];
    allStudentsDict = {}; 

    if (snapshot.exists()) {
        snapshot.forEach((childSnap) => {
            const student = childSnap.val();
            const studentKey = childSnap.key;
            allStudentsDict[studentKey] = student;
            
            const photo = student.photoUrl || `https://ui-avatars.com/api/?name=${student.fullName || 'User'}&background=0D8ABC&color=fff`;
            const currentFeeStatus = checkFeeStatus(student.validTill);
            
            if (student.status === "Approved") {
                totalActive++;
                if (student.seatNumber && student.seatNumber.trim() !== "") occupiedSeats++;
                if (currentFeeStatus === "Due") pendingFeeNames.push(student.fullName || studentKey);
                
                activeStudentsList.push({ ...student, key: studentKey, photo, currentFeeStatus });
            }
        });

        // Top 6 Recent
        activeStudentsList.sort((a, b) => (new Date(b.registrationTime.replace(/__/g, ' ').replace(/-/g, '/')) || 0) - (new Date(a.registrationTime.replace(/__/g, ' ').replace(/-/g, '/')) || 0));
        activeStudentsList.slice(0, 6).forEach(s => {
            let feeColor = s.currentFeeStatus === "Paid" ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400 font-bold";
            recentHTML += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 flex items-center">
                        <img src="${s.photo}" class="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 mr-3 object-cover">
                        <div><div class="font-medium text-xs md:text-sm">${s.fullName || s.key}</div></div>
                    </td>
                    <td class="px-4 py-3 text-xs md:text-sm ${feeColor}">${s.currentFeeStatus}</td>
                    <td class="px-4 py-3 text-xs md:text-sm text-slate-500 dark:text-slate-300">${s.validTill || '--'}</td>
                    <td class="px-4 py-3"><span class="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] md:text-xs">Active</span></td>
                </tr>`;
        });

        // All Students HTML
        activeStudentsList.forEach(s => {
            let feeColor = s.currentFeeStatus === "Paid" ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400 font-bold";
            allHTML += `
                <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800/40">
                    <td class="px-4 py-3 flex items-center">
                        <img src="${s.photo}" class="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 mr-3 object-cover">
                        <div><div class="font-medium text-xs md:text-sm">${s.fullName || s.key}</div></div>
                    </td>
                    <td class="px-4 py-3 text-xs md:text-sm text-cyan-600 dark:text-cyan-400 font-bold">${s.seatNumber || 'N/A'}</td>
                    <td class="px-4 py-3 text-xs md:text-sm ${feeColor}">${s.currentFeeStatus}</td>
                    <td class="px-4 py-3 text-xs md:text-sm text-slate-500 dark:text-slate-300">${s.validTill || '--'}</td>
                    <td class="px-4 py-3"><button class="bg-slate-200 dark:bg-slate-700 hover:bg-cyan-500 text-slate-700 dark:text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Profile</button></td>
                </tr>`;
        });
        
        statTotalStudents.innerText = totalActive; 
        statPendingFees.innerText = pendingFeeNames.length; 
        statAvailableSeats.innerText = globalTotalSeats - occupiedSeats; 
        pendingFeesNamesDiv.innerText = pendingFeeNames.length > 0 ? pendingFeeNames.join(', ') : "No dues pending 🎉";

        recentActivityTable.innerHTML = recentHTML !== '' ? recentHTML : `<tr><td colspan="4" class="text-center py-8">No active students.</td></tr>`;
        allStudentsTable.innerHTML = allHTML !== '' ? allHTML : `<tr><td colspan="5" class="text-center py-8">No active students.</td></tr>`;
        
        renderFeesTable(); // Refresh Fees Table
    }
});

onValue(ref(db, 'totalSeat'), (snapshot) => { if (snapshot.exists()) globalTotalSeats = snapshot.val(); statTotalCapacity.innerText = globalTotalSeats; });

// ==========================================
// 🔥 FEES MANAGEMENT LOGIC
// ==========================================
function renderFeesTable() {
    let html = '';
    const filter = feeFilterStatus.value; // 'all', 'due', 'paid'
    
    // Sort by Due first, then name
    let sortedForFees = [...activeStudentsList].sort((a, b) => {
        if(a.currentFeeStatus === "Due" && b.currentFeeStatus === "Paid") return -1;
        if(a.currentFeeStatus === "Paid" && b.currentFeeStatus === "Due") return 1;
        return a.fullName.localeCompare(b.fullName);
    });

    sortedForFees.forEach(s => {
        if(filter === 'due' && s.currentFeeStatus === 'Paid') return;
        if(filter === 'paid' && s.currentFeeStatus === 'Due') return;

        let feeColor = s.currentFeeStatus === "Paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" 
                     : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800 shadow-[0_0_8px_rgba(239,68,68,0.2)]";

        html += `
            <tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800/40">
                <td class="px-4 py-3 flex items-center">
                    <img src="${s.photo}" class="w-10 h-10 rounded-full border border-slate-300 dark:border-slate-600 mr-3 object-cover">
                    <div><div class="font-bold text-slate-800 dark:text-white text-sm">${s.fullName || s.key}</div><div class="text-xs text-slate-500">${s.key}</div></div>
                </td>
                <td class="px-4 py-3 text-sm text-cyan-600 dark:text-cyan-400 font-bold">${s.seatNumber || 'N/A'}</td>
                <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 font-mono">${s.validTill || '--'}</td>
                <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-md text-xs font-bold border ${feeColor}">${s.currentFeeStatus}</span></td>
                <td class="px-4 py-3"><button class="btn-pay-fee bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all" data-key="${s.key}" data-name="${s.fullName}" data-seat="${s.seatNumber}" data-photo="${s.photo}">Record Payment</button></td>
            </tr>`;
    });
    
    feesTableBody.innerHTML = html !== '' ? html : `<tr><td colspan="5" class="text-center py-8">No students match this filter.</td></tr>`;
}

feeFilterStatus.addEventListener('change', renderFeesTable);

// Payment Modal Actions
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-pay-fee');
    if(btn) {
        document.getElementById('payStudentKey').value = btn.getAttribute('data-key');
        document.getElementById('payStudentName').innerText = btn.getAttribute('data-name');
        document.getElementById('payStudentSeat').innerText = "Seat: " + btn.getAttribute('data-seat');
        document.getElementById('payStudentPhoto').src = btn.getAttribute('data-photo');
        
        // Auto-fill suggestions
        let nextMonthStr = months[(today.getMonth() + 1) % 12];
        let calcYear = today.getMonth() === 11 ? year + 1 : year;
        
        document.getElementById('payMonthYear').value = `${monthStr} ${year}`;
        document.getElementById('payAmount').value = "500";
        document.getElementById('payD2D').value = `01 ${monthStr} - 30 ${monthStr}`;
        document.getElementById('payDate').value = `${date < 10 ? '0'+date : date} ${monthStr} ${year}`;
        document.getElementById('payNextValidTill').value = `30 ${nextMonthStr} ${calcYear}`;

        paymentModal.classList.remove('hidden');
    }
});

document.getElementById('closePaymentModalBtn').addEventListener('click', () => paymentModal.classList.add('hidden'));

document.getElementById('submitPaymentBtn').addEventListener('click', async () => {
    const studentKey = document.getElementById('payStudentKey').value;
    const monthYear = document.getElementById('payMonthYear').value.trim();
    const amount = document.getElementById('payAmount').value.trim();
    const d2d = document.getElementById('payD2D').value.trim();
    const payDate = document.getElementById('payDate').value.trim();
    const newValidTill = document.getElementById('payNextValidTill').value.trim();

    if(!monthYear || !amount || !newValidTill) return alert("Please fill Month/Year, Amount, and New Valid Till dates.");

    const btn = document.getElementById('submitPaymentBtn');
    btn.innerHTML = `⏳ Saving...`; btn.disabled = true;

    try {
        // 🔥 ATOMIC MULTI-PATH UPDATE
        const updates = {};
        updates[`Payments/${studentKey}/${monthYear}`] = { amount: Number(amount), d2d: d2d, payDate: payDate };
        updates[`Students/${studentKey}/validTill`] = newValidTill;

        await update(ref(db), updates);
        
        alert("Payment Recorded & Profile Updated!");
        paymentModal.classList.add('hidden');
    } catch (e) {
        console.error(e);
        alert("Error saving payment.");
    } finally {
        btn.innerHTML = `<span class="mr-2">💾</span> Save & Update`; btn.disabled = false;
    }
});
