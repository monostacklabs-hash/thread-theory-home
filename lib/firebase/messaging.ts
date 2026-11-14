/**
 * FCM HTTP v1 sender shaped like firebase-admin's sendEachForMulticast, so it
 * runs on Cloudflare Workers.
 */
import { getProjectId, googleFetch, GoogleApiError } from "@/lib/firebase/google-auth";

export type MulticastMessage = {
  tokens: string[];
  notification?: { title?: string; body?: string };
  webpush?: { fcmOptions?: { link?: string } };
};

export type SendResponse = { success: boolean; error?: { code: string; message: string } };

export type BatchResponse = {
  responses: SendResponse[];
  successCount: number;
  failureCount: number;
};

export function toMessagingErrorCode(error: unknown): string {
  if (!(error instanceof GoogleApiError)) return "messaging/unknown-error";

  const details = (error.body as { error?: { details?: Array<{ errorCode?: string }> } } | undefined)
    ?.error?.details;
  const fcmCode = details?.find((detail) => detail.errorCode)?.errorCode;

  if (fcmCode === "UNREGISTERED" || error.httpStatus === 404) {
    return "messaging/registration-token-not-registered";
  }
  if (fcmCode === "INVALID_ARGUMENT" || error.status === "INVALID_ARGUMENT") {
    return "messaging/invalid-argument";
  }
  if (fcmCode === "SENDER_ID_MISMATCH") return "messaging/mismatched-credential";
  if (fcmCode === "QUOTA_EXCEEDED") return "messaging/message-rate-exceeded";
  if (fcmCode === "UNAVAILABLE") return "messaging/server-unavailable";
  return "messaging/unknown-error";
}

export class FirebaseMessaging {
  async sendEachForMulticast(message: MulticastMessage): Promise<BatchResponse> {
    const url = `https://fcm.googleapis.com/v1/projects/${getProjectId()}/messages:send`;
    const link = message.webpush?.fcmOptions?.link;

    // FCM rejects non-HTTPS links for every token; fail the whole call (as
    // firebase-admin did) so callers don't mistake it for dead tokens.
    if (link && !link.startsWith("https://")) {
      throw new Error("webpush.fcmOptions.link must be an HTTPS URL");
    }

    const responses = await Promise.all(
      message.tokens.map(async (token): Promise<SendResponse> => {
        try {
          await googleFetch(url, {
            body: {
              message: {
                token,
                ...(message.notification ? { notification: message.notification } : {}),
                ...(link ? { webpush: { fcm_options: { link } } } : {})
              }
            }
          });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: toMessagingErrorCode(error),
              message: error instanceof Error ? error.message : "unknown"
            }
          };
        }
      })
    );

    const successCount = responses.filter((response) => response.success).length;
    return { responses, successCount, failureCount: responses.length - successCount };
  }
}
