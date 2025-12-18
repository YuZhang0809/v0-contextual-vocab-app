// popup.js
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const selectionInput = document.getElementById('selection');
  const focusTermInput = document.getElementById('focus_term');
  const sourceUrlInput = document.getElementById('source_url');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const backBtn = document.getElementById('backBtn');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const inputArea = document.getElementById('inputArea');
  const wordSelectionArea = document.getElementById('wordSelectionArea');
  const wordList = document.getElementById('wordList');
  const selectedCountDiv = document.getElementById('selectedCount');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const timestampHint = document.getElementById('timestampHint');

  // State
  let analysisResult = null;
  let selectedItems = new Set();

  // Initialize: Get selected text from current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    
    if (activeTab.url) {
      chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus("Please refresh the Podwise page first.", "error");
          return;
        }

        if (response) {
          selectionInput.value = response.text || "";
          sourceUrlInput.value = response.url || activeTab.url;
          
          // 显示时间戳信息（如果有）
          if (response.formattedTime && response.timestampSeconds) {
            const locateValue = Math.floor(parseFloat(response.timestampSeconds));
            timestampHint.innerHTML = `✓ Detected: <strong>${response.formattedTime}</strong> (locate=${locateValue})`;
            timestampHint.style.display = 'block';
            timestampHint.style.color = '#22c55e';
          } else {
            timestampHint.style.display = 'none';
          }
        }
      });
    }
  });

  // Analyze button click
  analyzeBtn.addEventListener('click', async () => {
    const text = selectionInput.value.trim();
    const focusTerm = focusTermInput.value.trim();

    if (!text) {
      showStatus("Please select some text first.", "error");
      return;
    }

    setLoading(true, "Analyzing...");

    try {
      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          focus_term: focusTerm || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      analysisResult = await response.json();
      console.log("Analysis Result:", analysisResult);

      if (!analysisResult.items || analysisResult.items.length === 0) {
        throw new Error("No vocabulary items found.");
      }

      // Switch to word selection view
      renderWordList(analysisResult.items);
      showWordSelectionStep();
      hideStatus();

    } catch (error) {
      console.error(error);
      showStatus(`Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  });

  // Back button
  backBtn.addEventListener('click', () => {
    showInputStep();
    selectedItems.clear();
    updateSelectedCount();
  });

  // Save button
  saveBtn.addEventListener('click', async () => {
    if (selectedItems.size === 0) {
      showStatus("Please select at least one word.", "error");
      return;
    }

    const sourceUrl = sourceUrlInput.value.trim();
    const originalText = selectionInput.value.trim();
    
    setLoading(true, `Saving ${selectedItems.size} word(s)...`);

    try {
      const itemsToSave = analysisResult.items.filter((_, index) => selectedItems.has(index));
      let savedCount = 0;
      let errors = [];

      for (const item of itemsToSave) {
        try {
          const cardData = {
            word: item.term,
            sentence: item.example_sentence || originalText,
            meaning_cn: item.meaning,
            sentence_translation: item.example_sentence_translation || analysisResult.sentence_translation,
            source: sourceUrl,
            tags: ["Podwise"]
          };

          const response = await fetch('http://localhost:3000/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData)
          });

          if (response.status === 401) {
            throw new Error("Please log in to ContextVocab first.");
          }

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to save");
          }

          savedCount++;
        } catch (err) {
          errors.push(`${item.term}: ${err.message}`);
        }
      }

      if (savedCount > 0) {
        showStatus(`✓ Saved ${savedCount} word(s) successfully!`, "success");
      }
      if (errors.length > 0) {
        console.error("Save errors:", errors);
      }

    } catch (error) {
      console.error(error);
      showStatus(`Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  });

  // Render word list
  function renderWordList(items) {
    wordList.innerHTML = '';
    selectedItems.clear();

    items.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'word-item';
      div.innerHTML = `
        <input type="checkbox" id="word-${index}" data-index="${index}">
        <div class="word-info">
          <div>
            <span class="word-term">${item.term}</span>
            <span class="word-pos">${item.part_of_speech || ''}</span>
          </div>
          <div class="word-meaning">${item.meaning}</div>
          <div class="word-context">"${truncate(item.example_sentence || item.context_segment, 60)}"</div>
        </div>
      `;

      const checkbox = div.querySelector('input[type="checkbox"]');
      
      // Click on entire item toggles checkbox
      div.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        
        if (checkbox.checked) {
          selectedItems.add(index);
          div.classList.add('selected');
        } else {
          selectedItems.delete(index);
          div.classList.remove('selected');
        }
        updateSelectedCount();
      });

      wordList.appendChild(div);
    });

    // If only one item, auto-select it
    if (items.length === 1) {
      const firstCheckbox = wordList.querySelector('input[type="checkbox"]');
      if (firstCheckbox) {
        firstCheckbox.checked = true;
        selectedItems.add(0);
        wordList.querySelector('.word-item').classList.add('selected');
        updateSelectedCount();
      }
    }
  }

  function updateSelectedCount() {
    selectedCountDiv.innerHTML = `<strong>${selectedItems.size}</strong> word(s) selected`;
    saveBtn.disabled = selectedItems.size === 0;
  }

  function showInputStep() {
    inputArea.style.display = 'block';
    wordSelectionArea.style.display = 'none';
    step1.className = 'step active';
    step2.className = 'step';
  }

  function showWordSelectionStep() {
    inputArea.style.display = 'none';
    wordSelectionArea.style.display = 'block';
    step1.className = 'step done';
    step2.className = 'step active';
  }

  function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = type;
    statusDiv.style.display = "block";
  }

  function hideStatus() {
    statusDiv.style.display = "none";
  }

  function setLoading(isLoading, message) {
    analyzeBtn.disabled = isLoading;
    saveBtn.disabled = isLoading || selectedItems.size === 0;
    
    if (isLoading) {
      analyzeBtn.textContent = "Analyzing...";
      if (message) {
        showStatus(message, "loading");
      }
    } else {
      analyzeBtn.textContent = "Analyze";
      hideStatus();
    }
  }

  function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }
});
