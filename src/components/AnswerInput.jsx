// src/components/AnswerInput.js

import React, { useState, useEffect } from 'react'; 

const AnswerInput = ({ onBuzz, onSubmitAnswer, isMyTurn, isAnswerSelectable, options }) => {
  // 入力フィールドの状態管理
  const [answer, setAnswer] = useState('');
  // --- 早押しボタン処理 (キーボード入力対応) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // エンターキーで早押し
      if (e.key === 'Enter') {
        // 解答権がある状態でのEnterキーは解答送信として扱う
        if (isMyTurn) {
            // 選択式でなければ、解答を送信
            if (!isAnswerSelectable && answer.trim()) {
                onSubmitAnswer(answer);
                setAnswer(''); // 送信後クリア
            }
        } else {
            // 解答権がない状態でのEnterキーは早押しとして扱う
            onBuzz(); 
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBuzz, isMyTurn, isAnswerSelectable, answer, onSubmitAnswer]);


  // --- 解答入力/選択処理 ---
  if (!isMyTurn) {
    // 解答権がない、または早押し済みでない場合
    return (
      <button onClick={onBuzz}>
        早押し (Enterキー)
      </button>
    );
  }

  // 解答権がある場合
  return (
    <div>
      {/* 選択形式の回答 */}
      {isAnswerSelectable && options ? (
        <div>
          <p>選択肢を選んでください:</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {options.map((opt, index) => (
                <button 
                    key={index} 
                    onClick={() => {
                        onSubmitAnswer(opt.text); // 選択肢のテキストを解答として送信
                        setAnswer('');
                    }}
                    style={{ padding: '10px 15px', border: '1px solid #333' }}
                >
                    {opt.text}
                </button>
            ))}
          </div>
        </div>
      ) : (
        // 基本の記述式回答
        <div>
          <input 
            type="text" 
            placeholder="解答を入力..." 
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
                // Enterキーでの解答送信はuseEffectで処理される
                if (e.key === 'Enter') e.preventDefault();
            }}
          />
          <button 
            onClick={() => {
              if (answer.trim()) {
                onSubmitAnswer(answer);
                setAnswer(''); // 送信後クリア
              }
            }}
            disabled={!answer.trim()}
          >
            解答を送信
          </button>
        </div>
      )}
    </div>
  );
};

export default AnswerInput;