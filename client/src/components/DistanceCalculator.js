import React, { useState, useEffect, useRef, useMemo } from 'react';
import proj4 from 'proj4';
import './DistanceCalculator.css';

const DistanceCalculator = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [coordinates, setCoordinates] = useState([]);
  const [watchId, setWatchId] = useState(null);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [measurements, setMeasurements] = useState([]);
  const [currentMeasurement, setCurrentMeasurement] = useState(1);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [isGpsReady, setIsGpsReady] = useState(false);
  const [skippedPointsCount, setSkippedPointsCount] = useState(0);
  const [containerDimensions, setContainerDimensions] = useState({ width: 400, height: 300 });
  const intervalRef = useRef(null);
  const lastRecordedPoint = useRef(null);
  const cumulativeDistance = useRef(0);

  // Configuration constants
  const RECORDING_INTERVAL = 2000; // Record every 2 seconds
  const MIN_DISTANCE_THRESHOLD = 2.5; // Minimum 2.5 meters between points to reduce jitter
  const ACCURACY_THRESHOLD = 10; // Filter out points with accuracy > 10 meters
  const POLYGON_CLOSURE_THRESHOLD = 5; // Auto-close polygon if within 5 meters
  const MAX_COORDINATES = 10000; // Limit coordinates array to prevent memory issues

  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [watchId]);

  // Add resize listener for responsive SVG
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth > 768 ? 400 : Math.min(350, window.innerWidth - 40);
      const height = Math.min(300, (width * 3) / 4);
      setContainerDimensions({ width, height });
    };

    handleResize(); // Set initial dimensions
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showInstructionsDialog = () => {
    setShowInstructions(true);
  };

  const hideInstructionsDialog = () => {
    setShowInstructions(false);
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('మీ పరికరంలో GPS సపోర్ట్ లేదు');
      return;
    }

    // Reset all tracking state
    setError('');
    setResults(null);
    setCoordinates([]);
    setGpsAccuracy(null);
    setCurrentDistance(0);
    setIsGpsReady(false);
    setSkippedPointsCount(0);
    lastRecordedPoint.current = null;
    cumulativeDistance.current = 0;

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    let currentPosition = null;

    // Set tracking to true before starting GPS watch
    setIsTracking(true);

    // Start GPS position watching
    const id = navigator.geolocation.watchPosition(
      (position) => {
        currentPosition = position;
        setGpsAccuracy(position.coords.accuracy);
        setIsGpsReady(true);
        setError('');
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError('GPS అనుమతి తిరస్కరించబడింది. దయచేసి అనుమతి ఇవ్వండి');
            break;
          case error.POSITION_UNAVAILABLE:
            setError('GPS సిగ్నల్ అందుబాటులో లేదు. బహిరంగ ప్రాంతానికి వెళ్లండి');
            break;
          case error.TIMEOUT:
            setError('GPS సిగ్నల్ పొందడంలో ఆలస్యం. దయచేసి వేచి ఉండండి');
            break;
          default:
            setError('GPS లోపం సంభవించింది');
            break;
        }
        setIsTracking(false);
        setIsGpsReady(false);
      },
      options
    );

    // Record GPS points at regular intervals with filtering
    const interval = setInterval(() => {
      if (currentPosition) {
        recordGPSPoint(currentPosition);
      }
    }, RECORDING_INTERVAL);

    setWatchId(id);
    intervalRef.current = interval;
    hideInstructionsDialog();
  };

  const recordGPSPoint = (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Filter out points with poor accuracy
    if (accuracy > ACCURACY_THRESHOLD) {
      console.log(`Skipping point with poor accuracy: ${accuracy}m`);
      setSkippedPointsCount(prev => prev + 1);
      return;
    }

    const newPoint = { 
      lat: latitude, 
      lng: longitude, 
      timestamp: Date.now(),
      accuracy: accuracy 
    };

    // Filter out points that are too close to the last recorded point
    if (lastRecordedPoint.current) {
      const distance = haversineDistance(
        lastRecordedPoint.current.lat,
        lastRecordedPoint.current.lng,
        newPoint.lat,
        newPoint.lng
      );

      if (distance < MIN_DISTANCE_THRESHOLD) {
        console.log(`Skipping point too close to previous: ${distance.toFixed(1)}m`);
        setSkippedPointsCount(prev => prev + 1);
        return;
      }

      // Incrementally update cumulative distance
      cumulativeDistance.current += distance;
      setCurrentDistance(cumulativeDistance.current);
    }

    // Limit coordinates array size to prevent memory issues
    setCoordinates(prev => {
      const newCoords = [...prev, newPoint];
      if (newCoords.length > MAX_COORDINATES) {
        console.warn(`Coordinates array too large (${newCoords.length}), removing oldest points`);
        return newCoords.slice(-MAX_COORDINATES);
      }
      return newCoords;
    });
    lastRecordedPoint.current = newPoint;
  };



  const stopTracking = () => {
    // Stop GPS tracking
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);

    // Validate minimum points for area calculation
    if (coordinates.length < 3) {
      setError('వైశాల్యం లెక్కించడానికి కనీసం మూడు పాయింట్లు అవసరం. క్షేత్రం చుట్టూ నెమ్మదిగా నడవండి');
      return;
    }

    // Calculate results with the current coordinates (synchronously)
    calculateResultsWithCoordinates(coordinates);
  };

  // Add function to discard current measurement and start over
  const discardCurrentMeasurement = () => {
    setError('');
    setCoordinates([]);
    setCurrentDistance(0);
    setSkippedPointsCount(0);
    lastRecordedPoint.current = null;
    cumulativeDistance.current = 0;
    showInstructionsDialog();
  };

  /**
   * Create a properly closed polygon from the recorded coordinates
   * This ensures consistent area and perimeter calculations
   */
  const createClosedPolygon = (coords) => {
    if (coords.length < 3) return coords;

    const firstPoint = coords[0];
    const lastPoint = coords[coords.length - 1];
    
    // Calculate distance between first and last points
    const closingDistance = haversineDistance(
      firstPoint.lat, firstPoint.lng,
      lastPoint.lat, lastPoint.lng
    );

    // If the polygon is not reasonably closed, add the first point to close it
    if (closingDistance > POLYGON_CLOSURE_THRESHOLD) {
      console.log(`Auto-closing polygon: ${closingDistance.toFixed(1)}m gap`);
      return [...coords, firstPoint];
    }

    // Polygon is already reasonably closed
    return coords;
  };

  /**
   * Calculate the perimeter of a closed polygon using Haversine distance
   * This avoids double-counting the closing distance
   */
  const calculatePerimeter = (closedCoords) => {
    if (closedCoords.length < 2) return 0;
    
    let totalDistance = 0;
    
    // Calculate distance between consecutive points including the closing edge
    for (let i = 0; i < closedCoords.length - 1; i++) {
      const distance = haversineDistance(
        closedCoords[i].lat,
        closedCoords[i].lng,
        closedCoords[i + 1].lat,
        closedCoords[i + 1].lng
      );
      totalDistance += distance;
    }
    
    return totalDistance;
  };

  /**
   * Haversine formula for calculating distance between two GPS coordinates
   * Returns distance in meters
   */
  const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * Calculate area using improved projection for large fields
   * Falls back to Shoelace formula for smaller fields
   */
  const calculateArea = (closedCoords) => {
    if (closedCoords.length < 3) return 0;

    // Calculate field bounds to determine if we need projection
    const lats = closedCoords.map(coord => coord.lat);
    const lngs = closedCoords.map(coord => coord.lng);
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    
    // Use projection for large fields (> 0.01 degrees ≈ 1km)
    const useProjForLargeFields = latRange > 0.01 || lngRange > 0.01;

    if (useProjForLargeFields) {
      return calculateAreaWithProjection(closedCoords);
    } else {
      return calculateAreaWithShoelace(closedCoords);
    }
  };

  /**
   * Calculate area using UTM projection for high accuracy on large fields
   */
  const calculateAreaWithProjection = (closedCoords) => {
    try {
      // Get center point to determine UTM zone
      const centerLat = closedCoords.reduce((sum, coord) => sum + coord.lat, 0) / closedCoords.length;
      const centerLng = closedCoords.reduce((sum, coord) => sum + coord.lng, 0) / closedCoords.length;
      
      // Determine UTM zone
      const utmZone = Math.floor((centerLng + 180) / 6) + 1;
      const hemisphere = centerLat >= 0 ? 'north' : 'south';
      
      // Define WGS84 to UTM projection
      const wgs84 = 'EPSG:4326';
      const utm = `+proj=utm +zone=${utmZone} +${hemisphere} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
      
      // Convert coordinates to UTM
      const utmCoords = closedCoords.map(coord => {
        const [x, y] = proj4(wgs84, utm, [coord.lng, coord.lat]);
        return { x, y };
      });

      // Apply Shoelace formula on projected coordinates
      let area = 0;
      for (let i = 0; i < utmCoords.length - 1; i++) {
        area += (utmCoords[i].x * utmCoords[i + 1].y) - 
                (utmCoords[i + 1].x * utmCoords[i].y);
      }
      
      return Math.abs(area) / 2;
    } catch (error) {
      console.warn('Projection failed, falling back to Shoelace formula:', error);
      return calculateAreaWithShoelace(closedCoords);
    }
  };

  /**
   * Calculate area using Shoelace formula with flat-map projection (original method)
   */
  const calculateAreaWithShoelace = (closedCoords) => {
    // Use flat map approximation: convert lat/lng to meters
    const avgLat = closedCoords.reduce((sum, coord) => sum + coord.lat, 0) / closedCoords.length;
    const metersPerDegreeLat = 111000; // Meters per degree latitude (constant)
    const metersPerDegreeLng = 111000 * Math.cos(toRadians(avgLat)); // Meters per degree longitude (varies by latitude)

    // Convert all coordinates to meters using the average latitude
    const meterCoords = closedCoords.map(coord => ({
      x: coord.lng * metersPerDegreeLng,
      y: coord.lat * metersPerDegreeLat
    }));

    // Apply Shoelace formula for polygon area
    let area = 0;
    for (let i = 0; i < meterCoords.length - 1; i++) {
      area += (meterCoords[i].x * meterCoords[i + 1].y) - 
              (meterCoords[i + 1].x * meterCoords[i].y);
    }
    
    return Math.abs(area) / 2; // Return absolute area in square meters
  };

  /**
   * Convert degrees to radians
   */
  const toRadians = (degrees) => {
    return degrees * (Math.PI / 180);
  };

  /**
   * Calculate results using the provided coordinates
   * This function works synchronously to avoid state update issues
   */
  const calculateResultsWithCoordinates = (coords) => {
    // Create a properly closed polygon
    const closedPolygon = createClosedPolygon(coords);
    
    // Calculate perimeter and area using the same closed polygon
    const perimeter = calculatePerimeter(closedPolygon);
    const areaInSquareMeters = calculateArea(closedPolygon);
    
    // Convert area to different units
    const acres = areaInSquareMeters / 4047; // 1 acre = 4047 m²
    const hectares = areaInSquareMeters / 10000; // 1 hectare = 10000 m²
    const guntalu = areaInSquareMeters / 101.17; // 1 guntha = 101.17 m²

    // Calculate average accuracy of recorded points
    const avgAccuracy = coords.length > 0 
      ? (coords.reduce((sum, coord) => sum + coord.accuracy, 0) / coords.length)
      : 0;

    const newResult = {
      distance: perimeter.toFixed(2),
      areaSquareMeters: areaInSquareMeters.toFixed(2),
      acres: acres.toFixed(4),
      hectares: hectares.toFixed(4),
      guntalu: guntalu.toFixed(4),
      measurementNumber: currentMeasurement,
      pointsRecorded: coords.length,
      closedPolygonPoints: closedPolygon.length,
      avgAccuracy: avgAccuracy.toFixed(1),
      skippedPoints: skippedPointsCount // Add skipped points to results
    };

    // Update state with results
    setResults(newResult);
    setMeasurements(prev => [...prev, newResult]);
  };

  const startNewMeasurement = () => {
    setCurrentMeasurement(prev => prev + 1);
    setResults(null);
    setCoordinates([]);
    setError('');
    lastRecordedPoint.current = null;
    showInstructionsDialog();
  };

  /**
   * Calculate average results from multiple measurements
   * Provides more accurate results for irregular fields
   */
  const calculateAverageResults = () => {
    if (measurements.length < 2) return null;

    const avgArea = measurements.reduce((sum, m) => sum + parseFloat(m.areaSquareMeters), 0) / measurements.length;
    const avgDistance = measurements.reduce((sum, m) => sum + parseFloat(m.distance), 0) / measurements.length;

    return {
      areaSquareMeters: avgArea.toFixed(2),
      distance: avgDistance.toFixed(2),
      acres: (avgArea / 4047).toFixed(4),
      hectares: (avgArea / 10000).toFixed(4),
      guntalu: (avgArea / 101.17).toFixed(4),
      measurementCount: measurements.length
    };
  };

  /**
   * Get GPS accuracy status for user feedback
   * Only shows good and excellent accuracy to avoid confusion
   */
  const getAccuracyStatus = () => {
    if (!gpsAccuracy) return null;
    
    if (gpsAccuracy <= 5) return { status: 'excellent', color: '#4CAF50', text: 'అద్భుతమైన GPS ఖచ్చితత్వం' };
    if (gpsAccuracy <= 10) return { status: 'good', color: '#FF9800', text: 'మంచి GPS ఖచ్చితత్వం' };
    return null; // Don't show poor accuracy status to avoid user confusion
  };

  const accuracyStatus = getAccuracyStatus();
  const averageResults = calculateAverageResults();

  // Polygon component for SVG visualization with always-closed visual
  const PolygonShape = ({ coordinates, scaleX, scaleY }) => {
    if (coordinates.length < 3) return null;
    
    // Always close the polygon visually by adding the first point at the end
    const visualCoords = [...coordinates, coordinates[0]];
    const points = visualCoords.map(coord => `${scaleX(coord.lng)},${scaleY(coord.lat)}`).join(' ');
    
    return (
      <polygon
        points={points}
        fill="#87CEEB"
        fillOpacity="0.3"
        stroke="#4682B4"
        strokeWidth="2"
      />
    );
  };

  // Lines component for SVG visualization with closing line
  const ConnectingLines = ({ coordinates, scaleX, scaleY }) => {
    if (coordinates.length < 2) return null;
    
    const lines = [];
    
    // Draw lines between consecutive points
    for (let i = 0; i < coordinates.length - 1; i++) {
      const coord = coordinates[i];
      const nextCoord = coordinates[i + 1];
      
      lines.push(
        <line
          key={`line-${i}`}
          x1={scaleX(coord.lng)}
          y1={scaleY(coord.lat)}
          x2={scaleX(nextCoord.lng)}
          y2={scaleY(nextCoord.lat)}
          stroke="#4682B4"
          strokeWidth="2"
        />
      );
    }
    
    // Add closing line if we have 3 or more points
    if (coordinates.length >= 3) {
      const lastCoord = coordinates[coordinates.length - 1];
      const firstCoord = coordinates[0];
      
      lines.push(
        <line
          key="closing-line"
          x1={scaleX(lastCoord.lng)}
          y1={scaleY(lastCoord.lat)}
          x2={scaleX(firstCoord.lng)}
          y2={scaleY(firstCoord.lat)}
          stroke="#4682B4"
          strokeWidth="2"
          strokeDasharray="5,5" // Dashed line to indicate auto-closing
        />
      );
    }
    
    return lines;
  };

  // Points component for SVG visualization
  const GPSPoints = ({ coordinates, scaleX, scaleY }) => {
    return coordinates.map((coord, index) => {
      // Optimize rendering for many points
      const shouldShow = coordinates.length <= 50 || 
                        index % Math.ceil(coordinates.length / 50) === 0 || 
                        index === coordinates.length - 1 ||
                        index === 0;
      
      if (!shouldShow) return null;

      const color = coord.accuracy <= 5 ? '#4CAF50' : coord.accuracy <= 10 ? '#FF9800' : '#f44336';
      
      return (
        <g key={`point-${index}`}>
          <circle
            cx={scaleX(coord.lng)}
            cy={scaleY(coord.lat)}
            r="8"
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
          <text
            x={scaleX(coord.lng)}
            y={scaleY(coord.lat)}
            textAnchor="middle"
            dy="0.3em"
            fontSize="10"
            fill="white"
            fontWeight="bold"
          >
            {index + 1}
          </text>
          {/* Add labels at polygon vertices for better clarity */}
          {(index === 0 || index === coordinates.length - 1) && (
            <text
              x={scaleX(coord.lng)}
              y={scaleY(coord.lat) - 15}
              textAnchor="middle"
              fontSize="8"
              fill="#333"
              fontWeight="bold"
            >
              {index === 0 ? 'ప్రారంభం' : 'ముగింపు'}
            </text>
          )}
        </g>
      );
    });
  };

  // Memoized calculations for SVG visualization to prevent re-rendering
  const memoizedVisualizationData = useMemo(() => {
    if (coordinates.length === 0) return null;

    // Calculate bounds for visualization with epsilon to avoid division by zero
    const lats = coordinates.map(coord => coord.lat);
    const lngs = coordinates.map(coord => coord.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add epsilon to avoid division by zero for very small fields
    const epsilon = 0.0001;
    const latRange = Math.max(maxLat - minLat, epsilon);
    const lngRange = Math.max(maxLng - minLng, epsilon);

    const { width: svgWidth, height: svgHeight } = containerDimensions;
    const padding = 20;

    const scaleX = (lng) => ((lng - minLng) / lngRange) * (svgWidth - 2 * padding) + padding;
    const scaleY = (lat) => svgHeight - (((lat - minLat) / latRange) * (svgHeight - 2 * padding) + padding);

    return { scaleX, scaleY, svgWidth, svgHeight };
  }, [coordinates, containerDimensions]);

  // Optimized coordinate visualization component
  const CoordinateVisualization = () => {
    if (!memoizedVisualizationData) return null;

    const { scaleX, scaleY, svgWidth, svgHeight } = memoizedVisualizationData;

    return (
      <div className="live-map-container">
        <h3>GPS పాయింట్లు మరియు క్షేత్రం</h3>
        <div className="map-wrapper">
          <svg 
            width={svgWidth} 
            height={svgHeight} 
            className="gps-tracking-map" 
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          >
            <PolygonShape coordinates={coordinates} scaleX={scaleX} scaleY={scaleY} />
            <ConnectingLines coordinates={coordinates} scaleX={scaleX} scaleY={scaleY} />
            <GPSPoints coordinates={coordinates} scaleX={scaleX} scaleY={scaleY} />
          </svg>
        </div>
        
        {/* Enhanced legend with performance info */}
        <div className="map-legend">
          <div className="legend-item">
            <div className="legend-color excellent"></div>
            <span>అద్భుతమైన ఖచ్చితత్వం (≤5మీ)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color good"></div>
            <span>మంచి ఖచ్చితత్వం (≤10మీ)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color poor"></div>
            <span>దుర్బల ఖచ్చితత్వం (&gt;10మీ)</span>
          </div>
          {skippedPointsCount > 0 && (
            <div className="skipped-points-info">
              <span>⚠️ {skippedPointsCount} పాయింట్లు వదులుకోబడ్డాయి (దుర్బల ఖచ్చితత్వం/చాలా దగ్గరగా)</span>
            </div>
          )}
          {coordinates.length > 5000 && (
            <div className="performance-info">
              <span>📊 {coordinates.length} పాయింట్లు రికార్డ్ చేయబడ్డాయి (పనితీరు ఆప్టిమైజ్ చేయబడింది)</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="distance-calculator">
      <h1>క్షేత్ర వైశాల్యం మరియు దూరం లెక్కింపు</h1>
      
      {showInstructions && (
        <div className="instructions-modal">
          <div className="instructions-content">
            <h3>క్షేత్రం కొలిచే సూచనలు</h3>
            <ul>
              <li>📍 క్షేత్రం ఒక మూలలో నిలబడండి</li>
              <li>🚶‍♂️ సరిహద్దు వెంట నెమ్మదిగా మరియు స్థిరంగా నడవండి</li>
              <li>🔄 మొదలు పెట్టిన చోటికే తిరిగి రండి</li>
              <li>📱 ఫోన్‌ను స్థిరంగా పట్టుకోండి</li>
              <li>⏰ ప్రతి 2 సెకన్లకు GPS పాయింట్ రికార్డ్ అవుతుంది</li>
              <li>🎯 ఖచ్చిత ఫలితాల కోసం 2-3 సార్లు కొలవండి</li>
              <li>📡 దుర్బల GPS సిగ్నల్ పాయింట్లు స్వయంచాలకంగా వదులుకోబడతాయి</li>
            </ul>
            <div className="instruction-buttons">
              <button onClick={hideInstructionsDialog} className="cancel-btn">రద్దు</button>
              <button onClick={startTracking} className="start-btn">అర్థమయ్యింది, ప్రారంభించండి</button>
            </div>
          </div>
        </div>
      )}

      <div className="controls">
        {!isTracking ? (
          <button onClick={showInstructionsDialog} className="start-btn">
            కొలత ప్రారంభించండి
          </button>
        ) : (
          <button 
            onClick={stopTracking} 
            className="stop-btn"
            disabled={!isGpsReady} // Disable until GPS is ready
          >
            కొలత ఆపండి
          </button>
        )}
      </div>

      {gpsAccuracy && accuracyStatus && (
        <div className="accuracy-status" style={{ borderColor: accuracyStatus.color }}>
          <p style={{ color: accuracyStatus.color }}>
            📡 {accuracyStatus.text} ({gpsAccuracy.toFixed(1)} మీటర్లు)
          </p>
        </div>
      )}

      {isTracking && !isGpsReady && (
        <div className="gps-waiting">
          <p>🛰️ GPS సిగ్నల్ కోసం వేచి ఉన్నాం...</p>
          <p>దయచేసి బహిరంగ ప్రాంతానికి వెళ్లండి</p>
        </div>
      )}

      {isTracking && isGpsReady && (
        <div className="tracking-info">
          <p>📍 క్షేత్రం చుట్టూ నెమ్మదిగా నడుస్తున్నాం...</p>
          <p>రికార్డ్ చేసిన పాయింట్లు: {coordinates.length}</p>
          <p>🚶‍♂️ ప్రస్తుత దూరం: {currentDistance.toFixed(1)} మీటర్లు</p>
          {coordinates.length > 0 && (
            <p>చివరి పాయింట్ ఖచ్చితత్వం: {coordinates[coordinates.length - 1]?.accuracy?.toFixed(1)} మీటర్లు</p>
          )}
          {skippedPointsCount > 0 && (
            <p style={{ color: '#ff9800' }}>⚠️ {skippedPointsCount} పాయింట్లు వదులుకోబడ్డాయి</p>
          )}
          {gpsAccuracy > ACCURACY_THRESHOLD && (
            <p style={{ color: '#ff9800' }}>⚠️ GPS సిగ్నల్ మెరుగుపరచండి</p>
          )}
        </div>
      )}

      {error && (
        <div className="error">
          <p>❌ {error}</p>
          {/* Show discard option when error is about insufficient points */}
          {error.includes('కనీసం మూడు పాయింట్లు') && (
            <div className="error-actions">
              <button onClick={discardCurrentMeasurement} className="discard-btn">
                వదిలివేసి మళ్ళీ ప్రారంభించండి
              </button>
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="results">
          <h2>కొలత #{results.measurementNumber} ఫలితాలు</h2>
          <div className="result-item">
            <strong>చుట్టుకొలత:</strong> {results.distance} మీటర్లు
          </div>
          <div className="result-item">
            <strong>వైశాల్యం:</strong>
            <ul>
              <li>{results.areaSquareMeters} చదరపు మీటర్లు</li>
              <li>{results.acres} ఎకరాలు</li>
              <li>{results.hectares} హెక్టార్లు</li>
              <li>{results.guntalu} గుంటలు</li>
            </ul>
          </div>
          <div className="measurement-info">
            <p>📍 {results.pointsRecorded} GPS పాయింట్లు రికార్డ్ చేయబడ్డాయి</p>
            <p>🔗 {results.closedPolygonPoints} పాయింట్లతో బహుభుజి మూసబడింది</p>
            <p>🎯 సగటు ఖచ్చితత్వం: {results.avgAccuracy} మీటర్లు</p>
            {results.skippedPoints > 0 && (
              <p style={{ color: '#ff9800' }}>⚠️ {results.skippedPoints} పాయింట్లు వదులుకోబడ్డాయి</p>
            )}
            {/* Show calculation method for transparency */}
            {coordinates.length > 0 && (
              <p style={{ fontSize: '12px', color: '#666' }}>
                🧮 {(() => {
                  const lats = coordinates.map(c => c.lat);
                  const lngs = coordinates.map(c => c.lng);
                  const latRange = Math.max(...lats) - Math.min(...lats);
                  const lngRange = Math.max(...lngs) - Math.min(...lngs);
                  return (latRange > 0.01 || lngRange > 0.01) ? 
                    'UTM ప్రొజెక్షన్ ఉపయోగించబడింది (అధిక ఖచ్చితత్వం)' : 
                    'ఫ్లాట్ మ్యాప్ ఉపయోగించబడింది';
                })()}
              </p>
            )}
          </div>
          
          <div className="action-buttons">
            <button onClick={startNewMeasurement} className="repeat-btn">
              మళ్ళీ కొలవండి
            </button>
          </div>
        </div>
      )}

      {measurements.length > 1 && averageResults && (
        <div className="average-results">
          <h2>సగటు ఫలితాలు ({averageResults.measurementCount} కొలతల ఆధారంగా)</h2>
          <div className="result-item">
            <strong>సగటు చుట్టుకొలత:</strong> {averageResults.distance} మీటర్లు
          </div>
          <div className="result-item">
            <strong>సగటు వైశాల్యం:</strong>
            <ul>
              <li>{averageResults.areaSquareMeters} చదరపు మీటర్లు</li>
              <li>{averageResults.acres} ఎకరాలు</li>
              <li>{averageResults.hectares} హెక్టార్లు</li>
              <li>{averageResults.guntalu} గుంటలు</li>
            </ul>
          </div>
          <div className="average-info">
            <p>📊 ఈ సగటు ఫలితాలు అధిక ఖచ్చితత్వాన్ని అందిస్తాయి</p>
          </div>
        </div>
      )}

      {coordinates.length > 0 && <CoordinateVisualization />}
    </div>
  );
};

export default DistanceCalculator;
