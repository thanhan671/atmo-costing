const cfg = window.ATMO_CONFIG || {};
const configured =
  cfg.SUPABASE_URL &&
  !cfg.SUPABASE_URL.includes('YOUR_PROJECT') &&
  cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');

const sb = configured
  ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

const APP_URL = new URL('app.html', window.location.href).href;
const EMAIL_REDIRECT_URL = new URL('app.html', window.location.href).href;

const $ = id => document.getElementById(id);
let authMode = 'login';

function showAuthMessage(message, ok = false) {
  const el = $('authMessage');
  el.textContent = message || '';
  el.style.color = ok ? '#15803d' : '#dc2626';
}

function setMode(mode) {
  authMode = mode;
  $('authLoginTab').classList.toggle('active', mode === 'login');
  $('authSignupTab').classList.toggle('active', mode === 'signup');
  $('authSubmit').textContent = mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
  $('authPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  showAuthMessage('');
}

async function initAuth() {
  if (!configured) {
    showAuthMessage('Chưa cấu hình Supabase trong config.js.');
    $('authSubmit').disabled = true;
    return;
  }

  const { data: { session }, error } = await sb.auth.getSession();
  if (error) {
    showAuthMessage(error.message);
    return;
  }

  // Nếu đã đăng nhập, không cần ở lại trang login.
  if (session) {
    window.location.replace(APP_URL);
  }
}

$('authLoginTab').addEventListener('click', () => setMode('login'));
$('authSignupTab').addEventListener('click', () => setMode('signup'));

$('authForm').addEventListener('submit', async event => {
  event.preventDefault();

  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  const button = $('authSubmit');

  showAuthMessage('');
  button.disabled = true;
  button.textContent = authMode === 'login' ? 'Đang đăng nhập…' : 'Đang tạo tài khoản…';

  try {
    if (authMode === 'login') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('Supabase không trả về phiên đăng nhập.');

      showAuthMessage('Đăng nhập thành công. Đang chuyển trang…', true);
      window.location.replace(APP_URL);
      return;
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: EMAIL_REDIRECT_URL
      }
    });
    if (error) throw error;

    if (data.session) {
      // Confirm Email đang tắt: signup trả session ngay.
      showAuthMessage('Tạo tài khoản thành công. Đang chuyển trang…', true);
      window.location.replace(APP_URL);
    } else {
      showAuthMessage('Đã tạo tài khoản. Hãy kiểm tra email xác nhận rồi đăng nhập.', true);
    }
  } catch (error) {
    showAuthMessage(error?.message || 'Không thể thực hiện đăng nhập/đăng ký.');
  } finally {
    button.disabled = false;
    button.textContent = authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
  }
});

initAuth();
