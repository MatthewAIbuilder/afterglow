/**
 * Google Maps' night look on Android (iPhone uses Apple Maps' own dark,
 * muted style): deep navy land, near-black water, quiet roads and labels,
 * no businesses or transit, so the festival lights carry the map.
 */
export const NIGHT_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#14122b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8f89b8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0918' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2c2852' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#3d3770' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#b9b3e0' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#16142f' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#18233a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#262248' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6f6a99' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#332d63' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1c1940' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07061a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3770' }] },
];
