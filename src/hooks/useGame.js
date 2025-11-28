// src/hooks/useGame.js

import { useState, useEffect, useCallback } from 'react';
import { onValue, ref, get, update, remove } from 'firebase/database';
import { db, createNewGameWithRandom4DigitId, addClientToGame } from '../firebase/db'; 
import { QUIZ_QUESTIONS } from '../utils/constants'; 


// 問題をシャッフルするシンプルな関数
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// 教科名の日本語とFirebaseノード名のマッピング
const subjectNodeMap = {
    '国語': 'japanese',
    '数学': 'mathematics',
    '理科': 'science',
    '社会': 'social',
    '英語': 'english',
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
  // 問題リストの状態を追加（ホストが一度だけ取得し、Stateに保存）
  const [questionList, setQuestionList] = useState(null); 
  
  // 自分がホストかどうかを判定
  const isHost = gameState?.players?.[myPlayerId]?.isHost === true; 

  // --- ユーティリティ関数 ---

  // Firebaseから問題を取得し、Stateに保存する関数 (ホスト専用)
  const fetchQuestionsForGame = useCallback(async (settings) => {
    const allQuestionsRef = ref(db, 'questions');
    const snapshot = await get(allQuestionsRef);
    
    let allFirebaseQuestions = {};
    if (snapshot.exists()) {
        allFirebaseQuestions = snapshot.val();
        console.log("[DEBUG: Q Fetch] Loaded Firebase questions:", allFirebaseQuestions);
    } else {
        console.warn("[Game] Firebaseに問題データが見つかりません。");
    }

    let filteredQuestions = [];
    const subjectsToUse = settings?.range?.subjects || [];
    console.log(`[DEBUG: Q Fetch] Settings Subjects: ${subjectsToUse.join(', ')}`);

    // Firebaseからの問題と、ローカルのQUIZ_QUESTIONSを統合
    let combinedQuestions = {};
    
    // Firebaseからの問題をcombinedQuestionsに追加
    for (const [subjectNode, subjectQuestions] of Object.entries(allFirebaseQuestions)) {
        const japaneseSubject = Object.keys(subjectNodeMap).find(key => subjectNodeMap[key] === subjectNode);
        if (subjectsToUse.includes(japaneseSubject) || subjectsToUse.includes(subjectNode)) {
            // Firebaseのoptionsがオブジェクト形式の場合に備えて変換
            Object.values(subjectQuestions).forEach(q => {
                const questionId = q.questionId || q.id || `firebase_${Object.keys(combinedQuestions).length}`;
                combinedQuestions[questionId] = {
                    ...q,
                    // options がオブジェクトなら配列に変換してから格納
                    options: q.options ? (Array.isArray(q.options) ? q.options : Object.values(q.options)) : null,
                };
            });
        }
    }

    // ローカルのQUIZ_QUESTIONSから、設定に合うものをcombinedQuestionsに追加
    QUIZ_QUESTIONS.forEach(q => {
        if (subjectsToUse.includes(q.subject)) {
            const questionId = q.id || `local_${Object.keys(combinedQuestions).length}`;
            if (!combinedQuestions[questionId]) { // Firebaseと重複しないように
                combinedQuestions[questionId] = q;
            }
        }
    });

    // 最終的な filteredQuestions を生成
    filteredQuestions = Object.values(combinedQuestions).map(q => {
        // isSelectable の判定を強化: options が配列で、かつ要素がある場合
        const hasValidOptions = Array.isArray(q.options) && q.options.length > 0;
        return {
            ...q,
            isSelectable: hasValidOptions,
        };
    });
    
    // フィルタリング結果が空の場合、常にQUIZ_QUESTIONSを代替として使用
    if (filteredQuestions.length === 0) {
        console.warn("[Game] 設定された条件に合う問題が見つかりません。ローカルのQUIZ_QUESTIONSを使用します。");
        filteredQuestions = QUIZ_QUESTIONS.map(q => ({
            ...q,
            isSelectable: Array.isArray(q.options) && q.options.length > 0, // ローカルでも判定
        }));
    }
    
    const shuffledQuestions = shuffleArray(filteredQuestions);
    setQuestionList(shuffledQuestions);
    console.log(`[Game] 合計 ${shuffledQuestions.length} 問の問題を取得しました。`);
    return shuffledQuestions;

  }, []);

  // 次の問題を設定する関数 (ホスト専用)
  const setNextQuestion = useCallback(async (id, currentQuestionIndex) => {
    if (!questionList) {
        console.error("[Game] 問題リストがまだロードされていません。");
        return;
    }
    
    const questions = questionList; 
    const nextQuestionIndex = currentQuestionIndex + 1;

    const winPoints = gameState?.rules?.winPoints || 8;
    const players = gameState.players; 
    
    const isPlayerWon = Object.values(players).some(p => p.score >= winPoints);

    if (isPlayerWon) {
        console.log("[Game] どちらかのプレイヤーが勝利点に達しました。リザルト画面に移行します。");
        const playerScores = Object.values(players).map(p => ({ id: p.id, score: p.score }));
        const potentialWinners = playerScores.filter(p => p.score >= winPoints);
        const winner = potentialWinners.reduce((prev, current) => (prev.score > current.score) ? prev : current, { score: -1 });

        await update(ref(db, `games/${id}`), {
            status: 'finished', 
            winner: winner.id,
        });
        return;
    }
    
    if (nextQuestionIndex < questions.length) {
      const nextQuestion = questions[nextQuestionIndex];
      const gameRef = ref(db, `games/${id}`);
      
      const nextQuestionId = nextQuestion.questionId || nextQuestion.id || 'q_fallback_' + nextQuestionIndex; 

      // ⭐ 修正: 選択肢が存在する場合、シャッフルする
      let shuffledOptions = nextQuestion.options;
      if (Array.isArray(shuffledOptions) && shuffledOptions.length > 0) {
        // シャッフルは元の配列を破壊するため、コピーを作成してシャッフル
        shuffledOptions = shuffleArray([...shuffledOptions]);
        console.log(`[Shuffle] Question #${nextQuestionId} の選択肢をシャッフルしました。`);
      }

      await update(gameRef, {
        currentQuestionIndex: nextQuestionIndex, 
        currentQuestion: {
          id: nextQuestionId, 
          text: nextQuestion.text,
          answer: nextQuestion.answer,
          isSelectable: nextQuestion.isSelectable,
          options: shuffledOptions || null, // ⭐ シャッフルした選択肢を使用
          buzzedPlayerId: null, 
          answererId: null, 
          status: 'reading',
          lockedOutPlayers: [], 
        }
      });
      console.log(`[Game] 次の問題 #${nextQuestionId} を設定しました。`);
    } else {
        console.log("[Game] 全ての問題が終了しました。リザルト画面に移行します。");
        const playerScores = Object.values(players).map(p => ({ id: p.id, score: p.score }));
        const winner = playerScores.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        
        await update(ref(db, `games/${id}`), {
            status: 'finished', 
            winner: winner.id,
        });
    }
  }, [questionList, gameState]); 


  // --- ゲーム開始処理 (ホスト専用)
  const startGame = useCallback(async (id) => {
    if (!gameState?.players?.[myPlayerId]?.isHost || !id || gameState.status !== 'waiting') return; 
    
    let questions = questionList;
    if (!questions) {
        questions = await fetchQuestionsForGame(gameState.settings);
        if (!questions || questions.length === 0) {
            console.error("[Game] ゲームを開始できません。問題データがありません。");
            return;
        }
    }
    
    const gameRef = ref(db, `games/${id}`);
    
    const initialQuestion = questions[0]; 

    const initialPlayersUpdate = Object.keys(gameState.players).reduce((acc, playerId) => {
        acc[`players/${playerId}/score`] = 0;
        return acc;
    }, {});
    
    const initialQuestionId = initialQuestion.questionId || initialQuestion.id || 'q_fallback_0';

    // ⭐ 修正: 最初の問題もシャッフルする
    let shuffledOptions = initialQuestion.options;
    if (Array.isArray(shuffledOptions) && shuffledOptions.length > 0) {
        shuffledOptions = shuffleArray([...shuffledOptions]);
        console.log(`[Shuffle] Question #${initialQuestionId} の選択肢をシャッフルしました。`);
    }

    await update(gameRef, {
        ...initialPlayersUpdate, 
        status: 'playing',
        currentQuestionIndex: 0, 
        currentQuestion: {
            id: initialQuestionId, 
            text: initialQuestion.text,
            answer: initialQuestion.answer,
            isSelectable: initialQuestion.isSelectable,
            options: shuffledOptions || null, // ⭐ シャッフルした選択肢を使用
            buzzedPlayerId: null, 
            answererId: null, 
            status: 'reading', 
            lockedOutPlayers: [], 
        },
    });
    console.log(`[Game] ゲームID ${id} のステータスを 'playing' に更新し、最初の問題を設定しました。`);
  }, [gameState, myPlayerId, questionList, fetchQuestionsForGame]); 


  // --- 早押し処理 ---
  const buzz = useCallback(async () => {
    if (!gameId || gameState?.status !== 'playing') return;
    
    const currentQ = gameState.currentQuestion;

    const isLockedOut = currentQ.lockedOutPlayers?.includes(myPlayerId);
    if (currentQ.buzzedPlayerId || currentQ.answererId || isLockedOut) return;

    const gameRef = ref(db, `games/${gameId}`);
    
    await update(gameRef, {
        'currentQuestion/buzzedPlayerId': myPlayerId, 
        'currentQuestion/answererId': myPlayerId, 
        'currentQuestion/status': 'answering', 
    });
    console.log(`[Buzz] プレイヤー ${myPlayerId} が早押ししました。`);

  }, [gameId, gameState, myPlayerId]);


  // --- 解答送信処理 (クライアント/ホスト共通) ---
  const submitAnswer = useCallback(async (answerText) => {
    if (!gameId || gameState?.status !== 'playing' || gameState.currentQuestion?.answererId !== myPlayerId) return;

    const gameRef = ref(db, `games/${gameId}`);
    
    await update(gameRef, {
        'currentQuestion/submittedAnswer': answerText,
        'currentQuestion/submitterId': myPlayerId,
        'currentQuestion/status': 'judging', 
    });
    
    console.log(`[Answer] 解答: "${answerText}" を提出しました。ホストの判定を待っています。`);

  }, [gameId, gameState, myPlayerId]); 


  // --- 解答の判定処理 (ホスト専用) ---
  useEffect(() => {
    if (!isHost || gameState?.currentQuestion?.status !== 'judging') return;

    const gameId = gameState.id || initialGameId; 
    if (!gameId) return;

    const currentQ = gameState.currentQuestion;
    const answererId = currentQ.submitterId; 
    const submittedAnswer = currentQ.submittedAnswer;
    const correctAnswer = currentQ.answer; 

    const isCorrect = submittedAnswer.trim() === correctAnswer.trim(); 

    const handleJudgment = async () => {
        const gameRef = ref(db, `games/${gameId}`);

        if (isCorrect) {
            const newScore = (gameState.players[answererId]?.score || 0) + 1;
            
            await update(gameRef, {
                [`players/${answererId}/score`]: newScore, 
                'currentQuestion/status': 'answered_correct', 
                'currentQuestion/buzzedPlayerId': null, 
                'currentQuestion/answererId': null, 
                'currentQuestion/submittedAnswer': null, 
                'currentQuestion/submitterId': null, 
            });
            console.log(`[Host Judgment] 正解！プレイヤー ${answererId} のスコアが ${newScore} になりました。`);

            setTimeout(() => {
                setNextQuestion(gameId, gameState.currentQuestionIndex);
            }, gameState.rules.nextQuestionDelay * 1000 || 2000); 

        } else {
            const penaltyType = gameState.rules.wrongAnswerPenalty;
            let newScore = gameState.players[answererId]?.score || 0;
            let updates = {
                'currentQuestion/status': 'answered_wrong', 
                'currentQuestion/answererId': null, 
                'currentQuestion/submittedAnswer': null, 
                'currentQuestion/submitterId': null, 
            };

            if (penaltyType === 'minus_one') {
                newScore = Math.max(0, newScore - 1); 
                updates[`players/${answererId}/score`] = newScore; 
                console.log(`[Host Judgment] 誤答 (マイナス1点)。スコアが ${newScore} になりました。`);

                setTimeout(() => {
                    setNextQuestion(gameId, gameState.currentQuestionIndex);
                }, gameState.rules.nextQuestionDelay * 1000 || 2000);

            } else if (penaltyType === 'lockout') {
                const lockedOutPlayers = currentQ.lockedOutPlayers || [];
                updates['currentQuestion/lockedOutPlayers'] = [...lockedOutPlayers, answererId]; 
                console.log(`[Host Judgment] 誤答 (ロックアウト)。プレイヤー ${answererId} はこの問題に解答できません。`);
                
                updates['currentQuestion/buzzedPlayerId'] = null;
            }
            
            await update(gameRef, updates);
        }
    };
    
    handleJudgment();

  }, [isHost, gameState, setNextQuestion, initialGameId]);

  // ゲームルームをFirebaseから完全に削除する関数 (ホスト専用)
  const deleteGameRoom = useCallback(async () => {
    if (!gameId || !isHost) {
        console.warn("[Delete] 部屋の削除はホストのみ可能です。");
        return;
    }
    
    const gameRef = ref(db, `games/${gameId}`);
    try {
        await remove(gameRef);
        console.log(`[Delete] ゲームルームID ${gameId} をFirebaseから削除しました。`);
    } catch (error) {
        console.error(`[Delete] ゲームルーム ${gameId} の削除に失敗しました:`, error);
    }
  }, [gameId, isHost]);


  // --- マッチング処理（db.jsの関数をラップ） (変更なし) ---
  
  const createHostGame = async (ruleSettings, hostPlayer) => {
    const newGameId = await createNewGameWithRandom4DigitId(ruleSettings, hostPlayer);
    setGameId(newGameId);
    return newGameId;
  };

  const joinClientGame = async (targetGameId, clientPlayer) => {
    const gameRef = ref(db, `games/${targetGameId}`);
    
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) {
      throw new Error('指定された部屋IDのゲームは存在しません。');
    }
    
    const currentStatus = snapshot.val().status;
    if (currentStatus !== 'waiting') {
      throw new Error('このゲームは既に開始されています。');
    }

    await addClientToGame(targetGameId, clientPlayer);
    setGameId(targetGameId);
  };

  // --- リアルタイムデータ同期 (startGameに依存) ---
  useEffect(() => {
    if (!gameId) return;

    const gameRef = ref(db, `games/${gameId}`);
    
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
        
        if (data.players) {
          const playersArray = Object.values(data.players);
          
          const opponent = playersArray.find(
            (player) => player.id !== myPlayerId 
          );

          if (opponent) {
            setOpponentName(opponent.name);
          }

          if (data.status === 'waiting' && playersArray.length === 2 && data.players[myPlayerId]?.isHost) {
              console.log("[Host] プレイヤーが揃いました。ゲーム開始関数を呼び出します。");
              startGame(gameId); 
          }
        }
      } else {
        setGameState(null);
        setOpponentName('');
      }
    });

    return () => unsubscribe();
  }, [gameId, myPlayerId, startGame]); 


  return { 
    gameState, 
    opponentName, 
    gameId,
    myPlayerId,
    createHostGame, 
    joinClientGame,
    isHost,
    buzz, 
    submitAnswer, 
    deleteGameRoom,
  };
};

export default useGame;