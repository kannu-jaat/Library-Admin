import { db } from './firebase-config.js';
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// DOM Elements
const statTotalStudents = document.getElementById('statTotalStudents');
const statPresentToday = document.getElementById('statPresentToday');
const statPendingFees = document.getElementById('statPendingFees');
const statAvailableSeats = document.getElementById('statAvailableSeats');
const statTotalCapacity = document.getElementById('statTotalCapacity');
const recentActivityTable = document.getElementById('recentActivityTable');

// Dates configuration
const today = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const date = today.getDate();
const monthStr = months[today.getMonth()];
const year = today.getFullYear();

const dateString1 = `${date} ${monthStr} ${year}`;
const dateString2 = `${date < 10 ? '0' + date : date} ${monthStr} ${year}`;

// 🔥 CACHE MANAGER: Load Instant Data from LocalStorage
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
// Paint UI instantly!
loadCachedDashboard();

let globalTotalSeats = 100; // Fallback

// --- 1. FETCH TOTAL SEATS CONFIG ---
// Assuming "totalSeat" is stored at the root of your Realtime DB
const seatConfigRef = ref(db, 'totalSeat');
onValue(seatConfigRef, (snapshot) => {
    if (snapshot.exists()) {
        globalTotalSeats = snapshot.val();
        statTotalCapacity.innerText = globalTotalSeats;
        
        // Update local cache manually
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
    let studentCount = 0;

    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const student = childSnapshot.val();
            
            if (student.status === "Approved") {
                totalActive++;
                if (student.seatNumber && student.seatNumber.trim() !== "") occupiedSeats++;
            }

            if (student.feeStatus !== "Paid" || (student.dueAmount && student.dueAmount > 0)) {
                pendingFeesCount++;
            }

            // Top 6 Recent Students
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
                                <div class="text-white font-medium">${student.fullName || childSnapshot.key}</div>
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
        });
        
        statTotalStudents.innerText = totalActive;
        statPendingFees.innerText = pendingFeesCount;
        statAvailableSeats.innerText = globalTotalSeats - occupiedSeats; 
        if(tableHTML !== '') recentActivityTable.innerHTML = tableHTML;

        // 🔥 Save to Local Storage Cache
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalActive = totalActive;
        cache.pendingFees = pendingFeesCount;
        cache.occupiedSeats = occupiedSeats;
        cache.tableHTML = tableHTML;
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));

    } else {
        recentActivityTable.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">No students found.</td></tr>`;
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

    // 🔥 Save Attendance to Cache
    let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
    cache.presentCount = presentCount;
    localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
});
