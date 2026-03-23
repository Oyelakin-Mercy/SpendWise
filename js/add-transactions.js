import { supabase } from './supabase.js';

async function getSymbol(userId) {
    const { data } = await supabase
        .from('profiles')
        .select('currency_symbol')
        .eq('id', userId)
        .maybeSingle();

    if (data?.currency_symbol) return data.currency_symbol;
    const prefs = JSON.parse(localStorage.getItem('spendwise_prefs') || '{}');
    return prefs.currency?.symbol || '₦';
}

async function formatCurrency(amount, userId) {
    const symbol = await getSymbol(userId);
    return symbol + Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

async function initSymbol() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const symbol = await getSymbol(session.user.id);
    if (symEl) symEl.textContent = symbol;
}
initSymbol();

async function getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/pages/login.html';
        return null;
    }
    return session.user;
}

let selectedType     = 'expense';
let selectedCategory = null;

const symEl = document.getElementById('currency-symbol');

async function loadBalance() {
    const user = await getUser();
    if (!user) return;
    const { data } = await supabase
        .from('balances')
        .select('balance')
        .eq('user_id', user.id)
        .single();
    const el = document.getElementById('sidebar-balance');
    if (el) el.textContent = await formatCurrency(data?.balance ?? 0);
}

loadBalance();

document.querySelectorAll('.side-navs div a').forEach(link => {
    if (link.href === window.location.href) link.classList.add('active');
});

document.getElementById('date-input').value = new Date().toISOString().split('T')[0];

const btnExpense = document.getElementById('btn-expense');
const btnIncome  = document.getElementById('btn-income');

btnExpense.addEventListener('click', () => {
    selectedType = 'expense';
    btnExpense.className = 'type-btn active-expense';
    btnIncome.className  = 'type-btn';
    updateInsight();
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
}

btnIncome.addEventListener('click', () => {
    selectedType = 'income';
    btnIncome.className  = 'type-btn active-income';
    btnExpense.className = 'type-btn';
    updateInsight();
});

document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedCategory = btn.dataset.cat;
        updateInsight();
    });
});


async function updateInsight() {
    const amount    = parseFloat(document.getElementById('amount-input').value) || 0;
    const insightEl = document.getElementById('ai-insight-text');

    if (!amount || !selectedCategory) {
        insightEl.textContent = 'Enter an amount and category to see your spending insight.';
        return;
    }

    const user = await getUser();
    if (!user) return;

    const { data: txns } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('category', selectedCategory);

    const catSpend = (txns || []).reduce((sum, t) => sum + Number(t.amount), 0);

    if (selectedType === 'expense') {
        insightEl.textContent = `This transaction will bring your ${selectedCategory} spending to ${await formatCurrency(catSpend + amount)}.`;
    } else {
        insightEl.textContent = `Adding ${await formatCurrency(amount)} as income will boost your balance.`;
    }
}

document.getElementById('amount-input').addEventListener('input', updateInsight);

document.getElementById('save-btn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('amount-input').value);
    if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
    if (!selectedCategory)      { alert('Please select a category.');    return; }

    const user = await getUser();
    if (!user) return;

    // Insert transaction
    const { error: txnError } = await supabase.from('transactions').insert({
        user_id:  user.id,
        type:     selectedType,
        amount,
        category: selectedCategory,
        date:     document.getElementById('date-input').value,
        note:     document.getElementById('note-input').value.trim(),
    });

    if (txnError) { alert('Error saving transaction: ' + txnError.message); return; }

    // Update balance
    const { data: balData } = await supabase
        .from('balances')
        .select('balance')
        .eq('user_id', user.id)
        .single();

    const currentBalance = balData?.balance ?? 0;
    const newBalance     = selectedType === 'expense'
        ? currentBalance - amount
        : currentBalance + amount;

    await supabase.from('balances').upsert({
        user_id: user.id,
        balance: newBalance,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    window.location.href = '/pages/dashboard.html';
});