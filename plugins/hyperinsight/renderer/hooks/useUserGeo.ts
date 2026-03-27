import { useState, useEffect } from 'react';

interface GeoCoords {
  lat: number;
  lng: number;
}

/**
 * Requests the user's geolocation once on mount.
 * Returns { lat, lng } when available, null when denied or unavailable.
 * Failure is silent — callers treat null as "geo unavailable" and fall
 * back to scoring without distance modifier.
 */
export function useUserGeo(): GeoCoords | null {
  const [coords, setCoords] = useState<GeoCoords | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* silently ignore denial */ },
      { timeout: 5000, maximumAge: 300_000 }
    );
  }, []);

  return coords;
}
