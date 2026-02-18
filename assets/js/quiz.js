/*
  Logique QCM réutilisable.
  Pour de futures pages :
  - Gardez la structure .question > .choices > button[data-correct] + .feedback
  - Aucune config JS nécessaire : tout est basé sur le HTML.
*/

(function initQuiz() {
  const questions = document.querySelectorAll('.question');

  questions.forEach((question) => {
    const buttons = question.querySelectorAll('.choices button');
    const feedback = question.querySelector('.feedback');

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        // Verrouille une question déjà répondue.
        if (question.dataset.locked === 'true') return;

        const isCorrect = button.dataset.correct === 'true';

        // Style du bouton sélectionné.
        button.classList.add(isCorrect ? 'correct' : 'incorrect');

        // Affiche la correction visuelle sur la bonne réponse.
        buttons.forEach((btn) => {
          btn.disabled = true;
          if (btn.dataset.correct === 'true') {
            btn.classList.add('correct');
          }
        });

        // Feedback immédiat avec texte explicatif existant dans le HTML.
        if (feedback) {
          feedback.hidden = false;
          feedback.classList.remove('correct', 'incorrect');
          feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
          feedback.prepend(document.createTextNode(isCorrect ? 'Bonne réponse. ' : 'Mauvaise réponse. '));
        }

        question.dataset.locked = 'true';
      });
    });
  });
})();
