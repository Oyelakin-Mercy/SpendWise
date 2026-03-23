import { supabase } from './supabase.js';

const buttons = document.querySelectorAll('.currency-button, .secondary-btn');
let selectedSymbol = '₦';
let selectedCode   = 'NGN';
let selectedLabel  = 'Nigerian Naira (₦)';

buttons.forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.currency-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.secondary-btn').forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        selectedSymbol = btn.dataset.symbol;
        selectedCode   = btn.dataset.code;
        selectedLabel  = btn.dataset.label;

        document.getElementById('bar-icon').textContent  = selectedSymbol;
        document.getElementById('bar-label').textContent = `Selected: ${selectedLabel}`;
    });
});

document.getElementById('confirm-btn').addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/pages/login.html';
        return;
    }

    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem('spendwise_prefs') || '{}');
    existing.currency = { symbol: selectedSymbol, code: selectedCode, label: selectedLabel };
    localStorage.setItem('spendwise_prefs', JSON.stringify(existing));

    // Save to Supabase profiles table
    await supabase.from('profiles').upsert({
        id: session.user.id,
        currency_symbol: selectedSymbol,
        currency_code: selectedCode,
        currency_label: selectedLabel,
        updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    window.location.href = '/pages/dashboard.html';
});