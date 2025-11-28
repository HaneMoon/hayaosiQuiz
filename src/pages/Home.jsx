// src/pages/Home.js の最低限の内容

import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div>
      <h2>ようこそ！早押しクイズバトルへ</h2>
      <p>ゲームを始めるには、設定に進んでください。</p>
      <Link to="/settings">
        <button>ゲーム開始</button>
      </Link>
    </div>
  );
};

export default Home;