'use client'


import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'


export default function HomePage() {
const [user, setUser] = useState<any>(null)
const [loading, setLoading] = useState(true)


useEffect(() => {
checkUser()
}, [])


async function checkUser() {
const { data } = await supabase.auth.getUser()
setUser(data.user)
setLoading(false)
}


async function login() {
const email = prompt('Enter email')
if (!email) return


await supabase.auth.signInWithOtp({ email })
alert('Check email for login link')
}


async function logout() {
await supabase.auth.signOut()
setUser(null)
}


if (loading) return <div className="p-10">Loading...</div>


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

