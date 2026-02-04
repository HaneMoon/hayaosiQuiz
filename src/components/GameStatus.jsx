// src/components/GameStatus.jsx

import React from 'react';

/**
 * 現在のプレイヤーのスコアと状態を表示するコンポーネント
 * @param {object} props
 * @param {object} props.players - 全プレイヤー情報オブジェクト { [playerId]: { name, score, isHost, ... } }
 * @param {string} props.myPlayerId - 自分のプレイヤーID
 * @param {string} props.opponentName - 対戦相手の名前
 * @param {boolean} props.isHost - 自分がホストかどうか
 */
const GameStatus = ({ players, myPlayerId, opponentName, isHost }) => {
  // プレイヤー情報を配列に変換
  const playerList = Object.values(players);
  
  // 自分と相手の情報を特定
  const myPlayer = playerList.find(p => p.id === myPlayerId);
  const opponent = playerList.find(p => p.id !== myPlayerId);

  return (
    <div style={{ 
      border: '2px solid #333', 
      borderRadius: '8px', 
      padding: '15px', 
      backgroundColor: '#fff',
      display: 'flex',
      justifyContent: 'space-around',
      gap: '20px'
    }}>
      
      {/* 自分のステータス */}
      <div style={{ flex: 1, borderRight: opponent ? '1px solid #ddd' : 'none', paddingRight: '10px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: isHost ? '#007bff' : '#333' }}>
           あなた 
        </h3>
        <p style={{ margin: 0, fontSize: '1.8em', fontWeight: 'bold', color: myPlayer?.score >= 8 ? 'green' : '#333' }}>
        {myPlayer?.score || 0} 点
        </p>
      </div>

      {/* 対戦相手のステータス */}
      {opponent && (
        <div style={{ flex: 1, paddingLeft: '10px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: opponent.isHost ? '#007bff' : '#333' }}>
           {opponentName || '不明'} {/*  opponentName プロパティを使用 */}
          </h3>
          <p style={{ margin: 0, fontSize: '1.8em', fontWeight: 'bold', color: opponent.score >= 8 ? 'green' : '#333' }}>
          {opponent.score || 0} 点
          </p>
        </div>
      )}
      
      {!opponent && (
        <div style={{ flex: 1, paddingLeft: '10px', color: '#888' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>🆚 対戦相手</h3>
          <p style={{ margin: 0, fontSize: '1.2em' }}>
            参加を待っています...
          </p>
        </div>
      )}

    </div>
  );
};

export default GameStatus;