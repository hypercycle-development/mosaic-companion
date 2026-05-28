import { useState, useEffect } from 'react';

interface GeoCoords {
  lat: number;
  lng: number;
}

/**
 * Requests the user's geolocation when `enabled` is true.
 * Returns { lat, lng } when available, null when disabled, denied, or unavailable.
 * Callers must obtain explicit user consent before setting enabled=true.
 */
export function useUserGeo(enabled: boolean): GeoCoords | null {
  const [coords, setCoords] = useState<GeoCoords | null>(null);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* silently ignore denial */ },
      { timeout: 5000, maximumAge: 300_000 }
    );
  }, [enabled]);

  return coords;
}
