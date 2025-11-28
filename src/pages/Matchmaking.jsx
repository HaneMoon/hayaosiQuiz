// src/pages/Matchmaking.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGame from '../hooks/useGame';

// App.jsx から myPlayerId と settings を受け取るように変更
const Matchmaking = ({ myPlayerId, settings, onGameReady }) => {
  const [playerName, setPlayerName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();

  // useGameフックは、ゲームの状態管理とFirebaseとの接続を担う
  const { createHostGame, joinClientGame, gameId } = useGame(null, myPlayerId);

  // --- 部屋作成処理（ホスト） ---
  const handleCreateGame = async () => {
    if (!playerName) {
      setMessage('名前を入力してください。');
      return;
    }
    if (!settings) {
      setMessage('先に設定画面でルールを確定してください。');
      return;
    }

    setLoading(true);
    setMessage('部屋を作成中...');

    const ruleSettings = settings.rules;
    const hostPlayer = {
      id: myPlayerId,
      name: playerName,
      score: 0,
      isHost: true,
    };

    try {
      const newGameId = await createHostGame(ruleSettings, hostPlayer);
      
      // 成功時、Game画面へ遷移
      if (newGameId) {
        // ⭐ DEBUG: 部屋作成成功と遷移のログを追加
        console.log(`[DEBUG] 部屋作成成功: ${newGameId}。ゲーム画面へ遷移します。`);
        onGameReady(newGameId); // App.jsx にゲームIDを伝える
        navigate(`/game/${newGameId}`);
      } else {
        setMessage('部屋の作成に失敗しました。（ID取得失敗）');
      }
      
    } catch (error) {
      console.error(error);
      setMessage('部屋の作成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // --- 部屋参加処理（クライアント） ---
  const handleJoinGame = async () => {
    if (!playerName || joinId.length !== 4) {
      setMessage('名前と4桁の部屋IDを正しく入力してください。');
      return;
    }
    setLoading(true);
    setMessage(`部屋 ${joinId} に参加中...`);

    const clientPlayer = {
      id: myPlayerId,
      name: playerName,
      score: 0,
      isHost: false,
    };

    try {
      await joinClientGame(joinId, clientPlayer);
      
      // ⭐ DEBUG: 部屋参加成功と遷移のログを追加
      console.log(`[DEBUG] 部屋参加成功: ${joinId}。ゲーム画面へ遷移します。`);
      onGameReady(joinId); // App.jsx にゲームIDを伝える
      navigate(`/game/${joinId}`);
      
    } catch (error) {
      console.error(error);
      setMessage('部屋への参加に失敗しました。部屋IDを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>🚀 マッチメイキング</h2>
      <input
        type="text"
        placeholder="あなたの名前"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        disabled={loading}
      />
      <hr />
      
      <h3>ホストとして部屋を作成</h3>
      <button 
        onClick={handleCreateGame} 
        disabled={loading || !playerName || !settings} // settingsがないと作成不可
      >
        部屋を作成してホストになる ({settings ? '設定OK' : '設定必須'})
      </button>
      
      <hr />

      <h3>クライアントとして部屋に参加</h3>
      <input
        type="text"
        placeholder="参加する4桁の部屋ID"
        value={joinId}
        onChange={(e) => setJoinId(e.target.value.substring(0, 4))}
        maxLength={4}
        disabled={loading}
      />
      <button onClick={handleJoinGame} disabled={loading || !playerName || joinId.length !== 4}>
        部屋に参加
      </button>

      {message && <p style={{ marginTop: '20px', fontWeight: 'bold' }}>{message}</p>}
      {gameId && <p style={{ color: 'blue' }}>現在のゲームID: {gameId}</p>}
    </div>
  );
};

export default Matchmaking;