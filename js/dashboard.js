import { db } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// DOM Elements
const statTotalStudents = document.getElementById('statTotalStudents');
const statPresentToday = document.getElementById('statPresentToday');
const statPendingFees = document.getElementById('statPendingFees');
const statAvailableSeats = document.getElementById('statAvailableSeats');
const recentActivityTable = document.getElementById('recentActivityTable');

// Settings
const TOTAL_LIBRARY_SEATS = 100; // Library ki total seats yahan set karein

// Aaj ki Date format karna (Firebase me aapka format "1 August 2026" ya "01 August 2026" hai)
const today = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const date = today.getDate();
const monthStr = months[today.getMonth()];
const year = today.getFullYear();

// Hum dono formats check karenge taaki single digit (1 Aug) aur double digit (01 Aug) dono catch ho jayein
const dateString1 = `${date} ${monthStr} ${year}`;
const dateString2 = `${date < 10 ? '0' + date : date} ${monthStr} ${year}`;


// --- 1. FETCH STUDENTS DATA (Stats & Table) ---
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
            
            // Total Active Students aur Occupied Seats
            if (student.status === "Approved") {
                totalActive++;
                if (student.seatNumber && student.seatNumber.trim() !== "") {
                    occupiedSeats++;
                }
            }

            // Pending Fees Count (Agar "Paid" nahi hai ya dueAmount > 0 hai)
            if (student.feeStatus !== "Paid" || (student.dueAmount && student.dueAmount > 0)) {
                pendingFeesCount++;
            }

            // Sirf 6 students dikhayenge table me recent dashboard par
            if(studentCount < 6) {
                const photo = student.photoUrl ? student.photoUrl : 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
                
                // Colors logic based on status
                let accStatusColor = "bg-slate-700 text-slate-300";
                if(student.status === "Approved") accStatusColor = "bg-emerald-900/60 text-emerald-400 border border-emerald-500/30";
                if(student.status === "Pending") accStatusColor = "bg-amber-900/60 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.3)]";

                let feeColor = "text-emerald-400"; // Paid
                let feeText = "Paid";
                if(student.feeStatus !== "Paid") {
                    feeColor = "text-red-400 font-bold";
                    feeText = `Due: ₹${student.dueAmount || 0}`;
                }
                
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
                            <span class="${accStatusColor} px-2 py-1.5 rounded text-xs tracking-wide">
                                ${student.status || 'Unknown'}
                            </span>
                        </td>
                    </tr>
                `;
                studentCount++;
            }
        });
        
        // Update HTML UI
        statTotalStudents.innerText = totalActive;
        statPendingFees.innerText = pendingFeesCount;
        statAvailableSeats.innerText = TOTAL_LIBRARY_SEATS - occupiedSeats; 
        
        if(tableHTML !== '') {
            recentActivityTable.innerHTML = tableHTML;
        }
    } else {
        recentActivityTable.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">No students found.</td></tr>`;
    }
});


// --- 2. FETCH ATTENDANCE DATA (Today's count) ---
const attendanceRef = ref(db, 'Attendance');

onValue(attendanceRef, (snapshot) => {
    let presentCount = 0;
    
    if (snapshot.exists()) {
        snapshot.forEach((studentSnap) => {
            const studentAttendance = studentSnap.val();
            
            // Check agar aaj ki date (jaise "3 August 2026" ya "03 August 2026") student ke data me hai
            if (studentAttendance[dateString1] || studentAttendance[dateString2]) {
                presentCount++;
            }
        });
    }
    
    statPresentToday.innerText = presentCount;
});
