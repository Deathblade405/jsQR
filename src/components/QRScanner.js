import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [invertColors, setInvertColors] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const checkOpencv = () => {
      if (typeof cv !== 'undefined') {
        console.log("OpenCV.js loaded");
        // Proceed with the logic once OpenCV is loaded
        setIsScanning(true);
      } else {
        setTimeout(checkOpencv, 100); // Retry if OpenCV is not loaded yet
      }
    };

    checkOpencv();
  }, []);

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

  const adjustZoom = async (zoom) => {
    setZoomLevel(zoom);

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
      if (invertColors) {
        data[i] = data[i + 1] = data[i + 2] = brightness < 128 ? 255 : 0;
      } else {
        data[i] = data[i + 1] = data[i + 2] = brightness > 128 ? 255 : 0;
      }
    }
    return imageData;
  };

  const detectAndDecodeQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      requestAnimationFrame(detectAndDecodeQRCode);
      return;
    }

    canvas.width = video.videoWidth * 2;
    canvas.height = video.videoHeight * 2;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    imageData = enhanceImageData(imageData);

    // OpenCV processing code here (if OpenCV is loaded)

    // After processing, use jsQR to decode the QR code
    const qrCode = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'both',
      errorCorrectionLevel: 'high',
    });

    if (qrCode) {
      const qrData = qrCode.data;
      if (qrData !== 'https://scinovas.in/m') {
        window.open(qrData, '_blank');
        setIsScanning(false);
      }
    } else {
      requestAnimationFrame(detectAndDecodeQRCode);
    }
  };

  useEffect(() => {
    initScanner();
  }, []);

  useEffect(() => {
    if (isScanning) {
      requestAnimationFrame(detectAndDecodeQRCode);
    }
  }, [isScanning, invertColors]);

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
      <div className="invert-control">
        <label htmlFor="invert">Invert Colors:</label>
        <input
          id="invert"
          type="checkbox"
          checked={invertColors}
          onChange={(e) => setInvertColors(e.target.checked)}
        />
      </div>
      {isScanning && <p>Scanning...</p>}
      <video ref={videoRef} width="100%" height="auto" autoPlay></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default QRScanner;
