// src/App.js
import React from 'react';
import './App.css';
import QRScanner from './components/QRScanner';  // Correct import path

function App() {
  return (
    <div className="App">
      <h1>QR Code Scanner App</h1>
      <QRScanner />
    </div>
  );
}

export default App;
