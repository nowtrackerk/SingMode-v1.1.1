// scripts/backfillHistory.ts

import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { RequestStatus, SongRequest, UserProfile } from '../types';

async function runBackfill() {
    console.log("Starting Personal History Backfill...");

    try {
        const sessionsRef = collection(db, "sessions");
        const sessionsSnap = await getDocs(sessionsRef);

        const usersRef = collection(db, "users");
        const usersSnap = await getDocs(usersRef);

        const usersMap = new Map<string, UserProfile>();
        usersSnap.forEach(d => usersMap.set(d.id, d.data() as UserProfile));

        let updatedUsersCount = 0;
        let totalSongsBackfilled = 0;

        for (const sessionDoc of sessionsSnap.docs) {
            const data = sessionDoc.data();
            if (!data.fullState) continue;

            let parsedSession;
            try {
                parsedSession = JSON.parse(data.fullState);
            } catch (e) {
                continue;
            }

            const allRequests: SongRequest[] = [
                ...(parsedSession.requests || []),
                ...(parsedSession.history || [])
            ];

            for (const req of allRequests) {
                if (req.status === RequestStatus.DONE && req.participantId) {
                    const user = usersMap.get(req.participantId);
                    if (user) {
                        if (!user.personalHistory) user.personalHistory = [];

                        // Check if it already exists in their history
                        const alreadyExists = user.personalHistory.some(h =>
                            h.id === req.id ||
                            (h.songName.toLowerCase() === req.songName.toLowerCase() && h.artist.toLowerCase() === req.artist.toLowerCase())
                        );

                        if (!alreadyExists) {
                            const histRecord = { ...req, status: RequestStatus.DONE, completedAt: req.completedAt || Date.now() };
                            user.personalHistory.unshift(histRecord);
                            totalSongsBackfilled++;
                            usersMap.set(user.id, user);
                        }
                    }
                }
            }
        }

        // Now push updates
        for (const [userId, user] of Array.from(usersMap.entries())) {
            const dbUserStr = JSON.stringify((usersSnap.docs.find(d => d.id === userId)?.data() as UserProfile)?.personalHistory || []);
            const newUserStr = JSON.stringify(user.personalHistory);

            if (dbUserStr !== newUserStr) {
                // Enforce max 50 length
                const trimmedHistory = user.personalHistory.slice(0, 50);
                await updateDoc(doc(db, "users", userId), { personalHistory: trimmedHistory });
                updatedUsersCount++;
                console.log(`Updated history for user: ${user.name} (${trimmedHistory.length} songs)`);
            }
        }

        console.log(`\n✅ Backfill Complete!`);
        console.log(`- Updated ${updatedUsersCount} users`);
        console.log(`- Backfilled ${totalSongsBackfilled} historical songs directly into Performance Logs`);

    } catch (err) {
        console.error("Backfill failed:", err);
    }
}

// Ensure it can be run 
if (require.main === module) {
    runBackfill().then(() => process.exit(0));
}
