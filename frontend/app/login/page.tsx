"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    // Clean API URL: Remove quotes (start/end) and any trailing slashes
    let apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\/+$/, '');

    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      router.push('/chat');
    } else {
      alert("Invalid credentials.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white px-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
        <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Query Vault 2.0
            </h1>
            <p className="mt-2 text-zinc-400">Welcome back, Please login.</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 bg-black border border-zinc-800 rounded-xl focus:border-purple-500 outline-none transition-all"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-black border border-zinc-800 rounded-xl focus:border-purple-500 outline-none transition-all"
            required
          />
          <button
            type="submit"
            className="w-full p-3 bg-gradient-to-r from-purple-600 to-blue-600 font-semibold rounded-xl hover:opacity-90 transition-all"
          >
            Sign In
          </button>
        </form>
        
        <p className="text-center text-zinc-400 text-sm">
          Don&apos;t have an account? <Link href="/register" className="text-blue-400 hover:underline">Register now</Link>
        </p>
      </div>
    </div>
  );
}
