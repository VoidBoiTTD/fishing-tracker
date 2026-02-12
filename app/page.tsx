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
  const [message, setMessage] = useState('')

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

  // --- Username ---
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

    const oldUsername = username

    // Optimistic UI: update leaderboard row immediately
    setLeaderboard((prev) =>
      prev.map((entry) =>
        entry.user_id === user.id ? { ...entry, username } : entry
      )
    )

    // Inline message
    setMessage('Saving username...')

    // Update Supabase
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username })
      .select()

    if (error) {
      console.error('Failed to update username:', error)
      setMessage('Failed to update username')
      // rollback optimistic update
      setLeaderboard((prev) =>
        prev.map((entry) =>
          entry.user_id === user.id ? { ...entry, username: oldUsername } : entry
        )
      )
      setTimeout(() => setMessage(''), 2000)
      return
    }

    // Delay leaderboard reload to ensure view updates
    setTimeout(loadLeaderboard, 200)

    setMessage('Username updated!')
    setTimeout(() => setMessage(''), 2000)
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

    // Add flash flag for animation
    setLeaderboard((prev) =>
      (data as LeaderboardEntry[]).map((entry) => {
        const oldEntry = prev.find((e) => e.user_id === entry.user_id)
        return {
          ...entry,
          flash: oldEntry && (oldEntry.total_points !== entry.total_points || oldEntry.username !== entry.username)
        }
      })
    )
  }

  // --- Realtime subscriptions ---
  useEffect(() => {
    if (!user) return

    const logsSub = supabase
      .channel('public:logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'logs' },
        () => loadLeaderboard()
      )
      .subscribe()

    const profilesSub = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => loadLeaderboard()
      )
      .subscribe()

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

    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage(error.message)
    else setMessage('Signup successful! Please login.')
    setTimeout(() => setMessage(''), 2000)
  }

  async function login() {
    const email = prompt('Enter email:')
    const password = prompt('Enter password:')
    if (!email || !password) return

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    else setUser(data.user)
    setTimeout(() => setMessage(''), 2000)
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  // --- Logging events ---
  async function logEvent(event_type: string, points: number) {
    if (!user) return

    // Optimistic update
    setLeaderboard((prev) =>
      prev.map((entry) =>
        entry.user_id === user.id
          ? { ...entry, total_points: entry.total_points + points, flash: true }
          : entry
      )
    )

    const { error } = await supabase.from('logs').insert({
      user_id: user.id,
      event_type,
      points,
      username
    })

    if (error) console.error('Failed to log event:', error)
  }

  // --- Render ---
  if (loading) return <div className="p-10">Loading...</div>

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        {message && <div className="text-green-600">{message}</div>}
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
      {message && <div className="text-green-600 mb-2">{message}</div>}

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
              <tr
                key={u.user_id}
                className={`border-b hover:bg-gray-100 ${
                  u.flash ? 'flash' : u.user_id === user.id ? 'bg-green-100' : ''
                }`}
                onAnimationEnd={() =>
                  setLeaderboard((prev) =>
                    prev.map((entry) =>
                      entry.user_id === u.user_id ? { ...entry, flash: false } : entry
                    )
                  )
                }
              >
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
