document.addEventListener('DOMContentLoaded', () => {
  const stashBtn = document.getElementById('stashBtn');
  const groupNameInput = document.getElementById('groupName');
  const stashList = document.getElementById('stashList');
  const colorPicker = document.getElementById('colorPicker');

  let selectedColor = 'blue';

  // Handle color selection
  colorPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-option')) {
      document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
      e.target.classList.add('selected');
      selectedColor = e.target.dataset.color;
    }
  });

  renderStashes();

  // 1. Stash current tabs
  stashBtn.addEventListener('click', async () => {
    const name = groupNameInput.value.trim() || `Session (${new Date().toLocaleDateString()})`;
    
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(tab => !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'));

    if (validTabs.length === 0) return;

    const newStash = {
      id: Date.now().toString(),
      name: name,
      color: selectedColor,
      urls: validTabs.map(tab => tab.url)
    };

    const { stashes = [] } = await chrome.storage.local.get('stashes');
    stashes.unshift(newStash);
    await chrome.storage.local.set({ stashes });

    // Close stashed tabs and open a fresh new tab
    const tabIdsToClose = validTabs.map(tab => tab.id);
    await chrome.tabs.create({});
    await chrome.tabs.remove(tabIdsToClose);

    groupNameInput.value = '';
    renderStashes();
  });

  // 2. Render stashes with favicons
  async function renderStashes() {
    const { stashes = [] } = await chrome.storage.local.get('stashes');
    stashList.innerHTML = '';

    if (stashes.length === 0) {
      stashList.innerHTML = '<p style="font-size:12px; color:#888;">No saved tab groups yet.</p>';
      return;
    }

    const colorMap = {
      blue: '#1a73e8', red: '#d93025', yellow: '#f9ab00',
      green: '#188038', purple: '#a142f4', cyan: '#24c1e0'
    };

    stashes.forEach(stash => {
      const card = document.createElement('div');
      card.className = 'stash-card';

      // Build favicons HTML using Chrome's native favicon API
      const faviconsHtml = stash.urls.slice(0, 8).map(url => {
        const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=16`;
        return `<img src="${faviconUrl}" class="favicon-icon" alt="icon" onerror="this.style.display='none'">`;
      }).join('');

      card.innerHTML = `
        <div class="stash-header">
          <span>
            <span class="group-badge" style="background-color: ${colorMap[stash.color] || '#1a73e8'};"></span>
            ${escapeHtml(stash.name)}
          </span>
          <span style="font-size:11px; color:#777;">${stash.urls.length} tabs</span>
        </div>
        
        <div class="favicon-list">
          ${faviconsHtml}
          ${stash.urls.length > 8 ? `<span style="font-size:10px; color:#888;">+${stash.urls.length - 8} more</span>` : ''}
        </div>

        <div class="stash-actions">
          <button class="btn-restore" data-id="${stash.id}">Restore as Group</button>
          <button class="btn-delete" data-id="${stash.id}">Delete</button>
        </div>
      `;
      stashList.appendChild(card);
    });

    document.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', (e) => restoreAsGroup(e.target.dataset.id));
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => deleteStash(e.target.dataset.id));
    });
  }

  // 3. Restore tabs as a native Chrome Tab Group
  async function restoreAsGroup(id) {
    const { stashes = [] } = await chrome.storage.local.get('stashes');
    const stash = stashes.find(s => s.id === id);
    if (!stash) return;

    // Create tabs in background
    const tabPromises = stash.urls.map(url => chrome.tabs.create({ url, active: false }));
    const createdTabs = await Promise.all(tabPromises);
    const tabIds = createdTabs.map(t => t.id);

    // Bundle them into a native Chrome Tab Group
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: stash.name,
      color: stash.color || 'blue'
    });

    // Delete stash from popup storage after restoring
    deleteStash(id);
  }

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