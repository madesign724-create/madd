import { getApiBaseUrl } from "@/constants/oauth";

/**
 * Resolves paths returned by the storage API for React Native's Image.
 * Uploaded assets are stored as paths such as `/manus-storage/...`; those
 * paths must be served from the API host rather than the Expo web host.
 */
export function resolveAssetUrl(value: string): string {
  const normalized = value.trim();
  if (/^(https?:|data:|file:|content:|asset:)/i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith("//")) {
    return `https:${normalized}`;
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return normalized;
  }

  return `${apiBaseUrl}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}
