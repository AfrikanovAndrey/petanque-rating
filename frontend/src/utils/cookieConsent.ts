import {
  COOKIE_CONSENT_NAME,
  TOURNAMENT_FILTERS_COOKIE_NAME,
} from "./cookieNames";
import { clearCookie, getCookie, setCookie } from "./cookieStorage";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export type CookieConsentStatus = "accepted" | "rejected";

export const COOKIE_CONSENT_RESET_EVENT = "petanque-cookie-consent-reset";

function parseConsentValue(raw: string | null): CookieConsentStatus | null {
  if (raw === "accepted" || raw === "rejected") {
    return raw;
  }
  if (raw === "1") {
    return "accepted";
  }
  return null;
}

function notifyCookieConsentChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_RESET_EVENT));
  }
}

export function getCookieConsentStatus(): CookieConsentStatus | null {
  return parseConsentValue(getCookie(COOKIE_CONSENT_NAME));
}

export function hasCookieConsentDecision(): boolean {
  return getCookieConsentStatus() !== null;
}

export function canUsePreferenceCookies(): boolean {
  return getCookieConsentStatus() === "accepted";
}

export function acceptCookieConsent(): void {
  setCookie(COOKIE_CONSENT_NAME, "accepted", COOKIE_MAX_AGE_SEC);
}

export function rejectCookieConsent(): void {
  setCookie(COOKIE_CONSENT_NAME, "rejected", COOKIE_MAX_AGE_SEC);
  clearCookie(TOURNAMENT_FILTERS_COOKIE_NAME);
  notifyCookieConsentChanged();
}

export function revokeCookieConsent(): void {
  clearCookie(COOKIE_CONSENT_NAME);
  clearCookie(TOURNAMENT_FILTERS_COOKIE_NAME);
}

export function resetCookieConsentChoice(): void {
  revokeCookieConsent();
  notifyCookieConsentChanged();
}
