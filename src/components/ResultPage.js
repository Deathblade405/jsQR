// src/components/ResultPage.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ResultPage.css';

const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { status } = location.state || { status: 'unknown' };

  const handleBackToScan = () => {
    navigate('/');
  };

  return (
    <div className="result-page">
      <h2>Authentication Result</h2>
      <div className={`result ${status}`}>
        {status === 'genuine' && <p>This is a genuine product!</p>}
        {status === 'counterfeit' && <p>This is a counterfeit product.</p>}
        {status === 'unknown' && <p>Unable to authenticate the product.</p>}
      </div>
      <button onClick={handleBackToScan} className="back-button">
        Scan Again
      </button>
    </div>
  );
};

export default ResultPage;
