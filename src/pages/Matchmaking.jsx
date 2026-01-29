// src/pages/Matchmaking.jsx

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom'; 
import useGame from '../hooks/useGame';
import { findOrCreateOpenGame, addClientToGame } from '../firebase/db'; 

// App.jsx から myPlayerId と settings を受け取るように変更
const Matchmaking = ({ myPlayerId, settings, onGameReady }) => {
  const [playerName, setPlayerName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();
  // ⭐ Home.jsx / Settings.jsx から渡された state を取得
  const location = useLocation();
  const matchType = location.state?.type; // 'open' or 'private'
  const role = location.state?.role;     // 'host' or 'client' (private match時)

  // useGameフックは、ゲームの状態管理とFirebaseとの接続を担う
  const { createHostGame } = useGame(null, myPlayerId);

  // --- 部屋作成処理（ホスト） ---
  const handleCreateGame = async (isOpenMatch = false) => { 
    if (!playerName) {
      setMessage('名前を入力してください。');
      return;
    }
    // プライベートマッチング（isOpenMatch=false）の場合は設定が必須
    if (!isOpenMatch && !settings) {
      setMessage('先に設定画面でルールを確定してください。');
      return;
    }

    setLoading(true);
    setMessage(isOpenMatch ? 'オープンマッチング中...' : '部屋を作成中...');

    const ruleSettings = settings.rules;
    const hostPlayer = {
      id: myPlayerId,
      name: playerName,
      score: 0,
      isHost: true,
    };

    try {
      // ⭐ createHostGame の引数を更新
      const newGameId = await createHostGame(ruleSettings, hostPlayer, isOpenMatch); 
      
      // 成功時、Game画面へ遷移
      if (newGameId) {
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
      //  db.js の addClientToGame を直接呼び出す
      await addClientToGame(joinId, clientPlayer);
      
      // console.log(`[DEBUG] 部屋参加成功: ${joinId}。ゲーム画面へ遷移します。`);
      onGameReady(joinId); // App.jsx にゲームIDを伝える
      navigate(`/game/${joinId}`);
      
    } catch (error) {
      console.error(error);
      setMessage('部屋への参加に失敗しました。部屋IDを確認してください。');
    } finally {
      setLoading(false);
    }
  };
  
  // --- オープンマッチング処理（参加または作成） ---
  const handleFindOrCreateOpenGame = async () => {
    if (!playerName) {
        setMessage('名前を入力してください。');
        return;
    }
    
    const ruleSettings = settings.rules;

    setLoading(true);
    setMessage('対戦相手を検索中...');
    
    const clientPlayer = {
      id: myPlayerId,
      name: playerName,
      score: 0,
      isHost: false, // 最初の状態はホストではない（作成時のみホストに昇格）
    };

    try {
      const gameId = await findOrCreateOpenGame(ruleSettings, clientPlayer);
      
      // 成功時、Game画面へ遷移
      if (gameId) {
        console.log(`[DEBUG] マッチング成功: ${gameId}。ゲーム画面へ遷移します。`);
        onGameReady(gameId);
        navigate(`/game/${gameId}`);
      } else {
          setMessage('マッチング処理で予期せぬエラーが発生しました。');
      }
      
    } catch (error) {
        console.error("マッチング失敗:", error);
        setMessage('マッチングに失敗しました。');
    } finally {
        setLoading(false);
    }
  };
  
  // プレイヤー名入力 UI
  const playerNameInput = (
    <input
      type="text"
      placeholder="あなたの名前"
      value={playerName}
      onChange={(e) => setPlayerName(e.target.value)}
      disabled={loading}
      style={{ padding: '10px', fontSize: '1.2em', marginBottom: '20px', width: '90%' }}
    />
  );


  return (
    <div>
      <h2>マッチメイキング</h2>
      {playerNameInput} {/* 名前入力は常に表示 */}
      <p style={{ color: 'red' }}>{message}</p>
      <hr />
      
      {/* 1. オープンマッチングの UI */}
      {matchType === 'open' && (
        <div style={{ padding: '15px', border: '1px solid #007bff', borderRadius: '8px', marginBottom: '30px' }}>
            <h3>🌎 オープンマッチング</h3>
            <p>名前を入力し、ボタンを押すと自動で対戦相手を検索します。</p>
             <button 
                onClick={handleFindOrCreateOpenGame} 
                disabled={loading || !playerName} 
                style={{ 
                    padding: '15px 30px', 
                    fontSize: '1.2em', 
                    cursor: 'pointer', 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px',
                    width: '100%',
                    marginTop: '10px'
                }}
            >
                {loading ? 'マッチング中...' : 'マッチング開始'}
            </button>
        </div>
      )}

      {/* 2. 部屋を建てる方 */}
      {matchType === 'private' && role === 'host' && (
        <div style={{ padding: '15px', border: '1px solid #28a745', borderRadius: '8px' }}>
            <h3>ホストとして部屋を作る</h3>
            <p style={{ marginBottom: '20px' }}>
                設定内容: {settings ? 'OK' : '未設定'}
            </p>
            
            <button 
              onClick={() => handleCreateGame(false)} // isOpenMatch=false (プライベート)
              disabled={loading || !playerName || !settings} 
              style={{ 
                  padding: '10px 20px', 
                  fontSize: '1.0em', 
                  cursor: 'pointer', 
                  backgroundColor: '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '5px',
                  width: '100%'
              }}
            >
              部屋を作成する
            </button>
            
            <p style={{ marginTop: '10px' }}>
                <Link to="/settings" style={{ color: '#007bff', textDecoration: 'none' }}>
                    設定を修正する
                </Link>
            </p>
        </div>
      )}

      {/* 3. 部屋に参加する方 */}
      {matchType === 'private' && role === 'client' && (
        <div style={{ padding: '15px', border: '1px solid #ffc107', borderRadius: '8px' }}>
            <h3> 部屋に参加する</h3>
            <h4>参加する部屋IDを入力</h4>
            <input
              type="text"
              placeholder="4桁の部屋ID"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.substring(0, 4))}
              maxLength={4}
              disabled={loading}
              style={{ padding: '10px', fontSize: '1.2em', width: 'calc(100% - 70px)', marginRight: '10px' }}
            />
            <button 
              onClick={handleJoinGame}
              disabled={loading || !playerName || joinId.length !== 4}
              style={{ padding: '10px 15px', fontSize: '1.0em', cursor: 'pointer', backgroundColor: '#ffc107', color: '#333', border: 'none', borderRadius: '5px' }}
            >
              参加
            </button>
        </div>
      )}
      
      {/* 初期画面に戻るボタン */}
      <div style={{ marginTop: '30px' }}>
        <button 
          onClick={() => navigate(matchType === 'private' ? '/private-options' : '/')} // ⭐ プライベートマッチなら選択画面に戻る
          disabled={loading}
          style={{ padding: '10px 20px', fontSize: '1em', cursor: 'pointer', backgroundColor: '#ddd', border: 'none', borderRadius: '5px' }}
        >
          &lt; 戻る
        </button>
      </div>

    </div>
  );
};

export default Matchmaking;