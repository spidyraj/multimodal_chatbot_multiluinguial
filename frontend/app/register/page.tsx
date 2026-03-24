"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: 'Very Weak', color: 'bg-zinc-800' });
  const router = useRouter();

  const checkStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pass)) score++;
    if (/[A-Z]/.test(pass)) score++;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-cyan-500'];
    
    setPasswordStrength({
      score: score,
      label: pass.length === 0 ? 'Too Short' : labels[score],
      color: pass.length === 0 ? 'bg-zinc-800' : colors[score]
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    checkStrength(val);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clean API URL: Remove quotes (start/end) and any trailing slashes
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\/+$/, '');

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
          
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              className="w-full p-3 bg-black border border-zinc-800 rounded-xl focus:border-purple-500 outline-none transition-all"
              required
            />
            
            {/* STRENGTH METER */}
            {password.length > 0 && (
              <div className="px-1 space-y-1.5">
                <div className="flex justify-between items-center px-0.5">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Strength: {passwordStrength.label}</span>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((s) => (
                      <div key={s} className={`h-1 w-6 rounded-full transition-all duration-500 ${s < passwordStrength.score ? passwordStrength.color : 'bg-zinc-800'}`} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <Requirement met={password.length >= 8} label="8+ Characters" />
                  <Requirement met={/[0-9]/.test(password)} label="1 Number" />
                  <Requirement met={/[!@#$%^&*(),.?":{}|<>]/.test(password)} label="1 Special Char" />
                  <Requirement met={/[A-Z]/.test(password)} label="1 Uppercase" />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={passwordStrength.score < 3}
            className={`w-full p-3 font-semibold rounded-xl transition-all shadow-lg ${
              passwordStrength.score < 3 
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50' 
              : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            Create Account
          </button>
        </form>
        <p className="text-center text-zinc-400 text-sm">
          Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}

function Requirement({ met, label }: { met: boolean, label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors ${met ? 'text-emerald-400' : 'text-zinc-600'}`}>
      <div className={`w-1 h-1 rounded-full ${met ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-700'}`} />
      {label}
    </div>
  );
}
