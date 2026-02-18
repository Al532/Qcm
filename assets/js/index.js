(function initIndex() {
  const list = document.querySelector('[data-quiz-list]');
  if (!list) return;

  fetch('./data/quizzes.json', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Impossible de charger la liste des quiz (${response.status}).`);
      }

      return response.json();
    })
    .then((payload) => {
      const quizzes = Array.isArray(payload.quizzes) ? payload.quizzes : [];
      list.innerHTML = '';

      quizzes.forEach((quiz) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `./v/video.html?slug=${encodeURIComponent(quiz.slug)}`;
        link.textContent = quiz.title || quiz.slug;
        link.className = 'button-link';
        item.appendChild(link);
        list.appendChild(item);
      });

      if (!quizzes.length) {
        list.innerHTML = '<li>Aucun quiz publié pour le moment.</li>';
      }
    })
    .catch((error) => {
      console.error(error);
      list.innerHTML = '<li>Impossible de charger la liste des quiz.</li>';
    });
})();
