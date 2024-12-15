import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1); // Default zoom level
  const videoRef = useRef(null); // Video stream reference
  const canvasRef = useRef(null); // Canvas reference to draw video frames for QR scanning
  const streamRef = useRef(null); // To store the media stream
  const minZoom = 1; // Minimum zoom level
  const maxZoom = 5; // Maximum zoom level

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

    // Otherwise, select the rear camera with the best resolution
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
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // Function to adjust zoom automatically using zoomAndRetry logic
  const zoomAndRetry = async (track, capabilities, callback) => {
    setTimeout(async () => {
      if (capabilities.zoom && zoomLevel < maxZoom) {
        setZoomLevel((prevZoom) => prevZoom + 1); // Increment zoom level
        await track.applyConstraints({
          advanced: [{ zoom: zoomLevel }],
        });
      }
      requestAnimationFrame(callback); // Continue scanning
    }, 500);
  };

  // Function to adjust the zoom level
  const adjustZoom = async (zoomLevel) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      await track.applyConstraints({
        advanced: [{ zoom: zoomLevel }],
      });
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
      inversionAttempts: 'both',
    });

    if (code) {
      setScannedValue(code.data); // Set the decoded QR content
      setIsScanning(false); // Stop scanning after a successful scan
      adjustZoom(minZoom); // Zoom out to the default level after scanning
    } else {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities();
        zoomAndRetry(track, capabilities, scanQRCode); // Retry zoom and scanning
      }
    }
  };

  useEffect(() => {
    if (isScanning) {
      requestAnimationFrame(scanQRCode); // Start scanning when the camera is ready
    }
  }, [isScanning]);

  return (
    <div className="scanner-container">
      <p>{scannedValue ? `Scanned Value: ${scannedValue}` : 'Scanning for QR code...'}</p>
      {/* Video element to display the camera feed */}
      <video ref={videoRef} width="100%" height="auto" autoPlay></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default QRScanner;
