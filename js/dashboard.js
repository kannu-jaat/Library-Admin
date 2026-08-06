import { db } from './firebase-config.js';
import { ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// DOM Elements Link
const statTotalStudents = document.getElementById('statTotalStudents');
const statPresentToday = document.getElementById('statPresentToday');
const statPendingFees = document.getElementById('statPendingFees');
const pendingFeesNames = document.getElementById('pendingFeesNames'); // NEW
const statAvailableSeats = document.getElementById('statAvailableSeats');
const statTotalCapacity = document.getElementById('statTotalCapacity');
const recentActivityTable = document.getElementById('recentActivityTable');
const seatGrid = document.getElementById('seatGrid'); // NEW
const searchSeats = document.getElementById('searchSeats'); // NEW

const today = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dateString1 = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
const dateString2 = `${today.getDate() < 10 ? '0' + today.getDate() : today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

let allStudentsDict = JSON.parse(localStorage.getItem('allStudentsDataCache')) || {}; 
let globalTotalSeats = 100; 

// CACHE MANAGER
function loadCachedDashboard() {
    const cachedData = JSON.parse(localStorage.getItem('adminDashboardCache'));
    if (cachedData) {
        statTotalStudents.innerText = cachedData.totalActive || 0;
        statPendingFees.innerText = cachedData.pendingFees || 0;
        statTotalCapacity.innerText = cachedData.totalSeats || 100;
        statAvailableSeats.innerText = (cachedData.totalSeats || 100) - (cachedData.occupiedSeats || 0);
        statPresentToday.innerText = cachedData.presentCount || 0;
        if(cachedData.pendingNames) pendingFeesNames.innerText = cachedData.pendingNames;
        if(cachedData.recentHTML) recentActivityTable.innerHTML = cachedData.recentHTML;
        
        // Render Seats from Cache instantly!
        if(Object.keys(allStudentsDict).length > 0) renderSeatMatrix('');
    }
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
        renderSeatMatrix(searchSeats.value); // Re-render if it changes
    }
});

// MAIN ENGINE: STUDENTS FETCH & SORTING
onValue(ref(db, 'Students'), (snapshot) => {
    let totalActive = 0, pendingFeesCount = 0, occupiedSeats = 0;
    let pendingNamesArray = [];
    let allStudentsArray = [];
    
    allStudentsDict = {}; 

    if (snapshot.exists()) {
        // Collect into array for sorting
        snapshot.forEach((childSnapshot) => {
            const student = childSnapshot.val();
            student.key = childSnapshot.key;
            allStudentsArray.push(student);
            allStudentsDict[student.key] = student;
            
            if (student.status === "Approved" && student.seatNumber && student.seatNumber.trim() !== "") occupiedSeats++;
            if (student.feeStatus !== "Paid" || (student.dueAmount && student.dueAmount > 0)) {
                pendingFeesCount++;
                pendingNamesArray.push(student.fullName || student.key);
            }
        });

        // 🔥 SORTING BY REGISTRATION TIME (Newest Top)
        allStudentsArray.sort((a, b) => {
            function parseCustomDate(dStr) {
                if(!dStr) return 0;
                let parts = dStr.split('__');
                if(parts.length < 2) return 0;
                let d = parts[0].split('-');
                let t = parts[1].split('-');
                return new Date(d[2], d[1]-1, d[0], t[0], t[1]).getTime();
            }
            return parseCustomDate(b.registrationTime) - parseCustomDate(a.registrationTime);
        });

        // Build HTML after sorting
        let recentHTML = '';
        let studentCount = 0;

        allStudentsArray.forEach((student) => {
            if (student.status === "Approved") totalActive++;

            // Recent Active Students Table (Top 6 ONLY)
            if (student.status === "Approved" && studentCount < 6) {
                const photo = student.photoUrl || 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
                let feeColor = student.feeStatus !== "Paid" ? "text-red-400 font-bold" : "text-emerald-400";
                
                recentHTML += `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                        <td class="px-4 py-3 flex items-center">
                            <!-- 🔥 CLICKABLE PHOTO WITH btn-open-profile -->
                            <img src="${photo}" data-key="${student.key}" class="btn-open-profile cursor-pointer w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-slate-500 hover:border-cyan-400 mr-3 object-cover shadow-lg transition-colors">
                            <div>
                                <div class="text-white font-medium text-xs md:text-sm">${student.fullName || student.key}</div>
                                <div class="text-[10px] md:text-xs text-slate-500">Seat: ${student.seatNumber || 'N/A'}</div>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-xs md:text-sm ${feeColor}">${student.feeStatus}</td>
                        <td class="px-4 py-3 text-xs md:text-sm text-slate-300">${student.validTill || '--'}</td>
                        <td class="px-4 py-3 text-xs text-slate-400">${student.registrationTime ? student.registrationTime.split('__')[0] : '--'}</td>
                    </tr>`;
                studentCount++;
            }
        });
        
        // Update UI
        statTotalStudents.innerText = totalActive; 
        statPendingFees.innerText = pendingFeesCount; 
        statAvailableSeats.innerText = globalTotalSeats - occupiedSeats; 
        
        let namesText = pendingNamesArray.length > 0 ? pendingNamesArray.join(' • ') : "All Clear! 🎉";
        pendingFeesNames.innerText = namesText;
        
        recentActivityTable.innerHTML = recentHTML !== '' ? recentHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No recent students found.</td></tr>`;

        // Update Seat Matrix if view is active or data changes
        renderSeatMatrix(searchSeats.value);

        // Save Dashboard Stats to Cache
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalActive = totalActive; cache.pendingFees = pendingFeesCount; cache.occupiedSeats = occupiedSeats;
        cache.recentHTML = recentHTML; cache.pendingNames = namesText;
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
        localStorage.setItem('allStudentsDataCache', JSON.stringify(allStudentsDict));
    }
});

