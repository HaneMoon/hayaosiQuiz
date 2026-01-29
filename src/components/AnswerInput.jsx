// src/components/AnswerInput.js

import React, { useState, useEffect } from 'react'; 

const AnswerInput = ({ onBuzz, onSubmitAnswer, isMyTurn, isAnswerSelectable, options }) => {
  const [answer, setAnswer] = useState('');
  
  useEffect(() => {
    console.log("[DEBUG: AnswerInput] Current isAnswerSelectable:", isAnswerSelectable);
    console.log("[DEBUG: AnswerInput] Current Options:", options);
  }, [isAnswerSelectable, options]);
  
  // Enterキーで操作できるようにする
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Enterキーが押されたら
      if (e.key === 'Enter') {
        // キーボードのデフォルト動作（フォーム送信など）を防止
        e.preventDefault(); 
        
        if (isMyTurn) {
            // 解答権がある場合: 
            // 選択肢がない(記述式)かつ入力がある、または選択肢式だがボタン操作をスキップしEnterでテキストを送信したい場合
            if (!isAnswerSelectable && answer.trim()) { 
                onSubmitAnswer(answer);
                setAnswer('');
            }
            // 選択肢式の場合はボタンクリックを推奨するため、Enterでは何もしない
            
        } else {
            //早押し待機中の場合: 早押しを実行
            onBuzz(); 
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBuzz, isMyTurn, isAnswerSelectable, answer, onSubmitAnswer]);


  // --- スタイル定義 ---
  const fixedButtonContainerStyle = {
    position: 'fixed', // 画面下部に固定
    bottom: '20px',    // 画面下端から20px上
    left: '50%',       // 横方向の中央
    transform: 'translateX(-50%)', // 中央揃え
    width: isMyTurn ? 'auto' : '80%', // 早押しボタンは広く、解答オプションは自動幅
    maxWidth: isMyTurn ? '90%' : '500px',
    display: 'flex',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '10px',
  };

  const largeButtonStyle = {
    padding: '30px 50px', 
    fontSize: '2.5em', 
    fontWeight: 'bold',
    borderRadius: '15px',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    transition: 'background-color 0.2s, transform 0.1s',
  };


  // --- レンダリング ---
  
  // 1. 早押しボタンの表示
  if (!isMyTurn) {
    return (
      <div style={fixedButtonContainerStyle}>
        <button 
          onClick={onBuzz} 
          style={{ 
            ...largeButtonStyle, 
            backgroundColor: '#ff0505ff', // Warningカラー
            color: '#ffffffff',
          }}
        >
        回答する
        </button>
      </div>
    );
  }
  
  // 2. 解答権がある場合の表示
  const optionList = Array.isArray(options) ? options.filter(opt => opt && typeof opt === 'string' && opt.trim() !== '') : [];


  return (
    <div style={fixedButtonContainerStyle}> {/* 固定コンテナを使用 */}
      {/* isAnswerSelectable が true かつ optionList に要素がある場合に選択肢を表示 */}
      {isAnswerSelectable && optionList.length > 0 ? ( 
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
          {optionList.map((optText, index) => { // optText を直接使用
              return (
                  <button 
                      key={index} 
                      onClick={() => {
                          onSubmitAnswer(optText); // 選択肢のテキストを解答として送信
                          setAnswer('');
                      }}
                      style={{ 
                          padding: '15px 25px', 
                          fontSize: '1.2em',
                          fontWeight: 'bold',
                          borderRadius: '10px',
                          border: '1px solid #007bff', 
                          backgroundColor: '#007bff', // Primaryカラー
                          color: 'white',
                          minWidth: '120px',
                          flexGrow: 1, // 均等幅を試みる
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      }}
                  >
                      {optText} {/* optText を表示 */}
                  </button>
              );
          })}
        </div>
      ) : (
        // オプションが存在しない場合、または isAnswerSelectable が false の場合の記述式
        // Enterキーでも送信できるようにロジックはuseEffectにあり、ここではボタンクリックを実装
        <div style={{ display: 'flex', width: '100%', maxWidth: '400px', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="解答を入力..." 
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            // Enterキーでの送信はuseEffectで処理されるため、ここではデフォルト動作のみ防止
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
            }}
            style={{ padding: '15px', fontSize: '1.2em', width: '100%', borderRadius: '8px', border: '2px solid #ccc' }}
          />
          <button 
            onClick={() => {
              if (answer.trim()) {
                onSubmitAnswer(answer);
                setAnswer('');
              }
            }}
            disabled={!answer.trim()}
            style={{ 
                ...largeButtonStyle, 
                padding: '15px 30px', 
                fontSize: '1.5em',
                backgroundColor: '#28a745', // Successカラー
                color: 'white',
                width: '100%',
            }}
          >
            解答を送信 (Enterキー)
          </button>
        </div>
      )}
    </div>
  );
};

export default AnswerInput;