Protobject.Core.onReceived((data) => {
  if (data.engineUTC !== undefined) engineUTC = data.engineUTC;
  if (data.lat !== undefined && data.lon !== undefined) {
    currentLat = data.lat;
    currentLon = data.lon;

    applyLocationForAruco({ lat: currentLat, lon: currentLon });

    if (typeof map !== "undefined" && map.setView) {
      map.setView([currentLat, currentLon], map.getZoom());
      if (typeof marker !== "undefined") {
        marker.setLatLng([currentLat, currentLon]);
      }
    }
  }
});
