import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// TODO: Replace these with your actual keys from the Firebase Console!
const firebaseConfig = {
apiKey: "AIzaSyCETB0Li1OcgKCFtYQ_djykGafbRfQIS18",
  authDomain: "judgy-game.firebaseapp.com",
  databaseURL: "https://judgy-game-default-rtdb.firebaseio.com",
  projectId: "judgy-game",
  storageBucket: "judgy-game.firebasestorage.app",
  messagingSenderId: "671376227115",
  appId: "1:671376227115:web:4e7bbb68347944df82a36e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the database instance so App.jsx can use it
export const db = getDatabase(app);