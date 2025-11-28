// src/components/ResultDisplay.js

import React from 'react';

const ResultDisplay = ({ winnerName, myPlayerName }) => {
  const isWinner = winnerName === myPlayerName;
  
  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h2>🏆 ゲーム終了！リザルト 🏆</h2>
      {/* 勝敗はホストが決定し、DBから同期された winnerName に基づく */}
      {isWinner ? (
        <h1 style={{ color: 'green' }}>あなたの勝ちです！おめでとう！</h1>
      ) : (
        <h1 style={{ color: 'red' }}>残念！勝者は {winnerName} さんです。</h1>
      )}
      
      {/* 再び範囲選択画面へ [cite: 16] */}
      <button onClick={() => console.log('Go to Settings')}>
        もう一度遊ぶ（範囲選択へ）
      </button>
    </div>
  );
};

export default ResultDisplay;