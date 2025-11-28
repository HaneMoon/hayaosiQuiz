// src/components/QuestionDisplay.js

import React, { useState, useEffect } from 'react';

const QuestionDisplay = ({ questionText, isBuzzing, isAnswered }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!questionText) return;

    // 早押しボタンが押された、または解答済みなら表示を停止
    if (isBuzzing || isAnswered || currentIndex >= questionText.length) {
      return;
    }

    // 問題を一文字ずつ表示していくタイマー [cite: 28]
    const timer = setInterval(() => {
      setCurrentIndex(prevIndex => prevIndex + 1);
    }, 50); // 50ms ごとに1文字追加 (表示速度の調整)

    return () => clearInterval(timer);
  }, [questionText, isBuzzing, isAnswered, currentIndex]);

  useEffect(() => {
    // currentIndex が更新されたら displayedText を更新
    setDisplayedText(questionText.substring(0, currentIndex));
  }, [currentIndex, questionText]);


  return (
    <div style={{ border: '2px solid #ccc', padding: '20px', minHeight: '100px' }}>
      <p style={{ fontSize: '1.5em', minHeight: '40px' }}>
        {/* 誰かがボタンを押した時点で、表示されている部分までを表示 [cite: 28] */}
        {isBuzzing ? questionText.substring(0, currentIndex) : displayedText}
      </p>
    </div>
  );
};

export default QuestionDisplay;2