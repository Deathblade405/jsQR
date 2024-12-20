import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import axios from 'axios';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scanStatus, setScanStatus] = useState('');
  const [qrDetected, setQrDetected] = useState(false);
  const [qrData, setQrData] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

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
      // Ensure the detected QR code is large enough to be valid
      const qrSizeThreshold = Math.min(canvas.width, canvas.height) * 0.2;
      const qrWidth = Math.abs(code.location.bottomRightCorner.x - code.location.topLeftCorner.x);
      const qrHeight = Math.abs(code.location.bottomRightCorner.y - code.location.topLeftCorner.y);

      if (qrWidth >= qrSizeThreshold && qrHeight >= qrSizeThreshold) {
        setQrDetected(true);
        setQrData(code);
        setScanStatus(`QR Code Link: ${code.data}`);
        captureImage(); // Automatically trigger image capture on QR detection
      } else {
        setQrDetected(false);
        setScanStatus('Detected partial QR code, retrying...');
        setQrData(null);
      }
    } else {
      setQrDetected(false);
      setScanStatus('No QR detected');
      setQrData(null);
    }
  };

  const adjustZoom = async (zoom) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities();
      if (capabilities.zoom) {
        const newZoom = Math.min(Math.max(zoom, capabilities.zoom.min), capabilities.zoom.max);
        const constraints = { advanced: [{ zoom: newZoom }] };
        await track.applyConstraints(constraints);
        setZoomLevel(newZoom);
      }
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
              // Automatically restart scanning after 3 seconds
              setTimeout(() => setIsScanning(true), 3000);
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

  return (
    <div className="scanner-container">
      <p>{scannedValue || scanStatus || 'Scanning for QR code...'}</p>

      <div className="zoom-control">
        <label htmlFor="zoom">Zoom: </label>
        <input
          id="zoom"
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={zoomLevel}
          onChange={(e) => adjustZoom(Number(e.target.value))}
        />
      </div>

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
