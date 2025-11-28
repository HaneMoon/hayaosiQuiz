// src/pages/Game.jsx

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGame from '../hooks/useGame';
import QuestionDisplay from '../components/QuestionDisplay';
import AnswerInput from '../components/AnswerInput';
import GameStatus from '../components/GameStatus';
import ResultDisplay from '../components/ResultDisplay'; 

// コンポーネントは JSX を含むため、拡張子を .jsx とします

const Game = ({ myPlayerId, onGameEnd, propGameId }) => { 
  // ルーティングから gameId を取得
  const { gameId: routeGameId } = useParams();
  // 優先順位: 1. propで渡されたID (Appの状態) -> 2. ルートID -> 3. 開発用仮ID
  const actualGameId = propGameId || routeGameId || myPlayerId; 
  
  const navigate = useNavigate();

  // useGame フックでゲームの状態とロジックを取得
  const { 
    gameState, 
    opponentName, 
    buzz, 
    submitAnswer, 
    isHost, 
    deleteGameRoom, 
  } = useGame(actualGameId, myPlayerId);

  // --- ゲームの状態表示に必要な変数 ---
  const myPlayerName = gameState?.players?.[myPlayerId]?.name || 'あなた'; 
  const currentQuestionText = gameState?.currentQuestion?.text || "問題の出題を待っています...";
  const gameStatus = gameState?.status; // 'waiting', 'playing', 'finished'
  const players = gameState?.players || {};
  const winnerId = gameState?.winner;
  
  const answererId = gameState?.currentQuestion?.answererId; // 解答権を持つプレイヤー
  const buzzedPlayerId = gameState?.currentQuestion?.buzzedPlayerId; // 早押しボタンを押したプレイヤー
  const qStatus = gameState?.currentQuestion?.status; // 'reading', 'answering', 'judging', ...

  // プレイヤーが解答権を持っているか
  const isMyTurn = answererId === myPlayerId && qStatus === 'answering'; 
  // 誰かが早押しボタンを押した状態か
  const isBuzzing = !!buzzedPlayerId; 
  // 問題に解答があったか (ホストが判定待ちの状態など)
  const isAnswered = ['judging', 'answered_correct', 'answered_wrong'].includes(qStatus); 

  // --- プレイヤー情報の設定と取得 ---
  useEffect(() => {
    // もしゲームIDが確定していない状態でアクセスしたらホームへ戻す
    if (!actualGameId || (!gameState && !routeGameId && !propGameId)) {
      // DEBUG: リダイレクトが発生した場合のログ
      console.log(`[DEBUG] Game.jsx: ゲームIDまたは状態が見つかりません (${actualGameId})。ホームへリダイレクトします。`);
      navigate('/');
      return;
    }
    
    // 勝利が確定しても、ここでは削除せず、リザルト画面のボタン押下を待つ
    if (gameStatus === 'finished' && winnerId) {
      // 部屋の自動削除は行わない
    }
  }, [gameState, gameStatus, winnerId, routeGameId, propGameId, actualGameId, navigate, onGameEnd]); 


  // --- 操作ロジック ---

  // 早押し処理
  const onBuzz = () => {
    if (gameStatus === 'playing' && !isBuzzing) {
      buzz();
    }
  };

  // 解答送信処理 (useGameから取得した submitAnswer をそのまま使用)
  const onSubmitAnswer = submitAnswer;


  // --- レンダリング ---

  // 1. ゲーム終了時のリザルト画面
  if (gameStatus === 'finished' && winnerId) {
    const winner = players[winnerId];
    
    // ⭐ 修正: ホームへ戻る処理をラップし、ホストであれば削除処理を実行する
    const handleReturnHome = () => {
        if (isHost) {
            deleteGameRoom(); // ホストの場合、遷移直前に削除を実行
        }
        onGameEnd(); // App.jsx の状態をリセット (gameId=nullなど)
        navigate('/'); // Home.jsx へ遷移
    };

    return (
      <ResultDisplay 
        winnerName={winner?.name || '不明なプレイヤー'} 
        myPlayerName={myPlayerName} 
        onReturnHome={handleReturnHome} // コールバックを渡す
      />
    );
  }

  // 2. 対戦待ち画面
  if (gameStatus === 'waiting' || !gameState) {
    return (
      <div>
        <h2>⏱️ 対戦相手を待っています...</h2>
        <p>あなたの部屋ID: <strong>{actualGameId}</strong></p>
        <p>対戦相手: {opponentName ? <strong>{opponentName}</strong> : '待機中'}</p>
        {isHost && <p>あなたはホストです。相手が参加したらゲームを開始できます。</p>}
      </div>
    );
  }
  
  // 3. プレイ中のメイン画面
  return (
    <div>
      <h2>⚔️ クイズバトル中！ (ID: {actualGameId})</h2>
      <GameStatus 
        players={players} 
        myPlayerId={myPlayerId} 
        opponentName={opponentName}
        isHost={isHost}
      />
      <hr />
      
      {/* 問題表示 */}
      <QuestionDisplay 
        questionText={currentQuestionText} 
        isBuzzing={isBuzzing} 
        isAnswered={isAnswered}
      />

      {/* 状況メッセージ */}
      {buzzedPlayerId && buzzedPlayerId !== myPlayerId && qStatus === 'answering' && (
        <p style={{ color: 'orange' }}>
          {players[buzzedPlayerId]?.name || '誰か'} が早押ししました！解答権があります。
        </p>
      )}
      {qStatus === 'judging' && <p style={{ color: 'blue', fontWeight: 'bold' }}>ホストが解答を判定中です...</p>}
      {isMyTurn && <p style={{ color: 'green', fontWeight: 'bold' }}>解答権はあなたにあります！</p>}
      {qStatus === 'answered_correct' && <p style={{ color: 'green', fontWeight: 'bold' }}>正解！次の問題へ...</p>}
      {qStatus === 'answered_wrong' && <p style={{ color: 'red', fontWeight: 'bold' }}>誤答です...</p>}


      {/* 入力コンポーネント */}
      <AnswerInput 
        key={isMyTurn ? 'myturn' : 'notmyturn'} 
        onBuzz={onBuzz} 
        onSubmitAnswer={onSubmitAnswer}
        isMyTurn={isMyTurn}
        options={gameState?.currentQuestion?.options} 
        isAnswerSelectable={gameState?.currentQuestion?.isSelectable} 
      />
      
    </div>
  );
};

export default Game;