// --- 🔥 VISUAL SEAT MATRIX ENGINE ---
function renderSeatMatrix(searchTerm = '') {
    let seatHTML = '';
    let query = searchTerm.toLowerCase();
    let allottedCount = 0;
    
    // 1. Render Allotted Seats
    Object.keys(allStudentsDict).forEach(key => {
        const s = allStudentsDict[key];
        if (s.status === "Approved" && s.seatNumber && s.seatNumber.trim() !== '') {
            allottedCount++;
            const name = s.fullName || key;
            const seatNo = s.seatNumber;
            
            if (name.toLowerCase().includes(query) || seatNo.toLowerCase().includes(query)) {
                seatHTML += `
                    <div class="btn-open-profile cursor-pointer bg-red-900/40 border border-red-500/50 rounded-lg p-3 hover:bg-red-900/80 transition-colors flex flex-col items-center justify-center text-center h-24 shadow-[0_0_10px_rgba(239,68,68,0.2)]" data-key="${key}">
                        <span class="text-lg font-bold text-red-400">${seatNo}</span>
                        <span class="text-[10px] text-slate-300 mt-1 truncate w-full" title="${name}">${name}</span>
                    </div>`;
            }
        }
    });
    
    // 2. Render Empty Seats logic
    let emptyCount = globalTotalSeats - allottedCount;
    if (emptyCount < 0) emptyCount = 0;
    
    document.getElementById('countAllotted').innerText = allottedCount;
    document.getElementById('countEmpty').innerText = emptyCount;

    // Show empty seats only if query is empty OR matches 'empty/available'
    if (query === '' || 'empty'.includes(query) || 'available'.includes(query)) {
        for(let i=0; i<emptyCount; i++) {
            seatHTML += `
                <div class="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 flex flex-col items-center justify-center text-center h-24 opacity-70">
                    <span class="text-lg font-bold text-emerald-500/50">--</span>
                    <span class="text-[10px] text-emerald-300 mt-1">Empty</span>
                </div>`;
        }
    }
    
    if(seatHTML === '') seatHTML = '<div class="col-span-full text-center text-slate-500 py-10">No seats matched your search.</div>';
    
    seatGrid.innerHTML = seatHTML;
}

searchSeats.addEventListener('input', (e) => renderSeatMatrix(e.target.value));


// KEEP YOUR EXISTING MODAL OPEN & SUBMIT LOGIC BELOW THIS
// It uses document.addEventListener('click', ...) so it will automatically catch clicks on the Seat Grid and Recent Table Photos!
