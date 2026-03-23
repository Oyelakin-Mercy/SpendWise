import { supabase } from './supabase.js'
import { logIn, sendPasswordResetEmail, signInWithGoogle } from './auth.js'

function showError(message) {
    let el = document.getElementById('auth-error')
    if (!el) {
        el = document.createElement('p')
        el.id = 'auth-error'
        el.style.cssText = 'color: #c0392b; font-size: 13px; margin: 0 0 8px;'
        const form = document.querySelector('.forms')
        form.insertBefore(el, form.lastChild)
    }
    el.textContent = message
}

function showErrorWithLink(message, linkText, linkHref) {
    let el = document.getElementById('auth-error')
    if (!el) {
        el = document.createElement('p')
        el.id = 'auth-error'
        el.style.cssText = 'color: #c0392b; font-size: 13px; margin: 0 0 8px;'
        const form = document.querySelector('.forms')
        form.insertBefore(el, form.firstChild)
    }
    el.innerHTML = `${message} <a href="${linkHref}" style="color: #1A237E; font-weight: 700; text-decoration: none;">${linkText}</a>`
}

function clearError() {
    const el = document.getElementById('auth-error')
    if (el) el.remove()
}

function setLoading(button, loading) {
    button.disabled = loading
    const span = button.querySelector('span')
    if (span) span.textContent = loading ? 'Please wait…' : button.dataset.label
}


async function initSignUp() {
    const form = document.querySelector('.forms')
    if (!form) return

    const [nameInput, emailInput, passwordInput] = form.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]')
    const submitBtn = form.querySelector('button[type="submit"]')
    submitBtn.dataset.label = submitBtn.querySelector('span')?.textContent || 'Get Started'

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        clearError()

        const fullName = nameInput.value.trim()
        const email = emailInput.value.trim()
        const password = passwordInput.value

        const checkbox = form.querySelector('input[type="checkbox"]')
        if (!checkbox.checked) {
            showError('Please agree to the Terms of Service and Privacy Policy.')
            return
        }

        if (!fullName || !email || !password) {
            showError('All fields are required.')
            return
        }

        setLoading(submitBtn, true)
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            })

            if (error) throw error

            if (data?.user && data.user.identities?.length === 0) {
                showErrorWithLink(
                    'You already have an account.',
                    'Log in here',
                    '/pages/login.html'
                )
                return
            }

            window.location.href = '/pages/login.html?signup=success'
        } catch (err) {
            const msg = err.message?.toLowerCase()
            if (
                msg.includes('already registered') ||
                msg.includes('already exists') ||
                msg.includes('user already') ||
                msg.includes('email address is already')
            ) {
                showErrorWithLink(
                    'You already have an account.',
                    'Log in here',
                    '/pages/login.html'
                )
            } else {
                showError(err.message)
            }
        } finally {
            setLoading(submitBtn, false)
        }
    })

    const googleBtn = document.querySelector('.login-link button')
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try { await signInWithGoogle() } catch (err) { showError(err.message) }
        })
    }
}

async function initLogin() {
    const form = document.querySelector('.forms')
    if (!form) return

    if (new URLSearchParams(window.location.search).get('signup') === 'success') {
        const banner = document.createElement('p')
        banner.style.cssText = 'color: #27ae60; font-size: 13px; margin: 0 0 8px;'
        banner.textContent = 'Account created! Please check your email to confirm, then log in.'
        form.insertBefore(banner, form.firstChild)
    }

    const [emailInput, passwordInput] = form.querySelectorAll('input[type="email"], input[type="password"]')
    const submitBtn = form.querySelector('button[type="submit"]')
    submitBtn.dataset.label = submitBtn.querySelector('span')?.textContent || 'Log in'

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        clearError()

        const email = emailInput.value.trim()
        const password = passwordInput.value

        if (!email || !password) {
            showError('Email and password are required.')
            return
        }

        setLoading(submitBtn, true)
        try {
            await logIn(email, password)
            window.location.href = '/pages/currency.html'
        } catch (err) {
            showError(err.message)
        } finally {
            setLoading(submitBtn, false)
        }
    })

    const googleBtn = document.querySelector('.login-link button')
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try { await signInWithGoogle() } catch (err) { showError(err.message) }
        })
    }
}

async function initResetPassword() {
    const form = document.querySelector('.forms')
    if (!form) return

    const emailInput = form.querySelector('input[type="email"]')
    const submitBtn = form.querySelector('button[type="submit"]')
    submitBtn.dataset.label = submitBtn.querySelector('span')?.textContent || 'Send password reset link'

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        clearError()

        const email = emailInput.value.trim()
        if (!email) {
            showError('Please enter your email address.')
            return
        }

        setLoading(submitBtn, true)
        try {
            await sendPasswordResetEmail(email)
            form.innerHTML = '<p style="color: #27ae60; font-size: 14px;">Reset link sent! Check your inbox.</p>'
        } catch (err) {
            showError(err.message)
        } finally {
            setLoading(submitBtn, false)
        }
    })
}


async function initUpdatePassword() {
    const form = document.querySelector('.forms')
    if (!form) return

    const passwordInput = form.querySelector('#password')
    const confirmInput = form.querySelector('#confirm-password')
    const submitBtn = form.querySelector('button[type="submit"]')
    submitBtn.dataset.label = submitBtn.querySelector('span')?.textContent || 'Update password'

    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace('#', '?'))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (type === 'recovery' && accessToken) {
        // Set the session so Supabase knows who is updating the password
        const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        })
        if (error) {
            form.innerHTML = '<p style="color: #c0392b; font-size: 14px;">This reset link has expired. <a href="/pages/reset-password.html" style="color:#1A237E; font-weight:700; text-decoration:none;">Request a new one</a></p>'
            return
        }
    } else {
        form.innerHTML = '<p style="color: #c0392b; font-size: 14px;">Invalid or expired link. <a href="/pages/reset-password.html" style="color:#1A237E; font-weight:700; text-decoration:none;">Request a new one</a></p>'
        return
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        clearError()

        const password = passwordInput.value
        const confirm = confirmInput.value

        if (!password || !confirm) {
            showError('Please fill in both fields.')
            return
        }
        if (password !== confirm) {
            showError('Passwords do not match.')
            return
        }
        if (password.length < 6) {
            showError('Password must be at least 6 characters.')
            return
        }

        setLoading(submitBtn, true)
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            form.innerHTML = '<p style="color: #27ae60; font-size: 14px;">Password updated! <a href="/pages/login.html" style="color:#1A237E; font-weight:700; text-decoration:none;">Log in</a></p>'
        } catch (err) {
            showError(err.message)
        } finally {
            setLoading(submitBtn, false)
        }
    })
}

const path = window.location.pathname
if (path.includes('signup'))               initSignUp()
else if (path.includes('login'))           initLogin()
else if (path.includes('reset'))           initResetPassword()
else if (path.includes('update-password')) initUpdatePassword()