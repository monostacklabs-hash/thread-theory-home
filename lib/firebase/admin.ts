/**
 * Server-side Firebase access. Implemented over Google's REST APIs (not the
 * firebase-admin SDK) so the same code runs on Cloudflare Workers.
 */
import { Firestore } from "@/lib/firebase/firestore";
import { FirebaseMessaging } from "@/lib/firebase/messaging";

let db: Firestore | undefined;
let messaging: FirebaseMessaging | undefined;

export function getAdminDb() {
  return (db ||= new Firestore());
}

export function getAdminMessaging() {
  return (messaging ||= new FirebaseMessaging());
}
