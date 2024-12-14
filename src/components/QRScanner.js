import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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

  const applyZoom = async (zoom) => {
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

  const handleZoomChange = (e) => {
    const zoom = Number(e.target.value);
    setZoomLevel(zoom);
    applyZoom(zoom);
  };

  const preprocessImage = (imageData) => {
    const data = imageData.data;
    const grayscaleThreshold = 128;

    // Smooth the texture using Gaussian blur (simulate with averaging nearby pixels)
    const kernelSize = 5;
    for (let i = 0; i < data.length; i += 4) {
      let sum = 0;
      for (let k = -kernelSize; k <= kernelSize; k++) {
        const idx = i + k * 4;
        if (idx >= 0 && idx < data.length) {
          sum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        }
      }
      const avg = sum / (2 * kernelSize + 1);
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }

    // Convert to grayscale and apply adaptive thresholding
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const threshold = Math.random() * 30 + grayscaleThreshold; // Adaptive threshold
      const binarized = gray >= threshold ? 255 : 0;

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
      // Retry logic: dynamically adjust preprocessing and analyze additional frames
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
          onChange={handleZoomChange}
        />
      </div>
      {isScanning && <p>Scanning...</p>}
      <video ref={videoRef} width="100%" height="auto" autoPlay></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default QRScanner;
