import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ResultPage.css';

const ResultPage = () => {
  const [productStatus, setProductStatus] = useState(null);  // To hold the product status
  const navigate = useNavigate();

  useEffect(() => {
    // Check session storage for the result passed from QRScanner
    const result = sessionStorage.getItem('result');

    // If there's no result or it's not defined, redirect to QRScanner page
    if (!result) {
      navigate('/');
    } else {
      // Set the product status based on the result
      if (result.toLowerCase() === 'true') {
        setProductStatus('This product is genuine!');
      } else {
        setProductStatus('This product is counterfeit!');
      }
    }
  }, [navigate]);

  return (
    <div className="result-container">
      <h2>Product Authentication Result</h2>
      {productStatus ? (
        <div className={`status-message ${productStatus.toLowerCase().includes('genuine') ? 'genuine' : 'counterfeit'}`}>
          <h3>{productStatus}</h3>
        </div>
      ) : (
        <p>Loading result...</p>
      )}
    </div>
  );
};

export default ResultPage;
