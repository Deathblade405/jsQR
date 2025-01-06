import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ResultPage.css';

const ResultPage = () => {
  const [productStatus, setProductStatus] = useState(null); // To hold the product status
  const [details, setDetails] = useState([]); // To hold product details
  const [result, setResult] = useState(null); // To hold the result (0: counterfeit, 1: genuine, 2: error/no data)
  const [display, setDisplay] = useState(false); // To control when to display the details
  const colNames = ['ID', 'Drug Name', 'Manufacturer', 'Brand Name', 'Batch No.']; // Example column names (adjust as needed)

  const navigate = useNavigate();

  useEffect(() => {
    // Retrieve result and location from session storage
    const storedResult = sessionStorage.getItem('result');
    setResult(storedResult === 'true' ? 1 : 0);
    if (storedResult === 'true') {
      setProductStatus('This is a Genuine Product!');
    } else {
      setProductStatus('This is a Counterfeit Product!');
    }

    // Fetch product details
    fetchDetails();
  }, []);

  const fetchDetails = () => {
    const id = sessionStorage.getItem('id');
    if (!id) {
      console.error('ID not found in session storage');
      setResult(2);
      setDisplay(true);
      return;
    }

    axios.get(`https://auth.scinovas.com:5004/qrTable/${id}`)
      .then((response) => {
        const data = response.data;
        if (data.length <= 0) {
          setResult(2); // No data available
          setDisplay(true);
          return;
        }

        data[0].pop(); // Remove the last item (if required based on data structure)
        const mappedDetails = data[0].map((item, index) => ({
          name: colNames[index],
          value: item,
        }));
        setDetails(mappedDetails);
        setDisplay(true);
      })
      .catch((error) => {
        console.error('Error fetching details:', error);
        setResult(2); // Error state
        setDisplay(true);
      });
  };

  return (
    <div className="result-container">

      {display && (
        <div className="details-container">
          {result === 2 ? (
            <p>No data available or an error occurred.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Detail Name</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {details.map((detail, index) => (
                  <tr key={index}>
                    <td>{detail.name}</td>
                    <td>{detail.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Status message below the table */}
      {productStatus && (
        <div className={`status-message ${result === 1 ? 'genuine' : result === 0 ? 'counterfeit' : ''}`}>
          <p>{productStatus}</p>
        </div>
      )}
    </div>
  );
};

export default ResultPage;
