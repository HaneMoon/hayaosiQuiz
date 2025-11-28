// src/hooks/useGame.js

import { useState, useEffect, useCallback } from 'react'; // useCallbackをインポート
import { onValue, ref, get, update } from 'firebase/database';
import { db, createNewGameWithRandom4DigitId, addClientToGame } from '../firebase/db'; 
// db.jsから必要なFirebase関数をインポート
import { QUIZ_QUESTIONS } from '../utils/constants'; // 問題データをインポート


// 問題をシャッフルするシンプルな関数
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

/**
 * ゲームの状態管理とFirebaseとの通信を担うメインフック
 * @param {string | null} initialGameId - 現在接続しているゲームID (マッチング後は設定される)
 * @param {string} myPlayerId - 自分のプレイヤーID
 */
const useGame = (initialGameId, myPlayerId) => {
  const [gameId, setGameId] = useState(initialGameId);
  const [gameState, setGameState] = useState(null);
  const [opponentName, setOpponentName] = useState('');
  
  // 自分がホストかどうかを判定
  const isHost = gameState?.players?.[myPlayerId]?.isHost === true; 

  // --- ユーティリティ関数 ---
  // 次の問題を設定する関数 (ホスト専用)
  const setNextQuestion = async (id, currentQuestionIndex) => {
    const questions = shuffleArray([...QUIZ_QUESTIONS]); // 問題リストをシャッフルして取得
    const nextQuestionIndex = currentQuestionIndex + 1;

    if (nextQuestionIndex < questions.length) {
      const nextQuestion = questions[nextQuestionIndex];
      const gameRef = ref(db, `games/${id}`);
      
      await update(gameRef, {
        currentQuestionIndex: nextQuestionIndex, // 問題インデックスを更新
        currentQuestion: {
          id: nextQuestion.id,
          text: nextQuestion.text,
          answer: nextQuestion.answer,
          isSelectable: nextQuestion.isSelectable,
          options: nextQuestion.options || null, // 選択肢があれば設定
          buzzedPlayerId: null, // 早押し状態をリセット
          answererId: null, // 解答権をリセット
          status: 'reading', // 状態を「読み上げ中」に設定
        }
      });
      console.log(`[Game] 次の問題 #${nextQuestion.id} を設定しました。`);
    } else {
        // 全問終了の場合
        console.log("[Game] 全ての問題が終了しました。リザルト画面に移行します。");
        // TODO: スコアをチェックし、勝者を決定してステータスを 'result' に更新するロジック
        const players = gameState.players;
        const playerScores = Object.values(players).map(p => ({ id: p.id, score: p.score }));
        const winner = playerScores.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        
        await update(ref(db, `games/${id}`), {
            status: 'result',
            winnerId: winner.id,
        });
    }
  };


  // --- ゲーム開始処理 (ホスト専用) ---
  const startGame = useCallback(async (id) => {
    // ホストでないか、IDがないか、waiting中でない場合は実行しない
    if (!gameState?.players?.[myPlayerId]?.isHost || !id || gameState.status !== 'waiting') return; 

    const gameRef = ref(db, `games/${id}`);
    
    // 初期のゲーム状態を設定
    const initialQuestions = shuffleArray([...QUIZ_QUESTIONS]); // 問題リストをシャッフル
    const initialQuestion = initialQuestions[0]; // 最初の問題を取得

    // 全プレイヤーのスコアを初期化 (初回のみ)
    const initialPlayersUpdate = Object.keys(gameState.players).reduce((acc, playerId) => {
        acc[`players/${playerId}/score`] = 0;
        return acc;
    }, {});


    // ステータスを 'playing' に変更し、最初の問題を設定する
    await update(gameRef, {
        ...initialPlayersUpdate, // スコア初期化
        status: 'playing',
        currentQuestionIndex: 0, // 問題インデックスを0から開始
        currentQuestion: {
            id: initialQuestion.id,
            text: initialQuestion.text,
            answer: initialQuestion.answer,
            isSelectable: initialQuestion.isSelectable,
            options: initialQuestion.options || null,
            buzzedPlayerId: null, // 早押し状態をリセット
            answererId: null, // 解答権をリセット
            status: 'reading', // 状態を「読み上げ中」に設定
        },
        // TODO: 問題が読み終わった後の状態(waiting_answer)への移行タイマー設定
    });
    console.log(`[Game] ゲームID ${id} のステータスを 'playing' に更新し、最初の問題を設定しました。`);
  }, [gameState, myPlayerId]); // 依存配列に gameState, myPlayerId を含める


  // --- 早押し処理 ---
  const buzz = useCallback(async () => {
    if (!gameId || gameState?.status !== 'playing') return;
    
    const currentQ = gameState.currentQuestion;

    // 既に誰かが押している、または解答権がある場合は無視
    if (currentQ.buzzedPlayerId || currentQ.answererId) return;

    // Firebaseのトランザクションで、早押しプレイヤーを記録
    const gameRef = ref(db, `games/${gameId}`);
    await update(gameRef, {
        'currentQuestion/buzzedPlayerId': myPlayerId, // 押したプレイヤーID
        'currentQuestion/answererId': myPlayerId, // そのまま解答権を与える
        'currentQuestion/status': 'answering', // 状態を「解答中」に
    });
    console.log(`[Buzz] プレイヤー ${myPlayerId} が早押ししました。`);

  }, [gameId, gameState, myPlayerId]); // 依存配列に gameId, gameState, myPlayerId を含める


  // --- 解答処理 (仮) ---
  const submitAnswer = useCallback(async (answerText) => {
    if (!gameId || gameState?.status !== 'playing' || gameState.currentQuestion?.answererId !== myPlayerId) return;

    const currentQ = gameState.currentQuestion;
    const isCorrect = answerText === currentQ.answer; // 厳密に比較

    const gameRef = ref(db, `games/${gameId}`);
    
    if (isCorrect) {
        // 正解の場合
        const newScore = (gameState.players[myPlayerId]?.score || 0) + 1;
        
        await update(gameRef, {
            [`players/${myPlayerId}/score`]: newScore, // スコア加算
            'currentQuestion/status': 'answered_correct', // 正解としてマーク
            // TODO: 次の問題への移行タイマーを設定
        });
        console.log(`[Answer] 正解！スコアが ${newScore} になりました。`);

        // 次の問題へ移行
        setTimeout(() => {
            if (isHost) {
                setNextQuestion(gameId, gameState.currentQuestionIndex);
            }
        }, gameState.rules.nextQuestionDelay * 1000);

    } else {
        // 誤答の場合 (ペナルティ処理は複雑なので、一旦「次の問題に進む」をスキップする形で代替)
        
        // 誤答ペナルティのロジック
        let newScore = gameState.players[myPlayerId]?.score || 0;
        const penaltyType = gameState.rules.wrongAnswerPenalty;

        if (penaltyType === 'minus_one') {
            newScore = Math.max(0, newScore - 1); // 1点減点 (最低0点)
            console.log(`[Answer] 誤答 (マイナス1点)。スコアが ${newScore} になりました。`);
            await update(gameRef, {
                [`players/${myPlayerId}/score`]: newScore, // スコア減点
                'currentQuestion/status': 'answered_wrong', // 誤答としてマーク
                'currentQuestion/answererId': null, // 解答権を剥奪
                // buzzedPlayerIdはそのままにして、解答権を相手に移す...などのロジックが必要だが、一旦シンプルに
            });

        } else if (penaltyType === 'lockout') {
            // ロックアウト (解答権喪失)
            console.log("[Answer] 誤答 (ロックアウト)。この問題の解答権を失いました。");
            await update(gameRef, {
                'currentQuestion/status': 'answered_wrong',
                'currentQuestion/answererId': null, // 解答権を剥奪
                // 他のプレイヤーに解答権が移るロジックは、今後の課題
            });
        }
        
    }

  }, [gameId, gameState, myPlayerId, isHost, setNextQuestion]); // 依存配列に gameId, gameState, myPlayerId, isHost を含める


  // --- マッチング処理（db.jsの関数をラップ） (変更なし) ---
  
  // ホスト：部屋作成
  const createHostGame = async (ruleSettings, hostPlayer) => {
    // db.jsで定義したID衝突チェックを含む部屋作成関数を呼び出す
    const newGameId = await createNewGameWithRandom4DigitId(ruleSettings, hostPlayer);
    setGameId(newGameId);
    return newGameId;
  };

  // クライアント：部屋参加
  const joinClientGame = async (targetGameId, clientPlayer) => {
    const gameRef = ref(db, `games/${targetGameId}`);
    
    // 参加前に部屋が存在するか、ゲームが開始されていないかを確認
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) {
      throw new Error('指定された部屋IDのゲームは存在しません。');
    }
    
    const currentStatus = snapshot.val().status;
    if (currentStatus !== 'waiting') {
      throw new Error('このゲームは既に開始されています。');
    }


    // db.jsで定義したクライアント情報追加関数を呼び出す
    await addClientToGame(targetGameId, clientPlayer);
    setGameId(targetGameId);
    // 参加成功
  };

  // --- リアルタイムデータ同期 ---
  useEffect(() => {
    if (!gameId) return;

    const gameRef = ref(db, `games/${gameId}`);
    
    // リアルタイムリスナーを設定 (onValue)
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
        
        // --- 相手の名前を特定し、保存するロジック ---
        if (data.players) {
          const playersArray = Object.values(data.players);
          
          // 自分ではないプレイヤーを探す
          const opponent = playersArray.find(
            (player) => player.id !== myPlayerId 
          );

          if (opponent) {
            setOpponentName(opponent.name);
          }

          // ホストの場合、プレイヤーが2人揃ったらゲーム開始ステータスに移行
          // プレイヤー数が2人、ステータスが waiting、かつ自分がホストであれば開始
          if (data.status === 'waiting' && playersArray.length === 2 && data.players[myPlayerId]?.isHost) {
              console.log("[Host] プレイヤーが揃いました。ゲーム開始関数を呼び出します。");
              // useCallback化した startGame を呼び出す
              startGame(gameId); 
          }
        }
      } else {
        // ゲームセッションが削除された場合 (エラー処理)
        setGameState(null);
        setOpponentName('');
      }
    });

    // クリーンアップ：コンポーネントがアンマウントされたら購読を停止する
    return () => unsubscribe();
  }, [gameId, myPlayerId, startGame]); // 依存配列に startGame を追加


  return { 
    gameState, 
    opponentName, 
    gameId,
    myPlayerId,
    createHostGame, 
    joinClientGame,
    isHost, // isHostもエクスポート
    buzz, // 早押し関数を追加
    submitAnswer, // 解答関数を追加
  };
};

export default useGame;