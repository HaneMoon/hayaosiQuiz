// src/pages/Home.jsx

import React from 'react';
// ⭐ Link ではなく useNavigate を使用
import { Link, useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const containerStyle = {
    textAlign: 'center',
    padding: '40px',
    maxWidth: '500px',
    margin: '0 auto',
    border: '1px solid #ddd',
    borderRadius: '10px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  };

  const buttonStyle = {
    padding: '15px 30px',
    fontSize: '1.2em',
    margin: '10px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '300px',
    transition: 'background-color 0.3s',
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#007bff',
    color: 'white',
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#6c757d',
    color: 'white',
  };
  
  // オープンマッチング開始時の処理
  const handleOpenMatching = () => {
    // Matchmaking画面へ遷移し、type: 'open' を渡す
    navigate('/matchmaking', { state: { type: 'open' } });
  };

  // プライベートマッチング開始時の処理
  const handlePrivateMatching = () => {
    // 設定画面へ遷移し、設定後にマッチング画面へ進む
    navigate('/settings', { state: { type: 'private' } });
  };

  return (
    <div style={containerStyle}>
      <p style={{ marginBottom: '30px', color: '#555' }}>対戦形式を選択してください。</p>
      {/* 1. オープンマッチング */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>🌎 オープンマッチ</h3>
        <p style={{ color: '#555' }}>デフォルトの出題設定で、ランダムな対戦相手と即座にマッチングします。</p>
        <button 
          onClick={handleOpenMatching} 
          style={primaryButtonStyle}
        >
          オープンマッチで対戦
        </button>
      </div>

      {/* 2. プライベートマッチング */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>🔒 プライベートマッチ</h3>
        <p style={{ color: '#555' }}>ルールを自由に設定し、<br />部屋IDを共有して友人と対戦します。</p>
        <button 
          onClick={handlePrivateMatching} 
          style={secondaryButtonStyle}
        >
          プライベートマッチ（設定へ）
        </button>
      </div>
    </div>
  );
};

export default Home;