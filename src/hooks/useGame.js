// src/hooks/useGame.js

import { useState, useEffect, useCallback } from 'react';
import { onValue, ref, get, update, remove } from 'firebase/database';
// ⭐ db.js からインポートする関数を更新
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
  // ⭐ null ではなく、初期オブジェクトを使用
  const [gameState, setGameState] = useState({
      id: initialGameId,
      players: {},
      status: 'waiting',
      rules: null,
      currentQuestion: null,
      currentQuestionIndex: -1,
  });
  const [opponentName, setOpponentName] = useState('');
  // 問題リストの状態を追加（ホストが一度だけ取得し、Stateに保存）
  const [questionList, setQuestionList] = useState(null); 
  // ⭐ 追加: 問題リストのロード状態を追跡
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  
  // 自分がホストかどうかを判定
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
        console.warn("[Game] Firebaseに問題データが見つかりません。");
    }

    let filteredQuestions = [];
    const subjectsToUse = settings?.range?.subjects || Object.keys(subjectNodeMap); 
    const totalQuestionsLimit = settings?.rules?.totalQuestions || 10; 
    
    console.log(`[DEBUG: Q Fetch] Settings Subjects: ${subjectsToUse.join(', ')}. Limit: ${totalQuestionsLimit}問`);

    // Firebaseからの問題と、ローカルのQUIZ_QUESTIONSを統合
    let combinedQuestions = {};
    
    // --- 1. Firebaseからの問題をcombinedQuestionsに追加 ---
    for (const [subjectNode, subjectQuestions] of Object.entries(allFirebaseQuestions)) {
        const japaneseSubject = Object.keys(subjectNodeMap).find(key => subjectNodeMap[key] === subjectNode);
        
        if (subjectsToUse.includes(japaneseSubject) || subjectsToUse.includes(subjectNode)) {
            Object.values(subjectQuestions).forEach(q => {
                const questionId = q.questionId || q.id || `firebase_${Object.keys(combinedQuestions).length}`;
                if (!combinedQuestions[questionId]) {
                    
                    // ⭐ 修正: オブジェクト配列からテキストの文字列配列に変換する
                    const rawOptions = q.options ? (Array.isArray(q.options) ? q.options : Object.values(q.options)) : [];
                    // provided JSON format: options: [ {text: "...", isCorrect: bool}, ... ]
                    const optionTexts = rawOptions.map(opt => opt.text); 

                    combinedQuestions[questionId] = {
                        ...q,
                        // ⭐ 修正: optionsを文字列配列として格納
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
                
                // ローカルのQUIZ_QUESTIONSもoptionsが文字列配列であることを期待
                let localOptionTexts = Array.isArray(q.options) ? q.options : null;
                // ただし、ローカルのQUIZ_QUESTIONSは既に文字列配列として定義されていることが多い
                // 念のため、ローカルが{text: ..., isCorrect: ...}形式だったら対応
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
        // isSelectableはoptionsが文字列配列として存在するかで判定
        const hasValidOptions = Array.isArray(q.options) && q.options.length > 0;
        return {
            ...q,
            isSelectable: hasValidOptions,
        };
    });
    
    if (filteredQuestions.length === 0) {
        console.warn("[Game] 設定された条件に合う問題がFirebase/ローカルで見つかりません。全てのローカルQUIZ_QUESTIONSを代替として使用します。");
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
    console.log(`[Game] 最終的な問題リストを作成しました。合計 ${finalQuestionList.length} 問 (最大 ${totalQuestionsLimit} 問)。`);
    return finalQuestionList;

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

      // ⭐ optionsは既に文字列配列であることを前提にシャッフル
      let shuffledOptions = nextQuestion.options;
      if (Array.isArray(shuffledOptions) && shuffledOptions.length > 0) {
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
          options: shuffledOptions || null, // ⭐ シャッフルした文字列配列を使用
          buzzedPlayerId: null, 
          answererId: null, 
          status: 'reading',
          lockedOutPlayers: [], 
        }
      });
      console.log(`[Game] 次の問題 #${nextQuestionId} (${nextQuestion.source}) を設定しました。`);
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
    if (!gameState?.players?.[myPlayerId]?.isHost || !id || gameState.status !== 'waiting' || !questionsLoaded || !questionList) return; 
    
    const questions = questionList; 
    
    const gameRef = ref(db, `games/${id}`);
    
    const initialQuestion = questions[0]; 

    const initialPlayersUpdate = Object.keys(gameState.players).reduce((acc, playerId) => {
        acc[`players/${playerId}/score`] = 0;
        return acc;
    }, {});
    
    const initialQuestionId = initialQuestion.questionId || initialQuestion.id || 'q_fallback_0';

    // ⭐ optionsは既に文字列配列であることを前提にシャッフル
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
            options: shuffledOptions || null, // ⭐ シャッフルした文字列配列を使用
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

    // ⭐ 判定ロジックは、submittedAnswerとcorrectAnswer (正解のテキスト) の一致を確認するため、変更なしでOK
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
            const playerCount = Object.keys(gameState.players).length; // ⭐ プレイヤーの総数を取得
            let newScore = gameState.players[answererId]?.score || 0;
            let updates = {
                'currentQuestion/status': 'answered_wrong', // 初期値としてセット
                'currentQuestion/answererId': null, 
                'currentQuestion/submittedAnswer': null, 
                'currentQuestion/submitterId': null, 
            };
            
            let shouldAdvanceToNextQuestion = false; // ⭐ 次の問題へ進むべきか判定するフラグ

            if (penaltyType === 'minus_one') {
                newScore = Math.max(0, newScore - 1); 
                updates[`players/${answererId}/score`] = newScore; 
                console.log(`[Host Judgment] 誤答 (マイナス1点)。スコアが ${newScore} になりました。`);

                shouldAdvanceToNextQuestion = true; // ⭐ 'minus_one' の場合は即座に次の問題へ

            } else if (penaltyType === 'lockout') {
                const lockedOutPlayers = currentQ.lockedOutPlayers || [];
                // ロックアウトプレイヤーリストに追加
                updates['currentQuestion/lockedOutPlayers'] = [...lockedOutPlayers, answererId]; 
                
                // ⭐ status を一時的に 'judging' のままにするか、または次の早押しを待つために 'reading' に戻す
                updates['currentQuestion/status'] = 'reading'; 
                updates['currentQuestion/buzzedPlayerId'] = null; // 早押しをリセット

                const nextLockedOutCount = lockedOutPlayers.length + 1;
                
                // ⭐ プレイヤー全員がロックアウトされたかチェック
                if (nextLockedOutCount >= playerCount) {
                    console.log(`[Host Judgment] 誤答 (ロックアウト)。全プレイヤー (${playerCount}人) がロックアウトされました。次の問題へ移行します。`);
                    updates['currentQuestion/status'] = 'answered_wrong'; // 終了ステータスに変更
                    shouldAdvanceToNextQuestion = true; // ⭐ 全員ロックアウトの場合は次の問題へ
                } else {
                    console.log(`[Host Judgment] 誤答 (ロックアウト)。プレイヤー ${answererId} はこの問題に解答できません。`);
                }
            }
            
            await update(gameRef, updates);
            
            // ⭐ 次の問題へ進むべき場合にタイマーを設定
            if (shouldAdvanceToNextQuestion) {
                setTimeout(() => {
                    setNextQuestion(gameId, gameState.currentQuestionIndex);
                }, gameState.rules.nextQuestionDelay * 1000 || 2000);
            }
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
  
  // ⭐ createHostGame の定義を更新: isOpenMatch を受け取るようにする
  const createHostGame = useCallback(async (ruleSettings, hostPlayer, isOpenMatch = false) => {
    const newGameId = await createNewGameWithRandom4DigitId(ruleSettings, hostPlayer, isOpenMatch);
    setGameId(newGameId);
    return newGameId;
  }, []);

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

  // --- リアルタイムデータ同期 ---
  // ⭐ 修正: プレイヤーが揃ったら、問題ロードを開始するロジックに変更
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
  
  // ⭐ 追加: 問題ロード完了をトリガーとしてゲームを開始する
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