export async function hashString(message: string): Promise<string> {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
