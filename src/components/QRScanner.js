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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
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
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const adjustZoom = async (zoom) => {
    setZoomLevel(zoom);

    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities();
      if (capabilities.zoom) {
        try {
          const constraints = { advanced: [{ zoom }] };
          await track.applyConstraints(constraints);
        } catch (error) {
          console.error('Failed to apply zoom constraints:', error);
        }
      }
    }
  };

  const preprocessImage = (imageData) => {
    const data = imageData.data;
    const grayscaleThreshold = 128;

    // Adjust contrast and brightness
    const contrastFactor = 1.5;
    const brightnessOffset = 20;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, contrastFactor * data[i] + brightnessOffset);
      data[i + 1] = Math.min(255, contrastFactor * data[i + 1] + brightnessOffset);
      data[i + 2] = Math.min(255, contrastFactor * data[i + 2] + brightnessOffset);
    }

    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const binarized = gray >= grayscaleThreshold ? 255 : 0;

      data[i] = binarized;
      data[i + 1] = binarized;
      data[i + 2] = binarized;
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    imageData = preprocessImage(imageData);

    const code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'both',
      errorCorrectionLevel: 'high',
    });

    if (code) {
      const qrData = code.data;
      if (qrData !== 'https://scinovas.in/m') {
        alert(`QR Code Scanned: ${qrData}`);
        setIsScanning(false);
      }
    } else {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities();
        if (capabilities.zoom && zoomLevel < 5) {
          adjustZoom(zoomLevel + 0.1);
        }
      }
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
      <input
        type="text"
        className="batch-number-input"
        value={batchNumber}
        onChange={(e) => setBatchNumber(e.target.value)}
        placeholder="Enter Batch Number"
      />
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
