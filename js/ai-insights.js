const sideNavs = document.querySelectorAll('.side-navs div a');

sideNavs.forEach(link => {
    if (link.href === window.location.href) {
        link.classList.add('active');
    }
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/pages/login.html';
    });
}