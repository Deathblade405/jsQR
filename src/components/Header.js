import React from 'react';
import './Header.css'; // Add your CSS file for styling

const Header = () => {
  return (
    <header className="header">
      <img src="./assets/scinovas.png" alt="Logo" className="logo" /> {/* Replace with your logo */}
      <h1 className="title">Scinova Scientifics</h1>
      <p className="tagline">- Science as a Service</p> {/* Tagline below the title */}
    </header>
  );
};

export default Header;
