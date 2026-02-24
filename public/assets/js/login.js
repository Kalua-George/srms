const loginForm = document.getElementById('login-form');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const teacher_code = document.getElementById('teacher-code').value.trim();
 // const password = document.getElementById('password').value; // currently unused by backend

  try {
    const response = await fetch('./app/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include', // IMPORTANT for PHP session cookies
      body: JSON.stringify({ teacher_code }) // backend only needs teacher_code
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.ok) {
      // optional: store for UI convenience
      localStorage.setItem('srms_user', JSON.stringify(data.user || null));
      localStorage.setItem('srms_context', JSON.stringify(data.context || null));

      window.location.href = './teacher/dashboard.html';
    } else {
      alert(data?.error || 'Login failed');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred. Please try again.');
  }
});