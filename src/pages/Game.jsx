// src/pages/Game.jsx

import React, { useEffect, useCallback } from 'react'; // ⭐ useState を削除
import { useParams, useNavigate } from 'react-router-dom';
import useGame from '../hooks/useGame';
import QuestionDisplay from '../components/QuestionDisplay';
import AnswerInput from '../components/AnswerInput';
import GameStatus from '../components/GameStatus';
import ResultDisplay from '../components/ResultDisplay';

// コンポーネントは JSX を含むため、拡張子を .jsx とします

const Game = ({ myPlayerId, onGameEnd, propGameId }) => { // propGameId を受け取る
  // ルーティングから gameId を取得
  const { gameId: routeGameId } = useParams();
  // 優先順位: 1. propで渡されたID (Appの状態) -> 2. ルートID -> 3. 開発用仮ID
  const actualGameId = propGameId || routeGameId || myPlayerId; // myPlayerId は最終手段として残す
  
  const navigate = useNavigate();

  // useGame フックでゲームの状態とロジックを取得
  const { 
    gameState, 
    opponentName, 
    myPlayerName,
    handlePlayerBuzz, // 早押し処理
    // ⭐ processAnswer を削除
    isHost, 
  } = useGame(actualGameId, myPlayerId);

  // --- ゲームの状態表示に必要な変数 ---
  const currentQuestionText = gameState?.currentQuestion?.text || "問題の出題を待っています...";
  const gameStatus = gameState?.status; // 'waiting', 'playing', 'finished'
  const players = gameState?.players || {};
  const winnerId = gameState?.winner;
  const answererId = gameState?.currentQuestion?.answererId;
  const buzzedPlayerId = gameState?.currentQuestion?.buzzedPlayerId;

  // プレイヤーが解答権を持っているか
  const isMyTurn = answererId === myPlayerId; 
  // 誰かが早押しボタンを押した状態か
  const isBuzzing = !!buzzedPlayerId; 
  // 問題に解答があったか (ホストが判定待ちの状態など)
  const isAnswered = answererId !== null; 

  // --- プレイヤー情報の設定と取得 ---
  useEffect(() => {
    // もしゲームIDが確定していない状態でアクセスしたらホームへ戻す
    if (!actualGameId || (!gameState && !routeGameId && !propGameId)) {
      // DEBUG: リダイレクトが発生した場合のログ
      console.log(`[DEBUG] Game.jsx: ゲームIDまたは状態が見つかりません (${actualGameId})。ホームへリダイレクトします。`);
      navigate('/');
      return;
    }
    
    // 勝利が確定したら onGameEnd を呼び出す
    if (gameStatus === 'finished' && winnerId) {
      // 実際にはリザルト表示後、数秒待ってから終了処理を行う
      // onGameEnd(); 
    }
  }, [gameState, gameStatus, winnerId, routeGameId, propGameId, actualGameId, navigate, onGameEnd]);


  // --- 操作ロジック ---

  // 早押し処理
  const onBuzz = useCallback(() => {
    if (gameStatus === 'playing' && !isBuzzing) {
      // 誰かが押していない、かつゲーム中であれば、早押し情報を送信
      handlePlayerBuzz(actualGameId, myPlayerId);
    }
  }, [gameStatus, isBuzzing, actualGameId, myPlayerId, handlePlayerBuzz]);

  // 解答送信処理 (解答権を持ったプレイヤーが実行)
  const onSubmitAnswer = useCallback((answer) => {
    if (isMyTurn) {
      // 実際には、ホストであるかに関わらずこの関数が呼ばれるが、
      // 判定処理(processAnswer)はホスト側でのみDBリスナーを通じて実行されるのが理想
      // ここでは、解答権を持ったプレイヤーがFirebaseに解答を書き込むアクションを定義
      console.log(`解答を送信: ${answer}`);
      // DBに解答を書き込む関数 (例: recordAnswer(actualGameId, myPlayerId, answer))
      
      // ホストであれば即座に判定処理を走らせることもできるが、
      // リアルタイム性を重視し、DBへの書き込みをトリガーに useGame.js 内のホストリスナーで判定するのが一般的
    }
  }, [isMyTurn]);


  // --- レンダリング ---

  // 1. ゲーム終了時のリザルト画面
  if (gameStatus === 'finished' && winnerId) {
    const winner = players[winnerId];
    return (
      <ResultDisplay 
        winnerName={winner?.name || '不明なプレイヤー'} 
        myPlayerName={myPlayerName} 
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
      {buzzedPlayerId && buzzedPlayerId !== myPlayerId && (
        <p style={{ color: 'orange' }}>
          {players[buzzedPlayerId]?.name || '誰か'} が早押ししました！
        </p>
      )}
      {isMyTurn && <p style={{ color: 'green', fontWeight: 'bold' }}>解答権はあなたにあります！</p>}

      {/* 入力コンポーネント */}
      <AnswerInput 
        onBuzz={onBuzz}
        onSubmitAnswer={onSubmitAnswer}
        isMyTurn={isMyTurn}
        isAnswerSelectable={currentQuestionText.includes('（選択式）')} // 暫定ロジック
      />
      
    </div>
  );
};

export default Game;