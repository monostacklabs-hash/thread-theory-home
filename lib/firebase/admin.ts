import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | undefined;

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;

  if (!key) {
    throw new Error("Missing FIREBASE_PRIVATE_KEY");
  }

  return key.replace(/\\n/g, "\n");
}

export function getFirebaseAdminApp() {
  if (!app) {
    if (getApps().length) {
      app = getApp();
    } else {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: getPrivateKey()
        })
      });
    }
  }

  return app;
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
