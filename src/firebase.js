// src/firebase.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth,GoogleAuthProvider}from "firebase/auth"
import {getDatabase} from "firebase/database"
// ...

// Your web app's Firebase configuration
const firebaseConfig = {
  // 実際の設定値に置き換えてください
  apiKey: "AIzaSyAtudORGYTbg8wTDZ9p1ZHlZ_tFAwstL3U",
  authDomain: "hayaoshiquiz-8985f.firebaseapp.com",
  projectId: "hayaoshiquiz-8985f",
  storageBucket: "hayaoshiquiz-8985f.firebasestorage.app",
  messagingSenderId: "500037197124",
  appId: "1:500037197124:web:b7297d5387303ce13bcb11",
  databaseURL:"https://hayaoshiquiz-8985f-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 各インスタンスを取得
const auth=getAuth(app)
const provider=new GoogleAuthProvider();
const db =getDatabase(app); // Realtime Databaseのインスタンス名を 'db' に設定

// インスタンスをエクスポート
export {auth, provider, db};