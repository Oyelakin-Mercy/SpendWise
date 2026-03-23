import { supabase } from './supabase.js';

const savedPrefs = JSON.parse(localStorage.getItem('spendwise_prefs') || '{}');
let sym = savedPrefs.currency?.symbol || '$';

const CATEGORIES = [
    { key: 'housing',   label: 'Housing & Bills', color: '#000666' },
    { key: 'groceries', label: 'Groceries',        color: '#1B6D24' },
    { key: 'transport', label: 'Transport',         color: '#C6C5D4' },
    { key: 'food',      label: 'Food',              color: '#FFB59D' },
    { key: 'shopping',  label: 'Shopping',          color: '#7986CB' },
    { key: 'health',    label: 'Health',            color: '#4DB6AC' },
    { key: 'rent',      label: 'Rent',              color: '#FFD54F' },
    { key: 'others',    label: 'Others',            color: '#E0E0E0' },
];

function formatCurrency(n) {
    return sym + Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

async function loadSymbol(userId) {
    const { data } = await supabase
        .from('profiles')
        .select('currency_symbol')
        .eq('id', userId)
        .maybeSingle();

    
    if (data?.currency_symbol) {
        sym = data.currency_symbol;
        const prefs = JSON.parse(localStorage.getItem('spendwise_prefs') || '{}');
        prefs.currency = { ...prefs.currency, symbol: sym };
        localStorage.setItem('spendwise_prefs', JSON.stringify(prefs));
    }
}

async function getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/pages/login.html';
        return null;
    }
    return session.user;
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
}

document.querySelectorAll('.side-navs div a').forEach(link => {
    if (link.href === window.location.href) link.classList.add('active');
});

const fab = document.getElementById('add-transaction-btn');
if (fab) {
    fab.addEventListener('click', () => {
        window.location.href = '/pages/addtransactions.html';
    });
}

