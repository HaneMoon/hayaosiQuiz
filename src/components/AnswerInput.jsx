// src/components/AnswerInput.js

import React, { useState, useEffect } from 'react'; 

const AnswerInput = ({ onBuzz, onSubmitAnswer, isMyTurn, isAnswerSelectable, options }) => {
  const [answer, setAnswer] = useState('');
  
  // デバッグログの強化: isAnswerSelectable と options の両方を確認
  useEffect(() => {
    console.log("[DEBUG: AnswerInput] Current isAnswerSelectable:", isAnswerSelectable);
    console.log("[DEBUG: AnswerInput] Current Options:", options);
  }, [isAnswerSelectable, options]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (isMyTurn) {
            // isAnswerSelectable は now useGame.js will correctly set it based on actual options
            if (!isAnswerSelectable && answer.trim()) { // If not selectable and input has text, submit
                onSubmitAnswer(answer);
                setAnswer('');
            }
            // If selectable, Enter should not submit the text input (handled by button click)
        } else {
            onBuzz(); 
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBuzz, isMyTurn, isAnswerSelectable, answer, onSubmitAnswer]);


  if (!isMyTurn) {
    return (
      <button onClick={onBuzz}>
        早押し (Enterキー)
      </button>
    );
  }
  
  // ⭐ options は useGame.js で既に配列に変換されているはず
  // ここでは options が有効な配列であることを確認するだけ
  const optionList = Array.isArray(options) ? options.filter(opt => opt && typeof opt === 'string' && opt.trim() !== '') : [];


  return (
    <div>
      {/* ⭐ isAnswerSelectable が true かつ optionList に要素がある場合に選択肢を表示 */}
      {isAnswerSelectable && optionList.length > 0 ? ( 
        <div>
          <p>選択肢を選んでください:</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {optionList.map((optText, index) => { // ⭐ optText を直接使用
                return (
                    <button 
                        key={index} 
                        onClick={() => {
                            onSubmitAnswer(optText); // 選択肢のテキストを解答として送信
                            setAnswer('');
                        }}
                        style={{ padding: '10px 15px', border: '1px solid #333', minWidth: '100px' }}
                    >
                        {optText} {/* ⭐ optText を表示 */}
                    </button>
                );
            })}
          </div>
        </div>
      ) : (
        // オプションが存在しない場合、または isAnswerSelectable が false の場合の記述式
        <div>
          <input 
            type="text" 
            placeholder="解答を入力..." 
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
            }}
          />
          <button 
            onClick={() => {
              if (answer.trim()) {
                onSubmitAnswer(answer);
                setAnswer('');
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