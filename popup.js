document.addEventListener('DOMContentLoaded', () => {
  const stashBtn = document.getElementById('stashBtn');
  const groupNameInput = document.getElementById('groupName');
  const stashList = document.getElementById('stashList');

  // Render saved stashes on load
  renderStashes();

  // 1. Stash current tabs
  stashBtn.addEventListener('click', async () => {
    const name = groupNameInput.value.trim() || `Session (${new Date().toLocaleDateString()})`;
    
    // Get all tabs in the current window (excluding chrome:// extension pages)
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(tab => !tab.url.startsWith('chrome://'));

    if (validTabs.length === 0) return;

    const newStash = {
      id: Date.now().toString(),
      name: name,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      urls: validTabs.map(tab => tab.url)
    };

    // Save to storage
    const { stashes = [] } = await chrome.storage.local.get('stashes');
    stashes.unshift(newStash);
    await chrome.storage.local.set({ stashes });

    // Close saved tabs and open a clean tab
    const tabIdsToClose = validTabs.map(tab => tab.id);
    await chrome.tabs.create({}); // Create new empty tab so window doesn't close
    await chrome.tabs.remove(tabIdsToClose);

    groupNameInput.value = '';
    renderStashes();
  });

  // 2. Render stashes from storage
  async function renderStashes() {
    const { stashes = [] } = await chrome.storage.local.get('stashes');
    stashList.innerHTML = '';

    if (stashes.length === 0) {
      stashList.innerHTML = '<p style="font-size:12px; color:#888;">No saved tab groups yet.</p>';
      return;
    }

    stashes.forEach(stash => {
      const card = document.createElement('div');
      card.className = 'stash-card';
      card.innerHTML = `
        <div class="stash-header">
          <span>${escapeHtml(stash.name)}</span>
          <span class="stash-count">${stash.urls.length} tabs</span>
        </div>
        <div class="stash-actions">
          <button class="btn-restore" data-id="${stash.id}">Restore All</button>
          <button class="btn-delete" data-id="${stash.id}">Delete</button>
        </div>
      `;
      stashList.appendChild(card);
    });

    // Add action handlers
    document.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', (e) => restoreStash(e.target.dataset.id));
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => deleteStash(e.target.dataset.id));
    });
  }

  // 3. Restore a session
  async function restoreStash(id) {
    const { stashes = [] } = await chrome.storage.local.get('stashes');
    const stash = stashes.find(s => s.id === id);
    if (!stash) return;

    // Open each URL in a new tab
    stash.urls.forEach(url => chrome.tabs.create({ url, active: false }));
    
    // Optionally delete stash after restoring
    deleteStash(id);
  }

  // 4. Delete a session
  async function deleteStash(id) {
    let { stashes = [] } = await chrome.storage.local.get('stashes');
    stashes = stashes.filter(s => s.id !== id);
    await chrome.storage.local.set({ stashes });
    renderStashes();
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, match => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[match]);
  }
});