const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

interface Coordinates {
  lat: number;
  lon: number;
}

async function geocodeCity(cityName: string): Promise<Coordinates | null> {
  try {
    const query = `${cityName}, Brazil`;
    const res = await fetch(
      `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`,
      { headers: { "Accept-Language": "pt-BR" } }
    );
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function getRouteDistance(origin: string, destination: string): Promise<number | null> {
  try {
    const [originCoords, destCoords] = await Promise.all([
      geocodeCity(origin),
      geocodeCity(destination),
    ]);

    if (!originCoords || !destCoords) return null;

    const res = await fetch(
      `${OSRM_URL}/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`
    );
    const data = await res.json();

    if (data.code !== "Ok" || !data.routes?.length) return null;

    // distance is in meters, convert to km
    return Math.round(data.routes[0].distance / 1000);
  } catch {
    return null;
  }
}
