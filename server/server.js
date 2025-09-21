import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage for measurements (in production, use a database)
let measurements = [];
let measurementId = 1;

app.get("/", (req, res) => {
  res.send("Field Area Calculator Server is running!");
});

// Store a new measurement
app.post("/api/measurements", (req, res) => {
  try {
    const measurement = {
      id: measurementId++,
      ...req.body,
      timestamp: new Date().toISOString(),
      location: "Unknown" // Could be enhanced with reverse geocoding
    };
    
    measurements.push(measurement);
    res.status(201).json({ 
      success: true, 
      message: "Measurement saved successfully",
      data: measurement 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to save measurement",
      error: error.message 
    });
  }
});

// Get all measurements
app.get("/api/measurements", (req, res) => {
  try {
    res.json({ 
      success: true, 
      data: measurements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve measurements",
      error: error.message 
    });
  }
});

// Get measurement by ID
app.get("/api/measurements/:id", (req, res) => {
  try {
    const measurement = measurements.find(m => m.id === parseInt(req.params.id));
    if (!measurement) {
      return res.status(404).json({ 
        success: false, 
        message: "Measurement not found" 
      });
    }
    res.json({ 
      success: true, 
      data: measurement 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve measurement",
      error: error.message 
    });
  }
});

// Delete measurement by ID
app.delete("/api/measurements/:id", (req, res) => {
  try {
    const index = measurements.findIndex(m => m.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "Measurement not found" 
      });
    }
    
    measurements.splice(index, 1);
    res.json({ 
      success: true, 
      message: "Measurement deleted successfully" 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete measurement",
      error: error.message 
    });
  }
});

// Get statistics with performance metrics
app.get("/api/stats", (req, res) => {
  try {
    const totalMeasurements = measurements.length;
    const totalArea = measurements.reduce((sum, m) => sum + parseFloat(m.areaSquareMeters || 0), 0);
    const avgArea = totalMeasurements > 0 ? totalArea / totalMeasurements : 0;
    
    // Calculate performance statistics
    const avgPointsPerMeasurement = totalMeasurements > 0 ? 
      measurements.reduce((sum, m) => sum + (m.pointsRecorded || 0), 0) / totalMeasurements : 0;
    const totalSkippedPoints = measurements.reduce((sum, m) => sum + (m.skippedPoints || 0), 0);
    const avgAccuracy = totalMeasurements > 0 ?
      measurements.reduce((sum, m) => sum + parseFloat(m.avgAccuracy || 0), 0) / totalMeasurements : 0;
    
    res.json({
      success: true,
      data: {
        totalMeasurements,
        totalArea: totalArea.toFixed(2),
        averageArea: avgArea.toFixed(2),
        totalAreaInAcres: (totalArea / 4047).toFixed(4),
        totalAreaInHectares: (totalArea / 10000).toFixed(4),
        performanceMetrics: {
          avgPointsPerMeasurement: avgPointsPerMeasurement.toFixed(1),
          totalSkippedPoints,
          avgAccuracy: avgAccuracy.toFixed(1),
          dataQuality: totalSkippedPoints > 0 ? 
            ((measurements.reduce((sum, m) => sum + (m.pointsRecorded || 0), 0) / 
              (measurements.reduce((sum, m) => sum + (m.pointsRecorded || 0), 0) + totalSkippedPoints)) * 100).toFixed(1) + '%' :
            '100%'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to calculate statistics",
      error: error.message 
    });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
