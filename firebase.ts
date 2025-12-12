import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  updateProfile
} from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAcdJflbBZXgwIss1wkdzpslaO9D-DI2WY",
  authDomain: "notulensi-rapat-kpu.firebaseapp.com",
  projectId: "notulensi-rapat-kpu",
  storageBucket: "notulensi-rapat-kpu.firebasestorage.app",
  messagingSenderId: "572554244870",
  appId: "1:572554244870:web:55b2bc43b046d1826c6487",
  measurementId: "G-ER6WBTYVFT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize analytics conditionally
let analytics;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch((err) => {
  console.warn("Firebase Analytics not supported:", err);
});

// Auth Functions
const ADMIN_EMAIL = "admin@notulensi.app";
const ADMIN_PASSWORD_INTERNAL = "admin123"; 

export const loginAsDefaultAdmin = async () => {
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD_INTERNAL);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD_INTERNAL);
        await updateProfile(userCredential.user, { displayName: "Administrator" });
      } catch (createError) {
        console.error("Error creating default admin:", createError);
        throw createError;
      }
    } else {
      console.error("Error signing in as admin:", error);
      throw error;
    }
  }
};

export const logOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};

// Database Functions

// 1. Inisialisasi Rapat Baru (Status: live)
export const initializeMeeting = async (userId: string, title: string) => {
  try {
    const docRef = await addDoc(collection(db, "meetings"), {
      userId,
      title: title || `Rapat ${new Date().toLocaleDateString('id-ID')}`,
      status: 'live',
      transcriptSegments: [], // Array untuk menyimpan transkrip per jam
      content: '', // Hasil akhir nanti
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating meeting doc:", error);
    throw error;
  }
};

// 2. Simpan Potongan Transkrip (Per Jam)
export const saveTranscriptChunk = async (meetingId: string, transcriptChunk: string) => {
  try {
    const meetingRef = doc(db, "meetings", meetingId);
    await updateDoc(meetingRef, {
      transcriptSegments: arrayUnion(transcriptChunk),
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving transcript chunk:", error);
    // Kita tidak throw error agar proses recording di frontend tidak berhenti total
  }
};

// 3. Finalisasi Rapat (Simpan Dokumen Akhir)
export const finalizeMeeting = async (meetingId: string, finalContent: string) => {
  try {
    const meetingRef = doc(db, "meetings", meetingId);
    await updateDoc(meetingRef, {
      content: finalContent,
      status: 'completed',
      finishedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error finalizing meeting:", error);
    throw error;
  }
};

// Deprecated: Fungsi lama untuk backward compatibility
export const saveMeeting = async (userId: string, content: string) => {
  try {
    const titleLine = content.split('\n').find(line => line.trim().length > 0) || "Rapat Baru";
    const title = titleLine.replace(/^#+\s*/, '').substring(0, 50);

    await addDoc(collection(db, "meetings"), {
      userId,
      content,
      title: title || `Rapat ${new Date().toLocaleDateString('id-ID')}`,
      status: 'completed',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error saving meeting:", error);
    throw error;
  }
};

export const subscribeToHistory = (userId: string, callback: (data: any[]) => void) => {
  const q = query(
    collection(db, "meetings"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, 
    (snapshot) => {
      const meetings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      callback(meetings);
    },
    (error) => {
      console.warn("Error subscribing to history (permission denied or missing index):", error);
      callback([]); 
    }
  );
};

export { auth, db };