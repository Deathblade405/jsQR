import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1); // Default zoom level
  const [scanStatus, setScanStatus] = useState(''); // State to show "No QR detected"
  const videoRef = useRef(null); // Video stream reference
  const canvasRef = useRef(null); // Canvas reference to draw video frames for QR scanning
  const streamRef = useRef(null); // To store the media stream

  // Helper function to get the best rear camera
  const getBestRearCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter(device =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );

    if (rearCameras.length === 0) {
      // If no rear camera is found, default to the first available camera
      return videoDevices[0];
    }

    // Select the rear camera with the best resolution
    let bestCamera = rearCameras[0];
    for (const camera of rearCameras) {
      const constraints = {
        video: { deviceId: camera.deviceId, facingMode: 'environment' }
      };
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
        const bestCamera = await getBestRearCamera(); // Get the best rear camera
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

  // Function to scan the QR code
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      requestAnimationFrame(scanQRCode);
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
      // Check the QR code's location boundaries to ensure it's sufficiently visible
      const { topLeftCorner, bottomRightCorner, bottomLeftCorner, topRightCorner } = code.location;
      const qrWidth = bottomRightCorner.x - topLeftCorner.x;
      const qrHeight = bottomRightCorner.y - topLeftCorner.y;

      const qrArea = qrWidth * qrHeight;
      const frameArea = canvas.width * canvas.height;
      const qrAreaRatio = qrArea / frameArea;

      // If the QR code is too small in the frame, show an instruction to move closer
      if (qrAreaRatio < 0.05) {
        setScanStatus('Move closer or center the QR code.');
      } else {
        setScannedValue(code.data); // Set the decoded QR content
        setScanStatus(''); // Clear "No QR detected" message
        setIsScanning(false); // Stop scanning after a successful scan
      }

      // Draw the bounding box around the detected QR code
      context.beginPath();
      context.moveTo(topLeftCorner.x, topLeftCorner.y);
      context.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
      context.lineTo(bottomRightCorner.x, bottomRightCorner.y);
      context.lineTo(topRightCorner.x, topRightCorner.y);
      context.closePath();

      // Set styles for the bounding box
      context.lineWidth = 5;
      context.strokeStyle = 'red';
      context.fillStyle = 'rgba(255, 0, 0, 0.3)';
      context.fill();
      context.stroke();
    } else {
      setScanStatus('No QR detected');
      requestAnimationFrame(scanQRCode);
    }
  };

  useEffect(() => {
    if (isScanning) {
      requestAnimationFrame(scanQRCode); // Start scanning when the camera is ready
    }
  }, [isScanning, zoomLevel]);

  return (
    <div className="scanner-container">
      <p>{scannedValue ? `Scanned Value: ${scannedValue}` : scanStatus || 'Scanning for QR code...'}</p>

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
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default QRScanner;