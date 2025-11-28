// src/hooks/useGame.js

import { useState, useEffect, useCallback } from 'react';
import { onValue, ref, get, update } from 'firebase/database';
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
    // Firebase Realtime Databaseのルート参照
    const allQuestionsRef = ref(db, 'questions');
    const snapshot = await get(allQuestionsRef);
    
    if (!snapshot.exists()) {
        console.warn("[Game] Firebaseに問題データが見つかりません。");
        // 代替としてローカルのQUIZ_QUESTIONSを使うことも可能
        setQuestionList(shuffleArray([...QUIZ_QUESTIONS]));
        return shuffleArray([...QUIZ_QUESTIONS]); 
    }

    const allQuestions = snapshot.val();
    let filteredQuestions = [];

    // 設定された教科と学年でフィルタリング
    const subjectsToUse = settings?.range?.subjects || [];
    
    // ⭐ デバッグログの追加
    console.log(`[DEBUG: Q Fetch] Settings Subjects: ${subjectsToUse.join(', ')}`);

    // フィルタリング処理
    for (const [subjectNode, subjectQuestions] of Object.entries(allQuestions)) {
        // 日本語名に変換（Matchmakingから渡された設定の subjects は日本語名）
        const japaneseSubject = Object.keys(subjectNodeMap).find(key => subjectNodeMap[key] === subjectNode);

        if (subjectsToUse.includes(japaneseSubject) || subjectsToUse.includes(subjectNode)) {
             // 選択された教科の問題を全て配列に追加
             // ⭐ 修正: subjectQuestions がオブジェクトであることを想定し、Object.valuesで展開
             const questionsArray = Object.values(subjectQuestions);
             
             filteredQuestions = filteredQuestions.concat(questionsArray.map(q => ({
                ...q,
                // Q.type が "選択式" なら true に変換
                isSelectable: q.type === '選択式',
             })));
             
             console.log(`[DEBUG: Q Fetch] Found ${questionsArray.length} questions for: ${subjectNode} (${japaneseSubject || subjectNode})`);
        }
    }
    
    // フィルタリング結果が空の場合、ローカルの代替を使用
    if (filteredQuestions.length === 0) {
        console.warn("[Game] 設定された条件に合う問題が見つかりません。ローカルの代替問題を使用します。");
        // ⭐ デバッグ: フィルタリングが失敗した場合、空の配列を返す前にログ
        console.warn(`[DEBUG: Q Fetch] No questions found matching settings. Available Firebase nodes: ${Object.keys(allQuestions).join(', ')}`);
        setQuestionList(shuffleArray([...QUIZ_QUESTIONS]));
        return shuffleArray([...QUIZ_QUESTIONS]);
    }
    
    const shuffledQuestions = shuffleArray(filteredQuestions);
    setQuestionList(shuffledQuestions);
    console.log(`[Game] 合計 ${shuffledQuestions.length} 問の問題を取得しました。`);
    return shuffledQuestions;

  }, []); // 依存配列は空でOK

  // 次の問題を設定する関数 (ホスト専用)
  const setNextQuestion = useCallback(async (id, currentQuestionIndex) => {
    // questionList がロードされていることを確認
    if (!questionList) {
        console.error("[Game] 問題リストがまだロードされていません。");
        return;
    }
    
    const questions = questionList; // 既にシャッフル済み
    const nextQuestionIndex = currentQuestionIndex + 1;

    // 勝利点チェックをここに追加 (gameState に依存)
    const winPoints = gameState?.rules?.winPoints || 8;
    const players = gameState.players; // gameState に依存
    
    const isPlayerWon = Object.values(players).some(p => p.score >= winPoints);

    if (isPlayerWon) {
        console.log("[Game] どちらかのプレイヤーが勝利点に達しました。リザルト画面に移行します。");
        const playerScores = Object.values(players).map(p => ({ id: p.id, score: p.score }));
        // スコアが勝利点に達したプレイヤーを探し、その中でスコアが高い方を勝者とする
        const potentialWinners = playerScores.filter(p => p.score >= winPoints);
        const winner = potentialWinners.reduce((prev, current) => (prev.score > current.score) ? prev : current, { score: -1 });

        await update(ref(db, `games/${id}`), {
            status: 'finished', 
            winner: winner.id,
        });
        return;
    }
    
    // 問題インデックスをチェック
    if (nextQuestionIndex < questions.length) {
      const nextQuestion = questions[nextQuestionIndex];
      const gameRef = ref(db, `games/${id}`);
      
      // 問題IDがundefinedになることを防ぐためのフォールバック
      const nextQuestionId = nextQuestion.questionId || nextQuestion.id || 'q_fallback_' + nextQuestionIndex; 

      await update(gameRef, {
        currentQuestionIndex: nextQuestionIndex, 
        currentQuestion: {
          id: nextQuestionId, // 修正したIDを使用
          text: nextQuestion.text,
          answer: nextQuestion.answer,
          isSelectable: nextQuestion.isSelectable,
          options: nextQuestion.options || null, // options も Firebase からそのまま渡されます
          buzzedPlayerId: null, 
          answererId: null, 
          status: 'reading',
          lockedOutPlayers: [], 
        }
      });
      console.log(`[Game] 次の問題 #${nextQuestionId} を設定しました。`);
    } else {
        // 全問終了の場合
        console.log("[Game] 全ての問題が終了しました。リザルト画面に移行します。");
        const playerScores = Object.values(players).map(p => ({ id: p.id, score: p.score }));
        const winner = playerScores.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        
        await update(ref(db, `games/${id}`), {
            status: 'finished', 
            winner: winner.id,
        });
    }
  }, [questionList, gameState]); 


  // --- ゲーム開始処理 (ホスト専用) ---
  const startGame = useCallback(async (id) => {
    if (!gameState?.players?.[myPlayerId]?.isHost || !id || gameState.status !== 'waiting') return; 
    
    let questions = questionList;
    if (!questions) {
        // ⭐ 問題リストがない場合、ここで取得を試みる
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
    
    // 問題IDがundefinedになることを防ぐためのフォールバック
    const initialQuestionId = initialQuestion.questionId || initialQuestion.id || 'q_fallback_0';


    await update(gameRef, {
        ...initialPlayersUpdate, 
        status: 'playing',
        currentQuestionIndex: 0, 
        currentQuestion: {
            id: initialQuestionId, // 修正したIDを使用
            text: initialQuestion.text,
            answer: initialQuestion.answer,
            isSelectable: initialQuestion.isSelectable,
            options: initialQuestion.options || null, // options も Firebase からそのまま渡されます
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

    // 既に誰かが押している、または解答権がある場合、またはロックアウトされている場合は無視
    const isLockedOut = currentQ.lockedOutPlayers?.includes(myPlayerId);
    if (currentQ.buzzedPlayerId || currentQ.answererId || isLockedOut) return;

    const gameRef = ref(db, `games/${gameId}`);
    
    // Firebaseのトランザクションで、早押しプレイヤーを記録
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

    // クライアント/ホストに関わらず、解答をFirebaseに書き込むアクションとする
    const gameRef = ref(db, `games/${gameId}`);
    
    // 解答権を持ったプレイヤーの提出した解答をDBに記録 (ホストはこの書き込みをトリガーに判定)
    await update(gameRef, {
        'currentQuestion/submittedAnswer': answerText,
        'currentQuestion/submitterId': myPlayerId,
        'currentQuestion/status': 'judging', // 判定待ち
    });
    
    console.log(`[Answer] 解答: "${answerText}" を提出しました。ホストの判定を待っています。`);

  }, [gameId, gameState, myPlayerId]); 


  // --- 解答の判定処理 (ホスト専用) ---
  useEffect(() => {
    // ホストかつ、判定待ち状態であれば実行
    if (!isHost || gameState?.currentQuestion?.status !== 'judging') return;

    const gameId = gameState.id || initialGameId; 
    if (!gameId) return;

    const currentQ = gameState.currentQuestion;
    const answererId = currentQ.submitterId; 
    const submittedAnswer = currentQ.submittedAnswer;
    const correctAnswer = currentQ.answer; 

    // 厳密な比較（実際のクイズアプリでは、表記揺れを許容するロジックが必要です）
    const isCorrect = submittedAnswer.trim() === correctAnswer.trim(); 

    const handleJudgment = async () => {
        const gameRef = ref(db, `games/${gameId}`);

        if (isCorrect) {
            // 正解の場合
            const newScore = (gameState.players[answererId]?.score || 0) + 1;
            
            await update(gameRef, {
                [`players/${answererId}/score`]: newScore, // スコア加算
                'currentQuestion/status': 'answered_correct', // 正解としてマーク
                'currentQuestion/buzzedPlayerId': null, // リセット
                'currentQuestion/answererId': null, // リセット
                'currentQuestion/submittedAnswer': null, // リセット
                'currentQuestion/submitterId': null, // リセット
            });
            console.log(`[Host Judgment] 正解！プレイヤー ${answererId} のスコアが ${newScore} になりました。`);

            // 次の問題へ移行
            setTimeout(() => {
                setNextQuestion(gameId, gameState.currentQuestionIndex);
            }, gameState.rules.nextQuestionDelay * 1000 || 2000); // 遅延時間はルールから取得

        } else {
            // 誤答の場合
            const penaltyType = gameState.rules.wrongAnswerPenalty;
            let newScore = gameState.players[answererId]?.score || 0;
            let updates = {
                'currentQuestion/status': 'answered_wrong', // 誤答としてマーク
                'currentQuestion/answererId': null, // 解答権を剥奪
                'currentQuestion/submittedAnswer': null, // リセット
                'currentQuestion/submitterId': null, // リセット
            };

            if (penaltyType === 'minus_one') {
                newScore = Math.max(0, newScore - 1); // 1点減点 (最低0点)
                updates[`players/${answererId}/score`] = newScore; // スコア減点
                console.log(`[Host Judgment] 誤答 (マイナス1点)。スコアが ${newScore} になりました。`);

                // ロックアウトはしないため、即座に次の問題へ移行（次のプレイヤーに解答権は移らない）
                setTimeout(() => {
                    setNextQuestion(gameId, gameState.currentQuestionIndex);
                }, gameState.rules.nextQuestionDelay * 1000 || 2000);

            } else if (penaltyType === 'lockout') {
                // ロックアウト (解答権喪失)
                const lockedOutPlayers = currentQ.lockedOutPlayers || [];
                updates['currentQuestion/lockedOutPlayers'] = [...lockedOutPlayers, answererId]; // ロックアウトリストに追加
                console.log(`[Host Judgment] 誤答 (ロックアウト)。プレイヤー ${answererId} はこの問題に解答できません。`);

                // buzzedPlayerIdはnullに戻すが、ロックアウトリストに追加されているため、
                // 相手が早押ししていない場合は、相手が buzz できる状態に戻る
                
                updates['currentQuestion/buzzedPlayerId'] = null;
            }
            
            await update(gameRef, updates);
        }
    };
    
    // 判定処理を実行
    handleJudgment();

  }, [isHost, gameState, setNextQuestion, initialGameId]);


  // --- マッチング処理（db.jsの関数をラップ） (変更なし) ---
  
  // ホスト：部屋作成 (変更なし)
  const createHostGame = async (ruleSettings, hostPlayer) => {
    const newGameId = await createNewGameWithRandom4DigitId(ruleSettings, hostPlayer);
    setGameId(newGameId);
    return newGameId;
  };

  // クライアント：部屋参加 (変更なし)
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

          // ホストの場合、プレイヤーが2人揃ったらゲーム開始ステータスに移行
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
  };
};

export default useGame;