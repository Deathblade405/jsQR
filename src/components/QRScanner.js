import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';
const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const videoRef = useRef(null); // Ref for video element
  const canvasRef = useRef(null); // Ref for canvas element

  useEffect(() => {
    const initScanner = async () => {
      try {
        // Access the webcam (back camera for mobile)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // Use back camera on mobile
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Start scanning when the camera feed is available
        setIsScanning(true);
      } catch (err) {
        console.error('Error accessing camera:', err);
        setIsScanning(false);
      }
    };

    initScanner();

    // Cleanup when the component is unmounted
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Function to decode QR code from the video feed
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    // Check if the video has valid dimensions before proceeding
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      requestAnimationFrame(scanQRCode); // Keep scanning if video size is not available
      return;
    }

    // Set canvas size to match the video feed
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame on the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data from the canvas
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'dontInvert',
    });

    // If a QR code is detected and it's not the ignored URL, redirect
    if (code) {
      const qrData = code.data;
      if (qrData !== 'https://scinovas.in/m') {
        // Redirect to the QR code URL in a new tab
        window.open(qrData, '_blank');
        setIsScanning(false); // Stop scanning once redirected
      }
    } else {
      requestAnimationFrame(scanQRCode); // Keep scanning if no QR code is detected
    }
  };

  // Start the scanning process when the video is playing
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
      {isScanning && <p>Scanning...</p>}
      <video ref={videoRef} width="100%" height="auto" autoPlay></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default QRScanner;
