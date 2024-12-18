import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [scanStatus, setScanStatus] = useState(''); // State for scanning status (e.g., "No QR detected")
  const videoRef = useRef(null); // Video stream reference
  const canvasRef = useRef(null); // Canvas reference to draw video frames for QR scanning
  const streamRef = useRef(null); // To store the media stream

  // Helper function to get the best rear camera
  const getBestRearCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter((device) =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );

    if (rearCameras.length === 0) {
      return videoDevices[0]; // Default to the first camera if no rear camera is found
    }

    return rearCameras[0]; // Return the first rear camera
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
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

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
      setScannedValue(code.data); // Set the decoded QR content
      setScanStatus(''); // Clear any "No QR detected" message
      drawBorder(context, code.location); // Highlight QR code border
    } else {
      setScanStatus('No QR detected'); // Show message for blank spaces
      context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas to remove any previous borders
    }

    requestAnimationFrame(scanQRCode); // Continue scanning
  };

  // Function to draw the QR code border
  const drawBorder = (context, location) => {
    if (!location) return;

    context.beginPath();
    context.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
    context.lineTo(location.topRightCorner.x, location.topRightCorner.y);
    context.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
    context.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
    context.closePath();
    context.lineWidth = 4;
    context.strokeStyle = 'green'; // Border color
    context.stroke();
  };

  useEffect(() => {
    if (isScanning) {
      requestAnimationFrame(scanQRCode); // Start scanning when the camera is ready
    }
  }, [isScanning]);

  return (
    <div className="scanner-container">
      {/* Show scanning status or QR code result */}
      {scanStatus && <p className="status">{scanStatus}</p>}
      {scannedValue && <p className="result">Scanned Value: {scannedValue}</p>}

      {/* Video element to display the camera feed */}
      <video ref={videoRef} width="100%" height="auto" autoPlay></video>
      <canvas ref={canvasRef} className="scanner-canvas"></canvas>
    </div>
  );
};

export default QRScanner;
