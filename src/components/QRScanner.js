import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [qrResult, setQrResult] = useState('');
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
          videoRef.current.play();
        }

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        // Initialize zoom level if supported
        if (capabilities.zoom) {
          setZoomLevel(capabilities.zoom.min || 1);
          track.applyConstraints({
            advanced: [{ zoom: capabilities.zoom.min || 1 }],
          });
        }

        setIsScanning(true);
        scanQRCode(track, capabilities);
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

  const preprocessImage = (imageData) => {
    const data = imageData.data;
    const grayscaleThreshold = 128;

    // Step 1: Adjust contrast and brightness
    const contrastFactor = 1.5; // Increase contrast
    const brightnessOffset = 20; // Increase brightness

    for (let i = 0; i < data.length; i += 4) {
      // Adjust RGB values
      data[i] = Math.min(255, contrastFactor * data[i] + brightnessOffset); // Red
      data[i + 1] = Math.min(255, contrastFactor * data[i + 1] + brightnessOffset); // Green
      data[i + 2] = Math.min(255, contrastFactor * data[i + 2] + brightnessOffset); // Blue
    }

    // Step 2: Convert to grayscale and binarize
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const binarized = gray >= grayscaleThreshold ? 255 : 0;

      data[i] = binarized; // Red
      data[i + 1] = binarized; // Green
      data[i + 2] = binarized; // Blue
    }

    return imageData;
  };

  const scanQRCode = (track, capabilities) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || !video) {
      console.error('Canvas or video element is missing.');
      return;
    }

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Preprocess image for better decoding
        imageData = preprocessImage(imageData);

        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code) {
          setQrResult(code.data);
          console.log('QR Code detected:', code.data);
          setIsScanning(false);
        } else {
          console.log('QR Code not detected. Retrying...');
          zoomAndRetry(track, capabilities, tick);
        }
      } else {
        console.log('Video not ready. Retrying...');
        zoomAndRetry(track, capabilities, tick);
      }
    };
    tick();
  };

  const zoomAndRetry = (track, capabilities, callback) => {
    setTimeout(() => {
      if (capabilities.zoom && zoomLevel < (capabilities.zoom.max || 5)) {
        const newZoomLevel = zoomLevel + 1;
        setZoomLevel(newZoomLevel);
        track.applyConstraints({
          advanced: [{ zoom: newZoomLevel }],
        });
      }
      requestAnimationFrame(callback);
    }, 500);
  };

  return (
    <div className="scanner-container">
      <h2>QR Code Scanner</h2>
      {errorMessage && <p className="error">{errorMessage}</p>}
      <p>{isScanning ? 'Scanning...' : 'Stopped'}</p>
      <p>QR Result: {qrResult}</p>
      <video ref={videoRef} autoPlay muted></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default QRScanner;
