/**
 * Hash Service
 * 
 * Provides SHA-256 hashing for file deduplication.
 * Uses the Web Crypto API for browser-native hashing.
 */

/**
 * Compute SHA-256 hash of a File
 * @param file - File to hash
 * @returns Promise resolving to hex-encoded hash string
 */
export async function computeFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Compute SHA-256 hash of an ArrayBuffer
 * @param buffer - ArrayBuffer to hash
 * @returns Promise resolving to hex-encoded hash string
 */
export async function computeBufferHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Compute a quick hash for strings (for prompt versioning)
 * @param str - String to hash
 * @returns Promise resolving to hex-encoded hash string
 */
export async function computeStringHash(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Return first 8 chars for brevity
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
