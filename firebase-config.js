// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB1stVLEI3K_m2nT7oidXt46rwGaIIxnbE",
    authDomain: "progression-logger-bd54a.firebaseapp.com",
    projectId: "progression-logger-bd54a",
    storageBucket: "progression-logger-bd54a.appspot.com",
    messagingSenderId: "191611716470",
    appId: "1:191611716470:web:8c88bb767fe6aa0aa7f057",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);