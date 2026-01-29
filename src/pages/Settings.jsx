// src/pages/Settings.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_RULES, SUBJECTS, GRADES } from "../utils/constants";

const Settings = ({ onRulesConfirmed }) => {
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [selectedSubjects, setSelectedSubjects] = useState(SUBJECTS);
  const [selectedGrades] = useState(GRADES);

  const navigate = useNavigate();

  const handleRuleChange = (key, value) => {
    setRules((prev) => ({ ...prev, [key]: Number(value) || value }));
  };

  const handleSubjectToggle = (subject) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  // マッチング画面へ遷移する（ホストのみがこの画面を使用）
  const handleSubmit = () => {
    if (selectedSubjects.length === 0) {
      alert("最低1つ教科を選択してください。");
      return;
    }

    const settings = {
      rules,
      range: {
        subjects: selectedSubjects,
        grades: selectedGrades,
      },
    };

    onRulesConfirmed(settings);

    //  設定完了後、Matchmaking画面へ自動遷移し、タイプ='private'、役割='host'を渡す
    navigate("/matchmaking", { state: { type: "private", role: "host" } });
  };

  return (
    <div>
      <h2>対戦ルール設定と範囲選択</h2>

      {/* 1. 対戦ルール設定 */}
      <h3>対戦ルール</h3>
      <div>
        <label>勝利点 (デフォルト: 8点):</label>
        <input
          type="number"
          value={rules.winPoints}
          onChange={(e) => handleRuleChange("winPoints", e.target.value)}
        />
        <br />
        <label>誤答ペナルティ:</label>
        <select
          value={rules.wrongAnswerPenalty}
          onChange={(e) =>
            handleRuleChange("wrongAnswerPenalty", e.target.value)
          }
        >
          <option value="lockout">その問題に答えられなくなる</option>
          <option value="minus_one">1点減点</option>
        </select>
        {/* 他のルール設定（出題数、同時押し人数など）をここに追加 */}
      </div>

      <hr />

      {/* 2. 教科などの範囲選択 */}
      <h3>出題範囲 (義務教育9年間)</h3>
      <div>
        <h4>教科 (複数選択可)</h4>
        {SUBJECTS.map((subject) => (
          <label key={subject}>
            <input
              type="checkbox"
              checked={selectedSubjects.includes(subject)}
              onChange={() => handleSubjectToggle(subject)}
            />
            {subject}
          </label>
        ))}
      </div>
      <div></div>

      <button onClick={handleSubmit}>設定を確定してマッチングへ</button>
    </div>
  );
};

export default Settings;
