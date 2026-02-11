'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  // Check user on load
  useEffect(() => {
    checkUser()
    loadLeaderboard()
  }, [])

  async function checkUser() {
    const { data } = await supabase.auth.getUser()
    setUser(data.user)
    setLoading(false)
  }

  // Login with magic link
  async function login() {
    const email = prompt('Enter email')
    if (!email) return
    await supabase.auth.signInWithOtp({ email })
    alert('Check your email for the login link!')
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  // Log a fishing event
  async function logEvent(points: number, type: string) {
    if (!user) return
    await supabase.from('logs').insert({
      user_id: user.id,
      event_type: type,
      points,
    })
    setScore(score + points)
    loadLeaderboard()
  }

  // Load leaderboard from Supabase view
  async function loadLeaderboard() {
    const { data } = await supabase
      .from('leaderboard_view')
      .select('*')
      .order('total_points', { ascending: false })
    setLeaderboard(data || [])
  }

  if (loading) return <div className="p-10">Loading...</div>

  // Not logged in
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <button
          onClick={login}
          className="bg-blue-500 px-6 py-3 rounded-xl text-lg"
        >
          Login
        </button>
      </div>
    )
  }

  // Logged in → show dashboard
  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Fishing Tracker</h1>
      <p>Welcome, {user.email}</p>
      <div className="text-xl">Session Score: {score}</div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => logEvent(1, 'fish')}
          className="bg-green-600 p-4 rounded-xl"
        >
          +1 Fish
        </button>
        <button
          onClick={() => logEvent(3, 'pb')}
          className="bg-purple-600 p-4 rounded-xl"
        >
          PB Fish +3
        </button>
        <button
          onClick={() => logEvent(-1, 'line_snap')}
          className="bg-red-600 p-4 rounded-xl"
        >
          Line Snap -1
        </button>
        <button
          onClick={() => logEvent(-1, 'dud_trip')}
          className="bg-orange-600 p-4 rounded-xl"
        >
          Dud Trip -1
        </button>
      </div>

      <h2 className="text-xl mt-6 mb-2">Leaderboard</h2>
      <div className="space-y-2">
        {leaderboard.map((u, i) => (
          <div
            key={i}
            className="flex justify-between bg-slate-800 p-3 rounded"
          >
            <span>{u.email}</span>
            <span>{u.total_points} pts</span>
          </div>
        ))}
      </div>

      <button
        onClick={logout}
        className="bg-slate-700 px-4 py-2 rounded mt-6"
      >
        Logout
      </button>
    </div>
  )
}
