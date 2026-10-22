/* ==================================================================
 * Homeroom — main.js
 * Vanilla JavaScript only. Bootstrap's own bundle drives dropdowns,
 * offcanvas, modals, collapse and tabs; everything else is here.
 * One function per feature, each with a guard clause.
 * ================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ----------------------------------------------------------------
   * Small helpers
   * ---------------------------------------------------------------- */
  var ICONS = {
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'
  };
  function icon(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toMin(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function fmtTime(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function fileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  function money(n) { return '£' + n.toFixed(2); }

  // One polite live region for status announcements.
  var live = document.createElement('div');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);
  function announce(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 60); }

  /* ----------------------------------------------------------------
   * School clock
   * The timetable follows the real clock during school hours. Outside
   * them the preview runs at DEMO_TIME so a live lesson is visible.
   * Set DEMO_TIME to null to always use the real clock.
   * ---------------------------------------------------------------- */
  var DEMO_TIME = '10:25';
  var SCHOOL_DAY = { opens: toMin('08:30'), closes: toMin('16:30') };
  function schoolNow() {
    var d = new Date();
    var min = d.getHours() * 60 + d.getMinutes();
    var weekday = d.getDay() >= 1 && d.getDay() <= 5;
    if ((weekday && min >= SCHOOL_DAY.opens && min < SCHOOL_DAY.closes) || !DEMO_TIME) return { min: min, demo: false };
    return { min: toMin(DEMO_TIME), demo: true };
  }

  /* ----------------------------------------------------------------
   * Light / dark theme toggle (initial theme is set inline in <head>)
   * ---------------------------------------------------------------- */
  function initTheme() {
    var buttons = $$('[data-theme-toggle]');
    if (!buttons.length) return;
    var root = document.documentElement;
    function sync() {
      var dark = root.getAttribute('data-bs-theme') === 'dark';
      buttons.forEach(function (b) { b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); });
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-bs-theme', next);
        try { localStorage.setItem('homeroom-theme', next); } catch (e) { /* storage unavailable */ }
        sync();
        announce(next === 'dark' ? 'Dark theme on' : 'Light theme on');
      });
    });
    sync();
  }

  /* ----------------------------------------------------------------
   * Greeting by time of day
   * ---------------------------------------------------------------- */
  function initGreeting() {
    var el = $('[data-greeting]');
    if (!el) return;
    var h = Math.floor(schoolNow().min / 60);
    el.textContent = h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
  }

  /* ----------------------------------------------------------------
   * Today's timeline: done / now / up next from the clock
   * ---------------------------------------------------------------- */
  function initTodayTimeline() {
    var list = $('[data-timeline]');
    if (!list) return;
    var items = $$('.tl-item', list);
    var clock = $('[data-clock]');
    var note = $('[data-demo-note]');
    var nextTitle = $('[data-next-title]');
    var nextMeta = $('[data-next-meta]');

    // Every lesson gets a progress bar and a "minutes left" line to show when live.
    items.forEach(function (li) {
      var card = $('.tl-card', li);
      if (!card || li.classList.contains('is-break')) return;
      if (!$('.tl-progress', card)) card.insertAdjacentHTML('beforeend', '<div class="tl-progress" aria-hidden="true"><span></span></div>');
      if (!$('[data-tl-left]', card)) card.insertAdjacentHTML('beforeend', '<p class="tl-left" data-tl-left></p>');
    });

    function defaultStatus(li, s, e) {
      if (li.classList.contains('is-break')) return (e - s) + ' min';
      if (li.classList.contains('is-club')) return 'Club';
      return '';
    }

    function update() {
      var now = schoolNow();
      var nextSet = false;
      if (clock) clock.textContent = fmtTime(now.min);
      if (note) note.hidden = !now.demo;

      items.forEach(function (li) {
        var s = toMin(li.dataset.start);
        var e = toMin(li.dataset.end);
        var status = $('[data-tl-status]', li);
        var isBreak = li.classList.contains('is-break');
        li.classList.remove('is-done', 'is-now', 'is-next');
        li.removeAttribute('aria-current');
        var text = defaultStatus(li, s, e);

        if (now.min >= e) {
          li.classList.add('is-done');
          if (!isBreak) text = 'Done';
        } else if (now.min >= s) {
          li.classList.add('is-now');
          li.setAttribute('aria-current', 'time');
          text = 'Now';
          var bar = $('.tl-progress span', li);
          var left = $('[data-tl-left]', li);
          if (bar) bar.style.width = Math.round(((now.min - s) / (e - s)) * 100) + '%';
          if (left) left.textContent = (e - now.min) + ' minutes left';
        } else if (!nextSet && !isBreak) {
          nextSet = true;
          li.classList.add('is-next');
          text = 'Up next';
          if (nextTitle) nextTitle.textContent = $('.tl-title', li).textContent.trim();
          if (nextMeta) nextMeta.textContent = li.dataset.start + ' · ' + (li.dataset.room || '');
        }
        if (status) status.textContent = text;
      });

      if (!nextSet) {
        if (nextTitle) nextTitle.textContent = 'All done';
        if (nextMeta) nextMeta.textContent = 'See you tomorrow at 08:40';
      }
    }
    update();
    setInterval(update, 30000);
  }

  /* ----------------------------------------------------------------
   * SVG rings: sweep in when they scroll into view
   * ---------------------------------------------------------------- */
  function initRings() {
    var fills = $$('[data-ring] .ring-fill');
    if (!fills.length || reduceMotion || !('IntersectionObserver' in window)) return;
    fills.forEach(function (f) {
      f.dataset.to = f.getAttribute('stroke-dasharray');
      f.style.transition = 'none';
      f.style.strokeDasharray = '0 100';
    });
    void document.body.offsetWidth;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var f = entry.target;
        f.style.transition = '';
        f.style.strokeDasharray = f.dataset.to;
        io.unobserve(f);
      });
    }, { threshold: 0.3 });
    fills.forEach(function (f) { io.observe(f); });
  }

  /* ----------------------------------------------------------------
   * Assignments: status tabs, subject filter, sort by due date
   * ---------------------------------------------------------------- */
  function initAssignmentFilters() {
    var list = $('[data-assign-list]');
    if (!list) return;
    var tabs = $$('[data-status-tab]');
    var subject = $('#filter-subject');
    var sortBtn = $('[data-sort]');
    var sortLabel = $('[data-sort-label]');
    var empty = $('[data-empty]');
    var panel = $('#assign-panel');
    var state = { status: 'todo', asc: true };

    function apply() {
      var items = $$('.assign-item', list);
      var shown = 0;
      items.sort(function (a, b) {
        return (a.dataset.due < b.dataset.due ? -1 : a.dataset.due > b.dataset.due ? 1 : 0) * (state.asc ? 1 : -1);
      }).forEach(function (li) { list.appendChild(li); });
      items.forEach(function (li) {
        var ok = li.dataset.status === state.status && (!subject || subject.value === 'all' || li.dataset.subject === subject.value);
        li.hidden = !ok;
        if (ok) shown++;
      });
      tabs.forEach(function (t) {
        var on = t.dataset.statusTab === state.status;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var count = $('.count', t);
        if (count) count.textContent = items.filter(function (i) { return i.dataset.status === t.dataset.statusTab; }).length;
        if (on && panel) panel.setAttribute('aria-labelledby', t.id);
      });
      if (empty) empty.hidden = shown > 0;
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { state.status = t.dataset.statusTab; apply(); });
      t.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (e.key === 'Home') dir = -i;
        if (e.key === 'End') dir = tabs.length - 1 - i;
        if (!dir) return;
        e.preventDefault();
        var next = tabs[(i + dir + tabs.length) % tabs.length];
        state.status = next.dataset.statusTab;
        apply();
        next.focus();
      });
    });
    if (subject) subject.addEventListener('change', apply);
    if (sortBtn) sortBtn.addEventListener('click', function () {
      state.asc = !state.asc;
      if (sortLabel) sortLabel.textContent = state.asc ? 'Soonest first' : 'Latest first';
      sortBtn.setAttribute('aria-label', 'Sort by due date, currently ' + (state.asc ? 'soonest first' : 'latest first'));
      apply();
    });
    list.addEventListener('hr:statuschange', apply);
    apply();
  }

  /* ----------------------------------------------------------------
   * Assignment detail drawer (Bootstrap offcanvas)
   * ---------------------------------------------------------------- */
  var RUBRICS = {
    quiz: [['Vocabulary recall', 'Uses all 30 verbs and time phrases accurately', 4], ['Reflexive verbs', 'Correct pronoun and ending every time', 3], ['Own sentences', 'Five accurate, personal sentences with time phrases', 3]],
    problems: [['Method', 'Every step shown and clearly set out', 8], ['Accuracy', 'Correct answers, surds fully simplified', 8], ['Problem solving', 'Word problems turned into equations, answered in a sentence', 4]],
    code: [['Program works', 'Runs without errors for any valid input', 10], ['Loops', 'A nested for loop, plus a while loop for validation', 8], ['Readability', 'Clear names and a comment for each section', 4], ['Evidence', 'Screenshot shows the program running', 3]],
    diagram: [['Processes', 'Four erosion processes named and explained', 6], ['Sequence', 'Clear stages from crack to cave, arch, stack and stump', 5], ['Case study', 'Accurate, specific detail on Swanage Bay', 4]],
    log: [['Coverage', 'All seven scenes logged', 6], ['Quotations', 'Short, well-chosen, embedded quotations', 8], ['Insight', 'Links each scene to Macbeth’s ambition', 6]],
    source: [['Content', 'Uses what each source says to judge its usefulness', 10], ['Provenance', 'Explains how nature, origin and purpose affect usefulness', 10], ['Own knowledge', 'Accurate context that tests each source', 6], ['Judgement', 'A clear, supported conclusion', 4]],
    project: [['Question', 'Focused, testable and original', 10], ['Variables', 'Independent, dependent and control variables identified', 10], ['Method', 'Realistic, repeatable plan with an equipment list', 12], ['Safety', 'Specific hazards and how to control them', 8]],
    lab: [['Method', 'Clear, repeatable method with controls', 6], ['Results', 'Accurate table and a well-labelled graph', 8], ['Analysis', 'Explains the pattern using scientific ideas', 7], ['Evaluation', 'Identifies errors and suggests improvements', 4]],
    journal: [['Listening detail', 'Names instruments, tempo and dynamics', 6], ['Vocabulary', 'Uses musical terms accurately', 5], ['Response', 'Explains how the music supports the scene', 4]],
    reflection: [['Results', 'All six test scores recorded', 4], ['Analysis', 'Compares results with the national averages', 3], ['Goals', 'Two SMART goals for next term', 3]],
    art: [['Observation', 'Accurate, sensitive drawing from life', 30], ['Experimentation', 'A range of media explored with purpose', 30], ['Development', 'Ideas grow clearly across the pages', 25], ['Presentation', 'Annotated and well organised', 15]],
    essay: [['Argument', 'A clear, sustained interpretation', 25], ['Evidence', 'Well-chosen, embedded quotations', 25], ['Context', 'Links to the 1912 and 1945 settings', 25], ['Expression', 'Accurate, fluent writing', 25]],
    test: [['Substitution', 'Solves by substitution and checks the answer', 15], ['Elimination', 'Scales and subtracts equations accurately', 20], ['Graphs', 'Reads solutions from intersecting lines', 10], ['Working', 'Clear, logical layout', 5]]
  };

  var ASSIGNMENTS = {
    a1: { rubric: 'quiz',
      brief: ['Learn the 30 daily-routine verbs and time phrases on the vocabulary list, then complete the practice quiz. Reflexive verbs are the focus this week: me despierto, me ducho, me visto.'],
      steps: ['Practise with the flashcards for at least 15 minutes', 'Complete the 20-question practice quiz', 'Write five sentences about your own school-day routine'],
      files: [['vocab-mi-rutina-diaria.pdf', 'PDF · 184 KB'], ['practice-quiz-rutina.docx', 'Word · 42 KB']] },
    a2: { rubric: 'problems',
      brief: ['Solve questions 1 to 18 on factorising and the quadratic formula. Show every step of your working: a correct answer with no working earns one mark at most.'],
      steps: ['Questions 1–8: factorise and solve', 'Questions 9–14: use the quadratic formula, leaving answers in surd form', 'Questions 15–18: form and solve a quadratic from a word problem'],
      files: [['quadratics-set-3.pdf', 'PDF · 312 KB'], ['formula-sheet-year-10.pdf', 'PDF · 96 KB']] },
    a3: { rubric: 'code',
      brief: ['Write a Python program that prints a times-table grid for any number the user enters, then extend it so it highlights the square numbers.'],
      steps: ['Use a nested for loop for the grid', 'Validate the input with a while loop', 'Comment each section of your code', 'Upload your .py file and a screenshot of it running'],
      files: [['loops-challenge-brief.pdf', 'PDF · 140 KB'], ['starter-code.py', 'Python · 2 KB']] },
    a4: { rubric: 'diagram',
      brief: ['Draw and annotate how a headland and bay form, including a wave-cut platform. Use at least six key terms from this unit.'],
      steps: ['Label hydraulic action, abrasion, attrition and solution', 'Show the sequence in three or four stages', 'Add a short case-study note on Swanage Bay'],
      files: [['coastal-processes-notes.pdf', 'PDF · 420 KB']] },
    a5: { rubric: 'log',
      brief: ['Read Act 1 and keep a scene-by-scene log. For each scene, note one key quotation and what it reveals about Macbeth’s ambition.'],
      steps: ['Seven scene entries of 80–120 words each', 'One embedded quotation per entry', 'Finish with a prediction for Act 2'],
      files: [['macbeth-act-1-log-template.docx', 'Word · 38 KB']] },
    a6: { rubric: 'source',
      brief: ['Compare Sources A and B on German reactions to the Treaty of Versailles. How useful is each source to a historian studying the reaction in 1919? Use provenance and your own knowledge.'],
      steps: ['Plan with NOP: nature, origin, purpose', 'Write two developed paragraphs, one per source', 'End with a supported judgement'],
      files: [['versailles-sources-a-b.pdf', 'PDF · 1.2 MB']] },
    a7: { rubric: 'project',
      brief: ['Submit a one-page proposal for your science fair investigation: your question, hypothesis, variables, an outline of the method and a risk assessment.'],
      steps: ['A testable question and hypothesis', 'Independent, dependent and control variables', 'An equipment list and a safety note', 'Names of your team members (up to three)'],
      files: [['science-fair-proposal-template.docx', 'Word · 54 KB'], ['risk-assessment-guide.pdf', 'PDF · 210 KB']] },
    s1: { rubric: 'lab', turnedIn: 'Mon 21 Sep, 18:42', sent: ['rates-of-reaction-report.docx', 'results-graph.png'],
      brief: ['Write up the marble chips and hydrochloric acid practical. Include your results table, a graph of volume of gas against time and an evaluation.'],
      steps: ['Method in numbered steps', 'Results table with units', 'Graph with a line of best fit', 'Evaluation of at least two sources of error'],
      files: [['rates-practical-sheet.pdf', 'PDF · 260 KB']] },
    s2: { rubric: 'journal', turnedIn: 'Tue 22 Sep, 20:05', sent: ['listening-journal-week-3.pdf'],
      brief: ['Listen to the three film cues on the class playlist and write a journal entry for each: what you hear, and how the music supports what happens on screen.'],
      steps: ['About 150 words per cue', 'Use at least five musical terms', 'Name the instruments you can hear'],
      files: [['listening-journal-template.pdf', 'PDF · 88 KB']] },
    s3: { rubric: 'reflection', turnedIn: 'Wed 23 Sep, 16:30', sent: ['fitness-reflection.docx'],
      brief: ['Reflect on your fitness testing results from last week and set two goals for the rest of the term.'],
      steps: ['Record all six test scores', 'Compare them with the national averages sheet', 'Write two SMART goals'],
      files: [['fitness-test-norms.pdf', 'PDF · 120 KB']] },
    g1: { rubric: 'art', scores: [29, 28, 23, 14], teacher: 'Ms. Lindqvist',
      feedback: 'Your observational studies of the harbour are beautifully controlled, and the ink-wash experiments show real risk-taking. For the final piece, try working at A2 so the texture has room to breathe.',
      brief: ['Hand in your sketchbook for the half-term review: at least 12 developed pages on the theme of coastlines.'],
      steps: ['Observational drawing from life', 'At least three different media', 'Artist research with your own response'],
      files: [['coastlines-project-brief.pdf', 'PDF · 350 KB']] },
    g2: { rubric: 'essay', scores: [23, 21, 22, 22], teacher: 'Ms. Harlow',
      feedback: 'A perceptive argument about Priestley’s use of dramatic irony, especially Birling’s Titanic speech. To reach the top band, embed shorter quotations and zoom in on single words.',
      brief: ['How does Priestley use the character of Mr Birling to present ideas about responsibility? Write about 800 words.'],
      steps: ['Plan around three clear points', 'Use embedded quotations', 'Link to the 1912 and 1945 contexts'],
      files: [['inspector-calls-essay-question.pdf', 'PDF · 72 KB']] },
    g3: { rubric: 'lab', scores: [6, 8, 6, 3], teacher: 'Dr. Castellanos',
      feedback: 'Excellent method and a clear, well-labelled graph. Your evaluation of the temperature control was thoughtful. Add error bars next time to show the spread of your repeats.',
      brief: ['Write up the amylase and starch practical, investigating how temperature affects the rate of reaction.'],
      steps: ['Method with controlled variables', 'Results table and graph', 'Conclusion using the lock and key model'],
      files: [['enzymes-practical-sheet.pdf', 'PDF · 230 KB']] },
    g4: { rubric: 'test', scores: [14, 14, 9, 4], teacher: 'Mr. Adeyemi',
      feedback: 'A big step up from your last test. Most lost marks were on elimination questions where the signs flipped, so double-check the subtraction step.',
      brief: ['End-of-topic test on simultaneous equations: 50 marks, 45 minutes, calculator allowed.'],
      steps: ['Substitution', 'Elimination', 'Graphical solutions'],
      files: [['simultaneous-equations-revision.pdf', 'PDF · 150 KB']] }
  };

  function rubricTable(key, scores) {
    var rows = RUBRICS[key] || [];
    var total = rows.reduce(function (s, r) { return s + r[2]; }, 0);
    var got = scores ? scores.reduce(function (s, n) { return s + n; }, 0) : null;
    var head = '<thead><tr><th scope="col">Criterion</th><th scope="col">What excellent looks like</th><th scope="col" class="text-end">' + (scores ? 'Score' : 'Points') + '</th></tr></thead>';
    var body = rows.map(function (r, i) {
      return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td class="pts">' + (scores ? scores[i] + ' / ' : '') + r[2] + '</td></tr>';
    }).join('');
    var foot = '<tfoot><tr><th scope="row">Total</th><td></td><td class="pts">' + (scores ? got + ' / ' : '') + total + '</td></tr></tfoot>';
    return '<div class="rubric-wrap"><table class="rubric">' + head + '<tbody>' + body + '</tbody>' + foot + '</table></div>';
  }

  function submissionHtml(id, item, data) {
    if (item.dataset.status === 'graded') {
      return '<div class="feedback-box"><span class="grade-pill">' + esc(item.dataset.grade) + ' <small>' + esc(item.dataset.pct) + '</small></span>' +
        '<p>' + esc(data.feedback) + '</p><p class="who">' + esc(data.teacher) + '</p></div>';
    }
    if (item.dataset.status === 'submitted') {
      var sent = (data.sent || []).map(function (n) { return '<li>' + icon('file') + '<span class="file-name">' + esc(n) + '</span></li>'; }).join('');
      var msg = data.local
        ? 'Marked as turned in ' + esc(data.turnedIn) + '. This demo keeps the files in your browser; connect the form to your school\u2019s storage to upload them.'
        : 'Turned in ' + esc(data.turnedIn) + '. Your teacher will return it with feedback.';
      return '<div class="turned-in">' + icon('checkCircle') + '<span>' + msg + '</span></div>' +
        (sent ? '<ul class="file-list">' + sent + '</ul>' : '');
    }
    return '<form class="submit-form" novalidate data-submit-form="' + id + '">' +
      '<label class="dropzone" for="upload-' + id + '">' +
        '<span class="dropzone-ic">' + icon('upload') + '</span>' +
        '<strong>Drop your files here</strong>' +
        '<span>or <u>browse your device</u></span>' +
        '<small>PDF, Word, images or .py files, up to 20 MB each</small>' +
        '<input type="file" id="upload-' + id + '" multiple>' +
      '</label>' +
      '<ul class="file-list" aria-live="polite"></ul>' +
      '<div class="mt-3"><label class="form-label" for="note-' + id + '">Note for your teacher <span class="text-body-secondary fw-normal">(optional)</span></label>' +
      '<textarea class="form-control" id="note-' + id + '" rows="3" placeholder="Anything you want your teacher to know about this piece of work"></textarea></div>' +
      '<p class="submit-error" role="alert">Add at least one file or write a note before you turn this in.</p>' +
      '<div class="d-flex flex-wrap gap-2 align-items-center mt-3"><button type="submit" class="btn btn-primary">' + icon('upload') + ' Turn in</button>' +
      '<span class="local-note">' + icon('info') + '<span>Front-end demo: files stay in your browser. Connect this form to your school’s storage to upload them.</span></span></div>' +
      '</form>';
  }

  function initAssignmentDrawer() {
    var drawer = $('#assignmentDrawer');
    if (!drawer) return;
    var subj = $('[data-drawer-subject]', drawer);
    var title = $('[data-drawer-title]', drawer);
    var facts = $('[data-drawer-facts]', drawer);
    var body = $('[data-drawer-body]', drawer);

    drawer.addEventListener('show.bs.offcanvas', function (e) {
      var btn = e.relatedTarget;
      var item = btn && btn.closest('.assign-item');
      if (!item) return;
      var id = item.dataset.id;
      var data = ASSIGNMENTS[id] || { brief: [], steps: [], files: [] };
      drawer.className = drawer.className.replace(/\bs-[a-z]+\b/g, '').trim() + ' s-' + item.dataset.subject;
      subj.textContent = item.dataset.subjectName;
      title.textContent = $('.assign-open', item).textContent.trim();
      facts.innerHTML =
        '<span class="chip">' + icon('clock') + ' ' + esc(item.dataset.dueLabel) + '</span>' +
        '<span class="chip">' + icon('user') + ' ' + esc(item.dataset.teacher) + '</span>' +
        '<span class="chip">' + icon('star') + ' ' + esc(item.dataset.points) + ' points</span>';

      var steps = data.steps.length ? '<ul>' + data.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '';
      var files = data.files.map(function (f) { return '<li>' + icon('file') + '<span>' + esc(f[0]) + '</span><span>' + esc(f[1]) + '</span></li>'; }).join('');
      var subHead = item.dataset.status === 'graded' ? 'Feedback' : (item.dataset.status === 'submitted' ? 'Your submission' : 'Your work');

      body.innerHTML =
        '<section class="drawer-section"><h3>' + icon('list') + ' Instructions</h3><div class="prose">' +
          data.brief.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + steps + '</div></section>' +
        (files ? '<section class="drawer-section"><h3>' + icon('clip') + ' Resources</h3><ul class="resource-list">' + files + '</ul></section>' : '') +
        '<section class="drawer-section"><h3>' + icon('grid') + ' Rubric</h3>' + rubricTable(data.rubric, item.dataset.status === 'graded' ? data.scores : null) + '</section>' +
        '<section class="drawer-section" data-submission><h3>' + icon(item.dataset.status === 'graded' ? 'star' : 'upload') + ' ' + subHead + '</h3>' + submissionHtml(id, item, data) + '</section>';

      var form = $('[data-submit-form]', body);
      if (form) initSubmitForm(form, item, data);
    });
  }

  function initDropzone(form) {
    var zone = $('.dropzone', form);
    var input = $('input[type="file"]', form);
    var listEl = $('.file-list', form);
    var files = [];
    if (!zone || !input || !listEl) return { files: files };

    function render() {
      listEl.innerHTML = files.map(function (f, i) {
        return '<li>' + icon('file') + '<span class="file-name">' + esc(f.name) + '</span><span class="file-size">' + fileSize(f.size) + '</span>' +
          '<button type="button" class="file-remove" data-i="' + i + '" aria-label="Remove ' + esc(f.name) + '">' + icon('x', 'ic-sm') + '</button></li>';
      }).join('');
    }
    function add(fileList) {
      files.push.apply(files, Array.prototype.slice.call(fileList));
      render();
      form.dispatchEvent(new CustomEvent('hr:files'));
      announce(files.length + (files.length === 1 ? ' file' : ' files') + ' attached');
    }
    input.addEventListener('change', function () { if (input.files.length) add(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('is-over'); });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('is-over'); });
    });
    zone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) add(e.dataTransfer.files);
    });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('.file-remove');
      if (!b) return;
      files.splice(+b.dataset.i, 1);
      render();
      input.focus();
    });
    return { files: files };
  }

  function initSubmitForm(form, item, data) {
    var drop = initDropzone(form);
    var error = $('.submit-error', form);
    var note = $('textarea', form);
    form.addEventListener('hr:files', function () { error.classList.remove('is-visible'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!drop.files.length && !note.value.trim()) {
        error.classList.add('is-visible');
        $('input[type="file"]', form).focus();
        return;
      }
      var names = drop.files.map(function (f) { return f.name; });
      var stamp = 'today at ' + fmtTime(new Date().getHours() * 60 + new Date().getMinutes());
      data.turnedIn = stamp;
      data.local = true;
      data.sent = names.length ? names : ['Note: ' + note.value.trim().slice(0, 60)];
      item.dataset.status = 'submitted';
      var side = $('.assign-side', item);
      if (side) side.innerHTML = '<span class="chip chip-primary">' + icon('check') + ' Turned in</span><span class="due-state">Just now</span>';
      var section = form.closest('[data-submission]');
      section.innerHTML = '<h3>' + icon('upload') + ' Your submission</h3>' + submissionHtml(item.dataset.id, item, data);
      announce('Turned in. The assignment moved to Submitted.');
      var list = item.closest('[data-assign-list]');
      if (list) list.dispatchEvent(new CustomEvent('hr:statuschange'));
    });
  }

  /* ----------------------------------------------------------------
   * Grades: SVG trend line with crosshair tooltip, built from the
   * data table in the page (edit the table, the chart follows).
   * ---------------------------------------------------------------- */
  function initGradeChart() {
    var wrap = $('[data-chart]');
    var table = $('[data-trend-table]');
    if (!wrap || !table) return;
    var select = $('#compare-subject');
    var legendCompare = $('[data-legend-compare]');
    var tip = $('.chart-tip', wrap);
    var ticks = $$('thead th[data-tick]', table).map(function (th) { return { short: th.dataset.tick, year: th.dataset.year || '', full: th.textContent.trim() }; });
    var series = {};
    $$('tbody tr[data-series]', table).forEach(function (tr) {
      series[tr.dataset.series] = { name: $('th', tr).textContent.trim(), values: $$('td', tr).map(function (td) { return parseFloat(td.textContent); }) };
    });
    if (!series.overall) return;
    var active = -1;
    var geom = null;
    var SVGNS = 'http://www.w3.org/2000/svg';

    function el(name, attrs, parent) {
      var n = document.createElementNS(SVGNS, name);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (parent) parent.appendChild(n);
      return n;
    }

    function render() {
      var W = Math.max(280, wrap.clientWidth);
      var H = W < 520 ? 240 : Math.round(Math.min(390, Math.max(260, W * 0.46)));
      var m = { t: 16, r: W < 520 ? 46 : 58, b: 42, l: 34 };
      var yMin = 60, yMax = 100;
      var n = ticks.length;
      var x = function (i) { return m.l + (i * (W - m.l - m.r)) / (n - 1); };
      var y = function (v) { return m.t + ((yMax - v) * (H - m.t - m.b)) / (yMax - yMin); };
      var compareKey = select ? select.value : 'none';
      var cmp = compareKey !== 'none' ? series[compareKey] : null;

      var old = $('svg', wrap);
      if (old) old.remove();
      var svg = el('svg', { class: 'chart-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true', focusable: 'false' });
      wrap.insertBefore(svg, tip);

      var grid = el('g', { class: 'chart-grid chart-axis' }, svg);
      for (var v = yMin; v <= yMax; v += 10) {
        el('line', { x1: m.l, x2: W - m.r + 8, y1: y(v), y2: y(v) }, grid);
        el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, grid).textContent = v;
      }
      ticks.forEach(function (t, i) {
        el('text', { x: x(i), y: H - m.b + 20, 'text-anchor': 'middle' }, grid).textContent = t.short;
        if (t.year) el('text', { x: x(i), y: H - m.b + 36, 'text-anchor': 'middle', 'font-weight': '700' }, grid).textContent = t.year;
      });

      function pathFor(vals) { return vals.map(function (val, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(val).toFixed(1); }).join(' '); }
      var main = series.overall.values;
      el('path', { class: 'chart-area', d: pathFor(main) + ' L' + x(n - 1) + ' ' + y(yMin) + ' L' + x(0) + ' ' + y(yMin) + ' Z' }, svg);
      if (cmp) el('path', { class: 'chart-line chart-line-compare', d: pathFor(cmp.values) }, svg);
      el('path', { class: 'chart-line chart-line-main', d: pathFor(main) }, svg);

      // End dots and end labels (value at the end of each line).
      var endMain = main[n - 1];
      var labels = [{ v: endMain, cls: 'main' }];
      if (cmp) labels.push({ v: cmp.values[n - 1], cls: 'compare' });
      labels.forEach(function (l) { el('circle', { class: 'chart-dot chart-dot-' + l.cls, cx: x(n - 1), cy: y(l.v), r: 5 }, svg); });
      var ly = labels.map(function (l) { return y(l.v) + 4; });
      if (ly.length === 2 && Math.abs(ly[0] - ly[1]) < 16) {
        var mid = (ly[0] + ly[1]) / 2;
        var up = labels[0].v >= labels[1].v;
        ly[0] = mid + (up ? -8 : 8); ly[1] = mid + (up ? 8 : -8);
      }
      labels.forEach(function (l, i) {
        el('text', { class: 'chart-end', x: x(n - 1) + 10, y: ly[i] }, svg).textContent = (l.v % 1 ? l.v.toFixed(1) : l.v) + '%';
      });

      // Hover layer
      var hover = el('g', { class: 'chart-hover', visibility: 'hidden' }, svg);
      var cross = el('line', { class: 'chart-cross', y1: m.t, y2: H - m.b }, hover);
      var hMain = el('circle', { class: 'chart-dot chart-dot-main', r: 5 }, hover);
      var hCmp = cmp ? el('circle', { class: 'chart-dot chart-dot-compare', r: 5 }, hover) : null;
      el('rect', { x: m.l - 10, y: 0, width: W - m.l - m.r + 20, height: H, fill: 'transparent', 'data-hit': '' }, svg);

      geom = { x: x, y: y, n: n, W: W, m: m, hover: hover, cross: cross, hMain: hMain, hCmp: hCmp, cmp: cmp };
      if (legendCompare) {
        legendCompare.hidden = !cmp;
        var name = $('[data-legend-compare-name]', legendCompare);
        if (name && cmp) name.textContent = cmp.name;
      }
      if (active > -1) show(active);
    }

    function show(i) {
      if (!geom) return;
      active = i;
      var g = geom;
      var cx = g.x(i);
      g.hover.setAttribute('visibility', 'visible');
      g.cross.setAttribute('x1', cx); g.cross.setAttribute('x2', cx);
      g.hMain.setAttribute('cx', cx); g.hMain.setAttribute('cy', g.y(series.overall.values[i]));
      if (g.hCmp) { g.hCmp.setAttribute('cx', cx); g.hCmp.setAttribute('cy', g.y(g.cmp.values[i])); }
      tip.innerHTML = '';
      var t = document.createElement('div'); t.className = 'tip-title'; t.textContent = ticks[i].full; tip.appendChild(t);
      function row(val, name, cls) {
        var r = document.createElement('div'); r.className = 'tip-row';
        var s = document.createElement('strong'); s.textContent = val + '%';
        var k = document.createElement('span'); k.className = 'lk ' + cls;
        var nm = document.createElement('span'); nm.textContent = name;
        r.appendChild(s); r.appendChild(k); r.appendChild(nm); tip.appendChild(r);
      }
      row(series.overall.values[i], 'Overall average', '');
      if (g.cmp) row(g.cmp.values[i], g.cmp.name, 'lk-coral');
      tip.classList.add('is-on');
      var tw = tip.offsetWidth;
      var left = cx + 14;
      if (left + tw > g.W) left = cx - tw - 14;
      tip.style.transform = 'translate(' + Math.max(0, left) + 'px, ' + (g.m.t + 4) + 'px)';
    }
    function hide() { active = -1; if (geom) geom.hover.setAttribute('visibility', 'hidden'); tip.classList.remove('is-on'); }

    wrap.addEventListener('pointermove', function (e) {
      if (!geom) return;
      var rect = wrap.getBoundingClientRect();
      var px = e.clientX - rect.left;
      var step = (geom.W - geom.m.l - geom.m.r) / (geom.n - 1);
      var i = Math.round((px - geom.m.l) / step);
      show(Math.max(0, Math.min(geom.n - 1, i)));
    });
    wrap.addEventListener('pointerleave', hide);
    wrap.addEventListener('focus', function () { show(active > -1 ? active : ticks.length - 1); });
    wrap.addEventListener('blur', hide);
    wrap.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') { if (e.key === 'Escape') hide(); return; }
      e.preventDefault();
      var i = active < 0 ? ticks.length - 1 : active + (e.key === 'ArrowRight' ? 1 : -1);
      show(Math.max(0, Math.min(ticks.length - 1, i)));
    });
    if (select) select.addEventListener('change', render);
    if ('ResizeObserver' in window) {
      var lastW = 0;
      new ResizeObserver(function () { if (Math.abs(wrap.clientWidth - lastW) > 2) { lastW = wrap.clientWidth; render(); } }).observe(wrap);
    } else {
      window.addEventListener('resize', render);
    }
    render();
  }

  /* ----------------------------------------------------------------
   * Timetable: day / week toggle, day picker, live "now" line
   * ---------------------------------------------------------------- */
  function initTimetable() {
    var wrap = $('[data-tt]');
    if (!wrap) return;
    var tt = $('.tt', wrap);
    var heads = $$('.tt-head[data-day]', wrap);
    var cols = $$('.tt-col[data-day]', wrap);
    var viewBtns = $$('[data-view-btn]');
    var dayBtns = $$('[data-day-btn]');
    var label = $('[data-tt-label]');
    var todayCol = cols.filter(function (c) { return c.classList.contains('is-today'); })[0];
    var state = {
      view: window.matchMedia('(max-width: 767.98px)').matches ? 'day' : 'week',
      day: todayCol ? +todayCol.dataset.day : 0
    };

    function render() {
      tt.dataset.view = state.view;
      wrap.dataset.mode = state.view;
      viewBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.viewBtn === state.view)); });
      dayBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.dayBtn === state.day)); });
      heads.concat(cols).forEach(function (n) { n.classList.toggle('is-selected', +n.dataset.day === state.day); });
      tt.classList.toggle('shows-today', state.view === 'week' || (todayCol && +todayCol.dataset.day === state.day));
      if (label) {
        var h = heads[state.day];
        label.textContent = state.view === 'day' && h ? h.dataset.full : label.dataset.week;
      }
    }
    viewBtns.forEach(function (b) { b.addEventListener('click', function () { state.view = b.dataset.viewBtn; render(); }); });
    dayBtns.forEach(function (b) { b.addEventListener('click', function () { state.day = +b.dataset.dayBtn; render(); }); });
    wrap.addEventListener('keydown', function (e) {
      if (state.view !== 'day' || !e.target.closest('[data-day-btn]')) return;
      var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      state.day = (state.day + dir + dayBtns.length) % dayBtns.length;
      render();
      dayBtns[state.day].focus();
    });

    function placeNow() {
      if (!todayCol) return;
      var now = schoolNow();
      var t0 = parseInt(getComputedStyle(tt).getPropertyValue('--t0'), 10);
      var t1 = parseInt(getComputedStyle(tt).getPropertyValue('--t1'), 10);
      var axis = $('.tt-axis', wrap);
      var line = $('.tt-now', todayCol);
      var tag = axis && $('.tt-now-tag', axis);
      if (now.min < t0 || now.min > t1) { if (line) line.remove(); if (tag) tag.remove(); return; }
      if (!line) {
        line = document.createElement('div');
        line.className = 'tt-now';
        line.setAttribute('aria-hidden', 'true');
        todayCol.appendChild(line);
      }
      if (axis && !tag) {
        tag = document.createElement('span');
        tag.className = 'tt-now-tag';
        axis.appendChild(tag);
      }
      line.style.setProperty('--now', now.min);
      if (tag) { tag.style.setProperty('--now', now.min); tag.textContent = fmtTime(now.min); }
      // Hide the hour label the tag would collide with.
      if (axis) $$('span:not(.tt-now-tag)', axis).forEach(function (s) {
        s.style.visibility = Math.abs(parseInt(s.style.getPropertyValue('--m'), 10) - now.min) < 14 ? 'hidden' : '';
      });
    }
    render();
    placeNow();
    setInterval(placeNow, 30000);

  }

  /* ----------------------------------------------------------------
   * Print buttons (timetable, report card)
   * ---------------------------------------------------------------- */
  function initPrint() {
    var buttons = $$('[data-print]');
    if (!buttons.length) return;
    buttons.forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  }

  /* ----------------------------------------------------------------
   * Messages: thread switching, filters, search, composer
   * ---------------------------------------------------------------- */
  var THREADS = {
    harlow: { name: 'Ms. Eleanor Harlow', role: 'English Literature', initials: 'EH', av: 'av-coral', subject: 'Your “Inspector Calls” essay',
      messages: [
        ['day', 'Yesterday'],
        ['in', 'Hi Maya, I’ve marked your essay on “An Inspector Calls”: an A− and a really perceptive argument about dramatic irony. Well done.', '16:05'],
        ['in', 'One thing to work on: embed shorter quotations. Pick a single word and zoom in on it. There’s an example on page 2 of my feedback.', '16:06', 'essay-feedback-maya.pdf'],
        ['out', 'Thank you, Ms. Harlow. Could I bring my plan for the Macbeth log to your Friday clinic?', '19:40'],
        ['day', 'Today'],
        ['in', 'Of course. Friday lunchtime in E7. Bring Act 1 and a highlighter.', '08:15']
      ] },
    whitfield: { name: 'Coach Dana Whitfield', role: 'PE · Netball', initials: 'DW', av: 'av-orange', subject: 'Netball squad list',
      messages: [
        ['day', 'Today'],
        ['in', 'Squad for Friday’s match against Kingsmere is on the sports noticeboard. Maya, you’re starting at wing attack.', '07:50'],
        ['in', 'Kit check at 15:30 in the sports hall. Bring a water bottle and your mouthguard.', '07:51']
      ] },
    adeyemi: { name: 'Mr. Tunde Adeyemi', role: 'Mathematics', initials: 'TA', av: 'av-indigo', subject: 'Quadratics set 3, question 12',
      messages: [
        ['day', 'Monday'],
        ['out', 'Hi Mr. Adeyemi, I’m stuck on question 12 of the quadratics set. Is it meant to have two answers?', '18:10'],
        ['day', 'Tuesday'],
        ['in', 'Good question. Yes, there are two solutions, but one is negative and the context rules it out. Explain why in a sentence and you’ll get the extra mark.', '08:30'],
        ['out', 'That makes sense now, thank you.', '12:02']
      ] },
    castellanos: { name: 'Dr. Sofia Castellanos', role: 'Science', initials: 'SC', av: 'av-teal', subject: 'Science fair teams',
      messages: [
        ['day', 'Monday'],
        ['in', 'Year 10 scientists: proposals are due Friday 2 October, in teams of up to three. I’ve added a risk-assessment guide to the assignment.', '14:20'],
        ['out', 'Priya, Jonah and I would like to test how salt concentration affects plant growth. Is that OK?', '17:45'],
        ['day', 'Tuesday'],
        ['in', 'Lovely idea. Think about how you’ll keep light and temperature the same. Come and see me about pots and seeds.', '09:05']
      ] },
    office: { name: 'School Office', role: 'Harbourview Academy', initials: 'SO', av: 'av-slate', subject: 'Brighton field trip letter',
      messages: [
        ['day', 'Wednesday'],
        ['in', 'The Year 10 Geography field trip to Brighton is on Friday 9 October. A consent slip has been sent to your parent or carer through the parent portal.', '11:30', 'brighton-trip-letter.pdf']
      ] },
    fairweather: { name: 'Mrs. Joan Fairweather', role: 'Form tutor · 10H', initials: 'JF', av: 'av-violet', subject: 'Merit milestone',
      messages: [
        ['day', 'Last Friday'],
        ['in', 'Maya, you reached 125 merit points this week, the highest in 10H. Keep it up and you’ll make Silver before half-term.', '15:10'],
        ['out', 'Thank you, Mrs. Fairweather!', '17:22']
      ] },
    library: { name: 'Harbourview Library', role: 'Library team', initials: 'HL', av: 'av-amber', subject: 'Book due back Monday',
      messages: [
        ['day', 'Last Thursday'],
        ['in', 'Reminder: “The Curious Incident of the Dog in the Night-Time” is due back on Monday 28 September. You can renew it once at the front desk.', '12:40']
      ] }
  };

  function messageHtml(m) {
    if (m[0] === 'day') return '<p class="day-sep">' + esc(m[1]) + '</p>';
    var attach = m[3] ? '<span class="msg-attach">' + icon('clip') + esc(m[3]) + '</span>' : '';
    return '<div class="msg msg-' + m[0] + '"><div class="bubble">' + esc(m[1]) + '</div>' + attach +
      '<span class="msg-meta">' + esc(m[2]) + (m[0] === 'out' ? ' · You' : '') + '</span></div>';
  }

  function initMessages() {
    var inbox = $('[data-inbox]');
    if (!inbox) return;
    var threads = $$('[data-thread]', inbox);
    var head = $('[data-convo-head]', inbox);
    var subject = $('[data-convo-subject]', inbox);
    var body = $('[data-convo-body]', inbox);
    var back = $('[data-convo-back]', inbox);
    var form = $('[data-composer]', inbox);
    var search = $('#thread-search');
    var chips = $$('[data-filter]', inbox);
    var current = (threads.filter(function (t) { return t.getAttribute('aria-current') === 'true'; })[0] || threads[0]).dataset.thread;
    var filter = 'all';
    var mobile = window.matchMedia('(max-width: 991.98px)');

    function open(key, focusConvo) {
      var t = THREADS[key];
      if (!t) return;
      current = key;
      threads.forEach(function (b) {
        var on = b.dataset.thread === key;
        b.setAttribute('aria-current', String(on));
        if (on) b.classList.remove('is-unread');
      });
      $('.avatar', head).className = 'avatar ' + t.av;
      $('.avatar', head).textContent = t.initials;
      $('h2', head).textContent = t.name;
      $('p', head).textContent = t.role;
      $('span', subject).textContent = t.subject;
      body.innerHTML = t.messages.map(messageHtml).join('');
      body.scrollTop = body.scrollHeight;
      inbox.classList.add('is-open');
      if (focusConvo && mobile.matches) {
        inbox.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        $('h2', head).focus({ preventScroll: true });
      }
    }

    threads.forEach(function (b) { b.addEventListener('click', function () { open(b.dataset.thread, true); }); });
    if (back) back.addEventListener('click', function () {
      inbox.classList.remove('is-open');
      var btn = threads.filter(function (b) { return b.dataset.thread === current; })[0];
      if (btn) btn.focus();
    });

    function applyFilter() {
      var q = search ? search.value.trim().toLowerCase() : '';
      threads.forEach(function (b) {
        var li = b.closest('li');
        var kindOk = filter === 'all' || (filter === 'unread' ? b.classList.contains('is-unread') : li.dataset.kind === filter);
        var textOk = !q || b.textContent.toLowerCase().indexOf(q) > -1;
        li.hidden = !(kindOk && textOk);
      });
      var emptyEl = $('[data-thread-empty]', inbox);
      if (emptyEl) emptyEl.hidden = threads.some(function (b) { return !b.closest('li').hidden; });
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        filter = c.dataset.filter;
        chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
        applyFilter();
      });
    });
    if (search) search.addEventListener('input', applyFilter);

    // Mobile starts on the thread list; desktop shows both panes.
    if (mobile.matches) inbox.classList.remove('is-open');
    else inbox.classList.add('is-open');
    body.scrollTop = body.scrollHeight;

    if (!form) return;
    var text = $('textarea', form);
    var err = $('[data-composer-error]', inbox);
    var attachInput = $('input[type="file"]', form);
    var attachName = '';
    text.addEventListener('input', function () {
      text.style.height = 'auto';
      text.style.height = Math.min(text.scrollHeight, 160) + 'px';
      if (err) err.classList.remove('is-visible');
    });
    text.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); }
    });
    if (attachInput) attachInput.addEventListener('change', function () {
      attachName = attachInput.files.length ? attachInput.files[0].name : '';
      var hint = $('[data-attach-hint]', inbox);
      if (hint) { hint.hidden = !attachName; hint.textContent = attachName ? 'Attached: ' + attachName : ''; }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = text.value.trim();
      if (!value && !attachName) { if (err) err.classList.add('is-visible'); text.focus(); return; }
      var now = new Date();
      var msg = ['out', value || 'Attachment', fmtTime(now.getHours() * 60 + now.getMinutes()), attachName || undefined];
      var t = THREADS[current];
      var last = t.messages.filter(function (m) { return m[0] === 'day'; }).pop();
      if (!last || last[1] !== 'Today') { t.messages.push(['day', 'Today']); body.insertAdjacentHTML('beforeend', messageHtml(['day', 'Today'])); }
      t.messages.push(msg);
      body.insertAdjacentHTML('beforeend', messageHtml(msg));
      body.scrollTop = body.scrollHeight;
      var prev = $('[data-thread="' + current + '"] .thread-preview', inbox);
      if (prev) prev.textContent = 'You: ' + (value || attachName);
      text.value = ''; text.style.height = '';
      attachName = '';
      if (attachInput) attachInput.value = '';
      var hint = $('[data-attach-hint]', inbox);
      if (hint) hint.hidden = true;
      announce('Message added to the conversation');
    });
  }

  /* ----------------------------------------------------------------
   * Form helpers: browser validation, then a success state
   * ---------------------------------------------------------------- */
  function validate(form) {
    if (form.checkValidity()) { form.classList.remove('was-validated'); return true; }
    form.classList.add('was-validated');
    var bad = form.querySelector(':invalid');
    if (bad) bad.focus();
    return false;
  }
  function showSuccess(form, message) {
    var box = $('[data-success]', form);
    var fields = $('[data-fields]', form);
    if (fields) fields.hidden = true;
    $$('[type="submit"]', form.closest('.modal') || form).forEach(function (b) { b.hidden = true; });
    if (box) {
      $('span', box).textContent = message;
      box.classList.add('is-visible');
      box.setAttribute('tabindex', '-1');
      box.focus();
    }
    announce(message);
  }
  function resetForm(form) {
    form.reset();
    form.classList.remove('was-validated');
    var box = $('[data-success]', form);
    var fields = $('[data-fields]', form);
    if (fields) fields.hidden = false;
    if (box) box.classList.remove('is-visible');
    $$('[type="submit"]', form.closest('.modal') || form).forEach(function (b) { b.hidden = false; });
  }

  /* ----------------------------------------------------------------
   * Parent view: child switcher keeps modals in sync
   * ---------------------------------------------------------------- */
  function activeChild() {
    var tab = $('.child-tab.active');
    return tab ? { id: tab.dataset.child, name: tab.dataset.childName } : { id: 'maya', name: 'Maya' };
  }
  function initChildSwitcher() {
    var tabs = $$('.child-tab');
    if (!tabs.length) return;
    tabs.forEach(function (t) {
      t.addEventListener('shown.bs.tab', function () {
        $$('[data-child-label]').forEach(function (n) { n.textContent = t.dataset.childName; });
        announce('Showing ' + t.dataset.childName);
      });
    });
    // Links such as parent.html#fees land on the right card.
    if (location.hash && location.hash.length > 1) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) setTimeout(function () { target.scrollIntoView({ block: 'start' }); }, 50);
    }
  }

  /* ----------------------------------------------------------------
   * Parent view: fees and the pay modal
   * ---------------------------------------------------------------- */
  function initFees() {
    var modal = $('#payModal');
    if (!modal) return;
    var form = $('form', modal);
    var lines = $('[data-pay-lines]', modal);
    var total = $('[data-pay-total]', modal);
    var submitLabel = $('[data-pay-submit]', modal);
    var childId = 'maya';

    function sum() {
      var t = $$('input[type="checkbox"]', lines).filter(function (c) { return c.checked; })
        .reduce(function (s, c) { return s + parseFloat(c.value); }, 0);
      total.textContent = money(t);
      if (submitLabel) submitLabel.textContent = 'Pay ' + money(t);
      return t;
    }
    modal.addEventListener('show.bs.modal', function (e) {
      resetForm(form);
      var trigger = e.relatedTarget;
      childId = (trigger && trigger.dataset.child) || activeChild().id;
      var items = $$('#child-' + childId + ' .fee-item:not(.is-paid)');
      lines.innerHTML = items.map(function (it, i) {
        return '<li><label for="pay-line-' + i + '"><input class="form-check-input" type="checkbox" id="pay-line-' + i + '" value="' + it.dataset.amount + '" data-fee="' + it.dataset.fee + '" checked>' +
          '<span>' + esc($('h3', it).textContent) + '</span><strong>' + money(parseFloat(it.dataset.amount)) + '</strong></label></li>';
      }).join('') || '<li class="text-body-secondary">Everything is paid. Nothing is due.</li>';
      sum();
    });
    lines.addEventListener('change', sum);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var chosen = $$('input[type="checkbox"]', lines).filter(function (c) { return c.checked; });
      var err = $('[data-pay-error]', modal);
      if (!chosen.length) { if (err) err.classList.add('is-visible'); return; }
      if (err) err.classList.remove('is-visible');
      if (!validate(form)) return;
      var paid = sum();
      chosen.forEach(function (c) {
        var it = $('#child-' + childId + ' .fee-item[data-fee="' + c.dataset.fee + '"]');
        if (!it) return;
        it.classList.add('is-paid');
        var chip = $('.chip', it);
        if (chip) { chip.className = 'chip chip-success'; chip.innerHTML = icon('check') + ' Paid'; }
      });
      var remaining = $$('#child-' + childId + ' .fee-item:not(.is-paid)').reduce(function (s, it) { return s + parseFloat(it.dataset.amount); }, 0);
      var due = $('#child-' + childId + ' [data-fee-total]');
      if (due) due.textContent = money(remaining);
      var payBtn = $('#child-' + childId + ' [data-pay-btn]');
      if (payBtn && remaining === 0) { payBtn.disabled = true; payBtn.innerHTML = icon('check') + ' All paid'; }
      showSuccess(form, money(paid) + ' marked as paid in this preview. No money has moved: connect your payment provider to take real payments.');
    });
  }

  /* ----------------------------------------------------------------
   * Parent view: sign permission slips
   * ---------------------------------------------------------------- */
  function initSlips() {
    var forms = $$('[data-slip-form]');
    if (!forms.length) return;
    forms.forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(form)) return;
        var slip = form.closest('.slip');
        var name = $('input[type="text"]', form).value.trim();
        slip.classList.add('is-signed');
        var actions = $('.slip-actions', slip);
        if (actions) actions.innerHTML = '<span class="slip-signed">' + icon('pen') + ' Signed by ' + esc(name) + ' just now</span><span class="chip chip-success">' + icon('check') + ' Signed</span>';
        var collapse = form.closest('.collapse');
        if (collapse && window.bootstrap) window.bootstrap.Collapse.getOrCreateInstance(collapse).hide();
        var pane = slip.closest('.tab-pane') || document;
        var badge = $('[data-slip-count]', pane);
        var left = $$('.slip:not(.is-signed)[data-pending]', pane).length;
        if (badge) { badge.textContent = left ? left + ' to sign' : 'All signed'; badge.className = 'chip ' + (left ? 'chip-coral' : 'chip-success'); }
        announce('Permission slip signed');
        if (actions) { actions.setAttribute('tabindex', '-1'); actions.focus(); }
      });
    });
  }

  /* ----------------------------------------------------------------
   * Parent view: contact a teacher and report an absence (modals)
   * ---------------------------------------------------------------- */
  function initParentModals() {
    var contact = $('#contactModal');
    if (contact) {
      var cForm = $('form', contact);
      contact.addEventListener('show.bs.modal', function (e) {
        resetForm(cForm);
        var t = e.relatedTarget;
        $('#contact-to').value = (t && t.dataset.teacher) ? t.dataset.teacher + ' (' + t.dataset.role + ')' : '';
        $('#contact-about').value = activeChild().name;
      });
      cForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(cForm)) return;
        showSuccess(cForm, 'Your message is ready. This preview does not send it anywhere: connect the form to your school’s messaging service to deliver it.');
      });
    }
    var absence = $('#absenceModal');
    if (absence) {
      var aForm = $('form', absence);
      absence.addEventListener('show.bs.modal', function (e) {
        resetForm(aForm);
        var t = e.relatedTarget;
        var child = (t && t.dataset.child) || activeChild().id;
        $('#absence-child').value = child;
        if (t && t.dataset.date) $('#absence-date').value = t.dataset.date;
      });
      aForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(aForm)) return;
        var sel = $('#absence-child');
        showSuccess(aForm, 'Absence note for ' + sel.options[sel.selectedIndex].text + ' is ready for the attendance office. Connect this form to your school system to send it.');
      });
    }
  }

  /* ----------------------------------------------------------------
   * Boot
   * ---------------------------------------------------------------- */
  function init() {
    initTheme();
    initGreeting();
    initTodayTimeline();
    initRings();
    initAssignmentFilters();
    initAssignmentDrawer();
    initGradeChart();
    initTimetable();
    initPrint();
    initMessages();
    initChildSwitcher();
    initFees();
    initSlips();
    initParentModals();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
