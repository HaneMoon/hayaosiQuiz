// src/pages/Matchmaking.jsx

// ⭐ 修正: useEffect のインポートを削除しました (未使用のため)
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
  // ⭐ Home.jsx から渡された state を取得
  const location = useLocation();
  const matchType = location.state?.type; // 'open' or 'private'

  // useGameフックは、ゲームの状態管理とFirebaseとの接続を担う
  // ⭐ 修正: gameId の分割代入を削除しました (未使用のため)
  const { createHostGame } = useGame(null, myPlayerId);

  // --- 部屋作成処理（ホスト） ---
  // ⭐ createHostGame に isOpenMatch パラメータを追加
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
      // ⭐ db.js の addClientToGame を直接呼び出す
      await addClientToGame(joinId, clientPlayer);
      
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
  
  // --- オープンマッチング処理（参加または作成） ---
  const handleFindOrCreateOpenGame = async () => {
    if (!playerName) {
        setMessage('名前を入力してください。');
        return;
    }
    
    // settings は App.jsx でデフォルト設定が入っているため、ここでは settings を使用
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
      // ⭐ db.js で実装したロジックを呼び出す
      const gameId = await findOrCreateOpenGame(ruleSettings, clientPlayer);
      
      // 成功時、Game画面へ遷移
      if (gameId) {
        console.log(`[DEBUG] オープンマッチ成功: ${gameId}。ゲーム画面へ遷移します。`);
        onGameReady(gameId);
        navigate(`/game/${gameId}`);
      } else {
          setMessage('マッチング処理で予期せぬエラーが発生しました。');
      }
      
    } catch (error) {
        console.error("オープンマッチング失敗:", error);
        setMessage('オープンマッチングに失敗しました。');
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
        style={{ padding: '10px', fontSize: '1.2em', marginBottom: '20px', width: '90%' }}
      />
      <p style={{ color: 'red' }}>{message}</p>
      <hr />
      
      {/* ⭐ オープンマッチングのUI */}
      {matchType === 'open' && (
        <div style={{ padding: '15px', border: '1px solid #007bff', borderRadius: '8px', marginBottom: '30px' }}>
            <h3>🌎 オープンマッチング</h3>
            <p>名前を入力し、ボタンを押すと自動で対戦相手を検索/部屋を作成します。</p>
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
                {loading ? 'マッチング中...' : 'オープンマッチング開始'}
            </button>
        </div>
      )}

      {/* ⭐ プライベートマッチングのUI (既存のロジック) */}
      {(!matchType || matchType === 'private') && (
        <div style={{ padding: '15px', border: '1px solid #6c757d', borderRadius: '8px' }}>
            <h3>🔒 プライベートマッチング</h3>
            <p style={{ marginBottom: '20px' }}>
                <Link to="/settings">設定内容</Link>: {settings ? 'OK' : '未設定'}
            </p>
            
            <h4 style={{ marginTop: '0' }}>ホストとして部屋を作成</h4>
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
              部屋を作成してホストになる ({settings ? '設定OK' : '設定必須'})
            </button>
            
            <hr style={{ margin: '30px 0' }} />

            <h4>クライアントとして部屋に参加</h4>
            <input
              type="text"
              placeholder="参加する4桁の部屋ID"
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
          onClick={() => navigate('/')} 
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