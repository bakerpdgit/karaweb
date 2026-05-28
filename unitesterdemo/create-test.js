(function () {
  "use strict";

  const U = window.Unitester;
  const state = {
    mode: "zip",
    questions: [],
    currentIndex: 0,
    editMode: null,
    selectingOptionIndex: null,
    wizardIndex: null,
    wizardRects: [],
    cropRect: null,
    drag: null,
    pendingEdit: null,
    activeOptionMarkdownIndex: null,
    pendingTestText: "",
    pendingTestBase: "",
    instructionsEditor: null,
    endInstructionsEditor: null,
    explanationEditor: null,
    questionEditor: null,
    optionEditor: null,
    activeMarkdownEditor: null,
    pendingMarkdownImage: null,
    markdownImageCropRect: null,
    creatorKeyText: "",
    pendingCreatorKeyAction: null,
  };

  const elements = {
    openTestButton: document.getElementById("openTestButton"),
    openTestFile: document.getElementById("openTestFile"),
    zipMode: document.getElementById("zipMode"),
    pasteMode: document.getElementById("pasteMode"),
    addTextQuestionButton: document.getElementById("addTextQuestionButton"),
    zipPanel: document.getElementById("zipPanel"),
    pastePanel: document.getElementById("pastePanel"),
    zipUpload: document.getElementById("zipUpload"),
    pasteBox: document.getElementById("pasteBox"),
    pasteImageButton: document.getElementById("pasteImageButton"),
    browseImageButton: document.getElementById("browseImageButton"),
    imageUpload: document.getElementById("imageUpload"),
    importStatus: document.getElementById("importStatus"),
    imageList: document.getElementById("imageList"),
    emptyState: document.getElementById("emptyState"),
    reviewSection: document.getElementById("reviewSection"),
    wizardBar: document.getElementById("wizardBar"),
    imageEditor: document.getElementById("imageEditor"),
    questionMarkdownMount: document.getElementById("questionMarkdownMount"),
    questionOptionsPreview: document.getElementById("questionOptionsPreview"),
    reviewImage: document.getElementById("reviewImage"),
    editOverlay: document.getElementById("editOverlay"),
    editorHint: document.getElementById("editorHint"),
    stepIndicator: document.getElementById("stepIndicator"),
    questionTextTool: document.getElementById("questionTextTool"),
    resizeTool: document.getElementById("resizeTool"),
    cropTool: document.getElementById("cropTool"),
    optionCount: document.getElementById("optionCount"),
    correctAnswerChoices: document.getElementById("correctAnswerChoices"),
    optionWizard: document.getElementById("optionWizard"),
    optionSnippetList: document.getElementById("optionSnippetList"),
    showLetterPrefixes: document.getElementById("showLetterPrefixes"),
    explanationButton: document.getElementById("explanationButton"),
    previousQuestion: document.getElementById("previousQuestion"),
    nextQuestion: document.getElementById("nextQuestion"),
    removeQuestion: document.getElementById("removeQuestion"),
    moveQuestionUp: document.getElementById("moveQuestionUp"),
    moveQuestionDown: document.getElementById("moveQuestionDown"),
    downloadForm: document.getElementById("downloadForm"),
    testTitle: document.getElementById("testTitle"),
    activityMode: document.getElementById("activityMode"),
    guideTimeField: document.getElementById("guideTimeField"),
    guideTimeMinutes: document.getElementById("guideTimeMinutes"),
    timerEnforcementField: document.getElementById("timerEnforcementField"),
    timerEnforcement: document.getElementById("timerEnforcement"),
    extraTimeOptionField: document.getElementById("extraTimeOptionField"),
    extraTimeOption: document.getElementById("extraTimeOption"),
    openTestMode: document.getElementById("openTestMode"),
    instructions: document.getElementById("instructions"),
    endInstructions: document.getElementById("endInstructions"),
    endInstructionsPreview: document.getElementById("endInstructionsPreview"),
    editEndInstructions: document.getElementById("editEndInstructions"),
    downloadStatus: document.getElementById("downloadStatus"),
    clearAll: document.getElementById("clearAll"),
    editConfirmModal: document.getElementById("editConfirmModal"),
    editConfirmTitle: document.getElementById("editConfirmTitle"),
    editConfirmMessage: document.getElementById("editConfirmMessage"),
    editConfirmCancel: document.getElementById("editConfirmCancel"),
    editConfirmYes: document.getElementById("editConfirmYes"),
    testKeyModal: document.getElementById("testKeyModal"),
    testKeyInput: document.getElementById("testKeyInput"),
    testKeyStatus: document.getElementById("testKeyStatus"),
    testKeyCancel: document.getElementById("testKeyCancel"),
    testKeyOpen: document.getElementById("testKeyOpen"),
    creatorKeyModal: document.getElementById("creatorKeyModal"),
    creatorKeyMessage: document.getElementById("creatorKeyMessage"),
    creatorKeyFile: document.getElementById("creatorKeyFile"),
    retainCreatorKey: document.getElementById("retainCreatorKey"),
    creatorKeyStatus: document.getElementById("creatorKeyStatus"),
    creatorKeyCancel: document.getElementById("creatorKeyCancel"),
    creatorKeyUnlock: document.getElementById("creatorKeyUnlock"),
    explanationModal: document.getElementById("explanationModal"),
    explanationMarkdown: document.getElementById("explanationMarkdown"),
    explanationEditorMount: document.getElementById("explanationEditorMount"),
    explanationCloseTop: document.getElementById("explanationCloseTop"),
    deleteExplanation: document.getElementById("deleteExplanation"),
    cancelExplanation: document.getElementById("cancelExplanation"),
    saveExplanation: document.getElementById("saveExplanation"),
    questionTextModal: document.getElementById("questionTextModal"),
    questionMarkdown: document.getElementById("questionMarkdown"),
    questionEditorMount: document.getElementById("questionEditorMount"),
    questionTextCloseTop: document.getElementById("questionTextCloseTop"),
    deleteQuestionText: document.getElementById("deleteQuestionText"),
    cancelQuestionText: document.getElementById("cancelQuestionText"),
    saveQuestionText: document.getElementById("saveQuestionText"),
    optionTextModal: document.getElementById("optionTextModal"),
    optionTextTitle: document.getElementById("optionTextTitle"),
    optionMarkdown: document.getElementById("optionMarkdown"),
    optionEditorMount: document.getElementById("optionEditorMount"),
    optionTextCloseTop: document.getElementById("optionTextCloseTop"),
    deleteOptionText: document.getElementById("deleteOptionText"),
    cancelOptionText: document.getElementById("cancelOptionText"),
    saveOptionText: document.getElementById("saveOptionText"),
    endInstructionsModal: document.getElementById("endInstructionsModal"),
    endInstructionsMarkdown: document.getElementById("endInstructionsMarkdown"),
    endInstructionsEditorMount: document.getElementById("endInstructionsEditorMount"),
    endInstructionsCloseTop: document.getElementById("endInstructionsCloseTop"),
    resetEndInstructions: document.getElementById("resetEndInstructions"),
    cancelEndInstructions: document.getElementById("cancelEndInstructions"),
    saveEndInstructions: document.getElementById("saveEndInstructions"),
    instructionsEditorMount: document.getElementById("instructionsEditorMount"),
    markdownImageModal: document.getElementById("markdownImageModal"),
    markdownImageCloseTop: document.getElementById("markdownImageCloseTop"),
    markdownImagePasteBox: document.getElementById("markdownImagePasteBox"),
    markdownPasteImageButton: document.getElementById("markdownPasteImageButton"),
    markdownBrowseImageButton: document.getElementById("markdownBrowseImageButton"),
    markdownImageFile: document.getElementById("markdownImageFile"),
    markdownImageEditor: document.getElementById("markdownImageEditor"),
    markdownImageAlt: document.getElementById("markdownImageAlt"),
    markdownImageWidth: document.getElementById("markdownImageWidth"),
    markdownCropImageButton: document.getElementById("markdownCropImageButton"),
    markdownApplyCropButton: document.getElementById("markdownApplyCropButton"),
    markdownImagePreview: document.getElementById("markdownImagePreview"),
    markdownImageOverlay: document.getElementById("markdownImageOverlay"),
    markdownImageStatus: document.getElementById("markdownImageStatus"),
    cancelMarkdownImage: document.getElementById("cancelMarkdownImage"),
    insertMarkdownImage: document.getElementById("insertMarkdownImage"),
    linkModal: document.getElementById("linkModal"),
    linkText: document.getElementById("linkText"),
    linkUrl: document.getElementById("linkUrl"),
    linkStatus: document.getElementById("linkStatus"),
    cancelLink: document.getElementById("cancelLink"),
    insertLink: document.getElementById("insertLink"),
    equationModal: document.getElementById("equationModal"),
    equationInput: document.getElementById("equationInput"),
    equationDisplayMode: document.getElementById("equationDisplayMode"),
    equationPreview: document.getElementById("equationPreview"),
    equationStatus: document.getElementById("equationStatus"),
    cancelEquation: document.getElementById("cancelEquation"),
    insertEquation: document.getElementById("insertEquation"),
  };

  function initialiseOptionCounts() {
    elements.optionCount.replaceChildren();
    for (let count = 2; count <= 26; count += 1) {
      elements.optionCount.append(new Option(count + " (" + U.optionLetter(count - 1) + ")", String(count)));
    }
  }

  function ensureQuestionShape(question) {
    question.optionCount = U.clampOptionCount(question.optionCount);
    question.correctIndex = Number.parseInt(question.correctIndex, 10) || 0;
    if (question.correctIndex >= question.optionCount) {
      question.correctIndex = 0;
    }
    if (!Array.isArray(question.optionImages)) {
      question.optionImages = [];
    }
    if (!Array.isArray(question.optionMarkdown)) {
      question.optionMarkdown = [];
    }
    question.optionImages = question.optionImages.slice(0, question.optionCount);
    question.optionMarkdown = question.optionMarkdown.slice(0, question.optionCount);
    while (question.optionImages.length < question.optionCount) {
      question.optionImages.push("");
    }
    while (question.optionMarkdown.length < question.optionCount) {
      question.optionMarkdown.push("");
    }
    question.questionMarkdown = String(question.questionMarkdown || question.markdown || "");
    question.optionMarkdown = question.optionMarkdown.map((value) => String(value || ""));
    question.explanationMarkdown = String(question.explanationMarkdown || question.explanation || "");
    question.showLetterPrefixes = question.showLetterPrefixes === false ? false : true;
  }

  function currentQuestion() {
    return state.questions[state.currentIndex] || null;
  }

  function setMode(mode) {
    state.mode = mode;
    const zipActive = mode === "zip";
    elements.zipMode.classList.toggle("is-active", zipActive);
    elements.pasteMode.classList.toggle("is-active", !zipActive);
    elements.zipPanel.hidden = !zipActive;
    elements.pastePanel.hidden = zipActive;
    U.setStatus(elements.importStatus, "", "");
  }

  function setBusy(isBusy) {
    elements.openTestButton.disabled = isBusy;
    elements.zipUpload.disabled = isBusy;
    elements.imageUpload.disabled = isBusy;
    elements.zipMode.disabled = isBusy;
    elements.pasteMode.disabled = isBusy;
    elements.addTextQuestionButton.disabled = isBusy;
    elements.questionTextTool.disabled = isBusy;
    elements.resizeTool.disabled = isBusy;
    elements.cropTool.disabled = isBusy;
    elements.optionWizard.disabled = isBusy;
  }

  function loadStoredCreatorKey() {
    const stored = window.localStorage.getItem("unitesterPrivateKey");
    if (!stored) {
      return;
    }
    try {
      U.publicKeyTextFromKeyDetails(stored);
      state.creatorKeyText = stored;
      elements.retainCreatorKey.checked = true;
    } catch (error) {
      window.localStorage.removeItem("unitesterPrivateKey");
      state.creatorKeyText = "";
    }
  }

  function updateActivityModeFields() {
    const testMode = elements.activityMode.value !== "review";
    elements.guideTimeField.hidden = !testMode;
    elements.timerEnforcementField.hidden = !testMode;
    elements.extraTimeOptionField.hidden = !testMode;
    if (!testMode) {
      elements.guideTimeMinutes.value = "";
    }
  }

  function openCreatorKeyModal(message, action) {
    state.pendingCreatorKeyAction = action || null;
    elements.creatorKeyMessage.textContent = message || "Choose keydetails.txt so answers and explanations can be protected.";
    elements.creatorKeyFile.value = "";
    U.setStatus(elements.creatorKeyStatus, state.creatorKeyText ? "A retained key is available. Click Use Key to continue, or choose a different keydetails.txt." : "", "");
    elements.creatorKeyModal.hidden = false;
  }

  function closeCreatorKeyModal() {
    elements.creatorKeyModal.hidden = true;
    state.pendingCreatorKeyAction = null;
  }

  async function unlockCreatorKey() {
    const file = elements.creatorKeyFile.files[0];
    let keyText = state.creatorKeyText;
    if (file) {
      keyText = await file.text();
    }
    if (!keyText) {
      U.setStatus(elements.creatorKeyStatus, "Choose keydetails.txt first.", "error");
      return;
    }

    elements.creatorKeyUnlock.disabled = true;
    try {
      U.publicKeyTextFromKeyDetails(keyText);
      state.creatorKeyText = keyText;
      if (elements.retainCreatorKey.checked) {
        window.localStorage.setItem("unitesterPrivateKey", keyText);
      } else {
        window.localStorage.removeItem("unitesterPrivateKey");
      }
      const action = state.pendingCreatorKeyAction;
      if (typeof action === "function") {
        await action();
      }
      elements.creatorKeyModal.hidden = true;
      state.pendingCreatorKeyAction = null;
    } catch (error) {
      state.creatorKeyText = "";
      elements.creatorKeyModal.hidden = false;
      U.setStatus(elements.creatorKeyStatus, error.message, "error");
    } finally {
      elements.creatorKeyUnlock.disabled = false;
    }
  }

  function makeToolbarButton(label, title, handler) {
    const button = document.createElement("button");
    button.className = "editor-tool-button";
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", handler);
    return button;
  }

  function createMarkdownEditor(source, mount) {
    const wrapper = document.createElement("div");
    wrapper.className = "markdown-editor";

    const toolbar = document.createElement("div");
    toolbar.className = "markdown-toolbar";

    const preview = document.createElement("div");
    preview.className = "markdown-preview markdown-content";

    const editor = {
      source,
      preview,
      pendingReplacement: null,
      update() {
        U.renderMarkdown(preview, source.value);
        preview.querySelectorAll("img.markdown-image").forEach((image) => {
          image.title = "Click to select this image in the Markdown source.";
          image.addEventListener("click", () => {
            const src = image.getAttribute("src") || "";
            const target = "](" + src + ")";
            const targetIndex = source.value.indexOf(target);
            if (targetIndex < 0) {
              return;
            }
            const start = source.value.lastIndexOf("![", targetIndex);
            const end = targetIndex + target.length;
            if (start >= 0) {
              source.setSelectionRange(start, end);
              source.focus();
            }
          });
        });
        preview.querySelectorAll("a").forEach((link) => {
          link.title = "Click to select this link in the Markdown source.";
          link.addEventListener("click", (event) => {
            event.preventDefault();
            const href = link.getAttribute("href") || "";
            const text = link.textContent || "";
            const needle = "](" + href + ")";
            const targetIndex = source.value.indexOf(needle);
            if (targetIndex < 0) {
              return;
            }
            const start = source.value.lastIndexOf("[" + text, targetIndex);
            const end = targetIndex + needle.length;
            if (start >= 0 && source.value[start - 1] !== "!") {
              source.setSelectionRange(start, end);
              source.focus();
            }
          });
        });
      },
      setValue(value) {
        source.value = String(value || "");
        this.update();
      },
      insert(text) {
        const start = source.selectionStart || 0;
        const end = source.selectionEnd || 0;
        source.setRangeText(text, start, end, "end");
        source.focus();
        this.update();
      },
      replaceRange(start, end, text) {
        source.setRangeText(text, start, end, "end");
        source.focus();
        this.update();
      },
      wrap(before, after, placeholder) {
        const start = source.selectionStart || 0;
        const end = source.selectionEnd || 0;
        const selected = source.value.slice(start, end) || placeholder;
        source.setRangeText(before + selected + after, start, end, "select");
        source.focus();
        this.update();
      },
    };

    toolbar.append(
      makeToolbarButton("B", "Bold", () => editor.wrap("**", "**", "bold text")),
      makeToolbarButton("I", "Italic", () => editor.wrap("*", "*", "italic text")),
      makeToolbarButton("H", "Heading", () => editor.insert("\n## Heading\n")),
      makeToolbarButton("•", "Bullet list", () => editor.insert("\n- List item\n")),
      makeToolbarButton("1.", "Numbered list", () => editor.insert("\n1. List item\n")),
      makeToolbarButton("Link", "Link", () => openLinkEditor(editor)),
      makeToolbarButton("Img", "Image", () => openMarkdownImageEditor(editor)),
      makeToolbarButton("fx", "Equation", () => openEquationEditor(editor))
    );

    source.classList.add("markdown-editor-source");
    source.addEventListener("input", () => editor.update());
    wrapper.append(toolbar, source, preview);
    mount.replaceChildren(wrapper);
    editor.update();
    return editor;
  }

  function inlineSvgDataUrl(svg) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function rangeTouchesCursorOrSelection(matchStart, matchEnd, selectionStart, selectionEnd) {
    if (selectionStart !== selectionEnd) {
      return selectionStart >= matchStart && selectionEnd <= matchEnd;
    }
    return selectionStart >= matchStart && selectionStart <= matchEnd;
  }

  function findTokenAtSelection(source, regex) {
    const selectionStart = source.selectionStart || 0;
    const selectionEnd = source.selectionEnd || 0;
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source.value)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (rangeTouchesCursorOrSelection(start, end, selectionStart, selectionEnd)) {
        return { match, start, end };
      }
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }
    return null;
  }

  function detectSelectedImage(editor) {
    const source = editor.source;
    const selectionStart = source.selectionStart || 0;
    const selectionEnd = source.selectionEnd || 0;
    const selected = source.value.slice(selectionStart, selectionEnd);
    const selectedMatch = /^!\[([^\]]*)\]\((data:image\/[^)]+)\)$/.exec(selected.trim());
    if (selectedMatch) {
      return {
        alt: selectedMatch[1],
        dataUrl: selectedMatch[2],
        start: selectionStart,
        end: selectionEnd,
      };
    }

    const token = findTokenAtSelection(source, /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g);
    if (!token) {
      return null;
    }
    return {
      alt: token.match[1],
      dataUrl: token.match[2],
      start: token.start,
      end: token.end,
    };
  }

  function detectSelectedLink(editor) {
    const source = editor.source;
    const selectionStart = source.selectionStart || 0;
    const selectionEnd = source.selectionEnd || 0;
    const selected = source.value.slice(selectionStart, selectionEnd);
    const selectedMatch = /^(?<!!)\[([^\]]*)\]\(([^)\s]+)\)$/.exec(selected.trim());
    if (selectedMatch) {
      return {
        text: selectedMatch[1],
        url: selectedMatch[2],
        start: selectionStart,
        end: selectionEnd,
      };
    }
    const token = findTokenAtSelection(source, /(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g);
    if (!token) {
      return null;
    }
    return {
      text: token.match[1],
      url: token.match[2],
      start: token.start,
      end: token.end,
    };
  }

  function detectSelectedEquation(editor) {
    const source = editor.source;
    const start = source.selectionStart || 0;
    const end = source.selectionEnd || 0;
    const selected = source.value.slice(start, end).trim();
    if (/^\$\$[\s\S]*\$\$$/.test(selected)) {
      return {
        latex: selected.replace(/^\$\$\s*/, "").replace(/\s*\$\$$/, ""),
        displayMode: true,
        start,
        end,
      };
    }
    if (/^\$[^$]+\$$/.test(selected)) {
      return {
        latex: selected.slice(1, -1),
        displayMode: false,
        start,
        end,
      };
    }
    const displayToken = findTokenAtSelection(source, /\$\$([\s\S]*?)\$\$/g);
    if (displayToken) {
      return {
        latex: displayToken.match[1].trim(),
        displayMode: true,
        start: displayToken.start,
        end: displayToken.end,
      };
    }
    const inlineToken = findTokenAtSelection(source, /\$(?!\$)([^$\n]+)\$/g);
    if (inlineToken) {
      return {
        latex: inlineToken.match[1],
        displayMode: false,
        start: inlineToken.start,
        end: inlineToken.end,
      };
    }
    return null;
  }

  async function addQuestions(newQuestions, sourceLabel) {
    if (!newQuestions.length) {
      U.setStatus(elements.importStatus, "No image files were found.", "error");
      return;
    }

    const lastExisting = state.questions[state.questions.length - 1];
    newQuestions.forEach(ensureQuestionShape);
    if (lastExisting) {
      newQuestions.forEach((q) => {
        if (q.showLetterPrefixes === undefined) {
          q.showLetterPrefixes = lastExisting ? lastExisting.showLetterPrefixes !== false : false;
        }
      });
    }
    const startingCount = state.questions.length;
    state.questions.push(...newQuestions);
    state.currentIndex = startingCount;
    U.setStatus(elements.importStatus, newQuestions.length + " question image" + (newQuestions.length === 1 ? "" : "s") + " added from " + sourceLabel + ".", "ok");
    renderAll();
  }

  function addTextQuestion() {
    const prevQuestion = state.questions[state.questions.length - 1];
    const question = {
      imageName: "Text question",
      imageType: "",
      imageData: "",
      questionMarkdown: "## New question\n\nType the question here.",
      optionCount: 4,
      correctIndex: 0,
      optionImages: [],
      optionMarkdown: ["", "", "", ""],
      explanationMarkdown: "",
      showLetterPrefixes: prevQuestion ? prevQuestion.showLetterPrefixes !== false : false,
    };
    ensureQuestionShape(question);
    state.questions.push(question);
    state.currentIndex = state.questions.length - 1;
    U.setStatus(elements.importStatus, "Text question added.", "ok");
    renderAll();
    openQuestionTextEditor();
  }

  function baseNameFromFile(fileName) {
    return String(fileName || "")
      .replace(/^.*[\\/]/, "")
      .replace(/\.txt$/i, "")
      .trim();
  }

  async function loadDecodedTest(text, key, sourceName) {
    const decoded = await U.decryptTestPayload(text, key, "unitester-test");
    const test = U.normalizeTest(decoded.payload);
    if (test.secureMaterial && !test.secureMaterialUnlocked) {
      if (!state.creatorKeyText) {
        openCreatorKeyModal("This test protects its answers and explanations. Choose keydetails.txt to continue editing it.", async () => {
          await U.unlockSecureMaterials(test, state.creatorKeyText);
          applyLoadedTest(test, sourceName);
        });
        return;
      }
      try {
        await U.unlockSecureMaterials(test, state.creatorKeyText);
      } catch (error) {
        state.creatorKeyText = "";
        openCreatorKeyModal("The retained key could not decrypt this test's answers and explanations. Choose the matching keydetails.txt to continue editing it.", async () => {
          await U.unlockSecureMaterials(test, state.creatorKeyText);
          applyLoadedTest(test, sourceName);
        });
        return;
      }
    }
    applyLoadedTest(test, sourceName);
  }

  function applyLoadedTest(test, sourceName) {
    state.questions = test.questions;
    state.currentIndex = 0;
    elements.testTitle.value = test.title;
    elements.activityMode.value = test.activityMode || "test";
    elements.guideTimeMinutes.value = test.guideTimeMinutes ? String(test.guideTimeMinutes) : "";
    elements.timerEnforcement.value = test.timerEnforcement || "enforce-test-informational-review";
    elements.extraTimeOption.value = test.extraTimeOption || "allow-25-percent";
    if (state.instructionsEditor) {
      state.instructionsEditor.setValue(test.instructions);
    } else {
      elements.instructions.value = test.instructions;
    }
    elements.endInstructions.value = test.endInstructions || U.defaultEndInstructions();
    updateEndInstructionsPreview();
    elements.openTestMode.checked = /^\d{3}\.txt$/i.test(sourceName || "");
    updateActivityModeFields();
    U.setStatus(elements.importStatus, "Opened " + (sourceName || "test file") + " for editing.", "ok");
    renderAll();
  }

  async function handleOpenTestFile() {
    const file = elements.openTestFile.files[0];
    if (!file) {
      return;
    }

    const base = baseNameFromFile(file.name);
    state.pendingTestText = await file.text();
    state.pendingTestBase = base;
    U.setStatus(elements.importStatus, "Opening " + file.name + "...", "");
    try {
      await loadDecodedTest(state.pendingTestText, U.testPasswordFromBase(base), file.name);
    } catch (error) {
      elements.testKeyInput.value = "";
      U.setStatus(elements.testKeyStatus, "Enter the test key to open " + file.name + ".", "");
      elements.testKeyModal.hidden = false;
      window.setTimeout(() => elements.testKeyInput.focus(), 0);
    } finally {
      elements.openTestFile.value = "";
    }
  }

  async function openPendingTestWithTypedKey() {
    const key = elements.testKeyInput.value.trim();
    if (!key) {
      U.setStatus(elements.testKeyStatus, "Enter the test key.", "error");
      return;
    }

    elements.testKeyOpen.disabled = true;
    U.setStatus(elements.testKeyStatus, "Decrypting test...", "");
    try {
      await loadDecodedTest(state.pendingTestText, key, state.pendingTestBase + ".txt");
      state.pendingTestText = "";
      state.pendingTestBase = "";
      elements.testKeyModal.hidden = true;
    } catch (error) {
      U.setStatus(elements.testKeyStatus, "That key did not open this test.", "error");
    } finally {
      elements.testKeyOpen.disabled = false;
    }
  }

  function cancelPendingTestOpen() {
    state.pendingTestText = "";
    state.pendingTestBase = "";
    elements.testKeyModal.hidden = true;
  }

  async function handleZipUpload() {
    const file = elements.zipUpload.files[0];
    if (!file) {
      return;
    }

    setBusy(true);
    U.setStatus(elements.importStatus, "Reading " + file.name + "...", "");
    try {
      const questions = await U.zipImagesToQuestions(file);
      await addQuestions(questions, "ZIP");
    } catch (error) {
      U.setStatus(elements.importStatus, error.message, "error");
    } finally {
      setBusy(false);
      elements.zipUpload.value = "";
    }
  }

  async function addImageFiles(files, sourceLabel) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      U.setStatus(elements.importStatus, "No image file was provided.", "error");
      return;
    }

    setBusy(true);
    try {
      const questions = [];
      for (const file of imageFiles) {
        questions.push(await U.fileToImageQuestion(file));
      }
      await addQuestions(questions, sourceLabel);
    } catch (error) {
      U.setStatus(elements.importStatus, error.message, "error");
    } finally {
      setBusy(false);
      elements.imageUpload.value = "";
    }
  }

  function renderAll() {
    renderImageList();
    renderReview();
  }

  function renderImageList() {
    elements.imageList.replaceChildren();
    state.questions.forEach((question, index) => {
      const item = document.createElement("button");
      item.className = "image-list-item";
      item.type = "button";
      if (index === state.currentIndex) {
        item.classList.add("is-active");
      }
      item.addEventListener("click", () => {
        state.currentIndex = index;
        renderAll();
      });

      const image = document.createElement("img");
      image.src = question.imageData || inlineSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="#eef3f7"/><text x="22" y="28" font-family="Arial" font-size="18" text-anchor="middle" fill="#17324c">T</text></svg>');
      image.alt = "";

      const text = document.createElement("span");
      text.textContent = index + 1 + ". " + (question.questionMarkdown.trim() && !question.imageData ? "Text question" : question.imageName);

      item.append(image, text);
      elements.imageList.appendChild(item);
    });
  }

  function renderReview() {
    deactivateEditTools();
    const hasQuestions = state.questions.length > 0;
    elements.emptyState.hidden = hasQuestions;
    elements.reviewSection.hidden = !hasQuestions;
    if (!hasQuestions) {
      return;
    }

    state.currentIndex = Math.max(0, Math.min(state.currentIndex, state.questions.length - 1));
    const question = currentQuestion();
    ensureQuestionShape(question);
    const hasImage = Boolean(question.imageData);
    elements.imageEditor.hidden = !hasImage;
    elements.questionMarkdownMount.hidden = !question.questionMarkdown.trim();
    if (hasImage) {
      elements.reviewImage.src = question.imageData;
      elements.reviewImage.style.width = "";
      elements.reviewImage.style.height = "";
      elements.reviewImage.style.maxWidth = "";
      elements.reviewImage.alt = question.imageName;
    } else {
      elements.reviewImage.removeAttribute("src");
    }
    if (question.questionMarkdown.trim()) {
      const preview = document.createElement("div");
      preview.className = "markdown-preview markdown-content";
      U.renderMarkdown(preview, question.questionMarkdown);
      elements.questionMarkdownMount.replaceChildren(preview);
    } else {
      elements.questionMarkdownMount.replaceChildren();
    }
    elements.stepIndicator.textContent = "Question " + (state.currentIndex + 1) + " of " + state.questions.length;

    elements.optionCount.value = String(U.clampOptionCount(question.optionCount));
    elements.resizeTool.disabled = !hasImage;
    elements.cropTool.disabled = !hasImage;
    elements.optionWizard.disabled = !hasImage;
    renderCorrectAnswerChoices();
    renderOptionSnippetList();
    renderDesignerOptionsPreview();
    elements.showLetterPrefixes.checked = question.showLetterPrefixes !== false;
    elements.explanationButton.textContent = question.explanationMarkdown.trim() ? "Edit Explanation" : "Add Explanation";

    elements.previousQuestion.disabled = state.currentIndex === 0;
    elements.nextQuestion.disabled = state.currentIndex === state.questions.length - 1;
    elements.moveQuestionUp.disabled = state.currentIndex === 0;
    elements.moveQuestionDown.disabled = state.currentIndex === state.questions.length - 1;
  }

  function renderCorrectAnswerChoices() {
    const question = currentQuestion();
    if (!question) {
      return;
    }
    ensureQuestionShape(question);
    const count = U.clampOptionCount(question.optionCount);
    if (question.correctIndex >= count) {
      question.correctIndex = 0;
    }

    elements.correctAnswerChoices.replaceChildren();
    U.optionLetters(count).forEach((letter, index) => {
      const button = document.createElement("button");
      button.className = "correct-letter-button";
      button.type = "button";
      button.textContent = letter;
      if (question.correctIndex === index) {
        button.classList.add("is-correct");
        const tick = document.createElement("span");
        tick.className = "correct-tick";
        tick.textContent = "✓";
        button.appendChild(tick);
      }
      button.addEventListener("click", () => setCorrectAnswer(index));
      elements.correctAnswerChoices.appendChild(button);
    });
  }

  function setCorrectAnswer(index) {
    const question = currentQuestion();
    if (!question) {
      return;
    }
    question.correctIndex = index;
    renderCorrectAnswerChoices();
    renderDesignerOptionsPreview();
    renderImageList();
  }

  function renderOptionSnippetList() {
    const question = currentQuestion();
    elements.optionSnippetList.replaceChildren();
    if (!question) {
      return;
    }
    ensureQuestionShape(question);

    U.optionLetters(question.optionCount).forEach((letter, index) => {
      const row = document.createElement("div");
      row.className = "option-snippet-row";
      if ((state.editMode === "snippet" && state.selectingOptionIndex === index) ||
          (state.editMode === "wizard" && state.wizardIndex === index)) {
        row.classList.add("is-selecting");
      }

      const label = document.createElement("strong");
      label.textContent = letter;

      const selectButton = document.createElement("button");
      selectButton.className = "snippet-select-button";
      selectButton.type = "button";
      selectButton.title = "Select an image area for option " + letter;
      selectButton.setAttribute("aria-label", "Select an image area for option " + letter);
      selectButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" rx="1"></rect></svg>';
      selectButton.disabled = !question.imageData;
      selectButton.addEventListener("click", () => activateSnippetSelection(index));

      const textButton = document.createElement("button");
      textButton.className = "snippet-select-button option-text-button";
      textButton.type = "button";
      textButton.title = "Edit Markdown text for option " + letter;
      textButton.setAttribute("aria-label", "Edit Markdown text for option " + letter);
      textButton.textContent = "T";
      if (question.optionMarkdown[index].trim()) {
        textButton.classList.add("has-md");
      }
      textButton.addEventListener("click", () => openOptionTextEditor(index));

      const preview = document.createElement("div");
      preview.className = "snippet-preview";
      if (question.optionImages[index]) {
        const image = document.createElement("img");
        image.src = question.optionImages[index];
        image.alt = "Option " + letter + " snippet";
        preview.appendChild(image);
      } else {
        preview.textContent = "No snippet";
      }

      const clearButton = document.createElement("button");
      clearButton.className = "snippet-clear-button";
      clearButton.type = "button";
      clearButton.title = "Clear option " + letter + " snippet";
      clearButton.setAttribute("aria-label", "Clear option " + letter + " snippet");
      clearButton.textContent = "x";
      clearButton.disabled = !question.optionImages[index];
      clearButton.addEventListener("click", () => {
        question.optionImages[index] = "";
        renderReview();
      });

      row.append(label, selectButton, textButton, preview, clearButton);
      elements.optionSnippetList.appendChild(row);
    });
  }

  function renderDesignerOptionsPreview() {
    const question = currentQuestion();
    elements.questionOptionsPreview.replaceChildren();
    if (!question) {
      return;
    }
    ensureQuestionShape(question);

    const title = document.createElement("div");
    title.className = "designer-preview-title";
    title.textContent = "Question options preview";
    elements.questionOptionsPreview.appendChild(title);

    const wrap = document.createElement("div");
    wrap.className = "answer-options designer-answer-options";
    wrap.setAttribute("role", "radiogroup");
    U.optionLetters(question.optionCount).forEach((letter, index) => {
      const label = document.createElement("label");
      label.className = "answer-option";
      if (question.correctIndex === index) {
        label.classList.add("is-correct");
      }

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "designer-option-preview";
      input.checked = question.correctIndex === index;
      input.addEventListener("change", () => setCorrectAnswer(index));

      const marker = document.createElement("span");
      marker.className = "answer-marker";
      marker.textContent = letter;
      if (question.showLetterPrefixes !== false) {
        label.append(input, marker);
      } else {
        label.append(input);
      }

      if (question.optionImages[index]) {
        const snippet = document.createElement("img");
        snippet.className = "answer-snippet";
        snippet.alt = "Option " + letter;
        snippet.src = question.optionImages[index];
        label.appendChild(snippet);
      }

      if (question.optionMarkdown[index].trim()) {
        const markdown = document.createElement("div");
        markdown.className = "answer-option-markdown markdown-content";
        U.renderMarkdown(markdown, question.optionMarkdown[index]);
        label.appendChild(markdown);
      }

      wrap.appendChild(label);
    });
    elements.questionOptionsPreview.appendChild(wrap);
  }

  function updateOptionCount() {
    const question = currentQuestion();
    if (!question) {
      return;
    }
    question.optionCount = U.clampOptionCount(elements.optionCount.value);
    ensureQuestionShape(question);
    renderReview();
  }

  function removeCurrentQuestion() {
    if (!state.questions.length) {
      return;
    }
    state.questions.splice(state.currentIndex, 1);
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    renderAll();
  }

  function moveCurrentQuestion(direction) {
    const from = state.currentIndex;
    const to = from + direction;
    if (to < 0 || to >= state.questions.length) return;
    const temp = state.questions[from];
    state.questions[from] = state.questions[to];
    state.questions[to] = temp;
    state.currentIndex = to;
    renderAll();
  }

  function clearAllQuestions() {
    if (!state.questions.length) {
      return;
    }
    askToApplyEdit(
      "Clear all question images?",
      () => {
        state.questions = [];
        state.currentIndex = 0;
        renderAll();
        U.setStatus(elements.importStatus, "Questions cleared.", "");
      },
      null,
      "Clear All Questions",
    );
  }

  function deactivateEditTools() {
    state.editMode = null;
    state.selectingOptionIndex = null;
    state.wizardIndex = null;
    state.wizardRects = [];
    state.cropRect = null;
    state.drag = null;
    elements.editOverlay.hidden = true;
    elements.editOverlay.removeEventListener("pointerdown", startSnippetDrag);
    elements.editOverlay.removeEventListener("pointerdown", startWizardDrag);
    elements.editOverlay.replaceChildren();
    elements.editOverlay.style.cursor = "";
    elements.wizardBar.hidden = true;
    elements.wizardBar.textContent = "";
    elements.editorHint.textContent = "";
    elements.resizeTool.classList.remove("is-active");
    elements.cropTool.classList.remove("is-active");
    elements.optionWizard.classList.remove("is-active");
  }

  function imageIsReady() {
    return elements.reviewImage.complete && elements.reviewImage.naturalWidth > 0 && elements.reviewImage.naturalHeight > 0;
  }

  function getImageDisplaySize() {
    const rect = elements.reviewImage.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  function getOverlayPoint(event) {
    const rect = elements.reviewImage.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  }

  function createHandle(name, onPointerDown) {
    const handle = document.createElement("button");
    handle.className = "edit-handle " + name;
    handle.type = "button";
    handle.setAttribute("aria-label", name + " handle");
    handle.addEventListener("pointerdown", onPointerDown);
    return handle;
  }

  function activateResizeTool() {
    if (!imageIsReady()) {
      U.setStatus(elements.downloadStatus, "Wait for the question image to finish loading.", "error");
      return;
    }
    deactivateEditTools();
    state.editMode = "resize";
    elements.resizeTool.classList.add("is-active");
    elements.editorHint.textContent = "Drag a corner handle to resize the question image.";
    renderResizeOverlay();
  }

  function renderResizeOverlay() {
    elements.editOverlay.hidden = false;
    elements.editOverlay.replaceChildren();
    const box = document.createElement("div");
    box.className = "edit-selection-box";
    box.style.left = "0";
    box.style.top = "0";
    box.style.width = "100%";
    box.style.height = "100%";
    ["nw", "ne", "sw", "se"].forEach((handleName) => {
      box.appendChild(createHandle(handleName, (event) => startResizeDrag(event, handleName)));
    });
    elements.editOverlay.appendChild(box);
  }

  function startResizeDrag(event, handleName) {
    event.preventDefault();
    event.stopPropagation();
    const display = getImageDisplaySize();
    state.drag = {
      type: "resize",
      handle: handleName,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: display.width,
      startHeight: display.height,
      aspect: display.width / display.height,
      originalWidth: elements.reviewImage.style.width,
      originalHeight: elements.reviewImage.style.height,
      originalMaxWidth: elements.reviewImage.style.maxWidth,
      naturalWidth: elements.reviewImage.naturalWidth,
      naturalHeight: elements.reviewImage.naturalHeight,
    };
    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", finishResizeDrag, { once: true });
  }

  function handleResizeMove(event) {
    const drag = state.drag;
    if (!drag || drag.type !== "resize") {
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const widthFromX = drag.handle.includes("w") ? drag.startWidth - dx : drag.startWidth + dx;
    const heightFromY = drag.handle.includes("n") ? drag.startHeight - dy : drag.startHeight + dy;
    const widthFromY = heightFromY * drag.aspect;
    const targetWidth = Math.max(80, Math.min(2800, Math.abs(dx) > Math.abs(dy) ? widthFromX : widthFromY));

    elements.reviewImage.style.maxWidth = "none";
    elements.reviewImage.style.width = targetWidth + "px";
    elements.reviewImage.style.height = "auto";
  }

  function finishResizeDrag() {
    const drag = state.drag;
    window.removeEventListener("pointermove", handleResizeMove);
    state.drag = null;
    if (!drag) {
      return;
    }

    const display = getImageDisplaySize();
    const changed = Math.abs(display.width - drag.startWidth) > 2;
    if (!changed) {
      elements.reviewImage.style.width = drag.originalWidth;
      elements.reviewImage.style.height = drag.originalHeight;
      elements.reviewImage.style.maxWidth = drag.originalMaxWidth;
      return;
    }

    const targetWidth = Math.max(1, Math.round(display.width * (drag.naturalWidth / drag.startWidth)));
    const targetHeight = Math.max(1, Math.round(targetWidth / drag.aspect));
    askToApplyEdit(
      "Do you want to resize the image to " + targetWidth + " x " + targetHeight + " pixels?",
      async () => {
        const question = currentQuestion();
        if (!question) {
          return;
        }
        question.imageData = await resizeImageDataUrl(question.imageData, targetWidth, targetHeight);
        question.imageType = "image/png";
        renderAll();
      },
      () => {
        elements.reviewImage.style.width = drag.originalWidth;
        elements.reviewImage.style.height = drag.originalHeight;
        elements.reviewImage.style.maxWidth = drag.originalMaxWidth;
        deactivateEditTools();
      }
    );
  }

  function activateCropTool() {
    if (!imageIsReady()) {
      U.setStatus(elements.downloadStatus, "Wait for the question image to finish loading.", "error");
      return;
    }
    deactivateEditTools();
    const display = getImageDisplaySize();
    state.editMode = "crop";
    state.cropRect = { x: 0, y: 0, w: display.width, h: display.height };
    elements.cropTool.classList.add("is-active");
    elements.editorHint.textContent = "Drag the crop handles in from any side.";
    renderCropOverlay();
  }

  function renderCropOverlay() {
    elements.editOverlay.hidden = false;
    elements.editOverlay.replaceChildren();
    const box = document.createElement("div");
    box.className = "crop-box";
    updateCropBoxStyle(box);
    ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((handleName) => {
      box.appendChild(createHandle(handleName, (event) => startCropDrag(event, handleName)));
    });
    elements.editOverlay.appendChild(box);
  }

  function updateCropBoxStyle(box) {
    const rect = state.cropRect;
    box.style.left = rect.x + "px";
    box.style.top = rect.y + "px";
    box.style.width = rect.w + "px";
    box.style.height = rect.h + "px";
  }

  function startCropDrag(event, handleName) {
    event.preventDefault();
    event.stopPropagation();
    const display = getImageDisplaySize();
    state.drag = {
      type: "crop",
      handle: handleName,
      startX: event.clientX,
      startY: event.clientY,
      startRect: { ...state.cropRect },
      bounds: display,
    };
    window.addEventListener("pointermove", handleCropMove);
    window.addEventListener("pointerup", finishCropDrag, { once: true });
  }

  function handleCropMove(event) {
    const drag = state.drag;
    if (!drag || drag.type !== "crop") {
      return;
    }

    const minSize = 24;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    let { x, y, w, h } = drag.startRect;

    if (drag.handle.includes("w")) {
      const right = drag.startRect.x + drag.startRect.w;
      x = Math.max(0, Math.min(right - minSize, drag.startRect.x + dx));
      w = right - x;
    }
    if (drag.handle.includes("e")) {
      const right = Math.max(x + minSize, Math.min(drag.bounds.width, drag.startRect.x + drag.startRect.w + dx));
      w = right - x;
    }
    if (drag.handle.includes("n")) {
      const bottom = drag.startRect.y + drag.startRect.h;
      y = Math.max(0, Math.min(bottom - minSize, drag.startRect.y + dy));
      h = bottom - y;
    }
    if (drag.handle.includes("s")) {
      const bottom = Math.max(y + minSize, Math.min(drag.bounds.height, drag.startRect.y + drag.startRect.h + dy));
      h = bottom - y;
    }

    state.cropRect = { x, y, w, h };
    const box = elements.editOverlay.querySelector(".crop-box");
    if (box) {
      updateCropBoxStyle(box);
    }
  }

  function finishCropDrag() {
    const drag = state.drag;
    window.removeEventListener("pointermove", handleCropMove);
    state.drag = null;
    if (!drag || !state.cropRect) {
      return;
    }

    const changed = Math.abs(state.cropRect.x - drag.startRect.x) > 1 ||
      Math.abs(state.cropRect.y - drag.startRect.y) > 1 ||
      Math.abs(state.cropRect.w - drag.startRect.w) > 1 ||
      Math.abs(state.cropRect.h - drag.startRect.h) > 1;
    if (!changed) {
      return;
    }

    const display = getImageDisplaySize();
    const cropRect = { ...state.cropRect };
    const naturalRect = {
      x: Math.max(0, Math.round(cropRect.x * (elements.reviewImage.naturalWidth / display.width))),
      y: Math.max(0, Math.round(cropRect.y * (elements.reviewImage.naturalHeight / display.height))),
      w: Math.max(1, Math.round(cropRect.w * (elements.reviewImage.naturalWidth / display.width))),
      h: Math.max(1, Math.round(cropRect.h * (elements.reviewImage.naturalHeight / display.height))),
    };

    askToApplyEdit(
      "Do you want to crop the image to " + naturalRect.w + " x " + naturalRect.h + " pixels?",
      async () => {
        const question = currentQuestion();
        if (!question) {
          return;
        }
        question.imageData = await cropImageDataUrl(question.imageData, naturalRect);
        question.imageType = "image/png";
        renderAll();
      },
      deactivateEditTools
    );
  }

  function activateSnippetSelection(optionIndex) {
    if (!imageIsReady()) {
      U.setStatus(elements.downloadStatus, "Wait for the question image to finish loading.", "error");
      return;
    }
    deactivateEditTools();
    state.editMode = "snippet";
    state.selectingOptionIndex = optionIndex;
    elements.editOverlay.hidden = false;
    elements.editOverlay.style.cursor = "crosshair";
    elements.editorHint.textContent = "Draw a rectangle on the image for option " + U.optionLetter(optionIndex) + ".";
    elements.editOverlay.addEventListener("pointerdown", startSnippetDrag, { once: true });
    renderOptionSnippetList();
  }

  function startSnippetDrag(event) {
    if (state.editMode !== "snippet") {
      return;
    }
    event.preventDefault();
    const point = getOverlayPoint(event);
    state.drag = {
      type: "snippet",
      start: point,
      current: point,
    };
    renderSnippetSelectionBox(point, point);
    window.addEventListener("pointermove", handleSnippetMove);
    window.addEventListener("pointerup", finishSnippetDrag, { once: true });
  }

  function handleSnippetMove(event) {
    const drag = state.drag;
    if (!drag || drag.type !== "snippet") {
      return;
    }
    drag.current = getOverlayPoint(event);
    renderSnippetSelectionBox(drag.start, drag.current);
  }

  async function finishSnippetDrag() {
    const drag = state.drag;
    window.removeEventListener("pointermove", handleSnippetMove);
    state.drag = null;
    if (!drag || drag.type !== "snippet") {
      deactivateEditTools();
      return;
    }

    const displayRect = rectFromPoints(drag.start, drag.current);
    if (displayRect.w < 6 || displayRect.h < 6) {
      deactivateEditTools();
      return;
    }

    const display = getImageDisplaySize();
    const naturalRect = {
      x: Math.max(0, Math.round(displayRect.x * (elements.reviewImage.naturalWidth / display.width))),
      y: Math.max(0, Math.round(displayRect.y * (elements.reviewImage.naturalHeight / display.height))),
      w: Math.max(1, Math.round(displayRect.w * (elements.reviewImage.naturalWidth / display.width))),
      h: Math.max(1, Math.round(displayRect.h * (elements.reviewImage.naturalHeight / display.height))),
    };

    const question = currentQuestion();
    const optionIndex = state.selectingOptionIndex;
    if (question && optionIndex !== null) {
      ensureQuestionShape(question);
      question.optionImages[optionIndex] = await cropImageDataUrl(question.imageData, naturalRect);
    }
    renderAll();
  }

  function activateOptionWizard() {
    const question = currentQuestion();
    if (!question || !imageIsReady()) {
      U.setStatus(elements.downloadStatus, "Wait for the question image to finish loading.", "error");
      return;
    }

    deactivateEditTools();
    ensureQuestionShape(question);
    state.editMode = "wizard";
    state.wizardIndex = 0;
    state.wizardRects = [];
    elements.optionWizard.classList.add("is-active");
    elements.editOverlay.hidden = false;
    elements.editOverlay.style.cursor = "crosshair";
    elements.editorHint.textContent = "";
    renderWizardOverlay();
    updateWizardPrompt();
  }

  function updateWizardPrompt() {
    const question = currentQuestion();
    if (!question || state.editMode !== "wizard") {
      return;
    }

    elements.wizardBar.hidden = false;
    elements.wizardBar.textContent = "Draw option " + U.optionLetter(state.wizardIndex) + " rectangle";
    elements.editOverlay.removeEventListener("pointerdown", startWizardDrag);
    elements.editOverlay.addEventListener("pointerdown", startWizardDrag, { once: true });
    renderOptionSnippetList();
  }

  function startWizardDrag(event) {
    if (state.editMode !== "wizard") {
      return;
    }
    event.preventDefault();
    const point = getOverlayPoint(event);
    state.drag = {
      type: "wizard",
      start: point,
      current: point,
    };
    renderWizardOverlay(rectFromPoints(point, point));
    window.addEventListener("pointermove", handleWizardMove);
    window.addEventListener("pointerup", finishWizardDrag, { once: true });
  }

  function handleWizardMove(event) {
    const drag = state.drag;
    if (!drag || drag.type !== "wizard") {
      return;
    }
    drag.current = getOverlayPoint(event);
    renderWizardOverlay(rectFromPoints(drag.start, drag.current));
  }

  async function finishWizardDrag() {
    const drag = state.drag;
    window.removeEventListener("pointermove", handleWizardMove);
    state.drag = null;
    if (!drag || drag.type !== "wizard") {
      deactivateEditTools();
      return;
    }

    const displayRect = rectFromPoints(drag.start, drag.current);
    if (displayRect.w < 6 || displayRect.h < 6) {
      renderWizardOverlay();
      updateWizardPrompt();
      return;
    }

    const question = currentQuestion();
    if (!question) {
      deactivateEditTools();
      return;
    }

    const display = getImageDisplaySize();
    const naturalRect = {
      x: Math.max(0, Math.round(displayRect.x * (elements.reviewImage.naturalWidth / display.width))),
      y: Math.max(0, Math.round(displayRect.y * (elements.reviewImage.naturalHeight / display.height))),
      w: Math.max(1, Math.round(displayRect.w * (elements.reviewImage.naturalWidth / display.width))),
      h: Math.max(1, Math.round(displayRect.h * (elements.reviewImage.naturalHeight / display.height))),
    };

    ensureQuestionShape(question);
    question.optionImages[state.wizardIndex] = await cropImageDataUrl(question.imageData, naturalRect);
    state.wizardRects.push({ ...displayRect, label: U.optionLetter(state.wizardIndex) });
    state.wizardIndex += 1;
    renderOptionSnippetList();
    renderDesignerOptionsPreview();

    if (state.wizardIndex >= question.optionCount) {
      renderWizardOverlay();
      elements.wizardBar.textContent = "Option image rectangles complete";
      window.setTimeout(() => {
        if (state.editMode === "wizard") {
          deactivateEditTools();
          renderReview();
        }
      }, 450);
      return;
    }

    renderWizardOverlay();
    updateWizardPrompt();
  }

  function renderWizardOverlay(activeRect) {
    elements.editOverlay.replaceChildren();
    state.wizardRects.forEach((rect) => {
      elements.editOverlay.appendChild(makeWizardRect(rect, rect.label));
    });
    if (activeRect) {
      elements.editOverlay.appendChild(makeWizardRect(activeRect, U.optionLetter(state.wizardIndex)));
    }
  }

  function makeWizardRect(rect, labelText) {
    const box = document.createElement("div");
    box.className = "wizard-rect";
    box.style.left = rect.x + "px";
    box.style.top = rect.y + "px";
    box.style.width = rect.w + "px";
    box.style.height = rect.h + "px";

    const label = document.createElement("span");
    label.textContent = labelText;
    box.appendChild(label);
    return box;
  }

  function renderSnippetSelectionBox(start, current) {
    const rect = rectFromPoints(start, current);
    elements.editOverlay.replaceChildren();
    const box = document.createElement("div");
    box.className = "edit-selection-box";
    box.style.left = rect.x + "px";
    box.style.top = rect.y + "px";
    box.style.width = rect.w + "px";
    box.style.height = rect.h + "px";
    elements.editOverlay.appendChild(box);
  }

  function rectFromPoints(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
      x,
      y,
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y),
    };
  }

  function askToApplyEdit(message, applyEdit, cancelEdit, title = "Confirm Image Edit") {
    state.pendingEdit = { applyEdit, cancelEdit };
    elements.editConfirmTitle.textContent = title;
    elements.editConfirmMessage.textContent = message;
    elements.editConfirmModal.hidden = false;
  }

  async function confirmPendingEdit() {
    const pending = state.pendingEdit;
    state.pendingEdit = null;
    elements.editConfirmModal.hidden = true;
    if (!pending) {
      return;
    }

    try {
      await pending.applyEdit();
      U.setStatus(elements.downloadStatus, "Image updated.", "ok");
    } catch (error) {
      U.setStatus(elements.downloadStatus, error.message, "error");
      deactivateEditTools();
    }
  }

  function cancelPendingEdit() {
    const pending = state.pendingEdit;
    state.pendingEdit = null;
    elements.editConfirmModal.hidden = true;
    if (pending && typeof pending.cancelEdit === "function") {
      pending.cancelEdit();
    }
  }

  function openExplanationEditor() {
    const question = currentQuestion();
    if (!question) {
      return;
    }
    ensureQuestionShape(question);
    if (!state.explanationEditor) {
      state.explanationEditor = createMarkdownEditor(elements.explanationMarkdown, elements.explanationEditorMount);
    }
    state.explanationEditor.setValue(question.explanationMarkdown);
    elements.explanationModal.hidden = false;
  }

  function closeExplanationEditor() {
    elements.explanationModal.hidden = true;
  }

  function saveExplanation() {
    const question = currentQuestion();
    if (!question || !state.explanationEditor) {
      closeExplanationEditor();
      return;
    }
    question.explanationMarkdown = elements.explanationMarkdown.value.trim();
    closeExplanationEditor();
    renderReview();
  }

  function deleteExplanation() {
    const question = currentQuestion();
    if (question) {
      question.explanationMarkdown = "";
    }
    closeExplanationEditor();
    renderReview();
  }

  function openQuestionTextEditor() {
    const question = currentQuestion();
    if (!question) {
      return;
    }
    ensureQuestionShape(question);
    if (!state.questionEditor) {
      state.questionEditor = createMarkdownEditor(elements.questionMarkdown, elements.questionEditorMount);
    }
    state.questionEditor.setValue(question.questionMarkdown);
    elements.questionTextModal.hidden = false;
  }

  function closeQuestionTextEditor() {
    elements.questionTextModal.hidden = true;
  }

  function saveQuestionText() {
    const question = currentQuestion();
    if (question && state.questionEditor) {
      question.questionMarkdown = elements.questionMarkdown.value.trim();
    }
    closeQuestionTextEditor();
    renderReview();
  }

  function deleteQuestionText() {
    const question = currentQuestion();
    if (question) {
      question.questionMarkdown = "";
    }
    closeQuestionTextEditor();
    renderReview();
  }

  function openOptionTextEditor(index) {
    const question = currentQuestion();
    if (!question) {
      return;
    }
    ensureQuestionShape(question);
    state.activeOptionMarkdownIndex = index;
    if (!state.optionEditor) {
      state.optionEditor = createMarkdownEditor(elements.optionMarkdown, elements.optionEditorMount);
    }
    elements.optionTextTitle.textContent = "Option " + U.optionLetter(index) + " Text";
    state.optionEditor.setValue(question.optionMarkdown[index]);
    elements.optionTextModal.hidden = false;
  }

  function closeOptionTextEditor() {
    elements.optionTextModal.hidden = true;
    state.activeOptionMarkdownIndex = null;
  }

  function saveOptionText() {
    const question = currentQuestion();
    const index = state.activeOptionMarkdownIndex;
    if (question && index !== null && state.optionEditor) {
      ensureQuestionShape(question);
      question.optionMarkdown[index] = elements.optionMarkdown.value.trim();
    }
    closeOptionTextEditor();
    renderReview();
  }

  function deleteOptionText() {
    const question = currentQuestion();
    const index = state.activeOptionMarkdownIndex;
    if (question && index !== null) {
      ensureQuestionShape(question);
      question.optionMarkdown[index] = "";
    }
    closeOptionTextEditor();
    renderReview();
  }

  function updateEndInstructionsPreview() {
    U.renderMarkdown(elements.endInstructionsPreview, elements.endInstructions.value || U.defaultEndInstructions());
  }

  function openEndInstructionsEditor() {
    if (!state.endInstructionsEditor) {
      state.endInstructionsEditor = createMarkdownEditor(elements.endInstructionsMarkdown, elements.endInstructionsEditorMount);
    }
    state.endInstructionsEditor.setValue(elements.endInstructions.value || U.defaultEndInstructions());
    elements.endInstructionsModal.hidden = false;
  }

  function closeEndInstructionsEditor() {
    elements.endInstructionsModal.hidden = true;
  }

  function saveEndInstructions() {
    elements.endInstructions.value = elements.endInstructionsMarkdown.value.trim() || U.defaultEndInstructions();
    closeEndInstructionsEditor();
    updateEndInstructionsPreview();
  }

  function resetEndInstructions() {
    if (!state.endInstructionsEditor) {
      state.endInstructionsEditor = createMarkdownEditor(elements.endInstructionsMarkdown, elements.endInstructionsEditorMount);
    }
    state.endInstructionsEditor.setValue(U.defaultEndInstructions());
  }

  function openLinkEditor(editor) {
    state.activeMarkdownEditor = editor;
    const detected = detectSelectedLink(editor);
    const selected = editor.source.value.slice(editor.source.selectionStart || 0, editor.source.selectionEnd || 0);
    editor.pendingReplacement = detected ? { start: detected.start, end: detected.end } : null;
    elements.linkText.value = detected ? detected.text : selected;
    elements.linkUrl.value = detected ? detected.url : "";
    elements.insertLink.textContent = detected ? "Update Link" : "Insert Link";
    U.setStatus(elements.linkStatus, "", "");
    elements.linkModal.hidden = false;
    window.setTimeout(() => (elements.linkText.value ? elements.linkUrl : elements.linkText).focus(), 0);
  }

  function insertLink() {
    const editor = state.activeMarkdownEditor;
    const text = elements.linkText.value.trim();
    const url = elements.linkUrl.value.trim();
    if (!editor || !text || !url) {
      U.setStatus(elements.linkStatus, "Add link text and URL.", "error");
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(url)) {
      U.setStatus(elements.linkStatus, "Use a URL beginning with http://, https://, or mailto:.", "error");
      return;
    }
    const markdown = "[" + text.replace(/]/g, "") + "](" + url.replace(/\s/g, "%20").replace(/\)/g, "%29") + ")";
    if (editor.pendingReplacement) {
      editor.replaceRange(editor.pendingReplacement.start, editor.pendingReplacement.end, markdown);
    } else {
      editor.insert(markdown);
    }
    closeLinkEditor();
  }

  function closeLinkEditor() {
    elements.linkModal.hidden = true;
    state.activeMarkdownEditor = null;
    U.setStatus(elements.linkStatus, "", "");
  }

  function openMarkdownImageEditor(editor) {
    state.activeMarkdownEditor = editor;
    const detected = detectSelectedImage(editor);
    editor.pendingReplacement = detected ? { start: detected.start, end: detected.end } : null;
    elements.markdownImageAlt.value = detected ? detected.alt : "";
    state.pendingMarkdownImage = detected ? detected.dataUrl : "";
    state.markdownImageCropRect = null;
    elements.markdownImageEditor.hidden = !state.pendingMarkdownImage;
    elements.insertMarkdownImage.textContent = detected ? "Update Image" : "Insert Image";
    elements.markdownImageOverlay.hidden = true;
    elements.markdownImageOverlay.replaceChildren();
    elements.markdownApplyCropButton.disabled = true;
    U.setStatus(elements.markdownImageStatus, detected ? "Editing selected image." : "Paste, drop, or browse for an image.", "");
    if (state.pendingMarkdownImage) {
      elements.markdownImagePreview.src = state.pendingMarkdownImage;
    } else {
      elements.markdownImagePreview.removeAttribute("src");
      elements.markdownImageWidth.value = "";
    }
    elements.markdownImageModal.hidden = false;
  }

  async function setMarkdownImageFromFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      U.setStatus(elements.markdownImageStatus, "Choose an image file.", "error");
      return;
    }
    state.pendingMarkdownImage = await U.blobToDataUrl(file);
    elements.markdownImageWidth.value = "";
    elements.markdownImagePreview.src = state.pendingMarkdownImage;
    elements.markdownImageEditor.hidden = false;
    elements.markdownImageOverlay.hidden = true;
    elements.markdownImageOverlay.replaceChildren();
    elements.markdownApplyCropButton.disabled = true;
    U.setStatus(elements.markdownImageStatus, "Image loaded. Resize or crop before inserting.", "ok");
  }

  async function pasteMarkdownImageFromClipboard() {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
      elements.markdownImagePasteBox.focus();
      U.setStatus(elements.markdownImageStatus, "Paste is ready. Press Ctrl+V in the image paste area.", "");
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          await setMarkdownImageFromFile(await item.getType(imageType));
          return;
        }
      }
      U.setStatus(elements.markdownImageStatus, "No image was found on the clipboard.", "error");
    } catch (error) {
      elements.markdownImagePasteBox.focus();
      U.setStatus(elements.markdownImageStatus, "Paste is ready. Press Ctrl+V in the image paste area.", "");
    }
  }

  function handleMarkdownImagePaste(event) {
    const items = Array.from(event.clipboardData ? event.clipboardData.items : []);
    const item = items.find((entry) => entry.kind === "file" && entry.type.startsWith("image/"));
    if (!item) {
      return;
    }
    event.preventDefault();
    setMarkdownImageFromFile(item.getAsFile());
  }

  function markdownImageDisplaySize() {
    const rect = elements.markdownImagePreview.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  function markdownImagePoint(event) {
    const rect = elements.markdownImagePreview.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  }

  function renderMarkdownCropBox(rect) {
    elements.markdownImageOverlay.replaceChildren();
    if (!rect) {
      return;
    }
    const box = document.createElement("div");
    box.className = "crop-box";
    box.style.left = rect.x + "px";
    box.style.top = rect.y + "px";
    box.style.width = rect.w + "px";
    box.style.height = rect.h + "px";
    elements.markdownImageOverlay.appendChild(box);
  }

  function activateMarkdownImageCrop() {
    if (!state.pendingMarkdownImage || !elements.markdownImagePreview.complete) {
      U.setStatus(elements.markdownImageStatus, "Load an image before cropping.", "error");
      return;
    }
    elements.markdownImageOverlay.hidden = false;
    elements.markdownImageOverlay.style.cursor = "crosshair";
    U.setStatus(elements.markdownImageStatus, "Draw a crop rectangle on the image.", "");
    elements.markdownImageOverlay.addEventListener("pointerdown", startMarkdownCropDrag, { once: true });
  }

  function startMarkdownCropDrag(event) {
    event.preventDefault();
    const point = markdownImagePoint(event);
    state.drag = {
      type: "markdown-crop",
      start: point,
      current: point,
    };
    renderMarkdownCropBox(rectFromPoints(point, point));
    window.addEventListener("pointermove", handleMarkdownCropMove);
    window.addEventListener("pointerup", finishMarkdownCropDrag, { once: true });
  }

  function handleMarkdownCropMove(event) {
    const drag = state.drag;
    if (!drag || drag.type !== "markdown-crop") {
      return;
    }
    drag.current = markdownImagePoint(event);
    renderMarkdownCropBox(rectFromPoints(drag.start, drag.current));
  }

  function finishMarkdownCropDrag() {
    const drag = state.drag;
    window.removeEventListener("pointermove", handleMarkdownCropMove);
    state.drag = null;
    if (!drag || drag.type !== "markdown-crop") {
      return;
    }
    const rect = rectFromPoints(drag.start, drag.current);
    if (rect.w < 8 || rect.h < 8) {
      elements.markdownImageOverlay.hidden = true;
      return;
    }
    state.markdownImageCropRect = rect;
    elements.markdownApplyCropButton.disabled = false;
    renderMarkdownCropBox(rect);
  }

  async function applyMarkdownImageCrop() {
    if (!state.pendingMarkdownImage || !state.markdownImageCropRect) {
      return;
    }
    const display = markdownImageDisplaySize();
    const rect = state.markdownImageCropRect;
    const naturalRect = {
      x: Math.max(0, Math.round(rect.x * (elements.markdownImagePreview.naturalWidth / display.width))),
      y: Math.max(0, Math.round(rect.y * (elements.markdownImagePreview.naturalHeight / display.height))),
      w: Math.max(1, Math.round(rect.w * (elements.markdownImagePreview.naturalWidth / display.width))),
      h: Math.max(1, Math.round(rect.h * (elements.markdownImagePreview.naturalHeight / display.height))),
    };
    state.pendingMarkdownImage = await cropImageDataUrl(state.pendingMarkdownImage, naturalRect);
    elements.markdownImagePreview.src = state.pendingMarkdownImage;
    elements.markdownImageOverlay.hidden = true;
    elements.markdownImageOverlay.replaceChildren();
    elements.markdownApplyCropButton.disabled = true;
    state.markdownImageCropRect = null;
    U.setStatus(elements.markdownImageStatus, "Image cropped.", "ok");
  }

  async function insertMarkdownImage() {
    const editor = state.activeMarkdownEditor;
    if (!editor || !state.pendingMarkdownImage) {
      U.setStatus(elements.markdownImageStatus, "Add an image first.", "error");
      return;
    }
    let dataUrl = state.pendingMarkdownImage;
    const targetWidth = Number.parseInt(elements.markdownImageWidth.value, 10);
    if (targetWidth && targetWidth > 0 && elements.markdownImagePreview.naturalWidth) {
      const ratio = targetWidth / elements.markdownImagePreview.naturalWidth;
      const targetHeight = Math.max(1, Math.round(elements.markdownImagePreview.naturalHeight * ratio));
      dataUrl = await resizeImageDataUrl(dataUrl, targetWidth, targetHeight);
    }
    const markdown = "![" + elements.markdownImageAlt.value.replace(/]/g, "") + "](" + dataUrl + ")";
    if (editor.pendingReplacement) {
      editor.replaceRange(editor.pendingReplacement.start, editor.pendingReplacement.end, markdown);
    } else {
      editor.insert("\n" + markdown + "\n");
    }
    closeMarkdownImageEditor();
  }

  function closeMarkdownImageEditor() {
    elements.markdownImageModal.hidden = true;
    state.activeMarkdownEditor = null;
    state.pendingMarkdownImage = null;
    state.markdownImageCropRect = null;
    elements.markdownImageFile.value = "";
  }

  function openEquationEditor(editor) {
    state.activeMarkdownEditor = editor;
    const detected = detectSelectedEquation(editor);
    editor.pendingReplacement = detected ? { start: detected.start, end: detected.end } : null;
    elements.equationInput.value = detected ? detected.latex : "";
    elements.equationDisplayMode.checked = detected ? detected.displayMode : false;
    elements.insertEquation.textContent = detected ? "Update Equation" : "Insert Equation";
    elements.equationModal.hidden = false;
    updateEquationPreview();
    window.setTimeout(() => elements.equationInput.focus(), 0);
  }

  function updateEquationPreview() {
    const latex = elements.equationInput.value.trim();
    const markdown = elements.equationDisplayMode.checked ? "$$\n" + latex + "\n$$" : "$" + latex + "$";
    U.renderMarkdown(elements.equationPreview, latex ? markdown : "");
  }

  function insertEquation() {
    const editor = state.activeMarkdownEditor;
    const latex = elements.equationInput.value.trim();
    if (!editor || !latex) {
      U.setStatus(elements.equationStatus, "Enter a LaTeX equation.", "error");
      return;
    }
    const markdown = elements.equationDisplayMode.checked ? "\n$$\n" + latex + "\n$$\n" : "$" + latex + "$";
    if (editor.pendingReplacement) {
      editor.replaceRange(editor.pendingReplacement.start, editor.pendingReplacement.end, markdown);
    } else {
      editor.insert(markdown);
    }
    closeEquationEditor();
  }

  function closeEquationEditor() {
    elements.equationModal.hidden = true;
    state.activeMarkdownEditor = null;
    U.setStatus(elements.equationStatus, "", "");
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load the image for editing."));
      image.src = src;
    });
  }

  async function resizeImageDataUrl(src, width, height) {
    const image = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  }

  async function cropImageDataUrl(src, rect) {
    const image = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = rect.w;
    canvas.height = rect.h;
    const context = canvas.getContext("2d");
    context.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    return canvas.toDataURL("image/png");
  }

  async function downloadTest(event) {
    if (event) {
      event.preventDefault();
    }
    if (!elements.downloadForm.reportValidity()) {
      return;
    }
    if (!state.questions.length) {
      U.setStatus(elements.downloadStatus, "Add at least one question.", "error");
      return;
    }
    if (!elements.instructions.value.trim()) {
      U.setStatus(elements.downloadStatus, "Add first page instructions.", "error");
      return;
    }

    const title = elements.testTitle.value.trim();
    let safeBase;
    try {
      safeBase = U.normaliseTestNameToBase(title);
    } catch (error) {
      U.setStatus(elements.downloadStatus, error.message, "error");
      return;
    }

    const activityMode = elements.activityMode.value === "review" ? "review" : "test";
    if (!state.creatorKeyText) {
      openCreatorKeyModal("Choose keydetails.txt so student result files can be encrypted with the teacher public key. Test-mode answers and explanations will also be protected for the teacher only.", () => downloadTest());
      return;
    }
    const publicKeyText = U.publicKeyTextFromKeyDetails(state.creatorKeyText);

    const payload = {
      version: 1,
      type: "unitester-test",
      title,
      instructions: elements.instructions.value,
      endInstructions: elements.endInstructions.value.trim() || U.defaultEndInstructions(),
      questions: state.questions.map((question) => {
        ensureQuestionShape(question);
        const correctIndex = Number.parseInt(question.correctIndex, 10) || 0;
        return {
          imageName: question.imageName,
          imageType: question.imageType,
          imageData: question.imageData,
          questionMarkdown: question.questionMarkdown,
          optionCount: U.clampOptionCount(question.optionCount),
          correctIndex: activityMode === "review" ? correctIndex : 0,
          optionImages: question.optionImages,
          optionMarkdown: question.optionMarkdown,
          explanationMarkdown: activityMode === "review" ? question.explanationMarkdown : "",
          showLetterPrefixes: question.showLetterPrefixes !== false,
        };
      }),
      activityMode,
      guideTimeMinutes: activityMode === "test" ? Math.max(0, Number.parseInt(elements.guideTimeMinutes.value, 10) || 0) : 0,
      timerEnforcement: activityMode === "test" ? elements.timerEnforcement.value : "disabled",
      extraTimeOption: activityMode === "test" ? elements.extraTimeOption.value : "disallow",
      resultPublicKey: publicKeyText,
    };

    try {
      if (activityMode === "test") {
        const securePayload = {
          version: 1,
          type: "unitester-secure-materials",
          answers: U.answerStringFromQuestions(state.questions),
          explanations: state.questions.map((question) => String(question.explanationMarkdown || "")),
        };
        payload.secureMaterial = await U.encryptPayloadWithPublicKey(title, securePayload, publicKeyText);
      }

      let filenameBase = safeBase;
      if (elements.openTestMode.checked) {
        U.setStatus(elements.downloadStatus, "Finding the next open numeric test slot...", "");
        filenameBase = await U.findNextOpenTestId((id) => {
          U.setStatus(elements.downloadStatus, "Checking tests/" + id + ".txt...");
        });
      }
      const encoded = await U.encryptTestPayload(title, payload, U.testPasswordFromBase(filenameBase));
      const filename = filenameBase + ".txt";
      U.downloadText(filename, encoded);
      U.setStatus(elements.downloadStatus, "Downloaded " + filename + ". Place it in the tests folder.", "ok");
    } catch (error) {
      U.setStatus(elements.downloadStatus, error.message, "error");
    }
  }

  function handlePaste(event) {
    const items = Array.from(event.clipboardData ? event.clipboardData.items : []);
    const files = items
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (!files.length) {
      return;
    }
    event.preventDefault();
    addImageFiles(files, "clipboard");
  }

  async function pasteFromClipboardButton() {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
      elements.pasteBox.focus();
      U.setStatus(elements.importStatus, "Paste is ready. Press Ctrl+V in the image paste area.", "");
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      const files = [];
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) {
          continue;
        }
        const blob = await item.getType(imageType);
        const extension = imageType.split("/")[1] || "png";
        files.push(new File([blob], "pasted-image-" + (files.length + 1) + "." + extension, { type: imageType }));
      }

      if (!files.length) {
        elements.pasteBox.focus();
        U.setStatus(elements.importStatus, "No image was found on the clipboard. Press Ctrl+V in the image paste area if your browser blocks direct paste.", "error");
        return;
      }
      await addImageFiles(files, "clipboard");
    } catch (error) {
      elements.pasteBox.focus();
      U.setStatus(elements.importStatus, "Paste is ready. Press Ctrl+V in the image paste area.", "");
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    elements.pasteBox.classList.remove("is-dragging");
    if (event.dataTransfer && event.dataTransfer.files.length) {
      addImageFiles(event.dataTransfer.files, "drop");
    }
  }

  elements.zipMode.addEventListener("click", () => setMode("zip"));
  elements.pasteMode.addEventListener("click", () => setMode("paste"));
  elements.addTextQuestionButton.addEventListener("click", addTextQuestion);
  elements.openTestButton.addEventListener("click", () => elements.openTestFile.click());
  elements.openTestFile.addEventListener("change", handleOpenTestFile);
  elements.testKeyOpen.addEventListener("click", openPendingTestWithTypedKey);
  elements.testKeyCancel.addEventListener("click", cancelPendingTestOpen);
  elements.testKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openPendingTestWithTypedKey();
    }
  });
  elements.testKeyModal.addEventListener("click", (event) => {
    if (event.target === elements.testKeyModal) {
      cancelPendingTestOpen();
    }
  });
  elements.creatorKeyUnlock.addEventListener("click", unlockCreatorKey);
  elements.creatorKeyCancel.addEventListener("click", closeCreatorKeyModal);
  elements.creatorKeyModal.addEventListener("click", (event) => {
    if (event.target === elements.creatorKeyModal) {
      closeCreatorKeyModal();
    }
  });
  elements.zipUpload.addEventListener("change", handleZipUpload);
  elements.imageUpload.addEventListener("change", () => addImageFiles(elements.imageUpload.files, "upload"));
  elements.pasteBox.addEventListener("click", () => elements.pasteBox.focus());
  elements.pasteImageButton.addEventListener("click", pasteFromClipboardButton);
  elements.browseImageButton.addEventListener("click", () => elements.imageUpload.click());
  elements.pasteBox.addEventListener("paste", handlePaste);
  elements.pasteBox.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.pasteBox.classList.add("is-dragging");
  });
  elements.pasteBox.addEventListener("dragleave", () => {
    elements.pasteBox.classList.remove("is-dragging");
  });
  elements.pasteBox.addEventListener("drop", handleDrop);
  elements.optionCount.addEventListener("change", updateOptionCount);
  elements.showLetterPrefixes.addEventListener("change", () => {
    const question = currentQuestion();
    if (question) {
      question.showLetterPrefixes = elements.showLetterPrefixes.checked;
      renderDesignerOptionsPreview();
    }
  });
  elements.activityMode.addEventListener("change", updateActivityModeFields);
  elements.resizeTool.addEventListener("click", activateResizeTool);
  elements.cropTool.addEventListener("click", activateCropTool);
  elements.questionTextTool.addEventListener("click", openQuestionTextEditor);
  elements.optionWizard.addEventListener("click", activateOptionWizard);
  elements.explanationButton.addEventListener("click", openExplanationEditor);
  elements.saveExplanation.addEventListener("click", saveExplanation);
  elements.cancelExplanation.addEventListener("click", closeExplanationEditor);
  elements.explanationCloseTop.addEventListener("click", closeExplanationEditor);
  elements.deleteExplanation.addEventListener("click", deleteExplanation);
  elements.explanationModal.addEventListener("click", (event) => {
    if (event.target === elements.explanationModal) {
      closeExplanationEditor();
    }
  });
  elements.saveQuestionText.addEventListener("click", saveQuestionText);
  elements.cancelQuestionText.addEventListener("click", closeQuestionTextEditor);
  elements.questionTextCloseTop.addEventListener("click", closeQuestionTextEditor);
  elements.deleteQuestionText.addEventListener("click", deleteQuestionText);
  elements.questionTextModal.addEventListener("click", (event) => {
    if (event.target === elements.questionTextModal) {
      closeQuestionTextEditor();
    }
  });
  elements.saveOptionText.addEventListener("click", saveOptionText);
  elements.cancelOptionText.addEventListener("click", closeOptionTextEditor);
  elements.optionTextCloseTop.addEventListener("click", closeOptionTextEditor);
  elements.deleteOptionText.addEventListener("click", deleteOptionText);
  elements.optionTextModal.addEventListener("click", (event) => {
    if (event.target === elements.optionTextModal) {
      closeOptionTextEditor();
    }
  });
  elements.editEndInstructions.addEventListener("click", openEndInstructionsEditor);
  elements.saveEndInstructions.addEventListener("click", saveEndInstructions);
  elements.cancelEndInstructions.addEventListener("click", closeEndInstructionsEditor);
  elements.endInstructionsCloseTop.addEventListener("click", closeEndInstructionsEditor);
  elements.resetEndInstructions.addEventListener("click", resetEndInstructions);
  elements.endInstructionsModal.addEventListener("click", (event) => {
    if (event.target === elements.endInstructionsModal) {
      closeEndInstructionsEditor();
    }
  });
  elements.previousQuestion.addEventListener("click", () => {
    state.currentIndex -= 1;
    renderAll();
  });
  elements.nextQuestion.addEventListener("click", () => {
    state.currentIndex += 1;
    renderAll();
  });
  elements.removeQuestion.addEventListener("click", removeCurrentQuestion);
  elements.moveQuestionUp.addEventListener("click", () => moveCurrentQuestion(-1));
  elements.moveQuestionDown.addEventListener("click", () => moveCurrentQuestion(1));
  elements.clearAll.addEventListener("click", clearAllQuestions);
  elements.editConfirmYes.addEventListener("click", confirmPendingEdit);
  elements.editConfirmCancel.addEventListener("click", cancelPendingEdit);
  elements.editConfirmModal.addEventListener("click", (event) => {
    if (event.target === elements.editConfirmModal) {
      cancelPendingEdit();
    }
  });
  elements.markdownPasteImageButton.addEventListener("click", pasteMarkdownImageFromClipboard);
  elements.markdownBrowseImageButton.addEventListener("click", () => elements.markdownImageFile.click());
  elements.markdownImageFile.addEventListener("change", () => setMarkdownImageFromFile(elements.markdownImageFile.files[0]));
  elements.markdownImagePasteBox.addEventListener("paste", handleMarkdownImagePaste);
  elements.markdownImagePasteBox.addEventListener("click", () => elements.markdownImagePasteBox.focus());
  elements.markdownImagePasteBox.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.markdownImagePasteBox.classList.add("is-dragging");
  });
  elements.markdownImagePasteBox.addEventListener("dragleave", () => {
    elements.markdownImagePasteBox.classList.remove("is-dragging");
  });
  elements.markdownImagePasteBox.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.markdownImagePasteBox.classList.remove("is-dragging");
    if (event.dataTransfer && event.dataTransfer.files.length) {
      setMarkdownImageFromFile(event.dataTransfer.files[0]);
    }
  });
  elements.markdownImagePreview.addEventListener("load", () => {
    if (!elements.markdownImageWidth.value && elements.markdownImagePreview.naturalWidth) {
      elements.markdownImageWidth.value = String(elements.markdownImagePreview.naturalWidth);
    }
  });
  elements.markdownCropImageButton.addEventListener("click", activateMarkdownImageCrop);
  elements.markdownApplyCropButton.addEventListener("click", applyMarkdownImageCrop);
  elements.insertMarkdownImage.addEventListener("click", insertMarkdownImage);
  elements.cancelMarkdownImage.addEventListener("click", closeMarkdownImageEditor);
  elements.markdownImageCloseTop.addEventListener("click", closeMarkdownImageEditor);
  elements.markdownImageModal.addEventListener("click", (event) => {
    if (event.target === elements.markdownImageModal) {
      closeMarkdownImageEditor();
    }
  });
  elements.insertLink.addEventListener("click", insertLink);
  elements.cancelLink.addEventListener("click", closeLinkEditor);
  elements.linkText.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      elements.linkUrl.focus();
    }
  });
  elements.linkUrl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      insertLink();
    }
  });
  elements.linkModal.addEventListener("click", (event) => {
    if (event.target === elements.linkModal) {
      closeLinkEditor();
    }
  });
  elements.equationInput.addEventListener("input", updateEquationPreview);
  elements.equationDisplayMode.addEventListener("change", updateEquationPreview);
  elements.insertEquation.addEventListener("click", insertEquation);
  elements.cancelEquation.addEventListener("click", closeEquationEditor);
  elements.equationModal.addEventListener("click", (event) => {
    if (event.target === elements.equationModal) {
      closeEquationEditor();
    }
  });
  elements.downloadForm.addEventListener("submit", downloadTest);

  initialiseOptionCounts();
  loadStoredCreatorKey();
  updateActivityModeFields();
  elements.endInstructions.value = elements.endInstructions.value || U.defaultEndInstructions();
  updateEndInstructionsPreview();
  state.instructionsEditor = createMarkdownEditor(elements.instructions, elements.instructionsEditorMount);
  renderAll();
})();
