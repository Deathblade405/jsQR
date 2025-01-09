import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Import useLocation
import jsQR from 'jsqr';
import axios from 'axios';
import MobileDetect from 'mobile-detect';  // Import mobile-detect library
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('Scan the QR code for Product Authentication');
  const [scanStatus, setScanStatus] = useState('');
  const [qrDetected, setQrDetected] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [noLocation, setNoLocation] = useState(false);
  const timeoutRef = useRef(null); // Reference for 15-second timeout
  const timerRef = useRef(null); // Reference for timer
  const navigate = useNavigate(); // For navigation to result page
  const location = useLocation(); // Hook for query parameters
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // Extract query parameters
    const params = new URLSearchParams(location.search);
    const aParam = params.get('a');
    if (aParam) {
      const id = `QRmor${aParam}`;
      sessionStorage.setItem('id', id); // Save the constructed ID to sessionStorage
    }
  }, [location]);

  const fetchPublicIP = () => {
    axios.get('https://api.ipify.org?format=json')
      .then((response) => {
        const publicIP = response.data.ip;
        fetchLocation(publicIP);
      })
      .catch((error) => {
        console.error('Error fetching public IP:', error);
      });
  };

  const fetchLocation = (ip) => {
    const id = sessionStorage.getItem('id');
    const latitude = sessionStorage.getItem('latitude');
    const longitude = sessionStorage.getItem('longitude');
    const result = sessionStorage.getItem('result') === 'true' ? 1 : 0;

    axios.get(`https://auth.scinovas.com:5004/counter/${id}`)
      .then((response) => {
        const count = response.data[0] + 1;
        axios.get(`https://auth.scinovas.com:5004/latlon/${id}/${latitude}/${longitude}/${ip}/${result}/${count}`)
          .then(() => {
            navigate('/result');
          })
          .catch((error) => {
            console.error('Error:', error);
            alert('Database Connectivity Failed');
          });
      })
      .catch((error) => {
        console.error('Error:', error);
        alert('Database Connectivity Failed');
      });
  };

  const getBestRearCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter(device =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );
    return rearCameras.length ? rearCameras[0] : videoDevices[0];
  };

  const getLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sessionStorage.setItem('latitude', position.coords.latitude.toString());
          sessionStorage.setItem('longitude', position.coords.longitude.toString());
          scanQRCode();
          startTimeout();
        },
        () => {
          setNoLocation(true);
        }
      );
    } else {
      setNoLocation(true);
    }
  };

  const startTimeout = () => {
    timeoutRef.current = setTimeout(() => {
      if (!qrDetected) {
        clearInterval(timerRef.current); // Stop the timer
        setIsScanning(false); // Stop scanning
        sessionStorage.setItem('result', 'false'); // Set result as counterfeit
        fetchPublicIP(); // Trigger fetchPublicIP after timeout
      }
    }, 15000); // 15 seconds
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      requestAnimationFrame(scanQRCode);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'both' });
    if (code) {
      setQrDetected(true);
      clearTimeout(timeoutRef.current);
      setScanStatus(`QR Code Link: ${code.data}`);
      captureImage();
      fetchPublicIP(); // Trigger fetchPublicIP after QR code detection
    } else {
      setScanStatus('Scanning...');
      requestAnimationFrame(scanQRCode);
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
            sessionStorage.setItem('result', response.data.result === 'true' ? 'true' : 'false');
            fetchPublicIP(); // Trigger fetchPublicIP after image processing
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

  const zoomAndRetry = () => {
    console.log('Zooming in...');
    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (capabilities.zoom && zoomLevel < 3) {
      setZoomLevel(prevZoom => {
        const newZoom = prevZoom + 0.5;
        track.applyConstraints({
          advanced: [{ zoom: newZoom }], 
        });
        return newZoom;
      });
    }
  };

  const getDeviceDetails = () => {
    const md = new MobileDetect(window.navigator.userAgent);
    let deviceDetails = 'Unknown Device';

    if (md.mobile()) {
      const mobile = md.mobile();
      const os = md.os();
      const version = md.version();
      deviceDetails = `Mobile Device: ${mobile}, OS: ${os} Version: ${version ? version : 'Unknown'}`;
    } else if (md.tablet()) {
      const tablet = md.tablet();
      const os = md.os();
      const version = md.version();
      deviceDetails = `Tablet Device: ${tablet}, OS: ${os} Version: ${version ? version : 'Unknown'}`;
    } else if (md.phone()) {
      const phone = md.phone();
      const os = md.os();
      const version = md.version();
      deviceDetails = `Phone Device: ${phone}, OS: ${os} Version: ${version ? version : 'Unknown'}`;
    } else {
      deviceDetails = `Non-Mobile Device: ${md.userAgent()}`;
    }

    return deviceDetails;
  };

  useEffect(() => {
    const initScanner = async () => {
      try {
        const bestCamera = await getBestRearCamera();
        console.log('Using Camera:', bestCamera.label);  // Add this line to show the camera's label in console
        alert(`Using Camera: ${bestCamera.label}, Device Info: ${getDeviceDetails()}`);  // Add this line to alert the camera's label

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
        videoRef.current.onloadedmetadata = () => {
          setIsScanning(true);
          getLocation();
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
