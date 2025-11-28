// src/App.jsx

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx'; // 拡張子を明示
import Settings from './pages/Settings.jsx'; // 拡張子を明示
import Matchmaking from './pages/Matchmaking.jsx';
import Game from './pages/Game.jsx';
import QuestionAdmin from './pages/QuestionAdmin.jsx'; // ★ 問題管理ページのインポート
import './App.scss'; // ★ App.scss のインポートに変更

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
    <Router>
      <header>
        <h1>早押しクイズバトル F班</h1>
        {/* Bootstrapのボタンに変換されたナビゲーション */}
        <nav className="nav justify-content-center">
          <Link to="/" className="btn btn-primary m-1">起動</Link>
          <Link to="/settings" className="btn btn-success m-1">設定</Link>
          <Link to="/matchmaking" className="btn btn-warning m-1">マッチング</Link>
          <Link to="/admin" className="btn btn-danger m-1">問題管理</Link> {/* ★ 問題管理ページへのリンク */}
        </nav>
      </header>
      
      <main className="content container"> {/* Bootstrapのコンテナクラスを追加 */}
        <Routes>
          {/* 起動画面 */}
          <Route path="/" element={<Home />} />

          {/* 対戦ルール設定画面 */}
          <Route 
            path="/settings" 
            element={<Settings onRulesConfirmed={handleRulesConfirmed} />} 
          />
          
          {/* マッチング画面 */}
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
          
          {/* 問題管理ページ */}
          <Route 
            path="/admin" 
            element={<QuestionAdmin />} 
          />

          {/* 対戦画面（ルートパラメータあり） */}
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
    </Router>
  );
};

export default App;