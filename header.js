// header.js
document.addEventListener('DOMContentLoaded', () => {
  fetch('/header.html')
    .then(res => res.text())
    .then(html => {
      // insert it at the top of <body>
      document.body.insertAdjacentHTML('afterbegin', html);
    })
    .catch(err => console.error('Header load failed:', err));
});