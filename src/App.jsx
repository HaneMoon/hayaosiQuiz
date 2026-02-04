// src/App.jsx

import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

// ページコンポーネントを動的インポートに置き換える (Code Splitting) 
const Home = lazy(() => import('./pages/Home.jsx')); 
const Settings = lazy(() => import('./pages/Settings.jsx')); 
const Matchmaking = lazy(() => import('./pages/Matchmaking.jsx'));
const Game = lazy(() => import('./pages/Game.jsx'));
const QuestionAdmin = lazy(() => import('./pages/QuestionAdmin.jsx'));
const QuestionReview = lazy(() => import('./pages/QuestionReview.jsx')); 
//  新しいコンポーネントをインポート
const PrivateMatchOptions = lazy(() => import('./pages/PrivateMatchOption.jsx')); 

import './App.scss';
// ... (DEFAULT_SETTINGS は変更なし)
const DEFAULT_SETTINGS = {
  rules: {
    winPoints: 5,
    wrongAnswerPenalty: 'lockout',
    nextQuestionDelay: 2,
    totalQuestions: 10,
  },
  range: {
    subjects: ['国語', '数学', '理科', '社会', '英語'],
    grades: [1, 2, 3],
  }
};


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
  };

  // Matchmaking.js で部屋が作成/参加されたときに呼び出される関数
  const handleGameReady = (id) => {
    setGameId(id);
  };
  
  // Game.js でゲームが終了したときに呼び出される関数
  const handleGameEnd = () => {
    setGameId(null);
    setSettings(null);
    console.log("ゲーム終了: ゲームIDをリセットしました。");
  };

  return (
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

//  useLocation を使用するためのラッパーコンポーネント
const AppContent = ({ settings, gameId, myPlayerId, handleRulesConfirmed, handleGameReady, handleGameEnd }) => {
  const location = useLocation();
  const isGameRoute = location.pathname.startsWith('/game');

  return (
    <>
      {!isGameRoute && (
        <header>
          <h1 className="text-center fs-1">Answer X</h1>
            <nav className="nav justify-content-center">
            <Link to="/" className="btn btn-primary m-1">ホーム</Link>
            <Link to="/settings" className="btn btn-success m-1">問題設定</Link>
            {/* <Link to="/admin" className="btn btn-danger m-1">問題追加</Link>  */}
            {/* <Link to="/review" className="btn btn-danger m-1">問題確認・削除</Link>  */}
          </nav>
        </header>
      )}
      
      <main className="content container"> 
        <Suspense fallback={<div>ロード中...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />

            {/*  新しい選択画面のルートを追加 */}
            <Route path="/private-options" element={<PrivateMatchOptions />} />

            <Route 
              path="/settings" 
              element={<Settings onRulesConfirmed={handleRulesConfirmed} />} 
            />
            
            <Route 
              path="/matchmaking" 
              element={
                <Matchmaking 
                  myPlayerId={myPlayerId} 
                  settings={settings || DEFAULT_SETTINGS} 
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
            
            {gameId && (
              <Route 
                path="/game" 
                element={
                  <Game 
                    myPlayerId={myPlayerId} 
                    propGameId={gameId} 
                    onGameEnd={handleGameEnd}
                  />
                } 
              />
            )}

          </Routes>
        </Suspense>
      </main>
    </>
  );
};

export default App;