// Tiny in-memory store so AuthContext's logout() can find this device's
// current push subscription endpoint without threading it through props —
// mirrors the previous pushTokenStore.js, just holding a Web Push endpoint
// URL instead of an FCM token.
let currentEndpoint = null;

export function setCurrentPushEndpoint(endpoint) {
  currentEndpoint = endpoint;
}

export function getCurrentPushEndpoint() {
  return currentEndpoint;
}
