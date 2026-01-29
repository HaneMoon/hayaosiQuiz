// src/pages/QuestionReview.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase/db';
import { ref, onValue, remove, update } from 'firebase/database';

const subjectNodeMap = {
    '国語': 'japanese',
    '数学': 'mathematics',
    '理科': 'science',
    '社会': 'social',
    '英語': 'english',
};

const japaneseSubjectMap = Object.entries(subjectNodeMap).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
}, {});

const EditForm = ({
    editingQuestion,
    editFormData,
    setEditFormData,
    handleUpdate,
    setEditingQuestion,
    editFormRef
}) => (
    <div
        ref={editFormRef}
        tabIndex="-1"
        className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4 outline-none"
    >
        <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4 border-b pb-2 text-indigo-600">
                問題編集 (ID: {editingQuestion.questionId})
            </h3>
            <form onSubmit={handleUpdate}>
                <div className="mb-3">
                    <label className="form-label font-semibold">問題文:</label>
                    <textarea
                        className="form-control"
                        rows="3"
                        required
                        value={editFormData.text}
                        onChange={(e) => setEditFormData({ ...editFormData, text: e.target.value })}
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label font-semibold">正解:</label>
                    <input
                        type="text"
                        className="form-control"
                        required
                        value={editFormData.answer}
                        onChange={(e) => setEditFormData({ ...editFormData, answer: e.target.value })}
                    />
                </div>
                <div className="mb-4">
                    <label className="form-label font-semibold">選択肢 ( / 区切りで入力):</label>
                    <input
                        type="text"
                        className="form-control"
                        value={editFormData.optionsString}
                        placeholder="例: 選択肢1 / 選択肢2 / 選択肢3 / 選択肢4"
                        onChange={(e) => setEditFormData({ ...editFormData, optionsString: e.target.value })}
                    />
                </div>

                <div className="d-flex justify-content-end space-x-3">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditingQuestion(null)}
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        className="btn btn-success"
                    >
                        <i className="bi bi-save me-1"></i> 更新を保存
                    </button>
                </div>
            </form>
        </div>
    </div>
);

