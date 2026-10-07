/**
 * A link that opens directions to a place in the phone's maps app, pure:
 * Apple Maps on an iPhone, Google Maps everywhere else (Android and the
 * website). The map point when there is one, else the place by name.
 */
export function directionsUrl(to: { place?: { lat: number; lon: number }; name: string }, os: string): string {
  const where = to.place ? `${to.place.lat},${to.place.lon}` : encodeURIComponent(to.name);
  if (os === 'ios') return `https://maps.apple.com/?daddr=${where}${to.place ? `&q=${encodeURIComponent(to.name)}` : ''}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${where}`;
}
