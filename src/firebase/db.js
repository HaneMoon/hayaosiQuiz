// src/db.js

// firebase.js で初期化された db インスタンスをインポート
import { db } from '../firebase'; 
import { ref, get, set, child } from 'firebase/database';


/**
 * 衝突しない数字4桁のランダムなIDを生成し、新しいゲームセッションを作成する。
 * @param {object} ruleSettings - 対戦ルール設定。
 * @param {object} hostPlayer - ホストプレイヤー情報 (id, name, score=0, isHost=true)。
 * @returns {Promise<string>} 生成された4桁のゲームID。
 */
const createNewGameWithRandom4DigitId = async (ruleSettings, hostPlayer) => {
  const gamesRef = ref(db, 'games'); // /games/ ノードへの参照
  let gameId = '';
  let isUnique = false;
  
  // IDがユニークになるまで繰り返す (衝突チェック)
  while (!isUnique) {
    // 1. 1000〜9999のランダムな4桁の数字を生成
    gameId = String(Math.floor(Math.random() * 9000) + 1000); 

    // 2. 衝突チェック：そのIDを持つノードが存在するか確認
    // child(gamesRef, gameId) で /games/{gameId} への参照を作成
    const snapshot = await get(child(gamesRef, gameId));

    if (!snapshot.exists()) {
      isUnique = true; // 存在しないのでユニーク
    } 
    // else: 既に存在するので、ループを継続し再試行
  }

  // 3. ユニークなIDで新しいゲームセッションを作成
  await set(child(gamesRef, gameId), {
    gameId: gameId,
    status: 'waiting', // 待機中
    rules: ruleSettings,
    players: {
      [hostPlayer.id]: hostPlayer,
    },
    currentQuestion: {
      questionId: null,
      state: 'idle'
    },
    createdAt: Date.now(),
  });

  console.log(`New game session created with ID: ${gameId}`);
  return gameId;
};

/**
 * 既存のゲームセッションにクライアントプレイヤーを追加する。
 * @param {string} gameId - 参加するゲームの4桁ID。
 * @param {object} clientPlayer - クライアントプレイヤー情報 (id, name, score=0, isHost=false)。
 * @returns {Promise<void>}
 */
const addClientToGame = async (gameId, clientPlayer) => {
  const playerRef = ref(db, `games/${gameId}/players/${clientPlayer.id}`);
  await set(playerRef, clientPlayer);
};


export { 
  db, // ★ useGame.jsからインポートできるように db インスタンスをエクスポート
  createNewGameWithRandom4DigitId,
  addClientToGame
};