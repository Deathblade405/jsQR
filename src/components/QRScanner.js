import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

// Import OpenCV (or another image processing library) for better QR detection
import cv from 'opencv.js';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [invertColors, setInvertColors] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const initScanner = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // Use back camera
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

    const image = cv.matFromImageData(imageData);

    // Use OpenCV for border detection and perspective transform
    const gray = new cv.Mat();
    cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY);  // Convert to grayscale
    const edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 100); // Detect edges

    // Find contours (edges of QR code)
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Loop through contours to find the largest rectangle (QR code)
    let maxArea = 0;
    let qrContour = null;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const area = rect.width * rect.height;
      if (area > maxArea) {
        maxArea = area;
        qrContour = contour;
      }
    }

    // If QR contour is found, apply perspective transform
    if (qrContour) {
      const points = [];
      for (let i = 0; i < qrContour.rows; i++) {
        points.push([qrContour.data32S[i * 2], qrContour.data32S[i * 2 + 1]]);
      }

      // Perspective transform to straighten QR code
      const srcPoints = cv.matFromArray(points);
      const dstPoints = cv.matFromArray([
        [0, 0],
        [canvas.width, 0],
        [canvas.width, canvas.height],
        [0, canvas.height],
      ]);

      const M = cv.getPerspectiveTransform(srcPoints, dstPoints);
      cv.warpPerspective(image, image, M, new cv.Size(canvas.width, canvas.height));

      // Convert to binary image for better QR code detection
      cv.threshold(image, image, 128, 255, cv.THRESH_BINARY);

      // Now, use jsQR to decode the QR code
      const qrCode = jsQR(image.data, image.cols, image.rows, {
        inversionAttempts: 'both',
        errorCorrectionLevel: 'high',
      });

      if (qrCode) {
        const qrData = qrCode.data;
        if (qrData !== 'https://scinovas.in/m') {
          window.open(qrData, '_blank');
          setIsScanning(false);
        }
      }
    }

    image.delete();
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  };

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
