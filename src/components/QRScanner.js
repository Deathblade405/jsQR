import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import axios from 'axios';
import './styles.css';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate(); // For navigation to result page

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const timer = () => {
    let i = 0;
    const textElement = document.getElementById('text');
    timerRef.current = setInterval(() => {
      console.log(`Timer interval: ${i}`);
      if (qrDetected) {
        console.log('QR Detected, stopping timer');
        clearInterval(timerRef.current); // Stop the timer on QR detection
      } else {
        ++i;
        if (i >= 9) {
          console.log('Changing message to: "You are almost there!"');
          textElement.classList.remove('three');
          textElement.classList.add('four');
          setMessage('You are almost there!');
        } else if (i >= 6) {
          console.log('Changing message to: "Hold your device steady!"');
          textElement.classList.remove('two');
          textElement.classList.add('three');
          setMessage('Hold your device steady!');
        } else if (i >= 3) {
          console.log('Changing message to: "QRmor AI is Authenticating your product!"');
          textElement.classList.remove('one');
          textElement.classList.add('two');
          setMessage('QRmor AI is Authenticating your product!');
        }
      }
    }, 1000);
  };

  const getBestRearCamera = async () => {
    console.log('Getting best rear camera...');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter(device =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );
    console.log(`Found rear cameras: ${rearCameras.length ? rearCameras[0].label : 'None'}`);
    return rearCameras.length ? rearCameras[0] : videoDevices[0];
  };

  const getLocation = async () => {
    console.log('Getting location...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log(`Location retrieved: Latitude ${position.coords.latitude}, Longitude ${position.coords.longitude}`);
          sessionStorage.setItem('latitude', position.coords.latitude.toString());
          sessionStorage.setItem('longitude', position.coords.longitude.toString());
          timer();
          scanQRCode();
          startTimeout();
        },
        () => {
          setNoLocation(true);
          console.log('Location error: Geolocation not available');
        }
      );
    } else {
      setNoLocation(true);
      console.log('Geolocation not supported in this browser');
    }
  };

  const startTimeout = () => {
    console.log('Starting 15-second timeout...');
    timeoutRef.current = setTimeout(() => {
      if (!qrDetected) {
        console.log('QR code not detected within 15 seconds');
        setMessage('QR code not detected within 15 seconds. Counterfeit suspected.');
        clearInterval(timerRef.current); // Stop the timer
        setIsScanning(false); // Stop scanning
        sessionStorage.setItem('result', 'false'); // Set result as counterfeit
        navigate('/result'); // Redirect to result page
      }
    }, 15000); // 15 seconds
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    // Check if video dimensions are available and non-zero
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Waiting for valid video dimensions...');
      return; // Exit if the video dimensions are invalid
    }

    // Update canvas size to match video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'both' });

    if (code) {
      // QR code detected
      clearTimeout(timeoutRef.current); // Stop timeout if QR is detected
      setQrDetected(true);
      setScanStatus(`QR Code Link: ${code.data}`);
      captureImage(code.data); // Capture image and send to backend
    } else {
      // No QR code detected
      setScanStatus('Scanning...');
      zoomAndRetry();
    }
  };

  const captureImage = (qrData) => {
    console.log('Capturing image...');
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
        formData.append('qrData', qrData); // Add QR data to form

        console.log('Sending image for processing...');
        axios.post('https://scinovas.in:5009/b', formData)
          .then((response) => {
            console.log('Image sent successfully, response:', response.data);
            if (response.data.result === 'true') {
              sessionStorage.setItem('result', 'true'); // Genuine product
            } else {
              sessionStorage.setItem('result', 'false'); // Counterfeit product
            }
            navigate('/result'); // Redirect to result page
          })
          .catch((error) => {
            console.error('Error sending image:', error);
            sessionStorage.setItem('result', 'false'); // In case of error, assume counterfeit
            navigate('/result');
          });
      }
    }
  };

  const dataURLtoBlob = (dataURL) => {
    console.log('Converting data URL to Blob...');
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const buffer = new ArrayBuffer(byteString.length);
    const dataView = new Uint8Array(buffer);
    for (let i = 0; i < byteString.length; i++) {
      dataView[i] = byteString.charCodeAt(i);
    }
    return new Blob([buffer], { type: mimeString });
  };

  const zoomAndRetry = () => {
    // Check if zoom level needs to be increased
    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (capabilities.zoom && zoomLevel < 3) {
      console.log(`Zoom level before: ${zoomLevel}`);
      setZoomLevel(prevZoom => {
        const newZoom = prevZoom + 1;
        console.log(`Applying zoom: ${newZoom}`);
        track.applyConstraints({
          advanced: [{ zoom: newZoom }],
        });
        return newZoom;
      });
    }
    // Do not call scanQRCode here, just wait for the next scanning cycle
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

        // Wait until the video metadata is loaded
        videoRef.current.onloadedmetadata = () => {
          // Now the video has valid dimensions
          setIsScanning(true);
          getLocation(); // Get location before scanning
        };
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
