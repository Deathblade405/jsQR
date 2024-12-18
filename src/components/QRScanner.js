import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1); // Default zoom level
  const [scanStatus, setScanStatus] = useState(''); // State to show "No QR detected"
  const [qrDetected, setQrDetected] = useState(false); // Flag to track QR code detection
  const [qrData, setQrData] = useState(null); // Store QR data once decoded
  const videoRef = useRef(null); // Video stream reference
  const canvasRef = useRef(null); // Canvas reference to draw video frames for QR scanning
  const streamRef = useRef(null); // To store the media stream
  const intervalRef = useRef(null); // To store the interval for QR code detection

  // Helper function to get the best rear camera
  const getBestRearCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter(device =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );

    if (rearCameras.length === 0) {
      return videoDevices[0]; // Default to first camera if no rear camera found
    }

    // Select the rear camera with the best resolution
    let bestCamera = rearCameras[0];
    for (const camera of rearCameras) {
      const constraints = { video: { deviceId: camera.deviceId, facingMode: 'environment' } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      if (!bestCamera.resolution || capabilities.width > bestCamera.resolution.width) {
        bestCamera = camera;
        bestCamera.resolution = capabilities;
      }
      stream.getTracks().forEach(track => track.stop()); // Clean up the stream
    }

    return bestCamera;
  };

  useEffect(() => {
    const initScanner = async () => {
      try {
        const bestCamera = await getBestRearCamera();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: bestCamera.deviceId,
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      } catch (err) {
        console.error('Error accessing camera:', err);
        setIsScanning(false);
      }
    };

    initScanner();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current); // Clear the interval on component unmount
      }
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Function to adjust zoom manually using the slider
  const adjustZoom = async (zoom) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities();
      if (capabilities.zoom) {
        const newZoom = Math.min(Math.max(zoom, capabilities.zoom.min), capabilities.zoom.max);
        const constraints = { advanced: [{ zoom: newZoom }] };
        await track.applyConstraints(constraints);
        setZoomLevel(newZoom);
      }
    }
  };

  // Function to scan the QR code every second
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame on the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get the image data from the canvas
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Use jsQR to decode the QR code
    const code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'both', // Try both normal and inverted images
    });

    if (code) {
      // Mark that a QR code has been detected
      setQrDetected(true);
      setQrData(code); // Store the QR data
      setScanStatus('QR Code Detected.');

      // Draw the bounding box around the detected QR code
      const { topLeftCorner, bottomRightCorner, bottomLeftCorner, topRightCorner } = code.location;
      const qrWidth = bottomRightCorner.x - topLeftCorner.x;
      const qrHeight = bottomRightCorner.y - topLeftCorner.y;

      const qrArea = qrWidth * qrHeight;
      const frameArea = canvas.width * canvas.height;
      const qrAreaRatio = qrArea / frameArea;

      if (qrAreaRatio < 0.05) {
        setScanStatus('Move closer or center the QR code.');
      }
    } else {
      setQrDetected(false);
      setScanStatus('No QR detected');
      setQrData(null); // Reset the QR data if not detected
    }
  };

  // Decode the QR code when user clicks the bounding box
  const decodeQRCode = () => {
    if (qrData) {
      setScannedValue(qrData.data); // Set the decoded QR content
      setScanStatus(`Decoded Value: ${qrData.data}`); // Display the decoded value
      setIsScanning(false); // Stop scanning after successful decoding
    }
  };

  useEffect(() => {
    if (isScanning) {
      // Set an interval to scan for QR codes every second
      intervalRef.current = setInterval(scanQRCode, 1000);
    }
  }, [isScanning]);

  return (
    <div className="scanner-container">
      <p>{scannedValue || scanStatus || 'Scanning for QR code...'}</p>

      {/* Zoom Slider */}
      <div className="zoom-control">
        <label htmlFor="zoom">Zoom: </label>
        <input
          id="zoom"
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={zoomLevel}
          onChange={(e) => adjustZoom(Number(e.target.value))}
        />
      </div>

      {/* Video element to display the camera feed */}
      <video ref={videoRef} width="100%" height="auto" autoPlay></video>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Display bounding box and allow user to click to decode */}
      {qrDetected && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid red',
            padding: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            cursor: 'pointer',
          }}
          onClick={decodeQRCode}
        >
          Click to Decode QR Code
        </div>
      )}
    </div>
  );
};

export default QRScanner;
