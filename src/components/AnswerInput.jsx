// src/components/AnswerInput.js

import React, { useEffect } from 'react';

const AnswerInput = ({ onBuzz, onSubmitAnswer, isMyTurn, isAnswerSelectable }) => {
  
  // --- 早押しボタン処理 (キーボード入力対応) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 基本はキーボード入力 [cite: 29]
      // エンターキーなど特定のキーを押してもいい [cite: 32]
      if (e.key === 'Enter') {
        onBuzz(); // 親コンポーネント (Game.js) の早押し関数を呼び出す
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBuzz]);


  // --- 解答入力/選択処理 ---
  if (!isMyTurn) {
    return (
      <button onClick={onBuzz} disabled={isMyTurn}>
        早押し (Enterキー)
      </button>
    );
  }

  return (
    <div>
      {/* 選択形式の回答 [cite: 21, 30] */}
      {isAnswerSelectable ? (
        <div>
          <p>選択肢を選んでください:</p>
          {/* 選択肢をマップ表示するロジック（ここでは省略） */}
          <button onClick={() => onSubmitAnswer('Answer A')}>選択肢A</button>
          <button onClick={() => onSubmitAnswer('Answer B')}>選択肢B</button>
        </div>
      ) : (
        // 基本の記述式回答（ここでは簡単のためボタンで代替）
        <div>
          <input type="text" placeholder="解答を入力..." />
          <button onClick={() => onSubmitAnswer('User Answer')}>送信</button>
        </div>
      )}
    </div>
  );
};

export default AnswerInput;