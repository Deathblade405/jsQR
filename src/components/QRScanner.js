import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import Tesseract from 'tesseract.js'; // Fallback OCR library
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
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
        setErrorMessage('Failed to access the camera.');
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

    // Histogram Equalization for Contrast Enhancement
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      histogram[Math.floor(gray)]++;
    }

    let cumulative = 0;
    const equalizedHistogram = histogram.map((value) => {
      cumulative += value;
      return Math.round((cumulative / (imageData.width * imageData.height)) * 255);
    });

    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const equalized = equalizedHistogram[Math.floor(gray)];

      data[i] = equalized;
      data[i + 1] = equalized;
      data[i + 2] = equalized;
    }

    // Binarization with Adaptive Thresholding
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i];
      const threshold = Math.random() * 20 + grayscaleThreshold;
      const binarized = gray >= threshold ? 255 : 0;

      data[i] = binarized;
      data[i + 1] = binarized;
      data[i + 2] = binarized;
    }

    return imageData;
  };

  const fallbackOCR = async (canvas) => {
    const dataURL = canvas.toDataURL();
    const result = await Tesseract.recognize(dataURL, 'eng', {
      logger: (info) => console.log(info),
    });
    return result.data.text;
  };

  const scanQRCode = async () => {
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
      alert(`QR Code Scanned: ${code.data}`);
      setIsScanning(false);
    } else {
      console.log('jsQR failed. Attempting OCR...');
      const fallbackData = await fallbackOCR(canvas);
      if (fallbackData) {
        alert(`OCR Detected: ${fallbackData}`);
        setIsScanning(false);
      } else {
        console.log('Retrying...');
        requestAnimationFrame(scanQRCode);
      }
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
      {errorMessage && <p className="error">{errorMessage}</p>}
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
