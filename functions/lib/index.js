"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserStatusChanged = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
exports.onUserStatusChanged = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
})
    .firestore.document("users/{uid}")
    .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    // Check if deletion was requested in this update
    if (newData.deletionRequested === true && previousData.deletionRequested !== true) {
        const uid = context.params.uid;
        console.log(`Deletion requested for user ${uid}`);
        // Idempotency Check
        if (newData.deletionStatus === 'PROCESSING' || newData.deletionStatus === 'COMPLETED') {
            console.log(`Deletion already in progress or completed for user ${uid}`);
            return;
        }
        try {
            // 1. Mark as PROCESSING
            await change.after.ref.update({
                deletionStatus: 'PROCESSING',
                deletionStartedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // 2. Recursively delete subcollections
            // Note: We use the admin SDK's recursiveDelete which handles batching safely
            // Also attempt to clean up any other subcollections or just the user doc's subcollections broadly
            // Recursive delete on the user doc will delete all subcollections
            console.log(`Starting recursive delete for user ${uid} data...`);
            await db.recursiveDelete(change.after.ref);
            console.log(`Data deleted for user ${uid}. Deleting Auth user...`);
            // 3. Delete Auth User
            try {
                await auth.deleteUser(uid);
                console.log(`Auth user ${uid} deleted.`);
            }
            catch (authError) {
                if (authError.code === 'auth/user-not-found') {
                    console.log(`Auth user ${uid} already deleted.`);
                }
                else {
                    throw authError;
                }
            }
            // Note: Since we used recursiveDelete on the user doc ref above, 
            // the user document itself should strictly be gone or 'marked' for deletion depending on flags.
            // recursiveDelete deletes the document itself by default unless configured otherwise.
            // If the document is deleted, we can't update it to 'COMPLETED'.
            // However, our primary goal is data removal.
            // If recursiveDelete deleted the doc, strict compliance is met (data gone).
            console.log(`Account deletion completed successfully for ${uid}`);
        }
        catch (error) {
            console.error(`Error deleting account ${uid}:`, error);
            // Attempt to write failure state if document still exists
            // Verify if doc exists first to avoid crashing on error handling
            const docSnap = await change.after.ref.get();
            if (docSnap.exists) {
                await change.after.ref.update({
                    deletionStatus: 'FAILED',
                    deletionError: error.message || 'Unknown error'
                });
            }
        }
    }
});
//# sourceMappingURL=index.js.map