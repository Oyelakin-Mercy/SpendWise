async function getSymbol(userId) {
    const { data } = await supabase
        .from('profiles')
        .select('currency_symbol')
        .eq('id', userId)
        .maybeSingle();

    // If found in Supabase use it, otherwise fall back to localStorage
    if (data?.currency_symbol) return data.currency_symbol;
    const prefs = JSON.parse(localStorage.getItem('spendwise_prefs') || '{}');
    return prefs.currency?.symbol || '₦';
}

function formatCurrency(n) {
    const { symbol } = getSymbol();
    return symbol + Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}