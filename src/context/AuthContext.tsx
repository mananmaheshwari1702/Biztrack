import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    updateEmail,
    updatePassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { OrgLevel } from '../types';
import { normalizeEmail } from '../utils/stringUtils';

interface AuthContextType {
    currentUser: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    signup: (email: string, password: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    updateName: (name: string) => Promise<void>;
    updateEmailAddress: (email: string) => Promise<void>;
    updateUserPassword: (password: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    googleSignIn: () => Promise<void>;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Ref to hold the resolver for the auth ready promise
    // This allows login() to wait for onAuthStateChanged to complete
    const authReadyResolverRef = useRef<((value: void) => void) | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check if deletion is requested
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists() && userDocSnap.data().deletionRequested) {
                        alert("This account is scheduled for deletion.");
                        await signOut(auth);
                        setCurrentUser(null);
                    } else {
                        setCurrentUser(user);
                    }
                } catch (error) {
                    // Fallback if we can't check status (e.g. offline) - allow login but logs error
                    logger.error("Error checking account status:", error);
                    setCurrentUser(user);
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);

            // Resolve the auth ready promise if someone is waiting
            if (authReadyResolverRef.current) {
                authReadyResolverRef.current();
                authReadyResolverRef.current = null;
            }
        });
        return unsubscribe;
    }, []);

    // Helper to wait for auth state to be ready after a login/signup
    const waitForAuthReady = (): Promise<void> => {
        return new Promise((resolve) => {
            authReadyResolverRef.current = resolve;
        });
    };

    const signup = async (email: string, password: string, name: string) => {
        const normalizedEmail = normalizeEmail(email);
        const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await updateProfile(userCredential.user, {
            displayName: name
        });

        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

        // Create user document immediately to prevent race conditions
        const newUserProfile = {
            name: name,
            email: normalizedEmail,
            level: OrgLevel.Supervisor, // Default to Supervisor as requested
            avatarColor: randomColor,
            deletionRequested: false // Explicitly init as false
        };

        try {
            await setDoc(doc(db, 'users', userCredential.user.uid), newUserProfile);
        } catch (error) {
            logger.error("Error creating user profile in Firestore:", error);
        }

        // Force refresh user to get displayName
        setCurrentUser({ ...userCredential.user, displayName: name });
    };

    const googleSignIn = async () => {
        // Always use local persistence for Google Sign In
        await setPersistence(auth, browserLocalPersistence);

        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const normalizedEmail = normalizeEmail(user.email || '');

        // Check if user document exists
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            // Create new user profile
            const newUserProfile = {
                name: user.displayName || 'Google User',
                email: normalizedEmail,

                level: OrgLevel.Supervisor,
                avatarColor: randomColor,
                deletionRequested: false
            };

            try {
                await setDoc(userDocRef, newUserProfile);
            } catch (error) {
                logger.error("Error creating user profile in Firestore for Google user:", error);
            }
        } else if (userDocSnap.data().deletionRequested) {
            // Block login if deletion requested
            await signOut(auth);
            alert("Account is scheduled for deletion.");
            return;
        }
    };

    const login = async (email: string, password: string, rememberMe: boolean = true) => {
        const normalizedEmail = normalizeEmail(email);
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        // Set up the auth ready promise BEFORE signing in
        const authReady = waitForAuthReady();
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
        // Wait for onAuthStateChanged to complete and set currentUser
        await authReady;
    };

    const logout = async () => {
        await signOut(auth);
    };

    const deleteAccount = async () => {
        if (!currentUser) return;
        const uid = currentUser.uid;

        try {
            // 1. Mark account for deletion
            const userDocRef = doc(db, 'users', uid);
            await updateDoc(userDocRef, {
                deletionRequested: true,
                deletionStatus: 'REQUESTED',
                deletionRequestedAt: serverTimestamp()
            });

            // 2. Sign out immediately
            await signOut(auth);
        } catch (error) {
            logger.error("Error marking account for deletion:", error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            isAuthenticated: !!currentUser,
            loading,
            login,
            signup,
            logout,
            updateName: async (name: string) => {
                if (currentUser) {
                    await updateProfile(currentUser, { displayName: name });
                    // Force refresh to update UI immediately
                    setCurrentUser({ ...currentUser, displayName: name });
                }
            },
            updateEmailAddress: async (email: string) => {
                if (currentUser) {
                    const normalizedEmail = normalizeEmail(email);
                    await updateEmail(currentUser, normalizedEmail);
                    setCurrentUser({ ...currentUser, email: normalizedEmail });
                }
            },
            updateUserPassword: async (password: string) => {
                if (currentUser) {
                    await updatePassword(currentUser, password);
                }
            },
            resetPassword: async (email: string) => {
                const normalizedEmail = normalizeEmail(email);
                await sendPasswordResetEmail(auth, normalizedEmail);
            },
            googleSignIn,
            deleteAccount
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
