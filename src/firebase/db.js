// src/db.js

// firebase.js で初期化された db インスタンスをインポート
import { db } from '../firebase'; 
import { ref, get, set, child } from 'firebase/database';
// ⭐ Firebase Query のインポートを追加
import { query, orderByChild, equalTo, limitToFirst } from 'firebase/database';


/**
 * 衝突しない数字4桁のランダムなIDを生成し、新しいゲームセッションを作成する。
 * @param {object} ruleSettings - 対戦ルール設定。
 * @param {object} hostPlayer - ホストプレイヤー情報 (id, name, score=0, isHost=true)。
 * @param {boolean} isOpenMatch - オープンマッチングの部屋かどうか ⭐ 追加
 * @returns {Promise<string>} 生成された4桁のゲームID。
 */
const createNewGameWithRandom4DigitId = async (ruleSettings, hostPlayer, isOpenMatch = false) => { // ⭐ isOpenMatch パラメータを追加
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
    // ⭐ isOpenMatch フラグを追加
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
 * 既存のゲームセッションにクライアントプレイヤーを追加する。
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
 * * @param {object} ruleSettings - 新規作成時のデフォルトルール設定。
 * @param {object} clientPlayer - プレイヤー情報 (id, name, score=0, isHost=false)。
 * @returns {Promise<string>} 参加または作成したゲームのID。
 */
const findOrCreateOpenGame = async (ruleSettings, clientPlayer) => {
  const gamesRef = ref(db, 'games');
  
  // 1. 空いているオープンマッチの部屋を検索 (status='waiting' かつ players数が1人)
  // ⭐ クエリ: status が 'waiting' のもの
  const openGamesQuery = query(
    gamesRef,
    orderByChild('status'),
    equalTo('waiting'),
    limitToFirst(10) // 効率化のため、最初の10件だけ取得
  );

  console.log("空いているオープンマッチの部屋を検索中...");
  
  const snapshot = await get(openGamesQuery);
  let availableGameId = null;

  if (snapshot.exists()) {
    const games = snapshot.val();
    
    // 取得したゲームの中から、'waiting' かつ 'isOpenMatch' が true で、プレイヤー数が1人の部屋を探す
    for (const gameId in games) {
      const game = games[gameId];
      const playerCount = Object.keys(game.players || {}).length;
      
      if (game.isOpenMatch === true && playerCount === 1) {
        availableGameId = gameId;
        console.log(`[Success] 空いているオープン部屋を発見: ${availableGameId}`);
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
    console.log("[Info] 空いているオープン部屋が見つかりませんでした。新しい部屋を作成します。");
    
    // クライアントプレイヤー情報をホストプレイヤー情報に変換
    const hostPlayer = { 
      ...clientPlayer, 
      isHost: true // 部屋を作成するのでホストになる
    }; 
    
    // 新しいオープンマッチング用の部屋を作成
    const newGameId = await createNewGameWithRandom4DigitId(
      ruleSettings, 
      hostPlayer, 
      true // isOpenMatch = true
    );
    
    return newGameId;
  }
};


export { 
  db, 
  createNewGameWithRandom4DigitId,
  addClientToGame,
  // ⭐ findOrCreateOpenGame をエクスポート
  findOrCreateOpenGame,
};