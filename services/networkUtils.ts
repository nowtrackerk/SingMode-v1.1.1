/**
 * Network utility to get the local network IP address for QR code generation
 * This allows mobile devices on the same network to connect to the dev server
 */

/** 
 * Returns the Vite base path (e.g. "/Singmode-v.2/") from the current pathname.
 * Works for both localhost and network IP access.
 */
function getBasePath(): string {
    if (typeof window === 'undefined') return '/';
    // The base path is everything up to and including the first path segment with a dash/dot
    // E.g. "/Singmode-v.2/" or "/" in production
    const match = window.location.pathname.match(/^(\/[^/]+\/)/);
    return match ? match[1] : '/';
}

export function getNetworkUrl(): string {
    if (typeof window === 'undefined') return '';

    const port = window.location.port ? `:${window.location.port}` : '';
    const basePath = getBasePath();

    // Check if there's a stored network IP or full URL
    const storedNetworkIp = localStorage.getItem('kstar_network_ip');
    if (storedNetworkIp) {
        if (storedNetworkIp.startsWith('http')) {
            // Full URL (e.g. ngrok tunnel) — use as-is, add base path if not already present
            const url = storedNetworkIp.replace(/\/$/, '');
            return url.endsWith(basePath.replace(/\/$/, '')) ? url + '/' : url + basePath;
        }
        // Raw IP — build full URL with port and base path
        const ip = storedNetworkIp.trim();
        return `http://${ip}${port}${basePath}`;
    }

    // If already accessing via network IP (not localhost), use current origin + base path
    const currentOrigin = window.location.origin;
    if (!currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1')) {
        return currentOrigin + basePath;
    }

    // Fallback: localhost (phones won't be able to use this)
    return currentOrigin + basePath;
}

export function setNetworkIp(ip: string) {
    localStorage.setItem('kstar_network_ip', ip);
    window.dispatchEvent(new Event('kstar_sync'));
}

export function getStoredNetworkIp(): string | null {
    return localStorage.getItem('kstar_network_ip');
}

export function clearNetworkIp() {
    localStorage.removeItem('kstar_network_ip');
    window.dispatchEvent(new Event('kstar_sync'));
}
