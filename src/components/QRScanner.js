import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import axios from 'axios';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('Scan the QR code for Product Authentication');
  const [scanStatus, setScanStatus] = useState('');
  const [qrDetected, setQrDetected] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [noLocation, setNoLocation] = useState(false);
  const timeoutRef = useRef(null); // Reference for 15-second timeout
  const timerRef = useRef(null); // Reference for timer

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Timer for status updates during scanning
  const timer = () => {
    let i = 0;
    const textElement = document.getElementById('text');
    timerRef.current = setInterval(() => {
      if (qrDetected) {
        clearInterval(timerRef.current); // Stop the timer if QR is detected
      } else {
        ++i;
        if (i >= 9) {
          textElement.classList.remove('three');
          textElement.classList.add('four');
          setMessage('You are almost there!');
        } else if (i >= 6) {
          textElement.classList.remove('two');
          textElement.classList.add('three');
          setMessage('Hold your device steady!');
        } else if (i >= 3) {
          textElement.classList.remove('one');
          textElement.classList.add('two');
          setMessage('QRmor AI is Authenticating your product!');
        }
      }
    }, 1000);
  };

  // Function to get the best rear camera
  const getBestRearCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter(device =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );
    return rearCameras.length ? rearCameras[0] : videoDevices[0];
  };

  // Function to get the location of the user
  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sessionStorage.setItem('latitude', position.coords.latitude.toString());
          sessionStorage.setItem('longitude', position.coords.longitude.toString());
        },
        () => {
          setNoLocation(true);
        }
      );
    } else {
      setNoLocation(true);
    }
  };

  // Function to start the timeout after scanning begins
  const startTimeout = () => {
    timeoutRef.current = setTimeout(() => {
      if (!qrDetected) {
        setMessage('This is a Counterfeit Product!');
        clearInterval(timerRef.current); // Stop the timer
        setIsScanning(false); // Stop scanning after timeout
      }
    }, 15000); // 15 seconds
  };

  // Function to scan the QR code from the camera feed
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
      clearTimeout(timeoutRef.current); // Clear timeout if QR is detected
      setQrDetected(true);
      setQrData(code);
      setScanStatus(`QR Code Link: ${code.data}`);
      captureImage();
    } else {
      setScanStatus('Scanning...');
      zoomAndRetry();
    }
  };

  // Capture image to send to the backend for authentication
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
            if (response.data.result !== 'blur') {
              setMessage('QR code authenticated successfully!');
            } else {
              setMessage('Image is blurry, retrying...');
              setTimeout(captureImage, 500); // Retry capture on blur
            }
          })
          .catch((error) => {
            console.error('Error sending image:', error);
          });
      }
    }
  };

  // Convert data URL to Blob for image upload
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

  // Zoom and retry if QR code is not detected
  const zoomAndRetry = () => {
    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (capabilities.zoom && zoomLevel < 3) {
      setZoomLevel(prevZoom => {
        const newZoom = prevZoom + 1;
        track.applyConstraints({
          advanced: [{ zoom: newZoom }],
        });
        return newZoom;
      });
    }
  };

  // Initialize the camera and start scanning
  useEffect(() => {
    const initScanner = async () => {
      try {
        await getLocation();
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
        timer(); // Start the scanning timer
        startTimeout(); // Start the timeout for 15 seconds
      } catch (err) {
        console.error('Error initializing scanner:', err);
      }
    };

    initScanner();

    return () => {
      const tracks = streamRef.current?.getTracks();
      tracks?.forEach(track => track.stop());
      clearInterval(timerRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div>
      <p id="text" className="text">{message}</p>
      <div className="scanner-container">
        <video ref={videoRef} width="100%" height="auto" autoPlay></video>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default QRScanner;
