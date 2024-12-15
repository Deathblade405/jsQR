// src/App.js
import React from 'react';
import './App.css';
import QRScanner from './components/QRScanner';  // Correct import path
import Header from './components/Header'; // Import Header component
import Footer from './components/Footer'; // Import Footer component

function App() {
  return (
    <div className="App">
      {/* Render Header */}
      <Header />
      
      {/* Main content */}
      <div className="main-content">
        <QRScanner />
      </div>

      {/* Render Footer */}
      <Footer />
    </div>
  );
}

export default App;
