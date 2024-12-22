import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ResultPage.css';

const ResultPage = () => {
  const [productStatus, setProductStatus] = useState(null);  // To hold the product status

  const navigate = useNavigate();

  useEffect(() => {
    // Retrieve result and location from session storage
    const result = sessionStorage.getItem('result');


    if (result === 'true') {
      setProductStatus('This product is genuine!');
    } else {
      setProductStatus('This product is counterfeit!');
    }

    // Optional: Send data to backend if needed
    // axios.post('<BACKEND_API>', { result, latitude: lat, longitude: long })
    //   .then(response => console.log(response.data))
    //   .catch(error => console.error('Error sending data to backend:', error));
  }, []);

  return (
    <div className="result-container">
      <h2>Product Authentication Result</h2>
      <h3>{productStatus}</h3>
    </div>
  );
};

export default ResultPage;
