import React, { useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Haversine distance formula
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

// Polygon area formula
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
  const [currentPos, setCurrentPos] = useState(null);

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

      {/* Map only shows when tracking and current position exist */}
      {isTracking && currentPos && (
        <div style={{ height: "400px", marginTop: "20px" }}>
          <MapContainer
            center={currentPos}
            zoom={20} // Max zoom for Mapbox/OpenStreetMap tiles
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            key={currentPos.join(",")}
          >
            <TileLayer
              // Mapbox tiles for higher zoom
              url="https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=YOUR_MAPBOX_ACCESS_TOKEN"
              attribution='Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, Imagery &copy; <a href="https://www.mapbox.com/">Mapbox</a>'
              tileSize={512}
              zoomOffset={-1}
              maxZoom={25}
            />
            <Marker position={currentPos}>
              <Popup>Current Location</Popup>
            </Marker>
            {coordinates.length > 1 && <Polyline positions={coordinates} color="blue" />}
          </MapContainer>
        </div>
      )}
    </div>
  );
};

export default DistanceCalculator;
