// src/db.js

// firebase.js で初期化された db インスタンスをインポート
import { db } from '../firebase'; 
import { ref, get, set, child } from 'firebase/database';

import { query, orderByChild, equalTo, limitToFirst } from 'firebase/database';


/**
 * ランダムなIDを生成し、新しいゲームセッションを作成する。
 * @param {object} ruleSettings 
 * @param {object} hostPlayer 
 * @param {boolean} isOpenMatch 
 * @returns {Promise<string>} 生成された4桁のゲームID。
 */
const createNewGameWithRandom4DigitId = async (ruleSettings, hostPlayer, isOpenMatch = false) => { 
  const gamesRef = ref(db, 'games'); 
  let gameId = '';
  let isUnique = false;
  
  // IDがかぶらないようにする
  while (!isUnique) {
    // 1. 1000〜9999のランダムな4桁の数字を生成
    gameId = String(Math.floor(Math.random() * 9000) + 1000); 

    // 作ったIDを持つノードが存在するか確認
    const snapshot = await get(child(gamesRef, gameId));

    if (!snapshot.exists()) {
      isUnique = true; 
    } 
  }

  await set(child(gamesRef, gameId), {
    gameId: gameId,
    status: 'waiting',
    rules: ruleSettings,
    players: {
      [hostPlayer.id]: hostPlayer,
    },
    isOpenMatch: isOpenMatch,
    currentQuestion: {
      questionId: null,
      state: 'idle'
    },
    createdAt: Date.now(),
  });

  console.log(`New game session created with ID: ${gameId} (Open: ${isOpenMatch})`);
  return gameId;
};

/**
 * 既存のゲームセッションにクライアントプレイヤーをする。
 * @param {string} gameId - 参加するゲームの4桁ID。
 * @param {object} clientPlayer - クライアントプレイヤー情報 (id, name, score=0, isHost=false)。
 * @returns {Promise<void>}
 */
const addClientToGame = async (gameId, clientPlayer) => {
  const playerRef = ref(db, `games/${gameId}/players/${clientPlayer.id}`);
  await set(playerRef, clientPlayer);
};

/**
 * オープンマッチング用に、空いている部屋を検索し、見つからなければ新しく作成する。
 * * @param {object} ruleSettings
 * @param {object} clientPlayer
 * @returns {Promise<string>}
 */
const findOrCreateOpenGame = async (ruleSettings, clientPlayer) => {
  const gamesRef = ref(db, 'games');
  
  // 1. 空いているオープンマッチの部屋を検索
  const openGamesQuery = query(
    gamesRef,
    orderByChild('status'),
    equalTo('waiting'),
    limitToFirst(10) 
  );

  console.log("空いているオープンマッチの部屋を検索中 (条件: status='waiting')...");
  
  const snapshot = await get(openGamesQuery);
  let availableGameId = null;

  if (snapshot.exists()) {
    const games = snapshot.val();
    
    for (const gameId in games) {
      const game = games[gameId];
      const playerCount = Object.keys(game.players || {}).length;
      if (game.isOpenMatch === true && playerCount === 1) {
        availableGameId = gameId;
        break;
      }
    }
  }

  // 2. 空いている部屋が見つかった場合、参加する
  if (availableGameId) {
    await addClientToGame(availableGameId, clientPlayer);
    return availableGameId;

  } else {
    // 3. 空いている部屋が見つからなかった場合、新しく部屋を作成し、ホストになる  
    const hostPlayer = { 
      ...clientPlayer, 
      isHost: true 
    }; 
    
    // 新しいオープンマッチング用の部屋を作成
    const newGameId = await createNewGameWithRandom4DigitId(
      ruleSettings, 
      hostPlayer, 
      true 
    );
    
    return newGameId;
  }
};


export { 
  db, 
  createNewGameWithRandom4DigitId,
  addClientToGame,
  findOrCreateOpenGame,
};