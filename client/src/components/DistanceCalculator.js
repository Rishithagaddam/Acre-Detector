import React, { useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
// Haversine & polygonArea formulas
const haversineDistance = (coord1, coord2) => {
  const R = 6371e3;
  const lat1 = (coord1[0] * Math.PI) / 180;
  const lat2 = (coord2[0] * Math.PI) / 180;
  const deltaLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const deltaLon = ((coord2[1] - coord1[1]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const polygonArea = (coords) => {
  if (coords.length < 3) return 0;
  const R = 6378137;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lat1, lon1] = coords[i];
    const [lat2, lon2] = coords[(i + 1) % coords.length];
    const x1 = (lon1 * Math.PI) / 180 * R * Math.cos((lat1 * Math.PI) / 180);
    const y1 = (lat1 * Math.PI) / 180 * R;
    const x2 = (lon2 * Math.PI) / 180 * R * Math.cos((lat2 * Math.PI) / 180);
    const y2 = (lat2 * Math.PI) / 180 * R;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
};

const DistanceCalculator = () => {
  const [coordinates, setCoordinates] = useState([]);
  const [error, setError] = useState("");
  const [watchId, setWatchId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentPos, setCurrentPos] = useState(null); // initially null

  const startTracking = () => {
    setCoordinates([]);
    setTotalDistance(0);
    setError("");

    if ("geolocation" in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newCoord = [latitude, longitude];
          setCurrentPos(newCoord);

          setCoordinates((prev) => {
            const newCoords = [...prev, newCoord];

            if (newCoords.length > 1) {
              const lastCoord = newCoords[newCoords.length - 2];
              const dist = haversineDistance(lastCoord, newCoord);
              setTotalDistance((prevDist) => prevDist + dist);
            }

            return newCoords;
          });
        },
        (err) => setError(err.message),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
      setWatchId(id);
      setIsTracking(true);
    } else {
      setError("ఈ బ్రౌజర్ GPS ను మద్దతు ఇవ్వడం లేదు");
    }
  };

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  };

  const areaSqMeters = polygonArea(coordinates);
  const acres = areaSqMeters / 4046.86;
  const guntas = areaSqMeters / 101.17;
  const cents = areaSqMeters / 40.4686;

  return (
    <div className="distance-calculator">
      <h1>GPS భూవ్యవస్థాపన మరియు దూరం లెక్కింపు</h1>
      {error && <p className="error">{error}</p>}

      <div className="controls">
        {!isTracking ? (
          <button onClick={startTracking}>ప్రారంభించండి</button>
        ) : (
          <button onClick={stopTracking}>నిలిపివేయండి</button>
        )}
      </div>

      <h3>దూరం:</h3>
      <p>
        మొత్తం దూరం: <strong>{totalDistance.toFixed(2)} m</strong>
      </p>

      <h3>భూవ్యవస్థాపన:</h3>
      <p>చదరపు మీటర్లు: <strong>{areaSqMeters.toFixed(2)} m²</strong></p>
      <p>ఎకరాలు: <strong>{acres.toFixed(4)}</strong></p>
      <p>గుంటాలు: <strong>{guntas.toFixed(2)}</strong></p>
      <p>సెంట్లు: <strong>{cents.toFixed(2)}</strong></p>




      {/* Only show map after tracking starts */}
      {isTracking && currentPos && (
        <div style={{ height: "500px", marginTop: "20px", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.2)" }}>
  <MapContainer
    center={currentPos}
    zoom={20}
    scrollWheelZoom={true}
    zoomControl={true}
    style={{ height: "100%", width: "100%" }}
    key={currentPos.join(",")}
  >
    {/* High-detail satellite map */}
    <TileLayer
      url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
      subdomains={["mt0", "mt1", "mt2", "mt3"]}
      attribution="&copy; Google Maps Satellite"
    />

    {/* Marker with modern icon */}
    <Marker position={currentPos}>
      <Popup>
        📍 <strong>మీ ప్రస్తుత స్థానం</strong> <br />
        Coordinates: {currentPos[0].toFixed(5)}, {currentPos[1].toFixed(5)}
      </Popup>
    </Marker>

    {/* Smooth path drawing */}
    {coordinates.length > 1 && (
      <Polyline
        positions={coordinates}
        color="lime"
        weight={5}
        opacity={0.8}
        dashArray="6, 10"
      />
    )}
  </MapContainer>
</div>
      )
    }
    </div>
  );
};
L.Marker.prototype.options.icon = DefaultIcon;
export default DistanceCalculator;
