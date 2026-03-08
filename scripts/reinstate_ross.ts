import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

async function run() {
    console.log("Searching for ROSS in session histories...");
    const sessionsRef = collection(db, "sessions");
    const sessionsSnap = await getDocs(sessionsRef);

    let rossId = null;
    let rossName = "ROSS";

    for (const sessionDoc of sessionsSnap.docs) {
        const data = sessionDoc.data();
        if (!data.fullState) continue;

        let parsedSession;
        try {
            parsedSession = JSON.parse(data.fullState);
        } catch (e) {
            continue;
        }

        const allRequests = [
            ...(parsedSession.requests || []),
            ...(parsedSession.history || [])
        ];

        for (const req of allRequests) {
            if (req.participantName && req.participantName.toLowerCase() === 'ross') {
                rossId = req.participantId;
                rossName = req.participantName; // preserve original casing if possible
                break;
            }
        }
        if (rossId) break;
    }

    if (rossId) {
        console.log(`Found ${rossName} with ID: ${rossId}`);
        const userRef = doc(db, "users", rossId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            console.log(`Recreating ${rossName}...`);
            await setDoc(userRef, {
                id: rossId,
                name: rossName,
                favorites: [],
                personalHistory: [],
                createdAt: Date.now()
            });
            console.log(`${rossName} recreated successfully.`);
        } else {
            console.log(`${rossName} already exists in the database.`);
        }
    } else {
        console.log("Could not find ROSS in any session history.");
    }
}

run().then(() => process.exit(0)).catch(e => console.error(e));
