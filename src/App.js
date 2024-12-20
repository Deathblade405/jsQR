// src/App.js
import React from 'react';
import './App.css';
import QRScanner from './components/QRScanner';
import Header from './components/Header';
import Footer from './components/Footer';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ResultPage from './components/ResultPage'; // Import the result page

function App() {
  return (
    <Router>
      <div className="App">
        {/* Render Header */}
        <Header />

        {/* Main content */}
        <div className="main-content">
          <Routes>
            <Route path="/" element={<QRScanner />} />
            <Route path="/result" element={<ResultPage />} />
          </Routes>
        </div>

        {/* Render Footer */}
        <Footer />
      </div>
    </Router>
  );
}

export default App;
