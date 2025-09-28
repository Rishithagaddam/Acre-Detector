import React, { useState, useEffect } from "react";
import "./DistanceCalculator.css";

// Haversine formula to calculate distance between two coordinates in meters
const haversineDistance = (coord1, coord2) => {
  const R = 6371e3; // Earth radius in meters
  const lat1 = (coord1[0] * Math.PI) / 180;
  const lat2 = (coord2[0] * Math.PI) / 180;
  const deltaLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const deltaLon = ((coord2[1] - coord1[1]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
};

// Shoelace formula for polygon area (in m²) using lat/lng
const polygonArea = (coords) => {
  if (coords.length < 3) return 0; // need at least 3 points

  const R = 6378137; // Earth radius in meters (WGS84)
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

  return Math.abs(area / 2); // area in m²
};

const DistanceCalculator = () => {
  const [coordinates, setCoordinates] = useState([]);
  const [error, setError] = useState("");
  const [watchId, setWatchId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [totalDistance, setTotalDistance] = useState(0);

  // Start tracking
  const startTracking = () => {
    // Reset previous data when starting again
    setCoordinates([]);
    setTotalDistance(0);
    setError("");

    if ("geolocation" in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          setCoordinates((prev) => {
            const newCoords = [...prev, [latitude, longitude]];

            // Calculate distance incrementally
            if (newCoords.length > 1) {
              const lastCoord = newCoords[newCoords.length - 2];
              const newCoord = newCoords[newCoords.length - 1];
              const dist = haversineDistance(lastCoord, newCoord);

              // Add all movements (no filter for small movement)
              setTotalDistance((prevDist) => prevDist + dist);
            }

            return newCoords;
          });
        },
        (err) => setError(err.message),
        {
          enableHighAccuracy: true,
          maximumAge: 0, // always get fresh location
          timeout: 10000, // wait max 10 seconds
        }
      );
      setWatchId(id);
      setIsTracking(true);
    } else {
      setError("ఈ బ్రౌజర్ GPS ను మద్దతు ఇవ్వడం లేదు");
    }
  };

  // Stop tracking
  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  };

  // Calculate area
  const areaSqMeters = polygonArea(coordinates);
  const acres = areaSqMeters / 4046.86;
  const guntas = areaSqMeters / 101.17;

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

      <div className="coords">
        <h3>స్థాన సూచికలు:</h3>
        <ul>
          {coordinates.map((coord, i) => (
            <li key={i}>
              అక్షాంశం: {coord[0].toFixed(6)}, రేఖాంశం: {coord[1].toFixed(6)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default DistanceCalculator;
