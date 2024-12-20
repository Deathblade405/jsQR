import React from 'react';
import './Header.css'; // Add your CSS file for styling
import logo from '../assets/scinovas.png'; // Import the image from assets

const Header = () => {
  return (
    <header className="header">
      <img src={logo} alt="Logo" className="logo" /> {/* Use the imported image */}
      <h1 className="title">Scinova Scientifics</h1>
      <p className="tagline">- Science as a Service</p> {/* Tagline below the title */}
    </header>
  );
};

export default Header;
