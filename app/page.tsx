'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type LeaderboardEntry = {
  user_id: string
  username: string
  total_points: number
  email: string
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // --- Auth Check ---
  useEffect(() => {
    checkUser()
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadUsername(session.user.id)
    })
  }, [])

  async function checkUser() {
    const { data } = await supabase.auth.getUser()
    setUser(data.user)
    setLoading(false)
    if (data.user) loadUsername(data.user.id)
    loadLeaderboard()
  }

  // --- Username functions ---
  async function loadUsername(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()

    if (error) console.error('Failed to load username:', error)
    if (data?.username) setUsername(data.username)
  }

  async function saveUsername() {
    if (!username || !user) return

    // Update username and get the updated row back
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username })
      .select()

    if (updateError) {
      console.error('Failed to update username:', updateError)
      alert('Failed to update username')
      return
    }

    console.log('Updated profile:', updatedProfile)
    alert('Username updated!')
    // No need to call loadLeaderboard() here — Realtime will handle it
  }

  // --- Leaderboard ---
  async function loadLeaderboard() {
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .order('total_points', { ascending: false })

    if (error) {
      console.error('Failed to load leaderboard:', error)
      return
    }

    setLeaderboard(data as LeaderboardEntry[])
  }

  // --- Realtime subscriptions ---
  useEffect(() => {
    if (!user) return

    // Subscribe to logs updates
    const logsSub = supabase
      .channel('public:logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'logs' },
        (payload) => {
          console.log('Logs change detected:', payload)
          loadLeaderboard()
        }
      )
      .subscribe()

    // Subscribe to profiles updates
    const profilesSub = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('Profile change detected:', payload)
          loadLeaderboard()
        }
      )
      .subscribe()

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(logsSub)
      supabase.removeChannel(profilesSub)
    }
  }, [user])

  // --- Signup / Login ---
  async function signUp() {
    const email = prompt('Enter email:')
    const password = prompt('Enter password:')
    if (!email || !password) return

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Signup successful! Please login.')
  }

  async function login() {
    const email = prompt('Enter email:')
    const password = prompt('Enter password:')
    if (!email || !password) return

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    else setUser(data.user)
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  // --- Logging events ---
  async function logEvent(event_type: string, points: number) {
    if (!user) return
    await supabase.from('logs').insert({
      user_id: user.id,
      event_type,
      points,
      username
    })
    // Realtime handles leaderboard update
  }

  // --- Render ---
  if (loading) return <div className="p-10">Loading...</div>

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <button
          onClick={login}
          className="bg-blue-500 px-6 py-3 rounded-xl text-lg text-white"
        >
          Login
        </button>
        <button
          onClick={signUp}
          className="bg-green-500 px-6 py-3 rounded-xl text-lg text-white"
        >
          Sign Up
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Fishing Tracker</h1>
        <button
          onClick={logout}
          className="bg-red-500 text-white px-3 py-1 rounded"
        >
          Logout
        </button>
      </div>

      {/* Username Editor */}
      <div className="mb-6">
        <label className="block mb-1">Username:</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border px-2 py-1 rounded text-black"
        />
        <button
          onClick={saveUsername}
          className="bg-blue-500 text-white px-3 py-1 rounded ml-2"
        >
          Save
        </button>
      </div>

      {/* Score Buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => logEvent('fish', 1)}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          +1 Fish
        </button>
        <button
          onClick={() => logEvent('pb', 3)}
          className="bg-yellow-500 text-white px-4 py-2 rounded"
        >
          PB Fish +3
        </button>
        <button
          onClick={() => logEvent('line_snap', -1)}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Line Snap -1
        </button>
        <button
          onClick={() => logEvent('dud_trip', -1)}
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          Dud Trip -1
        </button>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
        <table className="w-full text-left border-collapse border border-gray-300">
          <thead>
            <tr className="border-b">
              <th className="p-2 border-r">Rank</th>
              <th className="p-2 border-r">Username</th>
              <th className="p-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((u, i) => (
              <tr key={u.user_id} className="border-b hover:bg-gray-100">
                <td className="p-2 border-r">{i + 1}</td>
                <td className="p-2 border-r">{u.username || u.email}</td>
                <td className="p-2">{u.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