const clearIncome = document.getElementById('clear-income-btn');
if (clearIncome) {
    clearIncome.addEventListener('click', async () => {
        if (!confirm('Clear all income transactions?')) return;
        const user = await getUser();
        if (!user) return;

        const { data: txns } = await supabase
            .from('transactions').select('amount')
            .eq('user_id', user.id).eq('type', 'income');

        const totalIncome = (txns || []).reduce((sum, t) => sum + Number(t.amount), 0);
        await supabase.from('transactions').delete().eq('user_id', user.id).eq('type', 'income');

        const { data: balData } = await supabase
            .from('balances').select('balance').eq('user_id', user.id).maybeSingle();
        await supabase.from('balances').upsert({
            user_id: user.id,
            balance: (balData?.balance ?? 0) - totalIncome,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        await loadDashboard();
    });
}

const clearExpense = document.getElementById('clear-expense-btn');
if (clearExpense) {
    clearExpense.addEventListener('click', async () => {
        if (!confirm('Clear all expense transactions?')) return;
        const user = await getUser();
        if (!user) return;

        const { data: txns } = await supabase
            .from('transactions').select('amount')
            .eq('user_id', user.id).eq('type', 'expense');

        const totalExpenses = (txns || []).reduce((sum, t) => sum + Number(t.amount), 0);
        await supabase.from('transactions').delete().eq('user_id', user.id).eq('type', 'expense');

        const { data: balData } = await supabase
            .from('balances').select('balance').eq('user_id', user.id).maybeSingle();
        await supabase.from('balances').upsert({
            user_id: user.id,
            balance: (balData?.balance ?? 0) + totalExpenses,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        await loadDashboard();
    });
}

async function loadDashboard() {
    const user = await getUser();
    if (!user) return;

    // Load symbol from Supabase first
    await loadSymbol(user.id);

    // Fetch balance
    const { data: balData } = await supabase
        .from('balances').select('balance')
        .eq('user_id', user.id).maybeSingle();
    const balance = balData?.balance ?? 0;

    // Fetch transactions
    const { data: transactions } = await supabase
        .from('transactions').select('*').eq('user_id', user.id);
    const txns = transactions || [];

    // Update balance displays
    const sidebarBal = document.getElementById('sidebar-balance');
    if (sidebarBal) sidebarBal.textContent = formatCurrency(balance);

    const totalEl = document.querySelector('.history-title div');
    if (totalEl) totalEl.textContent = formatCurrency(balance);

    // Monthly income vs expenses
    const thisMonth = new Date().toISOString().slice(0, 7);
    let monthlyIncome = 0, monthlyExpenses = 0;
    txns.forEach(t => {
        if (!t.date || !t.date.startsWith(thisMonth)) return;
        if (t.type === 'income')  monthlyIncome   += Number(t.amount);
        if (t.type === 'expense') monthlyExpenses += Number(t.amount);
    });

    document.querySelectorAll('.history-filters').forEach(card => {
        const label    = card.querySelector('div > div');
        const amountEl = card.querySelector('.amount');
        if (!label || !amountEl) return;
        if (label.textContent.includes('INCOME'))   amountEl.textContent = formatCurrency(monthlyIncome);
        if (label.textContent.includes('EXPENSES')) amountEl.textContent = formatCurrency(monthlyExpenses);
    });

    // Category totals
    const categoryTotals = {};
    txns.forEach(t => {
        if (t.type !== 'expense') return;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
    });

    document.querySelectorAll('[data-cat-display]').forEach(el => {
        el.textContent = formatCurrency(categoryTotals[el.dataset.catDisplay] || 0);
    });

    const legendContainer = document.getElementById('legend-container');
    if (legendContainer) {
        const sorted = [...CATEGORIES].sort(
            (a, b) => (categoryTotals[b.key] || 0) - (categoryTotals[a.key] || 0)
        );
        sorted.forEach((cat, index) => {
            const row = legendContainer.querySelector(`[data-cat-row="${cat.key}"]`);
            if (!row) return;
            row.style.display = index < 5 ? 'flex' : 'none';
            if (index < 5) legendContainer.appendChild(row);
        });
    }

    buildDonutChart(categoryTotals);
    loadDashboardInsight(txns, user.id);
}

let donutChart = null;

function buildDonutChart(categoryTotals) {
    const canvas = document.getElementById('spending-chart');
    if (!canvas) return;

    const active = CATEGORIES.filter(c => (categoryTotals[c.key] || 0) > 0);
    const labels = active.length > 0 ? active.map(c => c.label)               : ['No data yet'];
    const values = active.length > 0 ? active.map(c => categoryTotals[c.key]) : [1];
    const colors = active.length > 0 ? active.map(c => c.color)               : ['#E0E0E0'];

    if (donutChart) {
        donutChart.data.labels                      = labels;
        donutChart.data.datasets[0].data            = values;
        donutChart.data.datasets[0].backgroundColor = colors;
        donutChart.update();
        return;
    }

    donutChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverOffset: 8,
            }]
        },
        options: {
            cutout: '68%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (active.length === 0) return ' No transactions yet';
                            const val   = ctx.parsed;
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct   = ((val / total) * 100).toFixed(1);
                            return ` ${formatCurrency(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

async function loadDashboardInsight(txns, userId) {
    const titleEl = document.getElementById('ai-card-title');
    const bodyEl  = document.getElementById('ai-card-body');
    if (!titleEl || !bodyEl) return;

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthly   = txns.filter(t => t.date?.startsWith(thisMonth));
    let totalIncome = 0, totalExpenses = 0;
    const catTotals = {};

    monthly.forEach(t => {
        const amt = Number(t.amount);
        if (t.type === 'income') { totalIncome += amt; return; }
        totalExpenses += amt;
        catTotals[t.category] = (catTotals[t.category] || 0) + amt;
    });

    const topCat   = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const savings  = totalIncome > 0 ? (((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(0) : null;
    const catLines = Object.entries(catTotals).map(([c, a]) => `${c}: ${formatCurrency(a)}`).join(', ');

    const prompt = `You are a financial advisor. Based on this month's data, give ONE short financial insight in 2 sentences max. Be specific with numbers. No markdown.

Income: ${formatCurrency(totalIncome)} | Expenses: ${formatCurrency(totalExpenses)} | Savings rate: ${savings ?? 'N/A'}%
Top category: ${topCat ? `${topCat[0]} at ${formatCurrency(topCat[1])}` : 'none'}
Breakdown: ${catLines || 'no expenses yet'}

Also return a short title (5 words max). Reply in this exact format:
TITLE: <title here>
BODY: <insight here>`;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const EDGE_FN_URL = 'https://rnglffmqnchmibqixcoq.supabase.co/functions/v1/claude-proxy';
        const res = await fetch(EDGE_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
        });

        const data = await res.json();
        const text = data.content?.find(b => b.type === 'text')?.text || '';
        const titleMatch = text.match(/TITLE:\s*(.+)/);
        const bodyMatch  = text.match(/BODY:\s*([\s\S]+)/);

        if (titleMatch) titleEl.textContent = titleMatch[1].trim();
        if (bodyMatch)  bodyEl.textContent  = bodyMatch[1].trim();
    } catch (err) {
        titleEl.textContent = 'Insight unavailable';
        bodyEl.textContent  = 'Could not load AI insight right now.';
    }
}

if (document.getElementById('spending-chart')) {
    if (typeof Chart === 'undefined') {
        const script  = document.createElement('script');
        script.src    = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
        script.onload = loadDashboard;
        document.head.appendChild(script);
    } else {
        loadDashboard();
    }
} else {
    loadDashboard();
}