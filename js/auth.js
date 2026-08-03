import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Check if already logged in, redirect to dashboard
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "dashboard.html";
    }
});

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('errorMsg');
const loginBtn = document.getElementById('loginBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Show Loader
    loginBtn.disabled = true;
    btnText.textContent = "Authenticating...";
    btnLoader.classList.remove('hidden');
    errorMsg.classList.add('hidden');

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Logged in successfully
            const user = userCredential.user;
            console.log("Logged in as:", user.email);
            // Redirection is handled by onAuthStateChanged above
        })
        .catch((error) => {
            // Handle Errors here
            loginBtn.disabled = false;
            btnText.textContent = "Sign In";
            btnLoader.classList.add('hidden');
            
            errorMsg.textContent = "Login failed! Please check your email and password.";
            errorMsg.classList.remove('hidden');
            console.error("Auth Error:", error.code, error.message);
        });
});
