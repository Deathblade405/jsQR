import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import axios from 'axios';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [qrDetected, setQrDetected] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [isQRCodeDetected, setIsQRCodeDetected] = useState(false); // New state to track QR detection status

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const getBestRearCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter(device =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );
    return rearCameras.length ? rearCameras[0] : videoDevices[0];
  };

  useEffect(() => {
    const initScanner = async () => {
      try {
        const bestCamera = await getBestRearCamera();
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
      const tracks = streamRef.current?.getTracks();
      tracks?.forEach(track => track.stop());
    };
  }, []);

  const zoomAndRetry = async (track, capabilities) => {
    if (capabilities.zoom && zoomLevel < 3) { // Limit to 3x zoom
      setZoomLevel(prevZoom => {
        const newZoom = prevZoom + 1;
        track.applyConstraints({
          advanced: [{ zoom: newZoom }],
        });
        return newZoom;
      });
    }
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'both',
    });

    if (code) {
      const qrSizeThreshold = Math.min(canvas.width, canvas.height) * 0.2;
      const qrWidth = Math.abs(code.location.bottomRightCorner.x - code.location.topLeftCorner.x);
      const qrHeight = Math.abs(code.location.bottomRightCorner.y - code.location.topLeftCorner.y);

      if (qrWidth >= qrSizeThreshold && qrHeight >= qrSizeThreshold) {
        setQrDetected(true);
        setQrData(code);
        setScanStatus(`QR Code Link: ${code.data}`);
        setIsQRCodeDetected(true); // QR detected, update state
        captureImage(); // Automatically trigger image capture on QR detection
      } else {
        setQrDetected(false);
        setScanStatus('Detected partial QR code, retrying...');
        setQrData(null);
        setIsQRCodeDetected(false); // QR detected partially, set state to false
      }
    } else {
      setQrDetected(false);
      setScanStatus('No QR detected');
      setQrData(null);
      setIsQRCodeDetected(false); // No QR detected, set state to false
    }
  };

  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (canvas && video) {
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = dataURLtoBlob(canvas.toDataURL('image/png'));

        const formData = new FormData();
        formData.append('image', blob, 'image.jpg');

        axios.post('https://scinovas.in:5009/b', formData)
          .then((response) => {
            console.log(response);
            if (response.data.result !== 'blur') {
              setScannedValue(response.data.result);
              sessionStorage.setItem('result', response.data.result);
              setIsScanning(false); // Stop scanning on valid QR code
              setTimeout(() => setIsScanning(true), 3000); // Automatically restart scanning after 3 seconds
            } else {
              console.log('Image is blurry, retrying...');
              setTimeout(captureImage, 500); // Retry capture on blur
            }
          })
          .catch((error) => {
            console.error('Error sending image:', error);
          });
      }
    }
  };

  const dataURLtoBlob = (dataURL) => {
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const buffer = new ArrayBuffer(byteString.length);
    const dataView = new Uint8Array(buffer);
    for (let i = 0; i < byteString.length; i++) {
      dataView[i] = byteString.charCodeAt(i);
    }
    return new Blob([buffer], { type: mimeString });
  };

  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(scanQRCode, 1000);
      intervalRef.current = interval;

      return () => {
        clearInterval(interval);
      };
    }
  }, [isScanning]);

  useEffect(() => {
    if (isScanning && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      zoomAndRetry(track, capabilities);
    }
  }, [isScanning, zoomLevel]);

  return (
    <div className="scanner-container">
      <p>{scannedValue || scanStatus || (isQRCodeDetected ? 'QR Code detected: True' : 'Scanning for QR code...')}</p>
      <video ref={videoRef} width="100%" height="auto" autoPlay></video>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {qrDetected && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid red',
            padding: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            cursor: 'pointer',
          }}
          onClick={() => {
            if (qrData) {
              setScannedValue(qrData.data);
              setIsScanning(false);
              setTimeout(() => setIsScanning(true), 3000); // Restart scanning
            }
          }}
        >
          Click to Decode QR Code
        </div>
      )}
    </div>
  );
};

export default QRScanner;
