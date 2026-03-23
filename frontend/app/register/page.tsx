"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clean API URL: Remove quotes if any and trailing slashes
    let apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/['"]/g, '');
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

    // Backend expects query parameters for register
    const queryParams = new URLSearchParams({
      username,
      email,
      password
    }).toString();

    const res = await fetch(`${apiUrl}/auth/register?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (res.ok) {
      router.push('/login');
    } else {
      const errorData = await res.json().catch(() => ({}));
      alert(errorData.detail || "Registration failed. Try again.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white px-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Create Account
        </h1>
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 bg-black border border-zinc-800 rounded-xl focus:border-purple-500 outline-none transition-all"
            required
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            Register
          </button>
        </form>
        <p className="text-center text-zinc-400 text-sm">
          Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}
