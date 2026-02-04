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

// 教科名の日本語とFirebaseノード名を対応させる
const subjectNodeMap = {
    '国語': 'japanese',
    '数学': 'mathematics',
    '理科': 'science',
    '社会': 'social',
    '英語': 'english',
};

/**
 * @param {string | null} initialGameId -
 * @param {string} myPlayerId 
 */
const useGame = (initialGameId, myPlayerId) => {
  const [gameId, setGameId] = useState(initialGameId);
  const [gameState, setGameState] = useState({
      id: initialGameId,
      players: {},
      status: 'waiting',
      rules: null,
      currentQuestion: null,
      currentQuestionIndex: -1,
  });
  const [opponentName, setOpponentName] = useState('');
  const [questionList, setQuestionList] = useState(null); 
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  
  const isHost = gameState?.players?.[myPlayerId]?.isHost === true; 

  // --- ユーティリティ関数 ---

  // Firebaseから問題を取得し、Stateに保存する関数 (ホスト専用)
  const fetchQuestionsForGame = useCallback(async (settings) => {
    setQuestionsLoaded(false); // ロード開始
    const allQuestionsRef = ref(db, 'questions');
    const snapshot = await get(allQuestionsRef);
    
    let allFirebaseQuestions = {};
    if (snapshot.exists()) {
        allFirebaseQuestions = snapshot.val();
        console.log(`[DEBUG: Q Fetch] Loaded Firebase questions. Subjects: ${Object.keys(allFirebaseQuestions).join(', ')}`);
    } else {
        console.warn("Firebaseに問題データが見つかりません。");
    }

    let filteredQuestions = [];
    const subjectsToUse = settings?.range?.subjects || Object.keys(subjectNodeMap); 
    const totalQuestionsLimit = settings?.rules?.totalQuestions || 10; 
    

    let combinedQuestions = {};
    
    // --- 1. Firebaseからの問題をcombinedQuestionsに追加 ---
    for (const [subjectNode, subjectQuestions] of Object.entries(allFirebaseQuestions)) {
        const japaneseSubject = Object.keys(subjectNodeMap).find(key => subjectNodeMap[key] === subjectNode);
        
        if (subjectsToUse.includes(japaneseSubject) || subjectsToUse.includes(subjectNode)) {
            Object.values(subjectQuestions).forEach(q => {
                const questionId = q.questionId || q.id || `firebase_${Object.keys(combinedQuestions).length}`;
                if (!combinedQuestions[questionId]) {
                    
                    const rawOptions = q.options ? (Array.isArray(q.options) ? q.options : Object.values(q.options)) : [];
                    const optionTexts = rawOptions.map(opt => opt.text); 

                    combinedQuestions[questionId] = {
                        ...q,
                        options: optionTexts, 
                        source: 'firebase', 
                    };
                }
            });
        }
    }

    // --- 2. ローカルのQUIZ_QUESTIONSから、設定に合うものをcombinedQuestionsに追加 ---
    QUIZ_QUESTIONS.forEach(q => {
        if (subjectsToUse.includes(q.subject)) {
            const questionId = q.id || `local_${Object.keys(combinedQuestions).length}`;
            if (!combinedQuestions[questionId]) {                
                let localOptionTexts = Array.isArray(q.options) ? q.options : null;
                if (localOptionTexts && localOptionTexts.length > 0 && typeof localOptionTexts[0] === 'object') {
                   localOptionTexts = localOptionTexts.map(opt => opt.text);
                }

                combinedQuestions[questionId] = {
                    ...q,
                    options: localOptionTexts,
                    source: 'local',
                };
            }
        }
    });

    // --- 3. 最終的なリストの生成、シャッフル、切り詰め ---
    filteredQuestions = Object.values(combinedQuestions).map(q => {
        const hasValidOptions = Array.isArray(q.options) && q.options.length > 0;
        return {
            ...q,
            isSelectable: hasValidOptions,
        };
    });
    
    if (filteredQuestions.length === 0) {
        filteredQuestions = QUIZ_QUESTIONS.map(q => ({
            ...q,
            isSelectable: Array.isArray(q.options) && q.options.length > 0, 
            source: 'local_fallback',
        }));
    }
    
    const shuffledQuestions = shuffleArray(filteredQuestions);
    const finalQuestionList = shuffledQuestions.slice(0, totalQuestionsLimit);

    setQuestionList(finalQuestionList);
    setQuestionsLoaded(true); 
    return finalQuestionList;

  }, []);

  // 次の問題を設定する関数 (ホスト専用)
  const setNextQuestion = useCallback(async (id, currentQuestionIndex) => {
    if (!questionList) {
        console.error("問題リストがまだロードされていません。");
        return;
    }
    
    const questions = questionList; 
    const nextQuestionIndex = currentQuestionIndex + 1;

    const winPoints = gameState?.rules?.winPoints || 8;
    const players = gameState.players; 
    
    const isPlayerWon = Object.values(players).some(p => p.score >= winPoints);

    if (isPlayerWon) {
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

      let shuffledOptions = nextQuestion.options;
      if (Array.isArray(shuffledOptions) && shuffledOptions.length > 0) {
        shuffledOptions = shuffleArray([...shuffledOptions]);
      }

      await update(gameRef, {
        currentQuestionIndex: nextQuestionIndex, 
        currentQuestion: {
          id: nextQuestionId, 
          text: nextQuestion.text,
          answer: nextQuestion.answer,
          isSelectable: nextQuestion.isSelectable,
          options: shuffledOptions || null, //  シャッフルした文字列配列を使用
          buzzedPlayerId: null, 
          answererId: null, 
          status: 'reading',
          lockedOutPlayers: [], 
        }
      });
    } else {
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
    if (!gameState?.players?.[myPlayerId]?.isHost || !id || gameState.status !== 'waiting' || !questionsLoaded || !questionList) return; 
    
    const questions = questionList; 
    
    const gameRef = ref(db, `games/${id}`);
    
    const initialQuestion = questions[0]; 

    const initialPlayersUpdate = Object.keys(gameState.players).reduce((acc, playerId) => {
        acc[`players/${playerId}/score`] = 0;
        return acc;
    }, {});
    
    const initialQuestionId = initialQuestion.questionId || initialQuestion.id || 'q_fallback_0';

    let shuffledOptions = initialQuestion.options;
    if (Array.isArray(shuffledOptions) && shuffledOptions.length > 0) {
        shuffledOptions = shuffleArray([...shuffledOptions]);
        console.log(`Question #${initialQuestionId} の選択肢をシャッフルしました。`);
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
            options: shuffledOptions || null, 
            buzzedPlayerId: null, 
            answererId: null, 
            status: 'reading', 
            lockedOutPlayers: [], 
        },
    });
    console.log(`[Game] ゲームID ${id} のステータスを 'playing' に更新し、最初の問題 (${initialQuestion.source}) を設定しました。`);
  }, [gameState, myPlayerId, questionList, questionsLoaded]); 


  // --- 早押し処理 (変更なし) ---
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

  }, [gameId, gameState, myPlayerId]);


  // --- 解答送信処理 (クライアントとホスト共通) ---
  const submitAnswer = useCallback(async (answerText) => {
    if (!gameId || gameState?.status !== 'playing' || gameState.currentQuestion?.answererId !== myPlayerId) return;

    const gameRef = ref(db, `games/${gameId}`);
    
    await update(gameRef, {
        'currentQuestion/submittedAnswer': answerText,
        'currentQuestion/submitterId': myPlayerId,
        'currentQuestion/status': 'judging', 
    });
    

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

    //  判定ロジックは、submittedAnswerとcorrectAnswer (正解のテキスト) の一致を確認するため、変更なしでOK
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

            setTimeout(() => {
                setNextQuestion(gameId, gameState.currentQuestionIndex);
            }, gameState.rules.nextQuestionDelay * 1000 || 2000); 

        } else {
            const penaltyType = gameState.rules.wrongAnswerPenalty;
            const playerCount = Object.keys(gameState.players).length; //  プレイヤーの総数を取得
            let newScore = gameState.players[answererId]?.score || 0;
            let updates = {
                'currentQuestion/status': 'answered_wrong', // 初期値としてセット
                'currentQuestion/answererId': null, 
                'currentQuestion/submittedAnswer': null, 
                'currentQuestion/submitterId': null, 
            };
            
            let shouldAdvanceToNextQuestion = false; //  次の問題へ進むべきか判定するフラグ

            if (penaltyType === 'minus_one') {
                newScore = Math.max(0, newScore - 1); 
                updates[`players/${answererId}/score`] = newScore; 
                shouldAdvanceToNextQuestion = true; //  'minus_one' の場合は即座に次の問題へ

            } else if (penaltyType === 'lockout') {
                const lockedOutPlayers = currentQ.lockedOutPlayers || [];
                updates['currentQuestion/lockedOutPlayers'] = [...lockedOutPlayers, answererId];                 
                updates['currentQuestion/status'] = 'reading'; 
                updates['currentQuestion/buzzedPlayerId'] = null; // 早押しをリセット

                const nextLockedOutCount = lockedOutPlayers.length + 1;
                
                if (nextLockedOutCount >= playerCount) {
                    console.log(`[Host Judgment] 誤答 (ロックアウト)。全プレイヤー (${playerCount}人) がロックアウトされました。次の問題へ移行します。`);
                    updates['currentQuestion/status'] = 'answered_wrong'; 
                    shouldAdvanceToNextQuestion = true; //  全員ロックアウトの場合は次の問題へ
                } else {
                    console.log(`[Host Judgment] 誤答 (ロックアウト)。プレイヤー ${answererId} はこの問題に解答できません。`);
                }
            }
            
            await update(gameRef, updates);
            
            if (shouldAdvanceToNextQuestion) {
                setTimeout(() => {
                    setNextQuestion(gameId, gameState.currentQuestionIndex);
                }, gameState.rules.nextQuestionDelay * 1000 || 2000);
            }
        }
    };
    
    handleJudgment();

  }, [isHost, gameState, setNextQuestion, initialGameId]);

  const deleteGameRoom = useCallback(async () => {
    if (!gameId || !isHost) {
        return;
    }
    
    const gameRef = ref(db, `games/${gameId}`);
    try {
        await remove(gameRef);
    } catch (error) {
        console.error(`${gameId} の削除に失敗`, error);
    }
  }, [gameId, isHost]);


  // --- マッチング処理（db.jsの関数をラップ） (変更なし) ---
  
  //  createHostGame の定義を更新: isOpenMatch を受け取るようにする
  const createHostGame = useCallback(async (ruleSettings, hostPlayer, isOpenMatch = false) => {
    const newGameId = await createNewGameWithRandom4DigitId(ruleSettings, hostPlayer, isOpenMatch);
    setGameId(newGameId);
    return newGameId;
  }, []);

  const joinClientGame = async (targetGameId, clientPlayer) => {
    const gameRef = ref(db, `games/${targetGameId}`);
    
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) {
      throw new Error('部屋が見つかりませんでした。');
    }
    
    const currentStatus = snapshot.val().status;
    if (currentStatus !== 'waiting') {
      throw new Error('すでに試合が始まっています。');
    }

    await addClientToGame(targetGameId, clientPlayer);
    setGameId(targetGameId);
  };

  useEffect(() => {
    if (!gameId) return;

    const gameRef = ref(db, `games/${gameId}`);
    
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState({...data, id: snapshot.key}); 
        
        if (data.players) {
          const playersArray = Object.values(data.players);
          
          const opponent = playersArray.find(
            (player) => player.id !== myPlayerId 
          );

          if (opponent) {
            setOpponentName(opponent.name);
          } else {
            setOpponentName(''); // 相手が退出した場合に備えてリセット
          }

          // ホストの場合、プレイヤーが揃い、まだ問題リストをロードしていないなら、ロードを開始
          if (data.status === 'waiting' && playersArray.length === 2 && data.players[myPlayerId]?.isHost) {
              if (!questionsLoaded && !questionList) {
                  console.log("[Host] プレイヤーが揃いました。問題リストのロードを開始します。");
                  fetchQuestionsForGame(data.settings); 
              }
          }
        }
      } else {
        setGameState(null);
        setOpponentName('');
      }
    });

    return () => unsubscribe();
  }, [gameId, myPlayerId, fetchQuestionsForGame, questionList, questionsLoaded]); 
  
  //  追加: 問題ロード完了をトリガーとしてゲームを開始する
  useEffect(() => {
      // ホストであり、ロードが完了し、問題リストがあり、ステータスが'waiting'ならゲーム開始
      if (isHost && questionsLoaded && questionList && gameState?.status === 'waiting') {
          console.log("[Host] 問題リストのロードが完了しました。ゲームを開始します。");
          startGame(gameId);
      }
  }, [isHost, questionsLoaded, questionList, gameState, gameId, startGame]);


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
    questionsLoaded, 
  };
};

export default useGame;