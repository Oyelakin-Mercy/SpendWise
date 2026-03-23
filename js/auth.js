import { supabase } from './supabase.js'

export async function signUp(fullName, email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName }
        }
    })
    if (error) throw error
    return data
}

export async function logIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
}

export async function logOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export async function sendPasswordResetEmail(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://joinspendwise.vercel.app/pages/update-password.html'
    })
    if (error) throw error
}

export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://joinspendwise.vercel.app/pages/currency.html' }
    })
    if (error) throw error
}

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

