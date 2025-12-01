// src/utils/constants.js

export const DEFAULT_RULES = {
  winPoints: 8,                  // 勝利点: 基本は8ポイントで勝ち
  maxPlayers: 2,                 // 参加人数 (1対1を基本としつつ、できれば複数人対応)
  simultaneousPress: 1,          // 何人押せるか (1対1なら1人)
  wrongAnswerPenalty: 'minus_one', // 誤答ペナルティ ('none', 'lockout', 'minus_one')
  totalQuestions: 10,            // 1試合の出題数
  nextQuestionDelay: 3,          // 問題を読み終えて次の問題に行くまでの時間（秒）
};

// 選択できる範囲
export const SUBJECTS = ['国語', '数学', '理科', '社会', '英語']; 
export const GRADES = ['小1', '小2', '小3', '小4', '小5', '小6', '中1', '中2', '中3']; // 義務教育9年間


// --- 問題データサンプル (すべて選択式に修正) ---
export const QUIZ_QUESTIONS = [
  {
    id: 1,
    text: "太陽系の惑星の中で、最も大きく、表面に有名な大赤斑を持つガス惑星は何でしょう？",
    answer: "木星",
    subject: "理科",
    grade: "中3", // 修正: '3年' -> '中3'
    isSelectable: true, 
    options: ["土星", "火星", "木星", "天王星"], 
  },
  {
    id: 2,
    text: "日本の憲法で定められている、国民の三大義務のうち、教育を受けさせる義務、勤労の義務とあと一つは何でしょう？",
    answer: "納税の義務",
    subject: "社会",
    grade: "中3", // 修正: '3年' -> '中3'
    isSelectable: true, 
    options: ["納税の義務", "兵役の義務", "家族を扶養する義務", "環境を守る義務"], 
  },
  {
    id: 3,
    text: "英文で、「私は医者です」という意味になるように、 I am a ( ) の ( ) に入る単語はどれでしょう？",
    answer: "doctor",
    subject: "英語",
    grade: "中1", // 修正: '1年' -> '中1'
    isSelectable: true, 
    options: ["student", "teacher", "doctor", "firefighter"],
  },
  {
    id: 4,
    text: "二次方程式 $x^2 - 5x + 6 = 0$ の解は、次のうちどれでしょう？",
    answer: "x=2, 3",
    subject: "数学",
    grade: "中3", // 修正: '3年' -> '中3'
    isSelectable: true, 
    options: ["x=-2, -3", "x=1, 6", "x=2, 3", "x=-1, 5"],
  },
];