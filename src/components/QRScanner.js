import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './styles.css';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('Scan the QR code for Product Authentication');
  const [retryCount, setRetryCount] = useState(0);
  const [qrDetected, setQrDetected] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [noLocation, setNoLocation] = useState(false);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  const navigate = useNavigate();

  const getBestRearCamera = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const rearCameras = videoDevices.filter(device =>
      device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
    );
    return rearCameras.length ? rearCameras[0] : videoDevices[0];
  };

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

  const captureImage = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = dataURLtoBlob(canvas.toDataURL('image/png'));

    const formData = new FormData();
    formData.append('image', blob, 'image.jpg');

    try {
      const response = await axios.post('https://scinovas.in:5009/b', formData);
      if (response.data.result !== 'blur') {
        setMessage(`Product is ${response.data.result === 'genuine' ? 'Genuine' : 'Counterfeit'}`);
        sessionStorage.setItem('result', response.data.result);
        navigate('/result', { state: { status: response.data.result } });
      } else {
        setRetryCount(retryCount + 1);
        if (retryCount < 3) {
          setMessage('Image is blurry, retrying...');
          retryTimeoutRef.current = setTimeout(captureImage, 1000);
        } else {
          setMessage('Failed to process the image after multiple retries.');
        }
      }
    } catch (error) {
      console.error('Error sending image:', error);
      setMessage('Error processing image, please try again.');
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
      setQrDetected(true);
      setQrData(code);
      captureImage();
    }
  };

  const handleZoomChange = (e) => {
    const newZoomLevel = Number(e.target.value);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const constraints = { advanced: [{ zoom: newZoomLevel }] };
      track.applyConstraints(constraints).catch(err => console.error('Zoom error:', err));
      setZoomLevel(newZoomLevel);
    }
  };

  const startTimerWithMessages = () => {
    let i = 0;
    const textElement = document.getElementById('text');
    timerRef.current = setInterval(() => {
      if (qrDetected) {
        clearInterval(timerRef.current); // Stop the timer on QR detection
      } else {
        i++;
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
        startTimerWithMessages(); // Start the timer with messages
      } catch (err) {
        console.error('Error accessing camera:', err);
        setMessage('Camera initialization failed. Please check camera permissions.');
      }
    };

    initScanner();

    return () => {
      const tracks = streamRef.current?.getTracks();
      tracks?.forEach(track => track.stop());
      clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isScanning) {
      const scanInterval = setInterval(scanQRCode, 1000);
      return () => clearInterval(scanInterval);
    }
  }, [isScanning]);

  return (
    <div>
      <p id="text" className="text">{message}</p>
      <div className="scanner-container">
        <video ref={videoRef} width="100%" height="auto" autoPlay></video>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      <div className="zoom-control">
        <label htmlFor="zoom">Zoom: </label>
        <input
          id="zoom"
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={zoomLevel}
          onChange={handleZoomChange}
        />
      </div>
    </div>
  );
};

export default QRScanner;
