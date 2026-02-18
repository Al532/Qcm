/*
  Logique QCM réutilisable.
  - Mode dynamique: lit ?slug=... puis charge /data/<slug>.json.
  - Mode statique (legacy): conserve l'ancien comportement si des questions HTML existent déjà.
*/

(function initQuiz() {
  const dynamicRoot = document.querySelector('[data-quiz-root]');

  if (dynamicRoot) {
    initDynamicQuiz(dynamicRoot);
    return;
  }

  initStaticQuiz();
})();

function initDynamicQuiz(root) {
  const status = document.querySelector('[data-quiz-status]');
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    showError(
      status,
      "Aucun quiz n'a été demandé. Ajoutez un slug dans l'URL, par exemple : ?slug=test."
    );
    return;
  }

  loadQuizData(slug)
    .then((quizData) => {
      renderQuiz(root, quizData);
      if (status) status.hidden = true;
    })
    .catch((error) => {
      console.error(error);
      showError(
        status,
        "Impossible de charger ce quiz. Vérifiez le slug, puis réessayez dans quelques instants."
      );
    });
}

async function loadQuizData(slug) {
  const response = await fetch(`/data/${encodeURIComponent(slug)}.json`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Quiz introuvable pour le slug "${slug}" (${response.status}).`);
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.questions)) {
    throw new Error('Le JSON du quiz est invalide.');
  }

  return data;
}

function renderQuiz(root, quizData) {
  root.innerHTML = '';

  if (quizData.title) {
    const title = document.querySelector('[data-quiz-title]');
    if (title) title.textContent = quizData.title;
    document.title = `${quizData.title} - Harmonie interactive`;
  }

  const meta = document.querySelector('[data-quiz-meta]');
  if (meta) {
    meta.textContent = quizData.videoId
      ? `Quiz lié à la vidéo YouTube : ${quizData.videoId}`
      : 'Quiz interactif';
  }

  quizData.questions.forEach((questionData, index) => {
    root.appendChild(buildQuestionCard(questionData, index));
  });
}

function buildQuestionCard(questionData, index) {
  const section = document.createElement('section');
  section.className = 'card question';

  const questionId = questionData.id || `q${index + 1}`;
  const titleId = `${questionId}-title`;
  section.setAttribute('aria-labelledby', titleId);

  const heading = document.createElement('h2');
  heading.id = titleId;
  heading.textContent = `Q${index + 1} — ${labelForType(questionData.type)}`;

  const prompt = document.createElement('p');
  prompt.textContent = questionData.prompt || 'Question';

  section.append(heading, prompt);

  if (questionData.type === 'image' && questionData.media && questionData.media.src) {
    section.appendChild(buildImageBlock(questionData.media));
  }

  if (questionData.type === 'audio' && questionData.media && questionData.media.src) {
    section.appendChild(buildAudioBlock(questionData.media));
  }

  const choices = document.createElement('div');
  choices.className = 'choices';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', `Réponses de la question ${index + 1}`);

  (questionData.choices || []).forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.correct = String(choice.id === questionData.correctChoiceId);
    button.textContent = choice.label || choice.id;
    choices.appendChild(button);
  });

  const feedback = document.createElement('p');
  feedback.className = 'feedback';
  feedback.setAttribute('aria-live', 'polite');
  feedback.hidden = true;
  feedback.textContent = questionData.explanation || '';

  section.append(choices, feedback);
  wireQuestionInteractions(section);

  return section;
}

function buildImageBlock(media) {
  const figure = document.createElement('figure');
  figure.className = 'media-block';

  const image = document.createElement('img');
  image.src = media.src;
  image.alt = media.alt || 'Illustration de la question';
  image.loading = 'lazy';

  figure.appendChild(image);

  return figure;
}

function buildAudioBlock(media) {
  const block = document.createElement('div');
  block.className = 'media-block';

  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'none';

  const source = document.createElement('source');
  source.src = media.src;
  source.type = 'audio/mpeg';
  audio.appendChild(source);

  audio.appendChild(
    document.createTextNode('Votre navigateur ne supporte pas la lecture audio HTML5.')
  );

  block.appendChild(audio);

  return block;
}

function labelForType(type) {
  if (type === 'image') return 'Lecture visuelle (image)';
  if (type === 'audio') return 'Reconnaissance auditive (audio)';
  return 'Question (texte)';
}

function showError(status, message) {
  if (!status) return;
  status.hidden = false;
  status.classList.add('feedback', 'incorrect');
  status.textContent = message;
}

function initStaticQuiz() {
  const questions = document.querySelectorAll('.question');

  questions.forEach((question) => {
    wireQuestionInteractions(question);
  });
}

function wireQuestionInteractions(question) {
  const buttons = question.querySelectorAll('.choices button');
  const feedback = question.querySelector('.feedback');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      if (question.dataset.locked === 'true') return;

      const isCorrect = button.dataset.correct === 'true';

      button.classList.add(isCorrect ? 'correct' : 'incorrect');

      buttons.forEach((btn) => {
        btn.disabled = true;
        if (btn.dataset.correct === 'true') {
          btn.classList.add('correct');
        }
      });

      if (feedback) {
        feedback.hidden = false;
        feedback.classList.remove('correct', 'incorrect');
        feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
        const prefix = isCorrect ? 'Bonne réponse. ' : 'Mauvaise réponse. ';

        if (!feedback.dataset.prefixed) {
          feedback.prepend(document.createTextNode(prefix));
          feedback.dataset.prefixed = 'true';
        }
      }

      question.dataset.locked = 'true';
    });
  });
}
