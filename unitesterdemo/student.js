(function () {
  "use strict";

  const U = window.Unitester;
  const state = {
    tests: [],
    testId: "",
    test: null,
    student: null,
    startedAt: "",
    currentIndex: 0,
    answers: [],
    flagged: [],
    seen: [],
    mode: "home",
    resultText: "",
    resultFilename: "",
    activityMode: "test",
    reviewSource: null,
    marked: [],
    resumeDraft: null,
    timerId: null,
    timerDeadline: null,
    timerDismissed: false,
    timerPhase: "",
    effectiveCompletedAt: "",
    extraTimeMultiplier: 1,
    restBreaksEnabled: false,
    restBreaksRemaining: 3,
    restBreakActive: false,
    restBreakDeadline: null,
    restBreakTimerId: null,
    restBreaksUsed: 0,
    mainTimerRemainingAtBreakStart: 0,
    examLocked: false,
    pendingResult: null,
  };

  const elements = {
    startForm: document.getElementById("startForm"),
    testSelect: document.getElementById("testSelect"),
    schoolUsername: document.getElementById("schoolUsername"),
    testName: document.getElementById("testName"),
    homeChoiceRow: document.getElementById("homeChoiceRow"),
    nameSearchPanel: document.getElementById("nameSearchPanel"),
    searchByNameButton: document.getElementById("searchByNameButton"),
    testChoicePanel: document.getElementById("testChoicePanel"),
    namedTestResult: document.getElementById("namedTestResult"),
    openTestSelectField: document.getElementById("openTestSelectField"),
    reviewModeNote: document.getElementById("reviewModeNote"),
    standardStartRow: document.getElementById("standardStartRow"),
    reviewStartRow: document.getElementById("reviewStartRow"),
    startNewTestButton: document.getElementById("startNewTestButton"),
    newReviewButton: document.getElementById("newReviewButton"),
    reviewPreviousButton: document.getElementById("reviewPreviousButton"),
    previousReviewPanel: document.getElementById("previousReviewPanel"),
    previousAttemptSelect: document.getElementById("previousAttemptSelect"),
    previousResultFile: document.getElementById("previousResultFile"),
    openSavedReviewButton: document.getElementById("openSavedReviewButton"),
    startPreviousReviewButton: document.getElementById(
      "startPreviousReviewButton",
    ),
    botPhoneNumber: document.getElementById("botPhoneNumber"),
    startButton: document.getElementById("startButton"),
    resumeButton: document.getElementById("resumeButton"),
    resumeReviewButton: document.getElementById("resumeReviewButton"),
    findByNameButton: document.getElementById("findByNameButton"),
    browseOpenButton: document.getElementById("browseOpenButton"),
    homeStatus: document.getElementById("homeStatus"),
    examTitle: document.getElementById("examTitle"),
    examCounter: document.getElementById("examCounter"),
    questionCounter: document.getElementById("questionCounter"),
    examContent: document.getElementById("examContent"),
    footerRight: document.getElementById("examFooterRight"),
    endButton: document.getElementById("endButton"),
    explainButton: document.getElementById("explainButton"),
    markButton: document.getElementById("markButton"),
    flagButton: document.getElementById("flagButton"),
    colorScheme: document.getElementById("colorScheme"),
    navigatorModal: document.getElementById("navigatorModal"),
    navigatorRows: document.getElementById("navigatorRows"),
    navigatorSummary: document.getElementById("navigatorSummary"),
    navigatorClose: document.getElementById("navigatorClose"),
    navigatorCloseTop: document.getElementById("navigatorCloseTop"),
    endModal: document.getElementById("endModal"),
    endBody: document.getElementById("endBody"),
    turnstilePanel: document.getElementById("turnstilePanel"),
    turnstileMount: document.getElementById("turnstileMount"),
    turnstileStatus: document.getElementById("turnstileStatus"),
    cancelEndButton: document.getElementById("cancelEndButton"),
    confirmEndButton: document.getElementById("confirmEndButton"),
    resumeModal: document.getElementById("resumeModal"),
    browserResumeBlock: document.getElementById("browserResumeBlock"),
    browserResumeText: document.getElementById("browserResumeText"),
    resumeBrowserAttempt: document.getElementById("resumeBrowserAttempt"),
    resumeStatus: document.getElementById("resumeStatus"),
    closeResume: document.getElementById("closeResume"),
    timeModal: document.getElementById("timeModal"),
    timeTitle: document.getElementById("timeTitle"),
    timeBody: document.getElementById("timeBody"),
    continueAfterTime: document.getElementById("continueAfterTime"),
    endAfterTime: document.getElementById("endAfterTime"),
    explanationModal: document.getElementById("explanationModal"),
    explanationTitle: document.getElementById("explanationTitle"),
    explanationBody: document.getElementById("explanationBody"),
    closeExplanation: document.getElementById("closeExplanation"),
    closeExplanationTop: document.getElementById("closeExplanationTop"),
    examShell: document.getElementById("examShell"),
    accommodationsModal: document.getElementById("accommodationsModal"),
    extraTimeToggleRow: document.getElementById("extraTimeToggleRow"),
    extraTimeToggle: document.getElementById("extraTimeToggle"),
    extraTimePct: document.getElementById("extraTimePct"),
    restBreakToggleRow: document.getElementById("restBreakToggleRow"),
    restBreakToggle: document.getElementById("restBreakToggle"),
    accommodationsCancel: document.getElementById("accommodationsCancel"),
    accommodationsStart: document.getElementById("accommodationsStart"),
    restBreakModal: document.getElementById("restBreakModal"),
    restBreakCountdown: document.getElementById("restBreakCountdown"),
    endRestBreakButton: document.getElementById("endRestBreakButton"),
    restBreakButton: document.getElementById("restBreakButton"),
  };

  function setHomeBusy(isBusy) {
    const isReviewMode = !elements.reviewStartRow.hidden;
    elements.startButton.disabled = isBusy || !elements.testSelect.value;
    elements.resumeButton.disabled = isBusy || !elements.testSelect.value;
    elements.resumeReviewButton.disabled = isBusy || !elements.testSelect.value;
    elements.findByNameButton.disabled = isBusy;
    elements.browseOpenButton.disabled = isBusy;
    elements.searchByNameButton.disabled = isBusy;
    elements.testSelect.disabled = isBusy;
    elements.testName.disabled = isBusy;
    elements.startNewTestButton.disabled = isBusy;
    elements.newReviewButton.disabled = isBusy;
    elements.reviewPreviousButton.disabled = isBusy;
    elements.startPreviousReviewButton.disabled = isBusy;
    elements.openSavedReviewButton.disabled = isBusy;
    elements.previousResultFile.disabled = isBusy;
    if (!isBusy) {
      updateStartControlsForSelectedTest();
    }
  }

  function resetTestChoices(message) {
    state.tests = [];
    elements.testSelect.replaceChildren(
      new Option(message || "Find a test first...", ""),
    );
    elements.startButton.disabled = true;
    elements.testChoicePanel.hidden = true;
    elements.namedTestResult.hidden = true;
    elements.openTestSelectField.hidden = true;
    elements.reviewModeNote.hidden = true;
    elements.reviewStartRow.hidden = true;
    elements.standardStartRow.hidden = false;
    elements.previousReviewPanel.hidden = true;
  }

  function selectedTestRecord() {
    const testId = elements.testSelect.value;
    return state.tests.find((test) => test.id === testId) || null;
  }

  function updateStartControlsForSelectedTest() {
    const known = selectedTestRecord();
    const test = known && known.test;
    const isReviewMode = test && test.activityMode === "review";
    elements.reviewModeNote.hidden = !isReviewMode;
    elements.reviewModeNote.textContent = isReviewMode
      ? "This test is in review mode. Choose a test attempt, a new review, or review a previous completion."
      : "";
    elements.standardStartRow.hidden = Boolean(isReviewMode);
    elements.reviewStartRow.hidden = !isReviewMode;
    elements.previousReviewPanel.hidden = true;
    elements.startButton.disabled = !elements.testSelect.value;
    elements.resumeButton.disabled = !elements.testSelect.value;
    elements.resumeReviewButton.disabled = !elements.testSelect.value;
  }

  function showNameSearch() {
    if (!elements.schoolUsername.value.trim()) {
      U.setStatus(
        elements.homeStatus,
        "Enter your school username first.",
        "error",
      );
      return;
    }
    resetTestChoices("Find a test first...");
    elements.nameSearchPanel.hidden = false;
    U.setStatus(elements.homeStatus, "", "");
    window.setTimeout(() => elements.testName.focus(), 0);
  }

  async function findTestByName() {
    const username = elements.schoolUsername.value.trim();
    const testName = elements.testName.value.trim();
    if (!username || !testName) {
      resetTestChoices("Find a test first...");
      U.setStatus(
        elements.homeStatus,
        "Enter your school username and test name first.",
        "error",
      );
      setHomeBusy(false);
      return;
    }

    setHomeBusy(true);
    elements.testSelect.replaceChildren(new Option("Finding test...", ""));

    try {
      const testBase = U.normaliseTestNameToBase(testName);
      U.setStatus(
        elements.homeStatus,
        "Looking for tests/" + testBase + ".txt...",
        "",
      );
      const test = await U.findNamedTest(testName);
      elements.testSelect.replaceChildren();
      if (!test) {
        resetTestChoices("No matching test found");
        U.setStatus(
          elements.homeStatus,
          "No matching test file was found in the tests folder.",
          "error",
        );
        return;
      }
      state.tests = [test];
      elements.testSelect.append(new Option(test.title, test.id));
      elements.namedTestResult.textContent = test.title;
      elements.namedTestResult.hidden = false;
      elements.openTestSelectField.hidden = true;
      elements.testChoicePanel.hidden = false;
      elements.startButton.disabled = false;
      updateStartControlsForSelectedTest();
      U.setStatus(elements.homeStatus, "Test found.", "ok");
    } catch (error) {
      resetTestChoices("Unable to find test");
      U.setStatus(elements.homeStatus, error.message, "error");
    } finally {
      setHomeBusy(false);
    }
  }

  async function browseOpenTests() {
    const username = elements.schoolUsername.value.trim();
    if (!username) {
      resetTestChoices("Find a test first...");
      U.setStatus(
        elements.homeStatus,
        "Enter your school username first.",
        "error",
      );
      return;
    }

    setHomeBusy(true);
    elements.nameSearchPanel.hidden = true;
    elements.namedTestResult.hidden = true;
    elements.openTestSelectField.hidden = false;
    elements.testChoicePanel.hidden = false;
    elements.testSelect.replaceChildren(new Option("Loading tests...", ""));
    U.setStatus(elements.homeStatus, "Looking for open numbered tests...", "");

    try {
      const tests = await U.browseOpenTests((id) => {
        U.setStatus(elements.homeStatus, "Checking tests/" + id + ".txt...");
      });
      state.tests = tests;
      elements.testSelect.replaceChildren();
      if (!tests.length) {
        resetTestChoices("No open tests found");
        U.setStatus(
          elements.homeStatus,
          "No open numbered tests were found.",
          "error",
        );
        return;
      }
      tests.forEach((test) => {
        elements.testSelect.append(
          new Option(test.id + " - " + test.title, test.id),
        );
      });
      elements.startButton.disabled = !elements.testSelect.value;
      updateStartControlsForSelectedTest();
      U.setStatus(
        elements.homeStatus,
        tests.length +
          " open test" +
          (tests.length === 1 ? "" : "s") +
          " available.",
        "ok",
      );
    } catch (error) {
      resetTestChoices("Unable to load tests");
      U.setStatus(elements.homeStatus, error.message, "error");
    } finally {
      setHomeBusy(false);
    }
  }

  async function prepareSelectedTest() {
    if (!elements.startForm.reportValidity()) {
      return null;
    }

    const testId = elements.testSelect.value;
    if (!testId) {
      return null;
    }

    setHomeBusy(true);
    U.setStatus(elements.homeStatus, "Loading " + testId + ".txt...", "");

    try {
      const known = state.tests.find((test) => test.id === testId);
      const test = known
        ? known.test
        : await U.fetchTest(testId, U.testPasswordFromBase(testId));
      state.testId = testId;
      state.test = test;
      state.student = {
        schoolUsername: elements.schoolUsername.value.trim(),
      };
      state.startedAt = new Date().toISOString();
      state.currentIndex = 0;
      state.answers = Array(test.questions.length).fill(null);
      state.flagged = Array(test.questions.length).fill(false);
      state.seen = Array(test.questions.length).fill(false);
      state.marked = Array(test.questions.length).fill(false);
      state.reviewSource = null;
      state.resultText = "";
      state.resultFilename = "";
      state.pendingResult = null;
      state.timerDeadline = null;
      state.timerDismissed = false;
      state.timerPhase = "";
      state.effectiveCompletedAt = "";
      if (state.restBreakTimerId) {
        window.clearInterval(state.restBreakTimerId);
        state.restBreakTimerId = null;
      }
      state.restBreakActive = false;
      state.restBreakDeadline = null;
      state.mainTimerRemainingAtBreakStart = 0;
      stopGuideTimer(false);
      return test;
    } catch (error) {
      U.setStatus(elements.homeStatus, error.message, "error");
      return null;
    } finally {
      setHomeBusy(false);
    }
  }

  function showAccommodations() {
    const test = state.test;
    const baseMinutes = Math.max(0, Number.parseInt(test && test.guideTimeMinutes, 10) || 0);
    const hasTimer = baseMinutes > 0;
    const canExtraTime = Boolean(test && test.extraTimeOption !== "disallow" && hasTimer);
    if (!hasTimer) {
      state.extraTimeMultiplier = 1;
      state.restBreaksEnabled = false;
      return Promise.resolve(false);
    }
    const pct = test.extraTimeOption === "allow-10-percent" ? "10%" : "25%";
    const mult = test.extraTimeOption === "allow-10-percent" ? 1.1 : 1.25;
    elements.extraTimeToggleRow.hidden = !canExtraTime;
    if (canExtraTime) {
      elements.extraTimePct.textContent = "(+" + pct + " extra time)";
      elements.extraTimeToggle.checked = false;
    }
    elements.restBreakToggleRow.hidden = false;
    elements.restBreakToggle.checked = false;
    elements.accommodationsModal.hidden = false;
    return new Promise((resolve) => {
      function cleanup() {
        elements.accommodationsModal.hidden = true;
        elements.accommodationsStart.removeEventListener("click", onStart);
        elements.accommodationsCancel.removeEventListener("click", onCancel);
      }
      function onStart() {
        cleanup();
        state.extraTimeMultiplier = (canExtraTime && elements.extraTimeToggle.checked) ? mult : 1;
        state.restBreaksEnabled = elements.restBreakToggle.checked;
        state.restBreaksRemaining = 3;
        state.restBreaksUsed = 0;
        resolve(false);
      }
      function onCancel() { cleanup(); resolve(true); }
      elements.accommodationsStart.addEventListener("click", onStart);
      elements.accommodationsCancel.addEventListener("click", onCancel);
    });
  }

  async function startSelectedTest(event) {
    if (event) {
      event.preventDefault();
      const known = selectedTestRecord();
      if (known && known.test && known.test.activityMode === "review") {
        U.setStatus(
          elements.homeStatus,
          "Choose Start New Test, New Review, or Review Previous.",
          "error",
        );
        return;
      }
    }
    const test = await prepareSelectedTest();
    if (!test) {
      return;
    }
    const cancelled = await showAccommodations();
    if (cancelled) return;
    state.activityMode = "test";
    showInstructions();
  }

  async function startNewReview() {
    const test = await prepareSelectedTest();
    if (!test) {
      return;
    }
    if (test.activityMode !== "review") {
      U.setStatus(
        elements.homeStatus,
        "This test is not available in review mode.",
        "error",
      );
      return;
    }
    state.activityMode = "new-review";
    showInstructions();
  }

  function enterExamMode() {
    document.body.classList.add("exam-active");
    elements.examTitle.textContent = state.test.title;
    elements.markButton.hidden = true;
  }

  function leaveExamMode() {
    document.body.classList.remove("exam-active");
    state.mode = "home";
    stopGuideTimer(false);
  }

  function setFooterButtons(buttons) {
    elements.footerRight.replaceChildren();
    buttons.forEach((button) => elements.footerRight.appendChild(button));
  }

  function makeExamButton(label, handler) {
    const button = document.createElement("button");
    button.className = "exam-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function guideTimeMinutes() {
    const base = Math.max(
      0,
      Number.parseInt(state.test && state.test.guideTimeMinutes, 10) || 0,
    );
    return Math.round(base * (state.extraTimeMultiplier || 1));
  }

  function shouldRunGuideTimer() {
    const enforcement = state.test && state.test.timerEnforcement;
    if (enforcement === "disabled") return false;
    return guideTimeMinutes() > 0 && !state.timerDismissed;
  }

  function shouldEnforceTimer() {
    const enforcement = state.test && state.test.timerEnforcement;
    if (!enforcement || enforcement === "enforce-test-informational-review") return state.activityMode === "test";
    if (enforcement === "enforce-always") return true;
    return false;
  }

  function shouldUseTiming() {
    return state.activityMode === "test" && guideTimeMinutes() > 0;
  }

  function formatRemaining(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return minutes + ":" + seconds;
  }

  function updateExamCounter() {
    let questionText = "";
    if (state.mode === "question" && state.test) {
      questionText =
        state.currentIndex + 1 + " of " + state.test.questions.length;
    }
    elements.questionCounter.textContent = questionText;

    let timerText = "";
    elements.examCounter.classList.remove("is-timer", "is-warning");
    if (shouldRunGuideTimer() && state.timerDeadline) {
      const remaining = state.timerDeadline - Date.now();
      if (remaining > 0) {
        timerText = "◷ Time Remaining " + formatRemaining(remaining);
        elements.examCounter.classList.add("is-timer");
        if (remaining < 5 * 60000) {
          elements.examCounter.classList.add("is-warning");
        }
      }
    }
    elements.examCounter.textContent = timerText;
  }

  function stopGuideTimer(clearDeadline) {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
    if (clearDeadline) {
      state.timerDeadline = null;
      state.timerPhase = "";
    }
  }

  function startInstructionTimer() {
    if (!shouldRunGuideTimer()) {
      return;
    }
    state.timerPhase = "instructions";
    state.timerDeadline = Date.now() + 60000;
    restartTimerInterval();
  }

  function startGuideTimer(existingDeadline) {
    if (!shouldRunGuideTimer()) {
      return;
    }
    state.timerPhase = "test";
    if (!state.timerDeadline) {
      state.timerDeadline =
        existingDeadline || Date.now() + guideTimeMinutes() * 60000;
    }
    restartTimerInterval();
  }

  function restartTimerInterval() {
    if (state.timerId) {
      return;
    }
    state.timerId = window.setInterval(checkGuideTimer, 1000);
    checkGuideTimer();
  }

  function checkGuideTimer() {
    if (state.restBreakActive) {
      return;
    }
    if (!shouldRunGuideTimer() || !state.timerDeadline) {
      stopGuideTimer(false);
      updateExamCounter();
      return;
    }
    const remaining = state.timerDeadline - Date.now();
    if (remaining <= 0) {
      stopGuideTimer(false);
      if (state.timerPhase === "instructions") {
        state.timerDeadline = null;
        state.timerPhase = "";
        showQuestion(0);
        return;
      }
      state.effectiveCompletedAt = new Date().toISOString();
      state.timerDismissed = true;
      state.timerDeadline = null;
      state.timerPhase = "";
      updateExamCounter();
      saveCurrentActivity();
      if (shouldEnforceTimer()) {
        state.examLocked = true;
        elements.timeTitle.textContent = "Time Expired";
        elements.timeBody.textContent = "Your time has expired. Click OK to submit your answers.";
        elements.continueAfterTime.hidden = true;
        elements.endAfterTime.textContent = "OK";
        elements.timeModal.hidden = false;
        return;
      }
      elements.timeBody.textContent =
        "This would normally be the end of the usual time allowed for this test.";
      elements.timeModal.hidden = false;
      return;
    }
    updateExamCounter();
  }

  function updateRestBreakButton() {
    const show = state.restBreaksEnabled &&
      state.activityMode === "test" &&
      state.mode === "question" &&
      !state.timerDismissed &&
      !state.examLocked;
    elements.restBreakButton.hidden = !show;
    if (show) {
      elements.restBreakButton.textContent =
        "Rest Break (" + state.restBreaksRemaining + " remaining)";
      elements.restBreakButton.disabled = state.restBreaksRemaining <= 0;
    }
  }

  function startRestBreak() {
    if (!state.restBreaksEnabled || state.restBreaksRemaining <= 0 || state.restBreakActive) {
      return;
    }
    state.restBreakActive = true;
    state.restBreaksRemaining -= 1;
    state.restBreaksUsed += 1;
    state.mainTimerRemainingAtBreakStart =
      state.timerDeadline ? Math.max(0, state.timerDeadline - Date.now()) : 0;
    state.restBreakDeadline = Date.now() + 10 * 60 * 1000;
    elements.restBreakCountdown.textContent = "10:00";
    elements.restBreakModal.hidden = false;
    state.restBreakTimerId = window.setInterval(checkRestBreakTimer, 1000);
    checkRestBreakTimer();
    saveCurrentActivity();
    updateRestBreakButton();
  }

  function checkRestBreakTimer() {
    if (!state.restBreakActive || !state.restBreakDeadline) {
      return;
    }
    const remaining = state.restBreakDeadline - Date.now();
    if (remaining <= 0) {
      endRestBreak();
      return;
    }
    elements.restBreakCountdown.textContent = formatRemaining(remaining);
  }

  function endRestBreak() {
    if (!state.restBreakActive) {
      return;
    }
    if (state.restBreakTimerId) {
      window.clearInterval(state.restBreakTimerId);
      state.restBreakTimerId = null;
    }
    state.restBreakActive = false;
    if (state.mainTimerRemainingAtBreakStart > 0) {
      state.timerDeadline = Date.now() + state.mainTimerRemainingAtBreakStart;
    }
    state.mainTimerRemainingAtBreakStart = 0;
    state.restBreakDeadline = null;
    elements.restBreakModal.hidden = true;
    restartTimerInterval();
    saveCurrentActivity();
    updateRestBreakButton();
  }

  function showInstructions() {
    enterExamMode();
    state.mode = "instructions";
    if (shouldUseTiming()) {
      startInstructionTimer();
    } else {
      updateExamCounter();
    }
    elements.flagButton.disabled = true;
    elements.explainButton.disabled = true;
    elements.explainButton.hidden = true;
    elements.markButton.hidden = true;

    elements.examContent.replaceChildren();

    const copy = document.createElement("div");
    copy.className = "instruction-copy";
    const timingPrefix = shouldUseTiming()
      ? "**You have 1 minute to read these instructions.**\n\n"
      : "";
    U.renderMarkdown(
      copy,
      timingPrefix + (state.test.instructions || defaultInstructions()),
    );

    elements.examContent.append(copy);
    setFooterButtons([makeExamButton("Next >", () => showQuestion(0))]);
    saveCurrentActivity();
  }

  function defaultInstructions() {
    return [
      "For each question, choose the one answer you consider correct.",
      "",
      "There are no penalties for incorrect responses, only marks for correct answers, so you should attempt all questions.",
      "",
      "Click Next when you are ready to begin the test.",
    ].join("\n");
  }

  function showQuestion(index) {
    if (!state.test || index < 0 || index >= state.test.questions.length) {
      return;
    }

    if (state.timerPhase === "instructions") {
      stopGuideTimer(true);
    }
    state.mode = "question";
    state.currentIndex = index;
    state.seen[index] = true;
    const reviewActive =
      state.activityMode === "new-review" ||
      state.activityMode === "previous-review";
    elements.flagButton.disabled = state.activityMode === "previous-review";
    elements.explainButton.hidden = !reviewActive;
    elements.explainButton.disabled = !reviewActive;
    elements.markButton.hidden = state.activityMode !== "new-review";
    elements.markButton.disabled = state.answers[index] === null;
    startGuideTimer();
    updateExamCounter();
    updateFlagButton();
    updateRestBreakButton();

    elements.examContent.replaceChildren();
    const stage = document.createElement("div");
    stage.className = "question-stage";
    elements.examContent.appendChild(stage);

    U.renderQuestionView(stage, state.test.questions[index], {
      groupName: "student-question-" + index,
      selectedIndex: state.answers[index],
      disabled: state.activityMode === "previous-review",
      correctIndex: state.test.questions[index].correctIndex,
      showCorrectAnswer: state.activityMode === "previous-review",
      showFeedback:
        state.activityMode === "previous-review" || state.marked[index],
      onChange(answerIndex) {
        state.answers[index] = answerIndex;
        elements.markButton.disabled = false;
        saveCurrentActivity();
      },
    });

    const nextButton = makeExamButton(
      index === state.test.questions.length - 1
        ? state.activityMode === "test"
          ? "Finish"
          : "Finish Review"
        : "Next >",
      () => {
        saveCurrentActivity();
        if (state.currentIndex === state.test.questions.length - 1) {
          if (state.activityMode === "test") {
            openEndModal();
          } else {
            showCompletion();
          }
        } else {
          showQuestion(state.currentIndex + 1);
        }
      },
    );
    setFooterButtons([makeExamButton("Navigator", openNavigator), nextButton]);
    saveCurrentActivity();
  }

  function updateFlagButton() {
    if (state.mode !== "question") {
      elements.flagButton.textContent = "Flag for Review";
      return;
    }
    elements.flagButton.textContent = state.flagged[state.currentIndex]
      ? "Unflag Review"
      : "Flag for Review";
  }

  function questionStatus(index) {
    if (state.activityMode === "previous-review") {
      const answer = state.answers[index];
      if (answer === null || answer === undefined) {
        return "Unanswered";
      }
      return answer === state.test.questions[index].correctIndex
        ? "Correct"
        : "Incorrect";
    }
    if (state.answers[index] !== null) {
      return "Complete";
    }
    if (state.seen[index]) {
      return "Incomplete";
    }
    return "Unseen";
  }

  function openNavigator() {
    if (!state.test || state.mode !== "question") {
      return;
    }

    elements.navigatorRows.replaceChildren();
    let unresolved = 0;

    state.test.questions.forEach((question, index) => {
      const status = questionStatus(index);
      if (status !== "Complete") {
        unresolved += 1;
      }

      const row = document.createElement("tr");
      if (index === state.currentIndex) {
        row.className = "is-current";
      }

      const questionCell = document.createElement("td");
      const questionButton = document.createElement("button");
      questionButton.type = "button";
      questionButton.textContent = "Question " + (index + 1);
      questionButton.addEventListener("click", () => {
        saveCurrentActivity();
        closeNavigator();
        showQuestion(index);
      });
      questionCell.appendChild(questionButton);

      const statusCell = document.createElement("td");
      statusCell.className =
        state.activityMode === "previous-review" && status === "Correct"
          ? "mark-correct"
          : "navigator-status";
      statusCell.textContent = status;

      const flagCell = document.createElement("td");
      flagCell.textContent = state.flagged[index] ? "Yes" : "";

      row.append(questionCell, statusCell, flagCell);
      elements.navigatorRows.appendChild(row);
    });

    if (state.activityMode === "previous-review") {
      const score = state.answers.reduce(
        (total, answer, index) =>
          total + (answer === state.test.questions[index].correctIndex ? 1 : 0),
        0,
      );
      elements.navigatorSummary.textContent =
        "Score: " + score + " / " + state.test.questions.length;
    } else {
      elements.navigatorSummary.textContent = unresolved + " Unseen/Incomplete";
    }
    elements.navigatorModal.hidden = false;
  }

  function closeNavigator() {
    elements.navigatorModal.hidden = true;
  }

  function openEndModal() {
    if (state.mode === "instructions") {
      leaveExamMode();
      return;
    }

    saveCurrentActivity();
    state.pendingResult = null;
    const unanswered = state.answers.filter((answer) => answer === null).length;
    elements.endBody.textContent = unanswered
      ? "You have " +
        unanswered +
        " unanswered question" +
        (unanswered === 1 ? "" : "s") +
        ". Finishing now will download your result file."
      : "All questions have an answer. Finishing now will download your result file.";
    elements.turnstilePanel.hidden = true;
    elements.cancelEndButton.disabled = state.examLocked;
    elements.cancelEndButton.hidden = state.examLocked;
    elements.confirmEndButton.disabled = false;
    elements.confirmEndButton.textContent = "Finish and Download";
    U.setStatus(elements.turnstileStatus, "", "");
    if (U.CodehooksIntegration) {
      U.CodehooksIntegration.loadConfig().then((config) => {
        if (
          !config ||
          config.turnstileRequired === false ||
          !config.turnstileSiteKey ||
          elements.endModal.hidden
        ) {
          return;
        }
        elements.turnstilePanel.hidden = false;
        U.CodehooksIntegration.prepareTurnstile(
          elements.turnstileMount,
          elements.turnstileStatus,
        );
      });
    }
    elements.endModal.hidden = false;
    elements.examShell.inert = true;
  }

  function closeEndModal() {
    if (state.examLocked) return;
    elements.endModal.hidden = true;
    elements.examShell.inert = false;
    elements.cancelEndButton.disabled = false;
    elements.cancelEndButton.hidden = false;
    elements.confirmEndButton.textContent = "Finish and Download";
    if (U.CodehooksIntegration) {
      U.CodehooksIntegration.resetTurnstile();
    }
  }

  function openExplanation() {
    const question = state.test && state.test.questions[state.currentIndex];
    if (!question) {
      return;
    }
    elements.explanationTitle.textContent =
      "Question " + (state.currentIndex + 1) + " Explanation";
    const reviewActive =
      state.activityMode === "new-review" ||
      state.activityMode === "previous-review";
    const prefix = reviewActive
      ? "**The correct answer is " +
        U.optionLetter(question.correctIndex) +
        ".**\n\n"
      : "";
    const body = prefix + String(question.explanationMarkdown || "");
    U.renderMarkdown(elements.explanationBody, body);
    elements.explanationModal.hidden = false;
  }

  function closeExplanation() {
    elements.explanationModal.hidden = true;
  }

  function markCurrentAnswer() {
    if (
      state.activityMode !== "new-review" ||
      state.answers[state.currentIndex] === null
    ) {
      return;
    }
    state.marked[state.currentIndex] = true;
    saveCurrentActivity();
    showQuestion(state.currentIndex);
  }

  function currentActivityStorageKey(activityMode) {
    const username = U.sanitizeFilePart(
      (state.student && state.student.schoolUsername) ||
        elements.schoolUsername.value.trim(),
    );
    const testKey = U.sanitizeFilePart(
      state.testId ||
        (state.test && state.test.title) ||
        elements.testSelect.value ||
        "test",
    );
    return (
      "unitesterCurrent:" +
      username +
      ":" +
      testKey +
      ":" +
      (activityMode || state.activityMode)
    );
  }

  function draftAnswerIndices(answers) {
    return (answers || []).map((answer) => {
      if (answer === null || answer === undefined || answer === "") {
        return null;
      }
      if (typeof answer === "number") {
        return answer;
      }
      const index = String(answer).toUpperCase().charCodeAt(0) - 65;
      return index >= 0 ? index : null;
    });
  }

  function saveCurrentActivity() {
    if (
      !state.test ||
      (state.activityMode !== "test" && state.activityMode !== "new-review")
    ) {
      return;
    }
    const draft = {
      version: 1,
      testId: state.testId,
      testTitle: state.test.title,
      schoolUsername: state.student && state.student.schoolUsername,
      activityMode: state.activityMode,
      startedAt: state.startedAt,
      currentIndex: state.currentIndex,
      answers: state.answers,
      flagged: state.flagged,
      seen: state.seen,
      marked: state.marked,
      timerDeadline: state.timerDeadline,
      timerDismissed: state.timerDismissed,
      timerPhase: state.timerPhase,
      extraTimeMultiplier: state.extraTimeMultiplier || 1,
      restBreaksEnabled: state.restBreaksEnabled,
      restBreaksRemaining: state.restBreaksRemaining,
      restBreaksUsed: state.restBreaksUsed,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(
        currentActivityStorageKey(),
        JSON.stringify(draft),
      );
    } catch (error) {
      // Browser storage is best-effort only.
    }
  }

  function clearCurrentActivity() {
    try {
      window.localStorage.removeItem(currentActivityStorageKey("test"));
      window.localStorage.removeItem(currentActivityStorageKey("new-review"));
    } catch (error) {
      // Ignore storage cleanup failures.
    }
  }

  function matchingResumeDrafts() {
    const username = U.sanitizeFilePart(elements.schoolUsername.value.trim());
    const selected = selectedTestRecord();
    const testId = elements.testSelect.value;
    const title = selected && selected.test ? selected.test.title : "";
    const prefix = "unitesterCurrent:" + username + ":";
    const drafts = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(prefix)) {
        continue;
      }
      try {
        const draft = JSON.parse(window.localStorage.getItem(key) || "{}");
        if (
          (draft.testId === testId || draft.testTitle === title) &&
          (draft.activityMode === "test" || draft.activityMode === "new-review")
        ) {
          drafts.push(draft);
        }
      } catch (error) {
        // Skip malformed entries.
      }
    }
    return drafts.sort(
      (a, b) =>
        new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime(),
    );
  }

  function applyResumeDraft(draft) {
    const mode =
      draft.activityMode === "new-review" &&
      state.test.activityMode === "review"
        ? "new-review"
        : "test";
    state.activityMode = mode;
    state.startedAt = draft.startedAt || new Date().toISOString();
    const answerIndices = draftAnswerIndices(draft.answers);
    state.answers = state.test.questions.map((_, index) =>
      answerIndices[index] == null ? null : answerIndices[index],
    );
    state.flagged = state.test.questions.map((_, index) =>
      Boolean(draft.flagged && draft.flagged[index]),
    );
    state.seen = state.test.questions.map((_, index) =>
      Boolean(draft.seen && draft.seen[index]),
    );
    state.marked = state.test.questions.map((_, index) =>
      Boolean(draft.marked && draft.marked[index]),
    );
    state.currentIndex = Math.max(
      0,
      Math.min(
        Number.parseInt(draft.currentIndex, 10) || 0,
        state.test.questions.length - 1,
      ),
    );
    state.timerDismissed = Boolean(draft.timerDismissed);
    state.timerDeadline = Number(draft.timerDeadline) || null;
    state.timerPhase = draft.timerPhase === "test" ? "test" : "";
    state.extraTimeMultiplier = Number(draft.extraTimeMultiplier) || 1;
    state.restBreaksEnabled = Boolean(draft.restBreaksEnabled);
    state.restBreaksRemaining = typeof draft.restBreaksRemaining === "number" ? draft.restBreaksRemaining : 3;
    state.restBreaksUsed = Number(draft.restBreaksUsed) || 0;
    enterExamMode();
    showQuestion(state.currentIndex);
  }

  function openResumeModal() {
    if (!elements.schoolUsername.value.trim() || !elements.testSelect.value) {
      U.setStatus(
        elements.homeStatus,
        "Choose a username and test first.",
        "error",
      );
      return;
    }
    const drafts = matchingResumeDrafts();
    state.resumeDraft = drafts[0] || null;
    elements.browserResumeBlock.hidden = !state.resumeDraft;
    elements.browserResumeText.textContent = state.resumeDraft
      ? "Browser save found from " +
        U.formatDateTime(state.resumeDraft.savedAt) +
        " (" +
        (state.resumeDraft.activityMode === "new-review" ? "review" : "test") +
        ")."
      : "";
    U.setStatus(
      elements.resumeStatus,
      state.resumeDraft
        ? ""
        : "No unfinished attempt was found in this browser for this username and test.",
      state.resumeDraft ? "" : "error",
    );
    elements.resumeModal.hidden = false;
  }

  function closeResumeModal() {
    elements.resumeModal.hidden = true;
    state.resumeDraft = null;
  }

  async function resumeBrowserAttempt() {
    if (!state.resumeDraft) {
      return;
    }
    const draft = state.resumeDraft;
    const test = await prepareSelectedTest();
    if (!test) {
      return;
    }
    closeResumeModal();
    applyResumeDraft(draft);
  }

  function attemptStoreKey() {
    return (
      "unitesterAttempts:" +
      U.sanitizeFilePart(state.student.schoolUsername || "")
    );
  }

  function readStoredAttempts(username) {
    try {
      return JSON.parse(
        window.localStorage.getItem(
          "unitesterAttempts:" + U.sanitizeFilePart(username),
        ) || "[]",
      );
    } catch (error) {
      return [];
    }
  }

  function storeCurrentAttempt(completedAt, cloudDetails) {
    const attempts = readStoredAttempts(state.student.schoolUsername);
    attempts.push({
      testId: state.testId,
      testTitle: state.test.title,
      completedAt,
      submissionGuid: cloudDetails && cloudDetails.submissionGuid,
      reviewSecret: cloudDetails && cloudDetails.reviewSecret,
      answers: state.answers.map((answer) =>
        answer === null ? null : U.optionLetter(answer),
      ),
    });
    window.localStorage.setItem(
      attemptStoreKey(),
      JSON.stringify(attempts.slice(-50)),
    );
  }

  function matchingStoredAttempts() {
    const username = elements.schoolUsername.value.trim();
    const testId = elements.testSelect.value;
    const known = selectedTestRecord();
    const title = known && known.test ? known.test.title : "";
    return readStoredAttempts(username)
      .filter(
        (attempt) => attempt.testId === testId || attempt.testTitle === title,
      )
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
  }

  function showPreviousAttempts() {
    const known = selectedTestRecord();
    if (!known || known.test.activityMode !== "review") {
      U.setStatus(
        elements.homeStatus,
        "Previous review is only available for review-mode tests.",
        "error",
      );
      return;
    }
    const attempts = matchingStoredAttempts();
    elements.previousAttemptSelect.replaceChildren();
    if (!attempts.length) {
      elements.previousAttemptSelect.append(
        new Option("No browser completions found", ""),
      );
      elements.startPreviousReviewButton.disabled = true;
      elements.previousReviewPanel.hidden = false;
      U.setStatus(
        elements.homeStatus,
        "No browser completions were found. You can open a saved result file instead.",
        "error",
      );
      return;
    }
    attempts.forEach((attempt, index) => {
      const label =
        U.formatDateTime(attempt.completedAt) +
        " - " +
        (attempt.submissionGuid ? "cloud " : "browser ") +
        attempt.answers.map((answer) => answer || "-").join(" ");
      const option = new Option(label, String(index));
      option.dataset.attempt = JSON.stringify(attempt);
      elements.previousAttemptSelect.append(option);
    });
    elements.startPreviousReviewButton.disabled = false;
    updatePreviousReviewButtonLabel();
    elements.previousReviewPanel.hidden = false;
    U.setStatus(
      elements.homeStatus,
      attempts.length +
        " previous completion" +
        (attempts.length === 1 ? "" : "s") +
        " found.",
      "ok",
    );
  }

  async function startPreviousReview() {
    const option = elements.previousAttemptSelect.selectedOptions[0];
    if (!option || !option.value) {
      U.setStatus(
        elements.homeStatus,
        "Choose a previous completion.",
        "error",
      );
      return;
    }
    const test = await prepareSelectedTest();
    if (!test || test.activityMode !== "review") {
      return;
    }
    const attempt = JSON.parse(option.dataset.attempt || "{}");
    const reviewAttempt = await loadCloudReviewAttempt(attempt);
    applyPreviousReviewAttempt(test, reviewAttempt);
  }

  function updatePreviousReviewButtonLabel() {
    const option = elements.previousAttemptSelect.selectedOptions[0];
    if (!option || !option.dataset.attempt) {
      elements.startPreviousReviewButton.textContent = "Retrieve Cloud Submission";
      return;
    }
    try {
      const attempt = JSON.parse(option.dataset.attempt || "{}");
      elements.startPreviousReviewButton.textContent = attempt.submissionGuid
        ? "Retrieve Cloud Submission"
        : "Open Browser Copy";
    } catch (error) {
      elements.startPreviousReviewButton.textContent = "Retrieve Cloud Submission";
    }
  }

  async function loadCloudReviewAttempt(attempt) {
    if (
      attempt.submissionGuid &&
      U.CodehooksIntegration
    ) {
      try {
        U.setStatus(elements.homeStatus, "Loading cloud review...", "");
        const record = await U.CodehooksIntegration.fetchReviewSubmission(
          attempt.submissionGuid,
        );
        const payload = await decryptCloudReviewPayload(record.reviewPayload, attempt);
        return {
          completedAt: payload.completedAt || attempt.completedAt,
          answers: payload.answers || attempt.answers || [],
          submissionGuid: attempt.submissionGuid,
        };
      } catch (error) {
        U.setStatus(
          elements.homeStatus,
          "Cloud review unavailable; using the browser copy.",
          "error",
        );
      }
    }
    return attempt;
  }

  async function decryptCloudReviewPayload(reviewPayload, source) {
    const secrets = [
      source && source.submissionGuid,
      source && source.reviewSecret,
    ].filter(Boolean);
    let lastError = null;
    for (const secret of secrets) {
      try {
        return await U.CodehooksIntegration.decryptReviewPayload(
          reviewPayload,
          secret,
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("This cloud review payload could not be decrypted.");
  }

  function applyPreviousReviewAttempt(test, attempt) {
    state.activityMode = "previous-review";
    state.reviewSource = attempt;
    state.answers = test.questions.map((_, index) => {
      const letter = attempt.answers && attempt.answers[index];
      if (!letter) return null;
      const answer = String(letter).toUpperCase().charCodeAt(0) - 65;
      return answer >= 0 ? answer : null;
    });
    state.marked = Array(test.questions.length).fill(true);
    showInstructions();
  }

  async function openSavedResultReview() {
    const file = elements.previousResultFile.files[0];
    if (!file) {
      U.setStatus(elements.homeStatus, "Choose a saved result file first.", "error");
      return;
    }
    setHomeBusy(true);
    U.setStatus(elements.homeStatus, "Loading saved result file...", "");
    try {
      const fileText = await file.text();
      const wrapper = U.CodehooksIntegration.parseResultDownload(
        fileText,
      );
      const localAttempt = await previousAttemptFromResultFile(wrapper, fileText);
      if (!localAttempt && (!wrapper || !wrapper.submissionGuid)) {
        throw new Error("This saved result file does not contain review details.");
      }
      const test = await prepareSelectedTest();
      if (!test || test.activityMode !== "review") {
        throw new Error("Choose the matching review-mode test first.");
      }
      const source = localAttempt || wrapper;
      const matchesTitle = source.testTitle === test.title;
      const matchesId = !source.testId || source.testId === state.testId;
      if (!matchesTitle || !matchesId) {
        throw new Error("This result file is for a different test.");
      }
      if (localAttempt) {
        applyPreviousReviewAttempt(test, localAttempt);
        return;
      }
      if (!U.CodehooksIntegration) {
        throw new Error("Codehooks review support is not loaded.");
      }
      const record = await U.CodehooksIntegration.fetchReviewSubmission(
        wrapper.submissionGuid,
      );
      const payload = await decryptCloudReviewPayload(record.reviewPayload, wrapper);
      applyPreviousReviewAttempt(test, {
        completedAt: payload.completedAt || wrapper.completedAt,
        answers: payload.answers || [],
        submissionGuid: wrapper.submissionGuid,
      });
    } catch (error) {
      U.setStatus(elements.homeStatus, error.message, "error");
    } finally {
      setHomeBusy(false);
      elements.previousResultFile.value = "";
    }
  }

  async function previousAttemptFromResultFile(wrapper, text) {
    const result =
      U.CodehooksIntegration && U.CodehooksIntegration.studentResultFromDownload
        ? await U.CodehooksIntegration.studentResultFromDownload(
            text,
            elements.schoolUsername.value.trim(),
          )
        : null;
    if (!result) {
      return null;
    }
    return {
      testId: result.testNumber || (wrapper && wrapper.testId) || "",
      testTitle: result.testTitle || (wrapper && wrapper.testTitle) || "",
      completedAt: result.completedAt || (wrapper && wrapper.completedAt) || "",
      answers: (result.answers || []).map(answerValueToLetter),
      submissionGuid: result.submissionGuid || (wrapper && wrapper.submissionGuid) || "",
    };
  }

  function answerValueToLetter(answer) {
    if (answer === null || answer === undefined || answer === "") {
      return null;
    }
    if (typeof answer === "number") {
      return U.optionLetter(answer);
    }
    const text = String(answer).trim();
    if (/^[A-Za-z]$/.test(text)) {
      return text.toUpperCase();
    }
    const index = Number.parseInt(text, 10);
    return Number.isNaN(index) ? null : U.optionLetter(index);
  }

  function downloadPreparedResult() {
    if (!state.pendingResult || !state.resultText) {
      return;
    }
    U.downloadText(state.resultFilename, state.resultText);
    storeCurrentAttempt(state.pendingResult.completedAt, {
      submissionGuid: state.pendingResult.submissionGuid,
    });
    clearCurrentActivity();
    stopGuideTimer(true);
    state.examLocked = false;
    closeEndModal();
    state.pendingResult = null;
    showCompletion();
  }

  async function finishExam() {
    if (state.pendingResult && state.resultText) {
      downloadPreparedResult();
      return;
    }

    const completedAt = state.effectiveCompletedAt || new Date().toISOString();
    const submissionGuid = U.CodehooksIntegration
      ? U.CodehooksIntegration.generateSubmissionGuid()
      : "";
    const payload = {
      version: 1,
      type: "unitester-result",
      submissionGuid,
      testTitle: state.test.title,
      testNumber: state.testId,
      schoolUsername: state.student.schoolUsername,
      startedAt: state.startedAt,
      completedAt,
      answers: state.answers,
      flagged: state.flagged,
      questionCount: state.test.questions.length,
      usedExtraTime: state.extraTimeMultiplier > 1,
      usedRestBreaks: state.restBreaksUsed > 0,
      durationSeconds: Math.round(
        (new Date(completedAt).getTime() - new Date(state.startedAt).getTime()) / 1000,
      ),
    };
    state.resultFilename =
      [state.testId, U.sanitizeFilePart(state.student.schoolUsername)].join(
        "_",
      ) + ".txt";

    try {
      if (!U.CodehooksIntegration) {
        throw new Error("Result file encryption support is not loaded.");
      }
      const config = await U.CodehooksIntegration.loadConfig();
      const cloudEnabled = Boolean(config);
      const turnstileRequired =
        cloudEnabled &&
        config.turnstileRequired !== false &&
        Boolean(config.turnstileSiteKey);
      const turnstileToken = turnstileRequired
        ? U.CodehooksIntegration.getTurnstileToken()
        : "";
      if (turnstileRequired && !turnstileToken) {
        elements.endBody.textContent =
          "Complete the bot-protection check before finishing.";
        U.setStatus(
          elements.turnstileStatus,
          "Complete the bot-protection check before finishing.",
          "error",
        );
        return;
      }

      elements.cancelEndButton.disabled = true;
      elements.confirmEndButton.disabled = true;
      elements.confirmEndButton.textContent = cloudEnabled
        ? "Submitting..."
        : "Preparing...";
      elements.endBody.textContent = cloudEnabled
        ? "Please wait whilst submitting..."
        : "Preparing your result file...";

      let teacherPayload = "";
      let reviewPayload = null;
      if (submissionGuid) {
        const publicKeyText =
          state.test.resultPublicKey || (await U.fetchTextFile("publickey.txt"));
        teacherPayload = await U.encryptPayloadWithPublicKey(
          state.test.title,
          payload,
          publicKeyText,
        );
        reviewPayload = await U.CodehooksIntegration.encryptReviewPayload(
          {
            testTitle: state.test.title,
            testId: state.testId,
            completedAt,
            answers: state.answers.map((answer) =>
              answer === null ? null : U.optionLetter(answer),
            ),
            flagged: state.flagged,
            questionCount: state.test.questions.length,
            submissionGuid,
          },
          submissionGuid,
        );
        state.resultText = await U.CodehooksIntegration.createResultDownload({
          submissionGuid,
          testId: state.testId,
          testTitle: state.test.title,
          completedAt,
          studentUsername: state.student.schoolUsername,
          studentResult: payload,
        });
      }

      if (cloudEnabled && reviewPayload) {
        await U.CodehooksIntegration.submitToCodehooks(
          {
            schemaVersion: 2,
            testId: state.testId,
            submissionGuid,
            submittedAt: completedAt,
            teacherPayload,
            reviewPayload,
            turnstileToken,
            b_phone_number: elements.botPhoneNumber.value || "",
          },
          { timeoutMs: 20000 },
        );
      }

      state.pendingResult = {
        completedAt,
        submissionGuid,
      };
      elements.endBody.textContent = cloudEnabled
        ? "Cloud submission saved: please now download your test submission file for later review"
        : "Your test submission file is ready. Please download it for later review.";
      U.setStatus(elements.turnstileStatus, "", "");
      elements.confirmEndButton.textContent = "Download Test Submission File";
      elements.confirmEndButton.disabled = false;
    } catch (error) {
      if (state.resultText) {
        state.pendingResult = {
          completedAt,
          submissionGuid,
        };
        elements.endBody.textContent =
          "Cloud submission could not be saved: " +
          error.message +
          " Please download your test submission file now as a backup for later review.";
        U.setStatus(elements.turnstileStatus, "", "");
        elements.cancelEndButton.disabled = true;
        elements.confirmEndButton.textContent = "Download Backup Submission File";
        elements.confirmEndButton.disabled = false;
        return;
      }
      elements.endBody.textContent =
        "Could not save the submission: " + error.message;
      elements.cancelEndButton.disabled = false;
      elements.confirmEndButton.textContent = "Finish and Download";
      if (U.CodehooksIntegration) {
        U.CodehooksIntegration.resetTurnstile();
      }
    } finally {
      if (!state.pendingResult) {
        elements.confirmEndButton.disabled = false;
      }
    }
  }

  function showCompletion() {
    state.mode = "complete";
    clearCurrentActivity();
    stopGuideTimer(true);
    updateExamCounter();
    elements.flagButton.disabled = true;
    elements.explainButton.disabled = true;
    elements.explainButton.hidden = true;

    const panel = document.createElement("div");
    panel.className = "panel completion-panel";

    const title = document.createElement("h1");
    title.textContent =
      state.activityMode === "test"
        ? "Result File Downloaded"
        : "Review Complete";

    const detail = document.createElement("p");
    detail.textContent =
      state.activityMode === "test"
        ? state.resultFilename
        : "Return home when ready.";

    const endInstructions = document.createElement("div");
    endInstructions.className = "completion-instructions markdown-content";
    U.renderMarkdown(
      endInstructions,
      state.test.endInstructions || U.defaultEndInstructions(),
    );

    const row = document.createElement("div");
    row.className = "button-row";

    const again = document.createElement("button");
    again.className = "primary-button";
    again.type = "button";
    again.textContent = "Download Again";
    again.addEventListener("click", () =>
      U.downloadText(state.resultFilename, state.resultText),
    );
    again.hidden = state.activityMode !== "test";

    const home = document.createElement("button");
    home.className = "secondary-button";
    home.type = "button";
    home.textContent = "Return Home";
    home.addEventListener("click", leaveExamMode);

    row.append(again, home);
    panel.append(title, detail, endInstructions, row);
    elements.examContent.replaceChildren(panel);
    setFooterButtons([makeExamButton("Return Home", leaveExamMode)]);
  }

  function toggleFlag() {
    if (state.mode !== "question") {
      return;
    }
    state.flagged[state.currentIndex] = !state.flagged[state.currentIndex];
    updateFlagButton();
    saveCurrentActivity();
  }

  function applyColorScheme() {
    document.body.classList.toggle(
      "high-contrast",
      elements.colorScheme.value === "contrast",
    );
  }

  elements.startForm.addEventListener("submit", startSelectedTest);
  elements.findByNameButton.addEventListener("click", showNameSearch);
  elements.searchByNameButton.addEventListener("click", findTestByName);
  elements.browseOpenButton.addEventListener("click", browseOpenTests);
  elements.testSelect.addEventListener("change", () => {
    elements.startButton.disabled = !elements.testSelect.value;
    updateStartControlsForSelectedTest();
  });
  elements.testName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      findTestByName();
    }
  });
  elements.endButton.addEventListener("click", openEndModal);
  elements.flagButton.addEventListener("click", toggleFlag);
  elements.explainButton.addEventListener("click", openExplanation);
  elements.markButton.addEventListener("click", markCurrentAnswer);
  elements.startNewTestButton.addEventListener("click", () =>
    startSelectedTest(),
  );
  elements.newReviewButton.addEventListener("click", startNewReview);
  elements.resumeButton.addEventListener("click", openResumeModal);
  elements.resumeReviewButton.addEventListener("click", openResumeModal);
  elements.reviewPreviousButton.addEventListener("click", showPreviousAttempts);
  elements.previousAttemptSelect.addEventListener("change", updatePreviousReviewButtonLabel);
  elements.startPreviousReviewButton.addEventListener(
    "click",
    startPreviousReview,
  );
  elements.openSavedReviewButton.addEventListener("click", openSavedResultReview);
  elements.colorScheme.addEventListener("change", applyColorScheme);
  elements.navigatorClose.addEventListener("click", closeNavigator);
  elements.navigatorCloseTop.addEventListener("click", closeNavigator);
  elements.cancelEndButton.addEventListener("click", closeEndModal);
  elements.confirmEndButton.addEventListener("click", finishExam);
  elements.closeResume.addEventListener("click", closeResumeModal);
  elements.resumeBrowserAttempt.addEventListener("click", resumeBrowserAttempt);
  elements.continueAfterTime.addEventListener("click", () => {
    elements.timeModal.hidden = true;
    state.timerDismissed = true;
    state.timerDeadline = null;
    state.timerPhase = "";
    state.effectiveCompletedAt = "";
    stopGuideTimer(true);
    updateExamCounter();
    saveCurrentActivity();
  });
  elements.endAfterTime.addEventListener("click", () => {
    elements.timeModal.hidden = true;
    openEndModal();
  });
  elements.navigatorModal.addEventListener("click", (event) => {
    if (event.target === elements.navigatorModal) {
      closeNavigator();
    }
  });
  elements.endModal.addEventListener("click", (event) => {
    if (
      event.target === elements.endModal &&
      !elements.cancelEndButton.disabled &&
      !state.pendingResult
    ) {
      closeEndModal();
    }
  });
  elements.resumeModal.addEventListener("click", (event) => {
    if (event.target === elements.resumeModal) {
      closeResumeModal();
    }
  });
  elements.timeModal.addEventListener("click", (event) => {
    if (event.target === elements.timeModal) {
      elements.timeModal.hidden = true;
      state.timerDismissed = true;
      state.timerDeadline = null;
      state.timerPhase = "";
      state.effectiveCompletedAt = "";
      updateExamCounter();
      saveCurrentActivity();
    }
  });
  elements.closeExplanation.addEventListener("click", closeExplanation);
  elements.closeExplanationTop.addEventListener("click", closeExplanation);
  elements.restBreakButton.addEventListener("click", startRestBreak);
  elements.endRestBreakButton.addEventListener("click", endRestBreak);
  elements.explanationModal.addEventListener("click", (event) => {
    if (event.target === elements.explanationModal) {
      closeExplanation();
    }
  });

  elements.testName.addEventListener("input", () =>
    resetTestChoices("Find a test first..."),
  );
  elements.schoolUsername.addEventListener("input", () => {
    elements.startButton.disabled = !elements.testSelect.value;
    elements.resumeButton.disabled = !elements.testSelect.value;
    elements.resumeReviewButton.disabled = !elements.testSelect.value;
  });
})();
