/*
  Logique QCM réutilisable.
  - Mode dynamique: lit ?slug=... puis charge ../data/<slug>.json.
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
      console.error(error.message, { slug: error.slug || slug, fetchUrl: error.fetchUrl });
      showError(status, error.message);
    });
}

async function loadQuizData(slug) {
  const safeSlug = encodeURIComponent(slug);
  const dataUrl = `../data/${safeSlug}.json`;

  let response;

  try {
    response = await fetch(dataUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    throw createQuizLoadError(slug, dataUrl, `Erreur réseau lors du chargement du quiz.`);
  }

  if (!response.ok) {
    throw createQuizLoadError(
      slug,
      dataUrl,
      `Quiz introuvable pour le slug "${slug}" (${response.status}).`
    );
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw createQuizLoadError(slug, dataUrl, 'Le fichier JSON est invalide ou illisible.');
  }

  if (!data || !Array.isArray(data.questions)) {
    throw createQuizLoadError(slug, dataUrl, 'Le JSON du quiz est invalide.');
  }

  data.questions = data.questions.map((question) => normalizeQuestionMedia(question));

  return data;
}

function createQuizLoadError(slug, fetchUrl, detail) {
  const message = `Impossible de charger ce quiz (slug: "${slug}", URL: "${fetchUrl}"). ${detail}`;
  const error = new Error(message);
  error.slug = slug;
  error.fetchUrl = fetchUrl;
  return error;
}

function normalizeQuestionMedia(questionData) {
  if (!questionData) return questionData;

  return {
    ...questionData,
    promptMedia: normalizeMediaEntries(questionData.promptMedia),
    choices: (questionData.choices || []).map((choice) => ({
      ...choice,
      media: normalizeMediaEntries(choice.media),
    })),
  };
}

function normalizeMediaEntries(mediaData) {
  const mediaList = Array.isArray(mediaData) ? mediaData : mediaData ? [mediaData] : [];

  return mediaList.map((media) => ({
    ...media,
    src: normalizeMediaPath(String(media.src || '').trim()),
  }));
}

function normalizeMediaPath(src) {
  if (!src || /^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
    return src;
  }

  if (src.startsWith('/')) {
    return `..${src}`;
  }

  return src;
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
  const questionType = normalizeQuestionType(questionData.type);
  heading.textContent = `Q${index + 1} — ${labelForType(questionType)}`;

  const prompt = document.createElement('p');
  prompt.textContent = questionData.prompt || 'Question';

  section.append(heading, prompt);

  appendMediaBlocks(section, questionData.promptMedia);

  const choices = document.createElement('div');
  choices.className = 'choices';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', `Réponses de la question ${index + 1}`);

  const isMultiple = questionType === 'multiple';

  section.dataset.questionType = questionType;
  section.dataset.correctChoiceIds = JSON.stringify(getCorrectChoiceIds(questionData, isMultiple));

  (questionData.choices || []).forEach((choice) => {
    if (isMultiple) {
      choices.appendChild(buildMultipleChoiceRow(choice, questionId));
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.choiceId = choice.id;
    button.textContent = choice.label || choice.id;
    appendMediaBlocks(button, choice.media);
    choices.appendChild(button);
  });

  const feedback = document.createElement('p');
  feedback.className = 'feedback';
  feedback.setAttribute('aria-live', 'polite');
  feedback.hidden = true;
  feedback.textContent = questionData.explanation || '';

  section.append(choices);

  if (isMultiple) {
    const validateButton = document.createElement('button');
    validateButton.type = 'button';
    validateButton.className = 'button-link';
    validateButton.textContent = 'Valider les réponses';
    validateButton.dataset.action = 'validate-multiple';
    section.appendChild(validateButton);
  }

  section.append(feedback);
  wireQuestionInteractions(section);

  return section;
}

function buildMultipleChoiceRow(choice, questionId) {
  const wrapper = document.createElement('label');
  wrapper.className = 'choice-option';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = choice.id;
  checkbox.name = `${questionId}-choice`;

  const text = document.createElement('span');
  text.textContent = choice.label || choice.id;

  wrapper.append(checkbox, text);
  appendMediaBlocks(wrapper, choice.media);

  return wrapper;
}

function appendMediaBlocks(target, mediaData) {
  const mediaList = Array.isArray(mediaData)
    ? mediaData
    : mediaData
      ? [mediaData]
      : [];

  mediaList.forEach((media) => {
    if (!media || !media.src) return;

    if (media.kind === 'audio') {
      target.appendChild(buildAudioBlock(media));
      return;
    }

    target.appendChild(buildImageBlock(media));
  });
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
  if (type === 'multiple') return 'Réponses multiples';
  return 'Réponse unique';
}

function normalizeQuestionType(type) {
  return type === 'multiple' ? 'multiple' : 'single';
}

function getCorrectChoiceIds(questionData, isMultiple) {
  if (isMultiple) {
    if (Array.isArray(questionData.correctChoiceIds)) {
      return questionData.correctChoiceIds;
    }

    if (questionData.correctChoiceId) {
      return [questionData.correctChoiceId];
    }

    return [];
  }

  return questionData.correctChoiceId ? [questionData.correctChoiceId] : [];
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
  const questionType = question.dataset.questionType || 'single';
  if (questionType === 'multiple') {
    wireMultipleQuestionInteractions(question);
    return;
  }

  const buttons = question.querySelectorAll('.choices button');
  const feedback = question.querySelector('.feedback');
  const correctChoiceIds = JSON.parse(question.dataset.correctChoiceIds || '[]');
  const correctChoiceId = correctChoiceIds[0];

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      if (question.dataset.locked === 'true') return;

      const isCorrect = button.dataset.choiceId === correctChoiceId;

      button.classList.add(isCorrect ? 'correct' : 'incorrect');

      buttons.forEach((btn) => {
        btn.disabled = true;
        if (btn.dataset.choiceId === correctChoiceId) {
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

function wireMultipleQuestionInteractions(question) {
  const validateButton = question.querySelector('[data-action="validate-multiple"]');
  const checkboxes = question.querySelectorAll('.choices input[type="checkbox"]');
  const feedback = question.querySelector('.feedback');
  const correctChoiceIds = JSON.parse(question.dataset.correctChoiceIds || '[]');

  if (!validateButton) return;

  validateButton.addEventListener('click', () => {
    if (question.dataset.locked === 'true') return;

    const selected = Array.from(checkboxes)
      .filter((input) => input.checked)
      .map((input) => input.value)
      .sort();
    const expected = [...correctChoiceIds].sort();

    const isCorrect =
      selected.length === expected.length && selected.every((value, index) => value === expected[index]);

    checkboxes.forEach((input) => {
      input.disabled = true;
      const row = input.closest('.choice-option');
      if (!row) return;

      if (expected.includes(input.value)) {
        row.classList.add('correct');
      }

      if (input.checked && !expected.includes(input.value)) {
        row.classList.add('incorrect');
      }
    });

    validateButton.disabled = true;

    if (feedback) {
      feedback.hidden = false;
      feedback.classList.remove('correct', 'incorrect');
      feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
      const prefix = isCorrect ? 'Bonnes réponses. ' : 'Réponses incorrectes. ';

      if (!feedback.dataset.prefixed) {
        feedback.prepend(document.createTextNode(prefix));
        feedback.dataset.prefixed = 'true';
      }
    }

    question.dataset.locked = 'true';
  });
}
