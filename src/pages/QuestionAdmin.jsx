import React, { useState } from 'react';
import { ref, set, push } from 'firebase/database';
import { db } from '../firebase/db'; // Firebase DBインスタンスをインポート
import { SUBJECTS, GRADES } from '../utils/constants'; // 定数をインポート

const QuestionAdmin = () => {
  const [questionData, setQuestionData] = useState({
    subject: SUBJECTS[0] || '国語',
    grade: GRADES[0] || '小1',
    type: '選択式',
    text: '',
    answer: '',
    explanation: '',
    options: [], // { text: '', isCorrect: false } の配列
  });
  const [message, setMessage] = useState('');

  // 選択肢の状態管理 (選択肢を動的に追加・削除するため)
  const [optionInputs, setOptionInputs] = useState(['', '', '', '']); 
  const [correctIndex, setCorrectIndex] = useState(null);

  // --- 入力値の変更ハンドラ ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setQuestionData(prev => ({ ...prev, [name]: value }));
  };

  // --- 選択肢の入力ハンドラ ---
  const handleOptionChange = (index, value) => {
    const newOptions = [...optionInputs];
    newOptions[index] = value;
    setOptionInputs(newOptions);
  };

  // --- データのバリデーションと整形 ---
  const validateAndFormatData = () => {
    //  修正点: questionData を直接操作せず、コピーを作成 (dataToSave)
    let dataToSave = { ...questionData };
    
    if (!dataToSave.text || !dataToSave.subject) {
      setMessage('問題文、解答、教科は必須です。');
      return null;
    }

    let finalOptions = [];

    if (dataToSave.type === '選択式') {
      // 選択式の場合、選択肢のバリデーションを行う
      const filledOptions = optionInputs.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2) {
         setMessage('選択式の場合、最低2つの選択肢が必要です。');
         return null;
      }
      
      finalOptions = optionInputs.map((text, index) => ({
        text: text,
        isCorrect: index === correctIndex
      }));
      
      // 正しい解答を answer フィールドにも設定
      const correctOption = finalOptions.find(opt => opt.isCorrect);
      if (correctOption) {
        //  修正点: コピーしたオブジェクトのプロパティを変更する
        dataToSave.answer = correctOption.text; 
      } else {
         setMessage('選択式の場合、正しい解答の指定が必要です。');
         return null;
      }
      dataToSave.options = finalOptions;

    } else {
        // 知識/記述問題の場合も解答が必須
        if (!dataToSave.answer) {
             setMessage('知識/記述/計算問題の場合、解答は必須です。');
             return null;
        }
    }

    return {
      ...dataToSave,
      // Firebaseに保存するときに、IDはpush()で自動生成される
      createdAt: Date.now(),
    };
  };

  // --- 問題の保存処理 ---
  const handleSaveQuestion = async () => {
    const dataToSave = validateAndFormatData();
    if (!dataToSave) return;

    setMessage('問題を保存中...');

    // 選択された教科名 (例: '国語') を英語のノード名 (例: 'japanese') に変換
    const subjectNodeMap = {
      '国語': 'japanese',
      '数学': 'mathematics',
      '理科': 'science',
      '社会': 'social',
      '英語': 'english',
    };
    const subjectNode = subjectNodeMap[dataToSave.subject] || dataToSave.subject.toLowerCase();

    try {
      // /questions/{subjectNode}/ に新しい問題ノードを push で作成
      const questionsRef = ref(db, `questions/${subjectNode}`);
      const newQuestionRef = push(questionsRef);
      
      await set(newQuestionRef, {
        ...dataToSave, // 既にanswerが設定された整形済みデータ
        questionId: newQuestionRef.key // 自動生成されたキーをIDとして格納
      });

      setMessage(`問題が正常に保存されました！ ID: ${newQuestionRef.key}`);
      
      // フォームをクリア（状態をリセット）
      setQuestionData(prev => ({
        subject: prev.subject, // 教科はそのまま残す
        grade: prev.grade,     // 学年もそのまま残す
        type: prev.type,       // 形式もそのまま残す
        text: '', 
        answer: '', 
        explanation: '',
        options: [],
      }));
      setOptionInputs(['', '', '', '']);
      setCorrectIndex(null);

    } catch (error) {
      console.error("問題の保存エラー:", error);
      setMessage(`問題の保存に失敗しました: ${error.message}`);
    }
  };


  return (
    <div className="container mt-4">
      <div className="text-center">問題データ管理ページ</div> 
      <div className="card p-3 mb-4">
        <div className="row g-3">
          {/* 教科選択 */}
          <div className="col-md-4">
            <label className="form-label">教科</label>
            <select 
              className="form-select" 
              name="subject" 
              value={questionData.subject} 
              onChange={handleChange}
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          {/* 学年選択 */}
          <div className="col-md-4">
            <label className="form-label">学年</label>
            <select 
              className="form-select" 
              name="grade" 
              value={questionData.grade} 
              onChange={handleChange}
            >
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* 問題形式 */}
          <div className="col-md-4">
            <label className="form-label">問題形式</label>
            <select 
              className="form-select" 
              name="type" 
              value={questionData.type} 
              onChange={handleChange}
            >
              <option value="知識">記述式</option>
              <option value="選択式">選択式 (4択問題)</option>
            </select>
          </div>
        </div>

        {/* 問題文 */}
        <div className="mb-3 mt-3">
          <label className="form-label">問題文</label>
          <textarea 
            className="form-control" 
            name="text" 
            rows="3" 
            value={questionData.text} 
            onChange={handleChange} 
            placeholder="ここに問題文を入力"
          ></textarea>
        </div>
        
        {/* 解答 (選択式でない場合のみ表示) */}
        {questionData.type !== '選択式' && (
          <div className="mb-3">
            <label className="form-label">解答 (一言一句合わないと正解しないので考えて入力してね)</label>
            <input 
              type="text" 
              className="form-control" 
              name="answer" 
              value={questionData.answer} 
              onChange={handleChange} 
              placeholder="例: x=5, 五段活用"
            />
          </div>
        )}

        {/* 選択肢の入力 (選択式の場合のみ表示) */}
        {questionData.type === '選択式' && (
          <div className="mb-3 card p-3 bg-light">
            <h4 className="card-title">選択肢の設定</h4>
            {optionInputs.map((opt, index) => (
              <div key={index} className="input-group mb-2">
                <div className="input-group-text">
                  <input 
                    className="form-check-input mt-0" 
                    type="radio" 
                    name="correctOption"
                    checked={correctIndex === index}
                    onChange={() => setCorrectIndex(index)}
                  />
                </div>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder={`選択肢 ${index + 1}`}
                  value={opt}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                />
              </div>
            ))}
            <p className="text-danger small">※左のラジオボタンで正解の選択肢を指定してください。</p>
            <p className="text-danger small">選択肢は出題時にシャッフルされるので順番は関係ないです</p>
          </div>
        )}

        {/* 解説 */}
        <div className="mb-3">
          <label className="form-label">解説 (任意)</label>
          <textarea 
            className="form-control" 
            name="explanation" 
            rows="2" 
            value={questionData.explanation} 
            onChange={handleChange} 
            placeholder="正解の根拠や補足説明を入力"
          ></textarea>
        </div>

        <button 
          onClick={handleSaveQuestion} 
          className="btn btn-primary btn-lg mt-3"
        >
          問題を保存
        </button>
        
        {message && <p className={`mt-3 alert ${message.includes('成功') ? 'alert-success' : 'alert-danger'}`}>{message}</p>}
      </div>
    </div>
  );
};

export default QuestionAdmin;