import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1); // Default zoom level
  const videoRef = useRef(null); // Ref for video element
  const canvasRef = useRef(null); // Ref for canvas element
  const streamRef = useRef(null); // Ref for the media stream

  useEffect(() => {
    const initScanner = async () => {
      try {
        // Access the webcam (back camera for mobile)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // Use back camera on mobile
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

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

  const adjustZoom = async (zoom) => {
    setZoomLevel(zoom); // Update state for UI

    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities();
      if (capabilities.zoom) {
        const constraints = { advanced: [{ zoom }] };
        await track.applyConstraints(constraints);
      }
    }
  };

  const enhanceImageData = (imageData) => {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = brightness > 128 ? 255 : 0; // Thresholding for contrast
    }
    return imageData;
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth * 2; // Increase resolution
    canvas.height = video.videoHeight * 2;

    context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    imageData = enhanceImageData(imageData); // Improve contrast and reduce noise

    const code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'both', // Try both normal and inverted images
      errorCorrectionLevel: 'high',
    });

    if (code) {
      const qrData = code.data;
      if (qrData !== 'https://scinovas.in/m') {
        window.open(qrData, '_blank');
        setIsScanning(false);
      }
    } else {
      requestAnimationFrame(scanQRCode);
    }
  };

  useEffect(() => {
    if (isScanning) {
      requestAnimationFrame(scanQRCode);
    }
  }, [isScanning]);

  return (
    <div className="scanner-container">
      <h2>QR Code Scanner</h2>
      {/* Batch Number Input */}
      <input
        type="text"
        className="batch-number-input"
        value={batchNumber}
        onChange={(e) => setBatchNumber(e.target.value)}
        placeholder="Enter Batch Number"
      />
      {/* Zoom Control */}
      <div className="zoom-control">
        <label htmlFor="zoom">Zoom:</label>
        <input
          id="zoom"
          type="range"
          min="1"
          max="5"
          step="0.1"
          value={zoomLevel}
          onChange={(e) => adjustZoom(Number(e.target.value))}
        />
      </div>
      {isScanning && <p>Scanning...</p>}
      <video ref={videoRef} width="100%" height="auto" autoPlay></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default QRScanner;
