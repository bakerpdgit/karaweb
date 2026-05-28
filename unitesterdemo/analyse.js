(function () {
  "use strict";

  const U = window.Unitester;
  const state = {
    tests: [],
    test: null,
    testId: "",
    privateKeyText: "",
    unlocked: false,
    rows: [],
    hiddenRows: new Set(),
    duplicateMode: "all",
    resultDisplayMode: "marks",
    deleteCloudOnHide: false,
    sortKey: "schoolUsername",
    sortDirection: "asc",
    previewIndex: null,
    previewSelectedIndex: null,
  };

  const elements = {
    testSelect: document.getElementById("analysisTestSelect"),
    testName: document.getElementById("analysisTestName"),
    choiceRow: document.getElementById("analysisChoiceRow"),
    nameSearchPanel: document.getElementById("analysisNameSearchPanel"),
    searchByNameButton: document.getElementById("searchAnalysisByName"),
    testChoicePanel: document.getElementById("analysisTestChoicePanel"),
    namedTestResult: document.getElementById("analysisNamedTestResult"),
    openTestSelectField: document.getElementById("analysisOpenTestSelectField"),
    lockTestButton: document.getElementById("lockAnalysisTest"),
    uploadPanel: document.getElementById("analysisUploadPanel"),
    resultsZip: document.getElementById("resultsZip"),
    resultsTxt: document.getElementById("resultsTxt"),
    fetchCloudSubmissions: document.getElementById("fetchCloudSubmissions"),
    cloudFetchSpinner: document.getElementById("cloudFetchSpinner"),
    analyseButton: document.getElementById("analyseButton"),
    addTxtButton: document.getElementById("addTxtButton"),
    findByNameButton: document.getElementById("findAnalysisTestByName"),
    browseOpenButton: document.getElementById("browseAnalysisOpenTests"),
    analyseStatus: document.getElementById("analyseStatus"),
    resultsSummary: document.getElementById("resultsSummary"),
    hideNames: document.getElementById("hideNames"),
    duplicateMode: document.getElementById("duplicateMode"),
    resultDisplayMode: document.getElementById("resultDisplayMode"),
    deleteCloudOnHide: document.getElementById("deleteCloudOnHide"),
    exportCsv: document.getElementById("exportCsv"),
    settingsButton: document.getElementById("settingsButton"),
    resultsTableWrap: document.getElementById("resultsTableWrap"),
    resultsTable: document.getElementById("resultsTable"),
    questionModal: document.getElementById("questionModal"),
    previewTitle: document.getElementById("previewTitle"),
    previewQuestion: document.getElementById("previewQuestion"),
    previewMeta: document.getElementById("previewMeta"),
    showPreviewAnswer: document.getElementById("showPreviewAnswer"),
    closePreview: document.getElementById("closePreview"),
    closePreviewTop: document.getElementById("closePreviewTop"),
    privateKeyModal: document.getElementById("privateKeyModal"),
    privateKeyFile: document.getElementById("privateKeyFile"),
    retainPrivateKey: document.getElementById("retainPrivateKey"),
    privateKeyStatus: document.getElementById("privateKeyStatus"),
    unlockAnalyseButton: document.getElementById("unlockAnalyseButton"),
    settingsModal: document.getElementById("settingsModal"),
    settingsStatus: document.getElementById("settingsStatus"),
    generateKeysButton: document.getElementById("generateKeysButton"),
    closeSettings: document.getElementById("closeSettings"),
    closeSettingsTop: document.getElementById("closeSettingsTop"),
    deleteConfirmModal: document.getElementById("deleteConfirmModal"),
    deleteConfirmMessage: document.getElementById("deleteConfirmMessage"),
    deleteConfirmYes: document.getElementById("deleteConfirmYes"),
    deleteConfirmNo: document.getElementById("deleteConfirmNo"),
  };

  function setBusy(isBusy) {
    elements.analyseButton.disabled = isBusy;
    elements.findByNameButton.disabled = isBusy;
    elements.browseOpenButton.disabled = isBusy;
    elements.searchByNameButton.disabled = isBusy;
    elements.lockTestButton.disabled = isBusy || !elements.testSelect.value;
    elements.testSelect.disabled = isBusy;
    elements.testName.disabled = isBusy;
    elements.resultsZip.disabled = isBusy;
    elements.resultsTxt.disabled = isBusy;
    elements.fetchCloudSubmissions.disabled = isBusy;
    elements.addTxtButton.disabled = isBusy;
  }

  function setCloudFetchWaiting(isWaiting) {
    elements.fetchCloudSubmissions.classList.toggle("is-loading", isWaiting);
    if (elements.cloudFetchSpinner) {
      elements.cloudFetchSpinner.hidden = !isWaiting;
    }
  }

  function resetTestChoices(message) {
    state.tests = [];
    state.test = null;
    state.testId = "";
    state.rows = [];
    state.hiddenRows = new Set();
    elements.testSelect.replaceChildren(new Option(message || "Find a test first...", ""));
    elements.testChoicePanel.hidden = true;
    elements.namedTestResult.hidden = true;
    elements.openTestSelectField.hidden = true;
    elements.uploadPanel.hidden = true;
    renderResults();
  }

  function showAnalysisNameSearch() {
    if (!state.unlocked) {
      U.setStatus(elements.analyseStatus, "Unlock the analysis page with the private key first.", "error");
      return;
    }
    resetTestChoices("Find a test first...");
    elements.nameSearchPanel.hidden = false;
    U.setStatus(elements.analyseStatus, "", "");
    window.setTimeout(() => elements.testName.focus(), 0);
  }

  async function findAnalysisTestByName() {
    if (!state.unlocked) {
      U.setStatus(elements.analyseStatus, "Unlock the analysis page with the private key first.", "error");
      return;
    }

    const testName = elements.testName.value.trim();
    if (!testName) {
      resetTestChoices("Find a test first...");
      U.setStatus(elements.analyseStatus, "Enter the test name first.", "error");
      return;
    }

    setBusy(true);
    elements.testSelect.replaceChildren(new Option("Finding test...", ""));
    try {
      const testBase = U.normaliseTestNameToBase(testName);
      U.setStatus(elements.analyseStatus, "Looking for tests/" + testBase + ".txt...", "");
      const test = await U.findNamedTest(testName);
      elements.testSelect.replaceChildren();
      if (!test) {
        resetTestChoices("No matching test found");
        U.setStatus(elements.analyseStatus, "No matching test file was found in the tests folder.", "error");
        return;
      }
      state.tests = [test];
      elements.testSelect.append(new Option(test.title, test.id));
      elements.namedTestResult.textContent = test.title;
      elements.namedTestResult.hidden = false;
      elements.openTestSelectField.hidden = true;
      elements.testChoicePanel.hidden = false;
      elements.lockTestButton.disabled = false;
      U.setStatus(elements.analyseStatus, "Test found. Use this test to add submissions.", "ok");
    } catch (error) {
      resetTestChoices("Unable to find test");
      U.setStatus(elements.analyseStatus, error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function browseAnalysisOpenTests() {
    if (!state.unlocked) {
      U.setStatus(elements.analyseStatus, "Unlock the analysis page with the private key first.", "error");
      return;
    }

    setBusy(true);
    elements.nameSearchPanel.hidden = true;
    elements.namedTestResult.hidden = true;
    elements.openTestSelectField.hidden = false;
    elements.testChoicePanel.hidden = false;
    elements.testSelect.replaceChildren(new Option("Loading tests...", ""));
    U.setStatus(elements.analyseStatus, "Looking for open numbered tests...", "");
    try {
      const tests = await U.browseOpenTests();
      state.tests = tests;
      elements.testSelect.replaceChildren();
      if (!tests.length) {
        resetTestChoices("No open tests found");
        U.setStatus(elements.analyseStatus, "No open numbered tests were found.", "error");
        return;
      }
      tests.forEach((test) => {
        elements.testSelect.append(new Option(test.id + " - " + test.title, test.id));
      });
      elements.lockTestButton.disabled = !elements.testSelect.value;
      U.setStatus(elements.analyseStatus, tests.length + " open test" + (tests.length === 1 ? "" : "s") + " available.", "ok");
    } catch (error) {
      resetTestChoices("Unable to load tests");
      U.setStatus(elements.analyseStatus, error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function analyseSubmissions() {
    const testId = elements.testSelect.value;
    const zipFile = elements.resultsZip.files[0];
    if (!testId) {
      U.setStatus(elements.analyseStatus, "Choose a test.", "error");
      return;
    }
    if (!zipFile) {
      U.setStatus(elements.analyseStatus, "Choose a ZIP file of student results.", "error");
      return;
    }

    setBusy(true);
    U.setStatus(elements.analyseStatus, "Loading test and result files...", "");
    try {
      const test = await loadSelectedTest(true);
      const entries = await U.zipTextEntries(zipFile);
      const rows = [];
      let skipped = 0;

      for (const entry of entries) {
        const row = await parseResultEntry(entry.name, entry.text, test, testId);
        if (row) {
          rows.push(row);
        } else {
          skipped += 1;
        }
      }

      state.rows = rows;
      state.sortKey = "schoolUsername";
      state.sortDirection = "asc";
      renderResults();

      const suffix = skipped ? " " + skipped + " file" + (skipped === 1 ? "" : "s") + " skipped." : "";
      U.setStatus(elements.analyseStatus, rows.length + " submission" + (rows.length === 1 ? "" : "s") + " analysed." + suffix, rows.length ? "ok" : "error");
    } catch (error) {
      U.setStatus(elements.analyseStatus, error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function lockSelectedTest() {
    if (!elements.testSelect.value) {
      U.setStatus(elements.analyseStatus, "Choose a test first.", "error");
      return;
    }
    setBusy(true);
    U.setStatus(elements.analyseStatus, "Loading selected test...", "");
    try {
      await loadSelectedTest(true);
      elements.uploadPanel.hidden = false;
      U.setStatus(elements.analyseStatus, "Test locked. Add student result files.", "ok");
    } catch (error) {
      U.setStatus(elements.analyseStatus, error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function addTextSubmissions() {
    const files = Array.from(elements.resultsTxt.files || []);
    if (!files.length) {
      U.setStatus(elements.analyseStatus, "Choose one or more .txt result files.", "error");
      return;
    }

    const testId = elements.testSelect.value;
    if (!testId) {
      U.setStatus(elements.analyseStatus, "Choose a test.", "error");
      return;
    }

    setBusy(true);
    U.setStatus(elements.analyseStatus, "Adding result file" + (files.length === 1 ? "" : "s") + "...", "");
    try {
      const test = await loadSelectedTest(false);
      let added = 0;
      let skipped = 0;
      for (const file of files) {
        const text = await file.text();
        const row = await parseResultEntry(file.name, text, test, testId);
        if (row) {
          state.rows.push(row);
          added += 1;
        } else {
          skipped += 1;
        }
      }

      renderResults();
      const suffix = skipped ? " " + skipped + " skipped." : "";
      U.setStatus(elements.analyseStatus, added + " result file" + (added === 1 ? "" : "s") + " added." + suffix, added ? "ok" : "error");
    } catch (error) {
      U.setStatus(elements.analyseStatus, error.message, "error");
    } finally {
      setBusy(false);
      elements.resultsTxt.value = "";
    }
  }

  async function fetchCloudSubmissions() {
    const testId = elements.testSelect.value;
    if (!testId) {
      U.setStatus(elements.analyseStatus, "Choose a test.", "error");
      return;
    }
    if (!U.CodehooksIntegration) {
      U.setStatus(elements.analyseStatus, "Codehooks support is not loaded.", "error");
      return;
    }

    setBusy(true);
    setCloudFetchWaiting(true);
    U.setStatus(elements.analyseStatus, "Fetching cloud submissions...", "");
    try {
      const test = await loadSelectedTest(false);
      const records = await U.CodehooksIntegration.fetchTeacherSubmissions(
        testId,
        state.privateKeyText,
      );
      let added = 0;
      let skipped = 0;

      for (const record of records) {
        const existingRow = record.submissionGuid
          ? state.rows.find((row) => row.submissionGuid === record.submissionGuid)
          : null;
        if (existingRow) {
          existingRow.cloudBacked = true;
          skipped += 1;
          continue;
        }
        if (!record.teacherPayload) {
          skipped += 1;
          continue;
        }
        const row = await parseResultEntry(
          "cloud:" + (record.submissionGuid || record._id || "submission"),
          record.teacherPayload,
          test,
          testId,
        );
        if (row) {
          row.submissionGuid = record.submissionGuid || row.submissionGuid;
          row.cloudBacked = Boolean(record.submissionGuid);
          row.rowId = row.submissionGuid
            ? "submission:" + row.submissionGuid
            : row.rowId;
          state.rows.push(row);
          added += 1;
        } else {
          skipped += 1;
        }
      }

      renderResults();
      const suffix = skipped ? " " + skipped + " skipped." : "";
      U.setStatus(
        elements.analyseStatus,
        added + " cloud submission" + (added === 1 ? "" : "s") + " added." + suffix,
        added ? "ok" : "error",
      );
    } catch (error) {
      U.setStatus(elements.analyseStatus, error.message, "error");
    } finally {
      setCloudFetchWaiting(false);
      setBusy(false);
    }
  }

  async function loadSelectedTest(resetRows) {
    const testId = elements.testSelect.value;
    if (!testId) {
      throw new Error("Choose a test.");
    }

    if (!state.test || state.testId !== testId) {
      const known = state.tests.find((test) => test.id === testId);
      state.test = known ? known.test : await U.fetchTest(testId, U.testPasswordFromBase(testId));
      state.testId = testId;
      state.rows = [];
      state.hiddenRows = new Set();
      state.sortKey = "schoolUsername";
      state.sortDirection = "asc";
    } else if (resetRows) {
      state.rows = [];
      state.hiddenRows = new Set();
    }

    if (state.test.secureMaterial && !state.test.secureMaterialUnlocked) {
      await U.unlockSecureMaterials(state.test, state.privateKeyText);
    }

    return state.test;
  }

  async function parseResultEntry(name, text, test, testId) {
    try {
      const wrapper = U.CodehooksIntegration
        ? U.CodehooksIntegration.parseResultDownload(text)
        : null;
      let result =
        U.CodehooksIntegration && U.CodehooksIntegration.studentResultFromDownload
          ? await U.CodehooksIntegration.studentResultFromDownload(
              text,
              resultDownloadKeyFromName(name),
            )
          : null;
      if (!result) {
        const teacherText = wrapper && wrapper.teacherPayload
          ? wrapper.teacherPayload
          : text;
        const decoded = await U.decryptPayloadWithPrivateKey(teacherText, state.privateKeyText, "unitester-result");
        result = decoded.payload;
      }
      const matchesTitle = result.testTitle === test.title;
      const matchesNumber = !result.testNumber || result.testNumber === testId;
      if (!matchesTitle || !matchesNumber) {
        return null;
      }
      const row = makeResultRow(name, result, test);
      if (wrapper && wrapper.submissionGuid) {
        row.submissionGuid = wrapper.submissionGuid;
        row.rowId = "submission:" + wrapper.submissionGuid;
      }
      return row;
    } catch (error) {
      return null;
    }
  }

  function resultDownloadKeyFromName(name) {
    const fileName = String(name || "").split(/[\\/]/).pop() || "";
    const baseName = fileName.replace(/\.txt$/i, "");
    const separator = baseName.lastIndexOf("_");
    return separator >= 0 ? baseName.slice(separator + 1) : "";
  }

  function makeResultRow(fileName, result, test) {
    const answers = Array.isArray(result.answers) ? result.answers : [];
    const marks = test.questions.map((question, index) => {
      const answer = answerIndexFromValue(answers[index]);
      if (answer === null) {
        return null;
      }
      return answer === Number.parseInt(question.correctIndex, 10);
    });

    const schoolUsername = String(result.schoolUsername || result.username || result.firstName || "");
    const completedAt = result.completedAt || "";
    const submissionGuid = String(result.submissionGuid || "");
    return {
      rowId:
        (submissionGuid && "submission:" + submissionGuid) ||
        [fileName, schoolUsername, completedAt].join("|"),
      submissionGuid,
      fileName,
      schoolUsername,
      firstName: String(result.firstName || ""),
      surname: String(result.surname || ""),
      completedAt,
      answers,
      marks,
      score: marks.filter(Boolean).length,
      cloudBacked: false,
      usedExtraTime: Boolean(result.usedExtraTime),
      usedRestBreaks: Boolean(result.usedRestBreaks),
      durationSeconds: typeof result.durationSeconds === "number" ? result.durationSeconds : null,
    };
  }

  function compareRows(a, b) {
    const direction = state.sortDirection === "asc" ? 1 : -1;
    let comparison = 0;

    if (state.sortKey === "score") {
      comparison = a.score - b.score;
    } else if (state.sortKey === "completedAt") {
      comparison = new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    } else if (state.sortKey === "durationSeconds") {
      comparison = (a.durationSeconds !== null ? a.durationSeconds : -1) - (b.durationSeconds !== null ? b.durationSeconds : -1);
    } else if (state.sortKey.startsWith("q")) {
      const index = Number.parseInt(state.sortKey.slice(1), 10);
      comparison = markValue(a.marks[index]) - markValue(b.marks[index]);
    } else {
      comparison = String(a[state.sortKey] || "").localeCompare(String(b[state.sortKey] || ""), undefined, { sensitivity: "base" });
    }

    if (comparison !== 0) {
      return comparison * direction;
    }

    return a.schoolUsername.localeCompare(b.schoolUsername, undefined, { sensitivity: "base" });
  }

  function markValue(mark) {
    if (mark === true) return 1;
    if (mark === false) return 0;
    return -1;
  }

  function formatDuration(seconds) {
    if (seconds === null || seconds === undefined || seconds < 0) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, "0");
    return mins + ":" + secs;
  }

  function latestTime(row) {
    const time = new Date(row.completedAt || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function duplicateKey(row) {
    return String(row.schoolUsername || "").trim().toLowerCase();
  }

  function duplicateFilteredRows(rows) {
    if (state.duplicateMode === "all") {
      return rows;
    }
    const chosen = new Map();
    rows.forEach((row) => {
      const key = duplicateKey(row) || row.rowId;
      const current = chosen.get(key);
      if (!current) {
        chosen.set(key, row);
        return;
      }
      if (state.duplicateMode === "first") {
        if (latestTime(row) < latestTime(current)) {
          chosen.set(key, row);
        }
        return;
      }
      if (state.duplicateMode === "latest") {
        if (latestTime(row) > latestTime(current)) {
          chosen.set(key, row);
        }
        return;
      }
      if (
        row.score > current.score ||
        (row.score === current.score && latestTime(row) > latestTime(current))
      ) {
        chosen.set(key, row);
      }
    });
    return Array.from(chosen.values());
  }

  function visibleRows() {
    return duplicateFilteredRows(
      state.rows.filter((row) => !state.hiddenRows.has(row.rowId)),
    );
  }

  function renderResults() {
    elements.resultsTable.replaceChildren();
    elements.resultsTableWrap.classList.toggle("names-hidden", elements.hideNames.checked);

    const rows = visibleRows();
    elements.exportCsv.disabled = !rows.length;

    if (!rows.length || !state.test) {
      elements.resultsSummary.textContent = "No submissions loaded.";
      return;
    }

    const sortedRows = [...rows].sort(compareRows);
    elements.resultsSummary.textContent = sortedRows.length + " visible submission" + (sortedRows.length === 1 ? "" : "s") + " from " + state.rows.length + " loaded, " + state.test.questions.length + " question" + (state.test.questions.length === 1 ? "" : "s") + ".";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.append(
      document.createElement("th"),
      makeSortableHeader("schoolUsername", "Username"),
      makeSortableHeader("completedAt", "Completed"),
      makeSortableHeader("durationSeconds", "Duration")
    );

    state.test.questions.forEach((question, index) => {
      const th = document.createElement("th");
      th.className = "question-heading";

      const preview = document.createElement("button");
      preview.className = "question-link";
      preview.type = "button";
      preview.textContent = "Q" + (index + 1);
      preview.addEventListener("click", () => openQuestionPreview(index));

      const sorter = document.createElement("button");
      sorter.className = "sort-heading";
      sorter.type = "button";
      sorter.title = "Sort by question " + (index + 1);
      sorter.textContent = sortArrow("q" + index);
      sorter.addEventListener("click", () => setSort("q" + index));

      th.append(preview, document.createTextNode(" "), sorter);
      headerRow.appendChild(th);
    });

    headerRow.appendChild(makeSortableHeader("score", "Score"));
    thead.appendChild(headerRow);

    const tbody = document.createElement("tbody");
    sortedRows.forEach((row) => {
      const tr = document.createElement("tr");
      const hideCell = document.createElement("td");
      const hideButton = document.createElement("button");
      hideButton.className = "row-hide-button";
      hideButton.type = "button";
      hideButton.title =
        state.deleteCloudOnHide && row.cloudBacked
          ? "Delete this cloud submission and remove it from the grid"
          : "Hide this submission until the grid is reloaded";
      hideButton.textContent = "x";
      hideButton.addEventListener("click", () => removeResultRow(row));
      hideCell.appendChild(hideButton);
      const usernameCell = document.createElement("td");
      usernameCell.className = "student-username";
      usernameCell.textContent = row.schoolUsername;
      if (row.usedExtraTime) {
        const icon = document.createElement("span");
        icon.className = "extra-time-icon";
        icon.title = "Used extra time";
        icon.textContent = " ⏱";
        usernameCell.appendChild(icon);
      }
      if (row.usedRestBreaks) {
        const icon = document.createElement("span");
        icon.className = "rest-break-icon";
        icon.title = "Used rest breaks";
        icon.textContent = " ⏸";
        usernameCell.appendChild(icon);
      }
      tr.append(
        hideCell,
        usernameCell,
        makeCell(U.formatDateTime(row.completedAt), ""),
        makeCell(formatDuration(row.durationSeconds), "duration-cell")
      );

      row.marks.forEach((_, index) => {
        tr.appendChild(makeQuestionCell(row, index));
      });

      tr.appendChild(makeCell(row.score + " / " + state.test.questions.length, ""));
      tbody.appendChild(tr);
    });

    const summaryRows = buildSummaryRows(sortedRows);
    if (summaryRows.length) {
      const sep = document.createElement("tr");
      sep.className = "summary-separator";
      const sepTd = document.createElement("td");
      sepTd.colSpan = 4 + state.test.questions.length + 1;
      sep.appendChild(sepTd);
      tbody.appendChild(sep);
      summaryRows.forEach((r) => tbody.appendChild(r));
    }
    elements.resultsTable.append(thead, tbody);
  }

  function buildSummaryRows(sortedRows) {
    if (!state.test || !sortedRows.length) return [];
    const questions = state.test.questions;
    const total = sortedRows.length;

    function makeSummaryLabelCell(text) {
      const td = document.createElement("td");
      td.className = "summary-label";
      td.textContent = text;
      return td;
    }

    function makeEmptyTd() {
      return document.createElement("td");
    }

    function makeSummaryRow(label) {
      const tr = document.createElement("tr");
      tr.className = "summary-row";
      tr.appendChild(makeEmptyTd());
      tr.appendChild(makeSummaryLabelCell(label));
      tr.appendChild(makeEmptyTd()); // completed-at
      tr.appendChild(makeEmptyTd()); // duration
      return tr;
    }

    if (state.resultDisplayMode === "marks") {
      const correctRow = makeSummaryRow("% Correct");
      const wrongRow = makeSummaryRow("% Wrong");

      questions.forEach((_, qIndex) => {
        const correct = sortedRows.filter((r) => r.marks[qIndex] === true).length;
        const wrong = sortedRows.filter((r) => r.marks[qIndex] === false).length;

        const correctTd = document.createElement("td");
        correctTd.className = "question-cell summary-cell";
        const correctSpan = document.createElement("span");
        correctSpan.className = "mark-correct";
        correctSpan.textContent = Math.round((correct / total) * 100) + "%";
        correctTd.appendChild(correctSpan);
        correctRow.appendChild(correctTd);

        const wrongTd = document.createElement("td");
        wrongTd.className = "question-cell summary-cell";
        const wrongSpan = document.createElement("span");
        wrongSpan.className = "mark-incorrect";
        wrongSpan.textContent = Math.round((wrong / total) * 100) + "%";
        wrongTd.appendChild(wrongSpan);
        wrongRow.appendChild(wrongTd);
      });

      correctRow.appendChild(makeEmptyTd());
      wrongRow.appendChild(makeEmptyTd());
      return [correctRow, wrongRow];
    }

    const maxOptions = Math.max(...questions.map((q) => q.optionCount));
    const rows = [];
    for (let optIdx = 0; optIdx < maxOptions; optIdx += 1) {
      const letter = U.optionLetter(optIdx);
      const summaryRow = makeSummaryRow(letter);

      questions.forEach((question, qIndex) => {
        const td = document.createElement("td");
        td.className = "question-cell summary-cell";
        if (optIdx >= question.optionCount) {
          td.textContent = "-";
          summaryRow.appendChild(td);
          return;
        }
        const chose = sortedRows.filter(
          (r) => answerIndexFromValue(r.answers[qIndex]) === optIdx,
        ).length;
        const pct = Math.round((chose / total) * 100) + "%";
        const span = document.createElement("span");
        span.className = question.correctIndex === optIdx ? "mark-correct" : "mark-incorrect";
        span.textContent = pct;
        td.appendChild(span);
        summaryRow.appendChild(td);
      });

      summaryRow.appendChild(makeEmptyTd());
      rows.push(summaryRow);
    }
    return rows;
  }

  function makeQuestionCell(row, index) {
    const td = document.createElement("td");
    td.className = "question-cell";
    const mark = row.marks[index];
    if (state.resultDisplayMode === "choices") {
      const letter = answerLetter(row.answers[index]);
      if (letter === "-" && mark === null) {
        td.appendChild(makeMarkSpan(mark, false));
        return td;
      }
      const wrap = document.createElement("span");
      wrap.className = "choice-mark";
      const choice = document.createElement("span");
      choice.className = "choice-letter";
      choice.textContent = letter;
      wrap.append(choice, makeMarkSpan(mark, true));
      td.appendChild(wrap);
      return td;
    }
    td.appendChild(makeMarkSpan(mark, false));
    return td;
  }

  function makeMarkSpan(mark, compact) {
    const span = document.createElement("span");
    if (mark === true) {
      span.className = "mark-correct" + (compact ? " mark-icon" : "");
      span.textContent = "✓";
    } else if (mark === false) {
      span.className = "mark-incorrect" + (compact ? " mark-icon" : "");
      span.textContent = "✗";
    } else {
      span.className = "mark-empty" + (compact ? " mark-icon" : "");
      span.textContent = "-";
    }
    return span;
  }

  function answerLetter(answer) {
    const index = answerIndexFromValue(answer);
    if (index === null) {
      return "-";
    }
    return U.optionLetter(index);
  }

  function answerIndexFromValue(answer) {
    if (answer === null || answer === undefined || answer === "") {
      return null;
    }
    if (typeof answer === "number") {
      return answer;
    }
    const text = String(answer).trim();
    if (/^[A-Za-z]$/.test(text)) {
      const index = text.toUpperCase().charCodeAt(0) - 65;
      return index >= 0 ? index : null;
    }
    const index = Number.parseInt(text, 10);
    return Number.isNaN(index) ? null : index;
  }

  function showDeleteConfirm(message) {
    elements.deleteConfirmMessage.textContent = message;
    elements.deleteConfirmModal.hidden = false;
    return new Promise((resolve) => {
      function cleanup() {
        elements.deleteConfirmModal.hidden = true;
        elements.deleteConfirmYes.removeEventListener("click", onYes);
        elements.deleteConfirmNo.removeEventListener("click", onNo);
      }
      function onYes() { cleanup(); resolve(true); }
      function onNo() { cleanup(); resolve(false); }
      elements.deleteConfirmYes.addEventListener("click", onYes);
      elements.deleteConfirmNo.addEventListener("click", onNo);
    });
  }

  async function removeResultRow(row) {
    if (!row || !row.rowId) {
      return;
    }
    if (!state.deleteCloudOnHide || !row.cloudBacked || !row.submissionGuid) {
      state.hiddenRows.add(row.rowId);
      renderResults();
      return;
    }
    if (!U.CodehooksIntegration || !U.CodehooksIntegration.deleteTeacherSubmission) {
      U.setStatus(elements.analyseStatus, "Cloud deletion is not available.", "error");
      return;
    }
    if (!await showDeleteConfirm("Delete this submission from the cloud database? This cannot be undone.")) {
      return;
    }

    setBusy(true);
    U.setStatus(elements.analyseStatus, "Deleting cloud submission...", "");
    try {
      await U.CodehooksIntegration.deleteTeacherSubmission(
        row.submissionGuid,
        state.privateKeyText,
      );
      state.rows = state.rows.filter((candidate) => candidate.rowId !== row.rowId);
      state.hiddenRows.delete(row.rowId);
      renderResults();
      U.setStatus(elements.analyseStatus, "Cloud submission deleted.", "ok");
    } catch (error) {
      U.setStatus(elements.analyseStatus, error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function makeCell(text, className) {
    const td = document.createElement("td");
    if (className) {
      td.className = className;
    }
    td.textContent = text;
    return td;
  }

  function makeSortableHeader(key, label) {
    const th = document.createElement("th");
    const button = document.createElement("button");
    button.className = "sort-heading";
    button.type = "button";
    button.textContent = label + " " + sortArrow(key);
    button.addEventListener("click", () => setSort(key));
    th.appendChild(button);
    return th;
  }

  function sortArrow(key) {
    if (state.sortKey !== key) {
      return "↕";
    }
    return state.sortDirection === "asc" ? "▲" : "▼";
  }

  function setSort(key) {
    if (state.sortKey === key) {
      state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      state.sortKey = key;
      state.sortDirection = key === "score" ? "desc" : "asc";
    }
    renderResults();
  }

  function openQuestionPreview(index) {
    if (!state.test || !state.test.questions[index]) {
      return;
    }

    state.previewIndex = index;
    state.previewSelectedIndex = null;
    elements.showPreviewAnswer.checked = false;
    elements.previewTitle.textContent = "Question " + (index + 1);
    renderQuestionPreview();
    elements.questionModal.hidden = false;
  }

  function renderQuestionPreview() {
    const index = state.previewIndex;
    if (index === null || !state.test || !state.test.questions[index]) {
      return;
    }
    const question = state.test.questions[index];
    U.renderQuestionView(elements.previewQuestion, question, {
      groupName: "preview-question-" + index,
      selectedIndex: state.previewSelectedIndex,
      correctIndex: question.correctIndex,
      showCorrectAnswer: elements.showPreviewAnswer.checked,
      showFeedback: state.previewSelectedIndex !== null,
      onChange(answerIndex) {
        state.previewSelectedIndex = answerIndex;
        renderQuestionPreview();
      },
    });
    if (elements.showPreviewAnswer.checked) {
      elements.previewMeta.textContent = "Correct answer: " + U.optionLetter(question.correctIndex);
      elements.previewMeta.className = "";
    } else if (state.previewSelectedIndex !== null) {
      elements.previewMeta.textContent = state.previewSelectedIndex === question.correctIndex ? "Correct" : "Incorrect";
      elements.previewMeta.className = state.previewSelectedIndex === question.correctIndex ? "mark-correct" : "mark-incorrect";
    } else {
      elements.previewMeta.textContent = "";
      elements.previewMeta.className = "";
    }
  }

  function closeQuestionPreview() {
    elements.questionModal.hidden = true;
    state.previewIndex = null;
    state.previewSelectedIndex = null;
  }

  function exportCsv() {
    const rows = visibleRows();
    if (!rows.length || !state.test) {
      return;
    }

    const sortedRows = [...rows].sort(compareRows);
    const headers = ["Username", "Completed", "Duration"].concat(
      state.test.questions.map((_, index) => "Q" + (index + 1)),
      ["Score"]
    );
    const lines = [headers.map(U.csvEscape).join(",")];

    sortedRows.forEach((row) => {
      const values = [
        row.schoolUsername,
        row.completedAt,
        formatDuration(row.durationSeconds),
        ...row.marks.map((mark, index) => csvQuestionValue(row, index, mark)),
        row.score + "/" + state.test.questions.length,
      ];
      lines.push(values.map(U.csvEscape).join(","));
    });

    U.downloadText(state.testId + "_results.csv", lines.join("\r\n"));
  }

  function csvQuestionValue(row, index, mark) {
    if (state.resultDisplayMode !== "choices") {
      return mark === null ? "" : mark ? "1" : "0";
    }
    const letter = answerLetter(row.answers[index]);
    if (letter === "-") {
      return "";
    }
    return letter + " " + (mark ? "correct" : "incorrect");
  }

  async function unlockWithPrivateKey() {
    const selectedFile = elements.privateKeyFile.files[0];
    let privateKeyText = state.privateKeyText;
    if (selectedFile) {
      privateKeyText = await selectedFile.text();
    }
    if (!privateKeyText) {
      U.setStatus(elements.privateKeyStatus, "Choose keydetails.txt first.", "error");
      return;
    }

    elements.unlockAnalyseButton.disabled = true;
    U.setStatus(elements.privateKeyStatus, "Checking private key...", "");
    try {
      const keytestText = await U.fetchTextFile("keytest.txt");
      const result = await U.decryptTextWithPrivateKey(keytestText, privateKeyText);
      if (result.trim() !== "ACCESS GRANTED") {
        throw new Error("The private key did not pass the key test.");
      }

      state.privateKeyText = privateKeyText;
      state.unlocked = true;
      if (elements.retainPrivateKey.checked) {
        window.localStorage.setItem("unitesterPrivateKey", privateKeyText);
      } else {
        window.localStorage.removeItem("unitesterPrivateKey");
      }
      elements.privateKeyModal.hidden = true;
      U.setStatus(elements.analyseStatus, "Private key accepted. Find a test to analyse.", "ok");
    } catch (error) {
      state.privateKeyText = "";
      window.localStorage.removeItem("unitesterPrivateKey");
      U.setStatus(elements.privateKeyStatus, error.message, "error");
    } finally {
      elements.unlockAnalyseButton.disabled = false;
    }
  }

  function loadStoredPrivateKey() {
    const stored = window.localStorage.getItem("unitesterPrivateKey");
    if (!stored) {
      return;
    }
    state.privateKeyText = stored;
    elements.retainPrivateKey.checked = true;
    unlockWithPrivateKey();
  }

  function openSettings() {
    elements.hideNames.checked = Boolean(elements.hideNames.checked);
    elements.duplicateMode.value = state.duplicateMode;
    elements.resultDisplayMode.value = state.resultDisplayMode;
    elements.deleteCloudOnHide.checked = state.deleteCloudOnHide;
    elements.settingsModal.hidden = false;
    U.setStatus(elements.settingsStatus, "", "");
  }

  function closeSettings() {
    elements.settingsModal.hidden = true;
  }

  async function generateAndDownloadKeys() {
    elements.generateKeysButton.disabled = true;
    U.setStatus(elements.settingsStatus, "Generating key pair...", "");
    try {
      const files = await U.generateKeyFiles();
      U.downloadText("publickey.txt", files.publicKeyFile);
      U.downloadText("keytest.txt", files.keytestFile);
      U.downloadText("keydetails.txt", files.keyDetailsFile);
      U.setStatus(elements.settingsStatus, "Downloaded publickey.txt, keytest.txt, and keydetails.txt.", "ok");
    } catch (error) {
      U.setStatus(elements.settingsStatus, error.message, "error");
    } finally {
      elements.generateKeysButton.disabled = false;
    }
  }

  elements.findByNameButton.addEventListener("click", showAnalysisNameSearch);
  elements.searchByNameButton.addEventListener("click", findAnalysisTestByName);
  elements.browseOpenButton.addEventListener("click", browseAnalysisOpenTests);
  elements.lockTestButton.addEventListener("click", lockSelectedTest);
  elements.analyseButton.addEventListener("click", analyseSubmissions);
  elements.addTxtButton.addEventListener("click", addTextSubmissions);
  elements.fetchCloudSubmissions.addEventListener("click", fetchCloudSubmissions);
  elements.unlockAnalyseButton.addEventListener("click", unlockWithPrivateKey);
  elements.settingsButton.addEventListener("click", openSettings);
  elements.closeSettings.addEventListener("click", closeSettings);
  elements.closeSettingsTop.addEventListener("click", closeSettings);
  elements.generateKeysButton.addEventListener("click", generateAndDownloadKeys);
  elements.settingsModal.addEventListener("click", (event) => {
    if (event.target === elements.settingsModal) {
      closeSettings();
    }
  });
  elements.testName.addEventListener("input", () => resetTestChoices("Find a test first..."));
  elements.testName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      findAnalysisTestByName();
    }
  });
  elements.testSelect.addEventListener("change", () => {
    elements.lockTestButton.disabled = !elements.testSelect.value;
    elements.uploadPanel.hidden = true;
    if (state.testId && elements.testSelect.value !== state.testId) {
      state.test = null;
      state.testId = "";
      state.rows = [];
      state.hiddenRows = new Set();
      renderResults();
    }
  });
  elements.hideNames.addEventListener("change", renderResults);
  elements.duplicateMode.addEventListener("change", () => {
    state.duplicateMode = elements.duplicateMode.value;
    renderResults();
  });
  elements.resultDisplayMode.addEventListener("change", () => {
    state.resultDisplayMode = elements.resultDisplayMode.value;
    renderResults();
  });
  elements.deleteCloudOnHide.addEventListener("change", () => {
    state.deleteCloudOnHide = elements.deleteCloudOnHide.checked;
    renderResults();
  });
  elements.exportCsv.addEventListener("click", exportCsv);
  elements.closePreview.addEventListener("click", closeQuestionPreview);
  elements.closePreviewTop.addEventListener("click", closeQuestionPreview);
  elements.showPreviewAnswer.addEventListener("change", renderQuestionPreview);
  elements.questionModal.addEventListener("click", (event) => {
    if (event.target === elements.questionModal) {
      closeQuestionPreview();
    }
  });

  loadStoredPrivateKey();
})();
