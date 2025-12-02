// src/App.jsx

import React, { useState } from 'react';
// ⭐ 修正: useLocation をインポート
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx'; 
import Settings from './pages/Settings.jsx'; 
import Matchmaking from './pages/Matchmaking.jsx';
import Game from './pages/Game.jsx';
import QuestionAdmin from './pages/QuestionAdmin.jsx';
import QuestionReview from './pages/QuestionReview.jsx'; 
import './App.scss';

// --- アプリケーションのメインコンポーネント ---
const App = () => {
  // グローバルな状態管理の例：ゲームID、プレイヤーID、ルール設定など
  const [settings, setSettings] = useState(null);
  const [gameId, setGameId] = useState(null);

  // プレイヤーIDはアプリ起動時に一度だけ生成
  const myPlayerId = useState(() => Math.random().toString(36).substring(2, 9))[0]; 

  // ホストが設定を確定したときに呼び出される関数 (Settings.jsから)
  const handleRulesConfirmed = (newSettings) => {
    setSettings(newSettings);
    console.log("ルール設定が保存されました:", newSettings);
    // 設定完了後、Matchmaking画面へ自動遷移させるためのロジックをSettingsコンポーネント側で実装します。
  };

  // Matchmaking.js で部屋が作成/参加されたときに呼び出される関数
  const handleGameReady = (id) => {
    setGameId(id);
  };
  
  // Game.js でゲームが終了したときに呼び出される関数
  const handleGameEnd = () => {
    setGameId(null);
    setSettings(null);
    // 起動画面や設定画面へ戻る処理
  };

  return (
    // ⭐ Routerの外側では useLocation を使えないため、AppContent コンポーネントにロジックを分離します。
    <Router>
      <AppContent 
        settings={settings}
        gameId={gameId}
        myPlayerId={myPlayerId}
        handleRulesConfirmed={handleRulesConfirmed}
        handleGameReady={handleGameReady}
        handleGameEnd={handleGameEnd}
      />
    </Router>
  );
};

// ⭐ useLocation を使用するためのラッパーコンポーネント
const AppContent = ({ settings, gameId, myPlayerId, handleRulesConfirmed, handleGameReady, handleGameEnd }) => {
  const location = useLocation();
  // 現在のパスが /game または /game/xxx で始まっているかチェック
  const isGameRoute = location.pathname.startsWith('/game');

  return (
    <>
      {/* ⭐ isGameRoute が false の場合のみヘッダーを表示 */}
      {!isGameRoute && (
        <header>
          <h1>早押しクイズバトル F班</h1>
            <nav className="nav justify-content-center">
            <Link to="/" className="btn btn-primary m-1">起動</Link>
            <Link to="/settings" className="btn btn-success m-1">設定</Link>
            <Link to="/matchmaking" className="btn btn-warning m-1">マッチング</Link>
            <Link to="/admin" className="btn btn-danger m-1">問題追加</Link> 
            <Link to="/review" className="btn btn-danger m-1">問題確認・削除</Link> 
          </nav>
        </header>
      )}
      
      <main className="content container"> 
        <Routes>
          <Route path="/" element={<Home />} />

          <Route 
            path="/settings" 
            element={<Settings onRulesConfirmed={handleRulesConfirmed} />} 
          />
          
          <Route 
            path="/matchmaking" 
            element={
              <Matchmaking 
                myPlayerId={myPlayerId} // myPlayerId を渡す
                settings={settings} // 設定を渡す
                onGameReady={handleGameReady}
              />
            } 
          />

          <Route 
            path="/admin" 
            element={<QuestionAdmin />} 
          />

          <Route 
            path="/review" 
            element={<QuestionReview />} 
          />
          
          <Route 
            path="/game/:gameId" 
            element={
              <Game 
                myPlayerId={myPlayerId} 
                onGameEnd={handleGameEnd}
              />
            } 
          />
          
          {/* ルートパラメータがない場合でも、現在接続中のゲームIDを使ってGame画面へ遷移できるようにする */}
          {gameId && (
            <Route 
              path="/game" 
              element={
                <Game 
                  myPlayerId={myPlayerId} 
                  propGameId={gameId} // 状態からIDを渡す (propGameIdとして)
                  onGameEnd={handleGameEnd}
                />
              } 
            />
          )}

        </Routes>
      </main>
    </>
  );
};

export default App;