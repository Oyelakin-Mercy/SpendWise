import { supabase } from './supabase.js';

function getSymbol() {
    const data = JSON.parse(localStorage.getItem('spendwise_prefs') || '{}');
    return data.currency || { symbol: '$', code: 'USD' };
}

function formatCurrency(n) {
    const { symbol } = getSymbol();
    return symbol + Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

async function getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/pages/login.html'; return null; }
    return session.user;
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
}

const CAT_META = {
    housing:   { icon: '<img src="/images/rent.png" width="15" height="20">',      color: '#DBEAFE' }, // blue
    groceries: { icon: '<img src="/images/groceries.png" width="15" height="20">', color: '#DCFCE7' }, // green
    transport: { icon: '<img src="/images/transport.png" width="15" height="20">', color: '#FEF9C3' }, // yellow
    food:      { icon: '<img src="/images/food-logo.png" width="15" height="20">', color: '#FFE4E6' }, // pink
    shopping:  { icon: '<img src="/images/shopping.png" width="15" height="20">',  color: '#F3E8FF' }, // purple
    health:    { icon: '<img src="/images/health.png" width="15" height="20">',    color: '#CCFBF1' }, // teal
    rent:      { icon: '<img src="/images/rent.png" width="15" height="20">',      color: '#DBEAFE' }, // blue
    others:    { icon: '<img src="/images/others.png" width="15" height="20">',    color: '#F1F5F9' }, // grey
};

function formatDateHeader(dateStr) {
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dateStr === today)     return 'TODAY';
    if (dateStr === yesterday) return 'YESTERDAY';
    return new Date(dateStr + 'T00:00:00')
        .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        .toUpperCase();
}

function formatDateRight(dateStr) {
    return new Date(dateStr + 'T00:00:00')
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function formatTime(createdAt) {
    return new Date(createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

document.querySelectorAll('.side-navs div a').forEach(link => {
    if (link.href === window.location.href) link.classList.add('active');
});

async function loadBalance() {
    const user = await getUser();
    if (!user) return;
    const { data } = await supabase.from('balances').select('balance').eq('user_id', user.id).single();
    const el = document.getElementById('sidebar-balance');
    if (el) el.textContent = formatCurrency(data?.balance ?? 0);
}

loadBalance();

let currentFilter = 'all';

window.setFilter = function(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
    document.getElementById('filter-' + filter).classList.add('active-filter');
    renderTransactions();
};

async function renderTransactions() {
    const user = await getUser();
    if (!user) return;

    const list = document.getElementById('transactions-list');
    list.innerHTML = '<p style="color:#999; padding:20px;">Loading...</p>';

    let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (currentFilter !== 'all') query = query.eq('type', currentFilter);

    const { data: transactions, error } = await query;

    if (error) { list.innerHTML = '<p style="color:red;">Error loading transactions.</p>'; return; }
    if (!transactions || transactions.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>';
        return;
    }

    // Group by date
    const groups = {};
    transactions.forEach(t => {
        const key = t.date || 'Unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
    });

    list.innerHTML = '';
    Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(date => {
        const header = document.createElement('div');
        header.className = 'date-header';
        header.innerHTML = `<span>${formatDateHeader(date)}</span><span>${formatDateRight(date)}</span>`;
        list.appendChild(header);

        const group = document.createElement('div');
        group.className = 'transactions-group';

        groups[date].forEach(t => {
            const meta       = CAT_META[t.category] || CAT_META.others;
            const sign       = t.type === 'expense' ? '-' : '+';
            const amountCls  = t.type === 'expense' ? 'amount-expense' : 'amount-income';
            const timeText   = t.note && t.note.trim() ? t.note : formatTime(t.created_at);

            const card = document.createElement('div');
            card.className = 'transaction-card';
            card.innerHTML = `
                <div class="transaction-info">
                    <div class="transaction-icon" style="background-color:${meta.color}">${meta.icon}</div>
                    <div>
                        <div class="transaction-name">${t.category.charAt(0).toUpperCase() + t.category.slice(1)}</div>
                        <div class="transaction-meta">
                            <span class="category-badge">${t.category.toUpperCase()}</span>
                            <span class="transaction-time">${timeText}</span>
                        </div>
                    </div>
                </div>
                <div class="transaction-amount ${amountCls}">${sign}${formatCurrency(t.amount)}</div>
            `;
            group.appendChild(card);
        });

        list.appendChild(group);
    });
}

renderTransactions();