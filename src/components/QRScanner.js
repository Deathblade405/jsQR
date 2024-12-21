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
  const [noLocation, setNoLocation] = useState(false);
  const [retryCount, setRetryCount] = useState(0); // Track the number of retries for blurry images
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const zoomLevelRef = useRef(1); // Keep track of zoom level
  const trackRef = useRef(null);
  const capabilitiesRef = useRef(null);

  const getBestRearCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter(device =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );
    return rearCameras.length ? rearCameras[0] : videoDevices[0];
  };

  const zoomAndRetry = (track, capabilities, callback) => {
    setTimeout(() => {
      if (capabilities.zoom && zoomLevelRef.current < 3) { // Cap zoom to 3 levels
        zoomLevelRef.current += 1; // Increment zoom level
        track.applyConstraints({
          advanced: [{ zoom: zoomLevelRef.current }], // Apply new zoom level
        });
        console.log(`Zoom level set to: ${zoomLevelRef.current}`);
      }
      requestAnimationFrame(callback);
    }, 500); // Retry after 500ms
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
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        trackRef.current = track;
        capabilitiesRef.current = capabilities;

        videoRef.current.srcObject = stream;
        setIsScanning(true);

        zoomAndRetry(track, capabilities, () => {
          if (isScanning) {
            getLocation(); // Explicitly request location at the start
          }
        });
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

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNoLocation(false); // Location successfully retrieved
          sessionStorage.setItem('latitude', position.coords.latitude.toString());
          sessionStorage.setItem('longitude', position.coords.longitude.toString());
          console.log(
            `Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}`
          );
          if (trackRef.current && capabilitiesRef.current) {
            scanQRCode(trackRef.current, capabilitiesRef.current);
          }
        },
        (error) => {
          setNoLocation(true); // Mark location as unavailable
          setScanStatus(`Location error: ${error.message}`);
        }
      );
    } else {
      setNoLocation(true); // Geolocation not supported
      setScanStatus('Geolocation not supported');
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
        captureImage();
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

        // Add location data to the formData
        formData.append('latitude', sessionStorage.getItem('latitude'));
        formData.append('longitude', sessionStorage.getItem('longitude'));

        axios
          .post('https://scinovas.in:5009/b', formData)
          .then((response) => {
            console.log('Post Response:', response.data);
            if (response.data.result !== 'blur') {
              setScannedValue(response.data.result);
              sessionStorage.setItem('result', response.data.result);
              setIsScanning(false); // Stop scanning on valid QR code
              setRetryCount(0); // Reset retry count after successful scan
              setTimeout(() => {
                setIsScanning(true);
                getLocation(); // Prompt location again after scan restarts
              }, 3000); // Automatically restart scanning after 3 seconds
            } else {
              console.log('Image is blurry, retrying...');
              setRetryCount(prev => prev + 1); // Increment retry count
              if (retryCount >= 3) {
                setScanStatus('Image is too blurry, please try again later.');
                setIsScanning(false); // Stop scanning after too many blurry attempts
              } else {
                setTimeout(captureImage, 500); // Retry capture on blur
              }
            }
          })
          .catch((error) => {
            console.error('Error sending image:', error.message || error);
            setScanStatus('Error processing QR code. Please try again.');
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
      const interval = setInterval(() => scanQRCode(trackRef.current, capabilitiesRef.current), 1000);
      intervalRef.current = interval;

      return () => {
        clearInterval(interval);
      };
    }
  }, [isScanning]);

  return (
    <div>
      <p className="status-message">
        {noLocation ? 'Unable to access location. Please allow location access.' : ''}
        {scannedValue || scanStatus || 'Scanning for QR code...'}
      </p>
      <div className="scanner-container">
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
    </div>
  );
};

export default QRScanner;
