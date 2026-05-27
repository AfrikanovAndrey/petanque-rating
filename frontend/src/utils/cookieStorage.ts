function cookieAttributeSuffix(maxAgeSec: number): string {
  const parts = [`path=/`, `max-age=${maxAgeSec}`, `SameSite=Lax`];
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match.slice(name.length + 1));
}

export function setCookie(
  name: string,
  value: string,
  maxAgeSec: number,
  options?: { encode?: boolean }
): void {
  if (typeof document === "undefined") {
    return;
  }
  const cookieValue = options?.encode ? encodeURIComponent(value) : value;
  document.cookie = `${name}=${cookieValue}; ${cookieAttributeSuffix(maxAgeSec)}`;
}

export function clearCookie(name: string): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=; ${cookieAttributeSuffix(0)}`;
}