const QuestionReview = () => {
    const [questions, setQuestions] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSubjectNode, setSelectedSubjectNode] = useState('all');
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    const editFormRef = useRef(null);

    useEffect(() => {
        const questionsRef = ref(db, 'questions');

        const unsubscribe = onValue(questionsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setQuestions(data);
            } else {
                setQuestions({});
            }
            setLoading(false);
        }, (err) => {
            console.error("[QuestionReview] Firebase fetch error:", err);
            setError("問題データの取得中にエラーが発生しました。");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const totalQuestionCount = useMemo(() => {
        if (!questions) return 0;
        let count = 0;
        Object.keys(questions).forEach(subjectNode => {
            const subjectQuestions = questions[subjectNode];
            if (subjectQuestions) {
                count += Object.keys(subjectQuestions).length;
            }
        });
        return count;
    }, [questions]);

    const filteredQuestions = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filtered = {};

        // 1. 教科フィルタを適用
        const nodesToFilter = selectedSubjectNode === 'all'
            ? Object.keys(questions)
            : Object.keys(questions).filter(node => node === selectedSubjectNode);

        nodesToFilter.forEach(subjectNode => {
            const subjectQuestions = questions[subjectNode];
            if (!subjectQuestions) return;

            const filteredInSubject = {};

            // 2. 検索フィルタを適用
            Object.entries(subjectQuestions).forEach(([questionId, q]) => {
                if (!lowerCaseSearchTerm) {
                    // 検索キーワードがない場合は全て含める
                    filteredInSubject[questionId] = q;
                } else if (q.text && q.text.toLowerCase().includes(lowerCaseSearchTerm)) {
                    // 問題文に検索キーワードが含まれていれば含める
                    filteredInSubject[questionId] = q;
                }
            });

            if (Object.keys(filteredInSubject).length > 0) {
                filtered[subjectNode] = filteredInSubject;
            }
        });

        return filtered;
    }, [questions, selectedSubjectNode, searchTerm]);

    // フィルタリング後の総問題数を再計算
    const filteredTotalCount = useMemo(() => {
        let count = 0;
        Object.values(filteredQuestions).forEach(subjectQuestions => {
            count += Object.keys(subjectQuestions).length;
        });
        return count;
    }, [filteredQuestions]);


    const handleEdit = (subjectNode, questionId, questionData) => {
        const optionsString = questionData.options && Array.isArray(questionData.options)
            ? questionData.options.map(opt => opt.text || opt).join(' / ')
            : '';

        setEditingQuestion({ subjectNode, questionId, data: questionData });
        setEditFormData({
            text: questionData.text || '',
            answer: questionData.answer || '',
            optionsString: optionsString,
        });
        requestAnimationFrame(() => {
            if (editFormRef.current) {
                editFormRef.current.focus();
            }
        });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editingQuestion) return;

        const { subjectNode, questionId } = editingQuestion;

        const updatedData = {
            text: editFormData.text,
            answer: editFormData.answer,
        };

        if (editFormData.optionsString) {
            const optionsArray = editFormData.optionsString.split(' / ')
                .map(text => text.trim())
                .filter(text => text.length > 0)
                .map(text => ({ text: text }));
            updatedData.options = optionsArray;
        } else {
            updatedData.options = [];
        }

        const questionRef = ref(db, `questions/${subjectNode}/${questionId}`);

        try {
            await update(questionRef, updatedData);

            setEditingQuestion(null);
            setEditFormData({});
            alert("問題が正常に更新されました。");

        } catch (err) {
            console.error(`[Update] Failed to update question ${questionId}:`, err);
            alert(`問題の更新に失敗しました: ${err.message}`);
        }
    };

    const handleDelete = async (subjectNode, questionId) => {
        if (!window.confirm(`本当にID「${questionId}」の問題を削除しますか？\n（この操作は元に戻せません）`)) {
            return;
        }

        const questionRef = ref(db, `questions/${subjectNode}/${questionId}`);

        try {
            await remove(questionRef);
            console.log(`[Delete] Question ${questionId} from ${subjectNode} successfully deleted.`);
        } catch (err) {
            console.error(`[Delete] Failed to delete question ${questionId}:`, err);
            alert(`問題の削除に失敗しました: ${err.message}`);
        }
    };

    if (loading) {
        // ... (省略)
    }

    if (error) {
        return <div className="alert alert-danger p-4 shadow-lg">エラー: {error}</div>;
    }

    const hasQuestions = totalQuestionCount > 0;

    return (
        <div className="container mt-3">
            <div className="text-center">問題確認・削除ページ</div>
            <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white shadow-lg">
                <label htmlFor="search-term" className="block text-md font-medium text-gray-700 mb-2">
                    問題文で検索:
                </label>
                <input
                    id="search-term"
                    type="text"
                    placeholder="検索キーワードを入力してください..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-control w-full pl-3 pr-10 py-2 border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm"
                />
            </div>

            {/* 教科選択ドロップダウンの追加 */}
            <div className="mb-8 p-4 border border-gray-300 rounded-lg bg-white shadow-lg">
                <select
                    id="subject-select"
                    value={selectedSubjectNode}
                    onChange={(e) => setSelectedSubjectNode(e.target.value)}
                    className="form-select mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm bg-white"
                >
                    <option value="all">全ての教科 ({totalQuestionCount} 問)</option>
                    {Object.entries(subjectNodeMap).map(([japaneseName, nodeName]) => {
                        const count = questions[nodeName] ? Object.keys(questions[nodeName]).length : 0;
                        if (count === 0 && selectedSubjectNode !== nodeName) return null;

                        return (
                            <option key={nodeName} value={nodeName}>
                                {japaneseName} ({count} 問)
                            </option>
                        );
                    })}
                </select>
            </div>
            {/* --------------------- */}

            {!hasQuestions ? (
                <div className="alert alert-warning text-center p-4 shadow-md bg-yellow-100 border-yellow-400">
                    <i className="bi bi-info-circle me-2"></i>
                    問題を取得中です。
                </div>
            ) : (
                <>
                    <div className="text-center">
                        {searchTerm ? `検索結果: ${filteredTotalCount} 件` : `表示中の問題数: ${filteredTotalCount} 件`}
                    </div>

                    <div className="space-y-8">
                        {Object.keys(filteredQuestions) // 💡 filteredQuestionsのキーを使用
                            .sort((a, b) => {
                                const nameA = japaneseSubjectMap[a] || a;
                                const nameB = japaneseSubjectMap[b] || b;
                                return nameA.localeCompare(nameB, 'ja');
                            })
                            .map((subjectNode) => {
                                const subjectName = japaneseSubjectMap[subjectNode] || subjectNode;
                                const subjectQuestions = filteredQuestions[subjectNode]; // 💡 フィルタリング後のデータ
                                const questionList = Object.entries(subjectQuestions); // フィルタリング後のデータは既にオブジェクト

                                return (
                                    <div key={subjectNode} className="p-6 border-2 border-indigo-200 rounded-xl shadow-xl bg-white transition duration-300 hover:shadow-2xl">
                                        <h3 className="text-2xl font-bold mb-4 text-indigo-700 border-b-2 border-indigo-400 pb-2">
                                            {subjectName} ({questionList.length} 問)
                                        </h3>
                                        <ul className="space-y-4">
                                            {questionList.map(([questionId, q]) => {

                                                const optionsText = q.options && Array.isArray(q.options)
                                                    ? q.options.map(opt => opt.text || opt).join(' / ')
                                                    : 'なし';

                                                return (
                                                    <li key={questionId} className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition duration-150">
                                                        <div className="flex-grow me-md-4 mb-3 mb-md-0">
                                                            <div className="d-flex align-items-center mb-1">
                                                                <span className="badge bg-secondary me-3 text-sm font-mono">ID: {questionId}</span>
                                                            </div>
                                                            
                                                            <strong className="text-lg text-gray-900">
                                                                {q.text?.substring(0, 70) + (q.text?.length > 70 ? '...' : '')}
                                                            </strong>
                                                            
                                                            <div className="text-sm text-gray-600 space-y-1 ps-5">
                                                                <p>
                                                                    <span className="font-semibold text-green-700">正解: </span>
                                                                    <span className="font-bold">{q.answer}</span>
                                                                </p>
                                                                <p>
                                                                    <span className="font-semibold">選択肢: </span>
                                                                    {optionsText}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="d-flex space-x-2">
                                                            <button
                                                                className="btn btn-primary btn-sm shadow-md transition duration-150 hover:scale-105"
                                                                onClick={() => handleEdit(subjectNode, questionId, q)}
                                                            >
                                                                <i className="bi bi-pencil-fill me-1"></i> 編集
                                                            </button>
                                                            <button
                                                                className="btn btn-danger btn-sm shadow-md transition duration-150 hover:scale-105"
                                                                onClick={() => handleDelete(subjectNode, questionId)}
                                                            >
                                                                <i className="bi bi-trash-fill me-1"></i> 削除
                                                            </button>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            })}
                    </div>
                </>
            )}

            {/* 編集中の問題がある場合のみフォームを表示 */}
            {editingQuestion && (
                <EditForm
                    editingQuestion={editingQuestion}
                    editFormData={editFormData}
                    setEditFormData={setEditFormData}
                    handleUpdate={handleUpdate}
                    setEditingQuestion={setEditingQuestion}
                    editFormRef={editFormRef}
                />
            )}

        </div>
    );
};

export default QuestionReview;