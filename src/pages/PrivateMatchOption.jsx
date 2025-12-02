// src/pages/PrivateMatchOptions.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivateMatchOptions = () => {
    const navigate = useNavigate();

    const containerStyle = {
        textAlign: 'center',
        padding: '40px',
        maxWidth: '500px',
        margin: '0 auto',
        border: '1px solid #ddd',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    };
    
    const buttonStyle = {
        padding: '15px 30px',
        fontSize: '1.2em',
        margin: '10px 0',
        cursor: 'pointer',
        border: 'none',
        borderRadius: '8px',
        width: '100%',
        transition: 'background-color 0.3s',
        maxWidth: '350px',
    };

    // ホストとして設定へ遷移
    const handleHost = () => {
        // Settings 画面へ遷移し、そこで設定完了後に Matchmaking (ホストモード) へ遷移する
        navigate('/settings', { state: { role: 'host' } });
    };

    // クライアントとして直接参加画面へ遷移
    const handleClient = () => {
        // Matchmaking 画面へ遷移し、クライアントモードで部屋ID入力を表示する
        navigate('/matchmaking', { state: { type: 'private', role: 'client' } });
    };

    return (
        <div style={containerStyle}>
            <h2>プライベートマッチ</h2>
            <p style={{ marginBottom: '40px', color: '#555' }}>あなたの役割を選択してください。</p>

            {/* 1. ホストとして設定 */}
            <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #28a745', borderRadius: '8px' }}>
                <h3>ホストとして部屋を作成</h3>
                <p style={{ color: '#555' }}>ルールを設定し、対戦相手の参加を待ちます。</p>
                <button 
                    onClick={handleHost} 
                    style={{ ...buttonStyle, backgroundColor: '#28a745', color: 'white' }}
                >
                    設定へ進む
                </button>
            </div>

            {/* 2. クライアントとして参加 */}
            <div style={{ padding: '15px', border: '1px solid #ffc107', borderRadius: '8px' }}>
                <h3>クライアントとして部屋に参加</h3>
                <p style={{ color: '#555' }}>ホストから教えてもらった部屋番号を入力。</p>
                <button 
                    onClick={handleClient} 
                    style={{ ...buttonStyle, backgroundColor: '#ffc107', color: '#333' }}
                >
                    部屋番号入力へ進む
                </button>
            </div>

            <button 
                onClick={() => navigate('/')} 
                style={{ marginTop: '30px', padding: '10px 20px', fontSize: '1em', cursor: 'pointer', backgroundColor: '#ddd', border: 'none', borderRadius: '5px' }}
            >
                &lt; 戻る
            </button>
        </div>
    );
};

export default PrivateMatchOptions;