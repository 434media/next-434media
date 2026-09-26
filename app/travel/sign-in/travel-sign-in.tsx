"use client"

import { useState, type FormEvent } from "react"
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
import { Mail, Lock, Loader2 } from "lucide-react"
import { auth } from "@/lib/firebase"

export default function TravelSignIn({
  projectSlug,
  travelerSlug,
  nextPath,
}: {
  projectSlug: string
  travelerSlug: string
  nextPath: string
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [resetSent, setResetSent] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
      const idToken = await credential.user.getIdToken()
      const response = await fetch("/api/travel/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, projectSlug, travelerSlug }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error === "not_authorized" ? "This email is not authorized for this itinerary." : "Sign-in failed.")
      }
      window.location.assign(nextPath)
    } catch (caught) {
      console.error("Travel sign-in failed", caught)
      setError(caught instanceof Error ? caught.message : "Sign-in failed.")
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError("Enter your email first, then choose Forgot password.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch {
      setResetSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080b12] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white/10 p-8 text-white shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mb-6 inline-block font-menda-black text-3xl">
            <span className="sr-only">434 Media</span>
            <span aria-hidden className="block text-[1.7034em] leading-[0.8]">434</span>
            <span aria-hidden className="block leading-[0.95]">MEDIA</span>
          </div>
          <h1 className="text-2xl font-bold">Travel Access</h1>
          <p className="mt-2 text-sm text-neutral-300">Sign in to view the protected production itinerary.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-neutral-300">
            Email
            <span className="relative mt-2 block">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
              <input className="w-full rounded-xl border border-white/20 bg-white/10 py-3 pl-10 pr-4 text-white outline-none focus:ring-2 focus:ring-white/40" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
            </span>
          </label>
          <label className="block text-sm font-medium text-neutral-300">
            Password
            <span className="relative mt-2 block">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
              <input className="w-full rounded-xl border border-white/20 bg-white/10 py-3 pl-10 pr-4 text-white outline-none focus:ring-2 focus:ring-white/40" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
            </span>
          </label>
          {error && <p className="rounded-xl border border-red-400/40 bg-red-500/15 p-3 text-sm text-red-100">{error}</p>}
          {resetSent && <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-3 text-sm text-emerald-100">If an account exists, a reset link is on its way.</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-neutral-950 disabled:opacity-60">
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            Sign in
          </button>
          <button type="button" onClick={resetPassword} disabled={busy} className="w-full py-2 text-sm text-neutral-300 underline underline-offset-4">Forgot password?</button>
        </form>
        <p className="mt-6 text-center text-xs text-neutral-400">Access is granted by 434 Media to authorized emails only.</p>
      </div>
    </div>
  )
}
