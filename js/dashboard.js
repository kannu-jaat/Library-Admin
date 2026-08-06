import { db } from './firebase-config.js';
import { ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const statTotalStudents = document.getElementById('statTotalStudents');
const statPresentToday = document.getElementById('statPresentToday');
const statPendingFees = document.getElementById('statPendingFees');
const statPendingNames = document.getElementById('statPendingNames');
const statAvailableSeats = document.getElementById('statAvailableSeats');
const statTotalCapacity = document.getElementById('statTotalCapacity');
const recentActivityTable = document.getElementById('recentActivityTable');
const pendingApprovalsTable = document.getElementById('pendingApprovalsTable');
const allStudentsTable = document.getElementById('allStudentsTable');
const seatGridContainer = document.getElementById('seatGridContainer');
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

// 🔥 CACHE MANAGER
function loadCachedDashboard() {
    const cachedData = JSON.parse(localStorage.getItem('adminDashboardCache'));
    if (cachedData) {
        statTotalStudents.innerText = cachedData.totalActive || 0;
        statPendingFees.innerText = cachedData.pendingFees || 0;
        statPendingNames.innerText = cachedData.pendingNamesString || "No pending fees.";
        statTotalCapacity.innerText = cachedData.totalSeats || 100;
        statAvailableSeats.innerText = (cachedData.totalSeats || 100) - (cachedData.occupiedSeats || 0);
        statPresentToday.innerText = cachedData.presentCount || 0;
        if(cachedData.recentHTML) recentActivityTable.innerHTML = cachedData.recentHTML;
        if(cachedData.pendingHTML) pendingApprovalsTable.innerHTML = cachedData.pendingHTML;
        if(cachedData.allStudentsHTML) allStudentsTable.innerHTML = cachedData.allStudentsHTML;
        if(cachedData.seatGridHTML) seatGridContainer.innerHTML = cachedData.seatGridHTML;
    }
}
loadCachedDashboard();

// Helper: Parse Registration Time (29-06-2026__16-36)
function parseRegTime(timeStr) {
    if (!timeStr) return 0;
    try {
        const parts = timeStr.split('__');
        if(parts.length !== 2) return 0;
        const d = parts[0].split('-');
        const t = parts[1].split('-');
        return new Date(d[2], d[1]-1, d[0], t[0], t[1]).getTime();
    } catch (e) { return 0; }
}

const seatConfigRef = ref(db, 'totalSeat');
onValue(seatConfigRef, (snapshot) => {
    if (snapshot.exists()) {
        globalTotalSeats = parseInt(snapshot.val()) || 100;
        statTotalCapacity.innerText = globalTotalSeats;
        let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
        cache.totalSeats = globalTotalSeats;
        localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
    }
});

// --- 2. FETCH STUDENTS DATA (Main Sorting & Matrix Engine) ---
const studentsRef = ref(db, 'Students');
onValue(studentsRef, (snapshot) => {
    
    let activeStudentsArray = [];
    let pendingStudentsArray = [];
    let pendingFeeNames = [];
    let seatMap = new Array(globalTotalSeats + 1).fill(null); 
    
    allStudentsDict = {}; 

    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const student = childSnapshot.val();
            student.key = childSnapshot.key;
            allStudentsDict[student.key] = student;
            
            if (student.status === "Approved") {
                activeStudentsArray.push(student);
                
                // Smart Seat Parsing (Extracts '3' from 'K03' or 'Seat 3')
                if (student.seatNumber) {
                    let numMatch = student.seatNumber.match(/\d+/);
                    if(numMatch) {
                        let idx = parseInt(numMatch[0]);
                        if(idx >= 1 && idx <= globalTotalSeats) {
                            seatMap[idx] = student;
                        }
                    }
                }
            } else if (student.status === "Pending") {
                pendingStudentsArray.push(student);
            }

            // Pending Fees Catcher
            if (student.feeStatus !== "Paid" || (student.dueAmount && student.dueAmount > 0)) {
                pendingFeeNames.push(student.fullName || student.key);
            }
        });
    }

    // 1. Sort by Registration Time (Newest First)
    activeStudentsArray.sort((a, b) => parseRegTime(b.registrationTime) - parseRegTime(a.registrationTime));

    // 2. Build Dashboard Tables
    let recentHTML = '';
    let allHTML = '';
    
    activeStudentsArray.forEach((student, index) => {
        const photo = student.photoUrl || 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
        let feeColor = student.feeStatus !== "Paid" ? "text-red-400 font-bold" : "text-emerald-400";
        let feeText = student.feeStatus !== "Paid" ? `Due: ₹${student.dueAmount || 0}` : "Paid";
        
        let rowCommon = `
            <div>
                <div class="text-white font-medium text-xs md:text-sm">${student.fullName || student.key}</div>
                <div class="text-[10px] md:text-xs text-slate-500">${student.mobile || student.seatNumber || 'N/A'}</div>
            </div>`;
            
        // Top 6 for Recent Activity (Added btn-open-profile to image)
        if (index < 6) {
            recentHTML += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                    <td class="px-4 py-3 flex items-center">
                        <img src="${photo}" data-key="${student.key}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-slate-600 mr-3 object-cover btn-open-profile cursor-pointer transition-transform hover:scale-110 shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                        ${rowCommon}
                    </td>
                    <td class="px-4 py-3 text-xs md:text-sm ${feeColor}">${feeText}</td>
                    <td class="px-4 py-3 text-xs md:text-sm text-slate-300">${student.registrationTime ? student.registrationTime.split('__')[0] : '--'}</td>
                    <td class="px-4 py-3"><span class="bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-[10px] md:text-xs tracking-wide">Active</span></td>
                </tr>`;
        }

        allHTML += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                <td class="px-4 py-3 flex items-center">
                    <img src="${photo}" data-key="${student.key}" class="w-8 h-8 md:w-10 md:h-10 rounded-full border border-cyan-500/50 mr-3 object-cover btn-open-profile cursor-pointer hover:scale-110">
                    ${rowCommon}
                </td>
                <td class="px-4 py-3 text-xs md:text-sm text-cyan-400 font-bold">${student.seatNumber || 'N/A'}</td>
                <td class="px-4 py-3 text-xs md:text-sm ${feeColor}">${feeText}</td>
                <td class="px-4 py-3 text-xs md:text-sm text-slate-300">${student.validTill || '--'}</td>
                <td class="px-4 py-3"><button class="btn-open-profile bg-slate-700 hover:bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" data-key="${student.key}">View Profile</button></td>
            </tr>`;
    });

    let pendingHTML = '';
    pendingStudentsArray.forEach(student => {
        const photo = student.photoUrl || 'https://ui-avatars.com/api/?name=' + (student.fullName || 'User') + '&background=0D8ABC&color=fff';
        pendingHTML += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-all">
                <td class="px-4 py-3 flex items-center">
                    <img src="${photo}" data-key="${student.key}" data-type="approve" class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-amber-500 mr-3 object-cover shadow-[0_0_8px_rgba(245,158,11,0.4)] btn-open-profile cursor-pointer">
                    <div><div class="text-white font-medium text-xs md:text-sm">${student.fullName || student.key}</div><div class="text-[10px] md:text-xs text-slate-500">${student.key}</div></div>
                </td>
                <td class="px-4 py-3"><div class="text-slate-300 text-xs md:text-sm">${student.mobile || 'N/A'}</div><div class="text-[10px] md:text-xs text-slate-500 truncate w-24 md:w-32" title="${student.address || ''}">${student.address || 'N/A'}</div></td>
                <td class="px-4 py-3 text-amber-400 font-medium text-xs md:text-sm">${student.membership || 'N/A'}</td>
                <td class="px-4 py-3"><button class="btn-open-profile bg-amber-600/20 text-amber-400 border border-amber-500/50 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" data-key="${student.key}" data-type="approve">Review</button></td>
            </tr>`;
    });

    // 3. Build Smart Seat Matrix
    let seatGridHTML = '';
    let occupiedSeats = 0;
    
    for(let i=1; i<=globalTotalSeats; i++) {
        let occupant = seatMap[i];
        if(occupant) {
            occupiedSeats++;
            let bgClass = occupant.feeStatus !== "Paid" ? "bg-red-900/40 border-red-500" : "bg-blue-900/40 border-blue-500";
            let textColor = occupant.feeStatus !== "Paid" ? "text-red-400" : "text-blue-400";
            let photo = occupant.photoUrl || 'https://ui-avatars.com/api/?name=' + (occupant.fullName || 'U') + '&background=0D8ABC&color=fff';
            
            seatGridHTML += `
                <div class="seat-card ${bgClass} border rounded-lg p-3 flex flex-col items-center justify-center text-center shadow-lg btn-open-profile" data-key="${occupant.key}">
                    <span class="text-xs font-bold text-slate-400 mb-1">${occupant.seatNumber}</span>
                    <img src="${photo}" class="w-8 h-8 rounded-full mb-1 object-cover border border-slate-500">
                    <span class="text-[10px] font-bold ${textColor} truncate w-full">${occupant.fullName || occupant.key}</span>
                </div>
            `;
        } else {
            seatGridHTML += `
                <div class="seat-card bg-slate-800 border border-emerald-500/40 rounded-lg p-3 flex flex-col items-center justify-center text-center opacity-70 hover:opacity-100 hover:bg-emerald-900/30">
                    <span class="text-xs font-bold text-emerald-400 mb-1">Seat ${i}</span>
                    <span class="text-[10px] text-slate-500">Available</span>
                </div>
            `;
        }
    }

    // Update UI Stats
    let totalActive = activeStudentsArray.length;
    let pendingFeesCount = pendingFeeNames.length;
    let pendingNamesStr = pendingFeeNames.length > 0 ? pendingFeeNames.join(" • ") : "All fees paid! 🎉";

    statTotalStudents.innerText = totalActive; 
    statPendingFees.innerText = pendingFeesCount; 
    statPendingNames.innerText = pendingNamesStr;
    statAvailableSeats.innerText = globalTotalSeats - occupiedSeats; 
    
    recentActivityTable.innerHTML = recentHTML !== '' ? recentHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No active students.</td></tr>`;
    pendingApprovalsTable.innerHTML = pendingHTML !== '' ? pendingHTML : `<tr><td colspan="4" class="text-center py-8 text-slate-500">No pending approvals! 🎉</td></tr>`;
    allStudentsTable.innerHTML = allHTML !== '' ? allHTML : `<tr><td colspan="5" class="text-center py-8 text-slate-500">No active students found.</td></tr>`;
    seatGridContainer.innerHTML = seatGridHTML;

    // Cache Data
    let cache = JSON.parse(localStorage.getItem('adminDashboardCache')) || {};
    cache.totalActive = totalActive; cache.pendingFees = pendingFeesCount; cache.pendingNamesString = pendingNamesStr; cache.occupiedSeats = occupiedSeats;
    cache.recentHTML = recentHTML; cache.pendingHTML = pendingHTML; cache.allStudentsHTML = allHTML; cache.seatGridHTML = seatGridHTML;
    localStorage.setItem('adminDashboardCache', JSON.stringify(cache));
    localStorage.setItem('allStudentsDataCache', JSON.stringify(allStudentsDict));
});

// Global Event Listener for Profile Modals (Works on Buttons & Images)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-open-profile');
    if (btn) {
        const key = btn.getAttribute('data-key');
        const mode = btn.getAttribute('data-type'); 
        openProfileModal(key, mode === 'approve');
    }
});

// Search functionality for Seat Matrix
document.getElementById('searchSeats').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase(); 
    const cards = seatGridContainer.getElementsByClassName('seat-card');
    for (let card of cards) { 
        const text = card.innerText.toLowerCase(); 
        card.style.display = text.includes(query) ? '' : 'none'; 
    }
});
