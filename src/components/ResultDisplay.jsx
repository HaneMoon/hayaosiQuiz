// src/components/ResultDisplay.jsx

import React from 'react';

/**
 * ゲーム終了時のリザルト画面
 * @param {object} props
 * @param {string} props.winnerName - 勝者の名前
 * @param {string} props.myPlayerName - 自分の名前
 * @param {function} props.onReturnHome - ホームへ戻るためのコールバック
 */
const ResultDisplay = ({ winnerName, myPlayerName, onReturnHome }) => {
  const isWinner = winnerName === myPlayerName;
  
  return (
    <div style={{ textAlign: 'center', padding: '50px', border: '3px solid #f00', borderRadius: '10px' }}>
      <h2> ゲーム終了！</h2>
      
      {isWinner ? (
        <h1 style={{ color: 'gold', fontSize: '3em' }}> 勝利! </h1>
      ) : (
        <h1 style={{ color: 'red', fontSize: '3em' }}>残念... 敗北</h1>
      )}

      <p style={{ fontSize: '1.5em', marginTop: '20px' }}>
        勝者は {winnerName} でした。
      </p>

      <div style={{ marginTop: '40px' }}>
        {/* ボタンを押したらホームへ戻る */}
        <button 
          onClick={onReturnHome} 
          style={{ padding: '15px 30px', fontSize: '1.2em', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          トップ画面に戻る
        </button>
      </div>
    </div>
  );
};

export default ResultDisplay;