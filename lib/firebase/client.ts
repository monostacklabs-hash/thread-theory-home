"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { Auth, getAuth } from "firebase/auth";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let analytics: Analytics | null | undefined;

export function getFirebaseClientApp() {
  if (!app) {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    };

    app = getApps().length ? getApp() : initializeApp(config);
  }

  return app;
}

export function getFirebaseAuth() {
  if (!auth) {
    auth = getAuth(getFirebaseClientApp());
  }

  return auth;
}

export async function getFirebaseAnalytics() {
  if (analytics !== undefined) {
    return analytics;
  }

  if (!(await isSupported())) {
    analytics = null;
    return analytics;
  }

  analytics = getAnalytics(getFirebaseClientApp());
  return analytics;
}
