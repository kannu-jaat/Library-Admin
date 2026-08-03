// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// TODO: Replace with your app's Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyBu0OkmpY7uXZkQIlVxfQj9MCyGBOA9sxI",
    authDomain: "whatsapp-web-03.firebaseapp.com",
  databaseURL: "https://whatsapp-web-03-default-rtdb.firebaseio.com",
  projectId: "whatsapp-web-03",
  storageBucket: "whatsapp-web-03.firebasestorage.app",
  messagingSenderId: "239319034758",
  appId: "1:239319034758:web:1c260d221b5f698a63da07"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export instances to use in other files
export const auth = getAuth(app);
export const db = getDatabase(app);
