const TILE_URL = 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}';
const TILE_ATTRIBUTION = '© 內政部國土測繪中心';
const MAX_ZOOM = 19;
const PINS = [
  ['start', '集'],
  ['stop1', '1'],
  ['end', '終'],
];

let leafletLoading = null;

function appendToHead(node) {
  return new Promise((resolve, reject) => {
    node.onload = resolve;
    node.onerror = reject;
    document.head.append(node);
  });
}

export function loadLeaflet(rel) {
  leafletLoading ??= Promise.all([
    appendToHead(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${rel}vendor/leaflet/leaflet.css` })),
    appendToHead(Object.assign(document.createElement('script'), { src: `${rel}vendor/leaflet/leaflet.js` })),
  ]).then(
    () => window.L,
    (error) => {
      leafletLoading = null;
      throw error;
    },
  );
  return leafletLoading;
}

export function createRouteMap(container, L, route) {
  const map = L.map(container, { dragging: !L.Browser.mobile, scrollWheelZoom: false });
  L.tileLayer(TILE_URL, { maxZoom: MAX_ZOOM, attribution: TILE_ATTRIBUTION }).addTo(map);
  const legs = route.legPaths.map((path, i) =>
    L.polyline(path, { className: `route-leg route-leg-${i}`, interactive: false }).addTo(map),
  );
  for (const [stop, label] of PINS) {
    const icon = L.divIcon({ className: 'route-pin', html: label, iconSize: [26, 26] });
    L.marker([route[stop].lat, route[stop].lon], { icon, interactive: false, keyboard: false }).addTo(map);
  }
  const dot = L.circleMarker([route.start.lat, route.start.lon], { className: 'route-dot', radius: 7, interactive: false }).addTo(map);
  map.fitBounds(L.featureGroup(legs).getBounds(), { padding: [20, 20] });

  return {
    moveDot(point) {
      dot.setLatLng(point);
    },
    focusLeg(leg) {
      legs.forEach((line, i) => line.getElement()?.classList.toggle('is-faded', leg !== null && i !== leg));
    },
    remove() {
      map.remove();
    },
  };
}
