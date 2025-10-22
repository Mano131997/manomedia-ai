const storageKeys = {
  agents: 'ai-agent-hub:agents',
  chats: 'ai-agent-hub:chats',
  settings: 'ai-agent-hub:settings'
};

const defaultAgents = [
  {
    id: 'agent-strategist',
    name: 'Strategie Coach',
    role: 'Business & marketing strateeg',
    description:
      'Helpt je bij het uitwerken van campagnes, proposities en groeiplannen met een scherpe marketingblik.',
    context:
      'Je bent een senior marketingstrateeg voor Manomedia. Stel veel vragen voordat je adviseert en geef concrete stappen met duidelijke prioriteiten. Focus op haalbare acties voor het MKB.'
  },
  {
    id: 'agent-copywriter',
    name: 'Creatieve Copywriter',
    role: 'Tone-of-voice specialist',
    description:
      'Bedenkt overtuigende teksten die passen bij de merkstem en doelgroep. Denk aan headlines, social posts en scripts.',
    context:
      'Je bent een award-winning copywriter. Schrijf kort, ritmisch en in een enthousiaste merkstem. Lever meerdere varianten als het relevant is.'
  },
  {
    id: 'agent-analyst',
    name: 'Data Analyst',
    role: 'Data storytelling & inzichten',
    description:
      'Ontleedt campagneresultaten, dashboards en spreadsheets en vertaalt ze naar begrijpelijke inzichten.',
    context:
      'Je bent een data-analist die duidelijk uitlegt wat de cijfers betekenen voor marketingbeslissingen. Gebruik bullets, benoem kansen en risico\'s.'
  }
];

const state = {
  agents: [],
  selectedAgentId: null,
  settings: {
    openAiKey: '',
    useOpenAi: false
  },
  searchTerm: ''
};

const elements = {
  agentList: document.querySelector('#agentList'),
  agentListItemTemplate: document.querySelector('#agentListItemTemplate'),
  chatMessageTemplate: document.querySelector('#chatMessageTemplate'),
  agentDetails: document.querySelector('#agentDetails'),
  emptyState: document.querySelector('#emptyState'),
  agentName: document.querySelector('#agentName'),
  agentRole: document.querySelector('#agentRole'),
  agentDescription: document.querySelector('#agentDescription'),
  agentContext: document.querySelector('#agentContext'),
  agentShortName: document.querySelector('#agentShortName'),
  chatMessages: document.querySelector('#chatMessages'),
  chatForm: document.querySelector('#chatForm'),
  chatInput: document.querySelector('#chatInput'),
  chatStatus: document.querySelector('#chatStatus'),
  addAgent: document.querySelector('#addAgent'),
  editAgent: document.querySelector('#editAgent'),
  deleteAgent: document.querySelector('#deleteAgent'),
  agentDialog: document.querySelector('#agentDialog'),
  agentDialogTitle: document.querySelector('#agentDialogTitle'),
  agentForm: document.querySelector('#agentForm'),
  agentNameInput: document.querySelector('#agentNameInput'),
  agentRoleInput: document.querySelector('#agentRoleInput'),
  agentDescriptionInput: document.querySelector('#agentDescriptionInput'),
  agentContextInput: document.querySelector('#agentContextInput'),
  cancelAgent: document.querySelector('#cancelAgent'),
  closeAgentDialog: document.querySelector('#closeAgentDialog'),
  searchAgents: document.querySelector('#searchAgents'),
  settingsDialog: document.querySelector('#settingsDialog'),
  settingsForm: document.querySelector('#settingsForm'),
  toggleSettings: document.querySelector('#toggleSettings'),
  closeSettingsDialog: document.querySelector('#closeSettingsDialog'),
  cancelSettings: document.querySelector('#cancelSettings'),
  openAiKey: document.querySelector('#openAiKey'),
  useOpenAi: document.querySelector('#useOpenAi')
};

let editingAgentId = null;

function loadState() {
  try {
    const storedAgents = JSON.parse(localStorage.getItem(storageKeys.agents));
    state.agents = Array.isArray(storedAgents) && storedAgents.length > 0 ? storedAgents : defaultAgents;
  } catch (error) {
    console.warn('Kon agents niet laden uit localStorage:', error);
    state.agents = defaultAgents;
  }

  try {
    const storedSettings = JSON.parse(localStorage.getItem(storageKeys.settings));
    if (storedSettings) {
      state.settings = { ...state.settings, ...storedSettings };
    }
  } catch (error) {
    console.warn('Kon instellingen niet laden:', error);
  }

  if (state.settings.openAiKey) {
    elements.openAiKey.value = state.settings.openAiKey;
  }
  elements.useOpenAi.checked = Boolean(state.settings.useOpenAi);
}

function saveAgents() {
  localStorage.setItem(storageKeys.agents, JSON.stringify(state.agents));
}

function saveSettings() {
  localStorage.setItem(storageKeys.settings, JSON.stringify(state.settings));
}

function getChatHistory(agentId) {
  const histories = JSON.parse(localStorage.getItem(storageKeys.chats) || '{}');
  return histories[agentId] || [];
}

function saveChatHistory(agentId, messages) {
  const histories = JSON.parse(localStorage.getItem(storageKeys.chats) || '{}');
  histories[agentId] = messages;
  localStorage.setItem(storageKeys.chats, JSON.stringify(histories));
}

function createId() {
  return `agent-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function renderAgents() {
  const { agents, searchTerm, selectedAgentId } = state;
  const fragment = document.createDocumentFragment();
  const normalizedSearch = searchTerm.trim().toLowerCase();

  agents
    .filter((agent) => {
      if (!normalizedSearch) return true;
      return (
        agent.name.toLowerCase().includes(normalizedSearch) ||
        agent.role.toLowerCase().includes(normalizedSearch) ||
        agent.description.toLowerCase().includes(normalizedSearch)
      );
    })
    .forEach((agent) => {
      const item = elements.agentListItemTemplate.content.firstElementChild.cloneNode(true);
      const button = item.querySelector('.agent-list__button');
      item.dataset.agentId = agent.id;
      item.classList.toggle('is-active', agent.id === selectedAgentId);
      item.querySelector('.agent-list__name').textContent = agent.name;
      item.querySelector('.agent-list__role').textContent = agent.role;

      button.addEventListener('click', () => {
        selectAgent(agent.id);
      });

      fragment.appendChild(item);
    });

  elements.agentList.replaceChildren(fragment);

  if (state.agents.length === 0) {
    elements.agentList.innerHTML = '<li class="empty">Nog geen agents toegevoegd</li>';
  }
}

function selectAgent(agentId) {
  state.selectedAgentId = agentId;
  const agent = state.agents.find((entry) => entry.id === agentId);

  if (!agent) {
    elements.agentDetails.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    return;
  }

  elements.agentName.textContent = agent.name;
  elements.agentRole.textContent = agent.role;
  elements.agentDescription.textContent = agent.description;
  elements.agentContext.textContent = agent.context;
  elements.agentShortName.textContent = agent.name;
  elements.agentDetails.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');

  renderAgents();
  renderChat(agentId);
}

function renderChat(agentId) {
  const messages = getChatHistory(agentId);
  const fragment = document.createDocumentFragment();

  messages.forEach((message) => {
    const article = elements.chatMessageTemplate.content.firstElementChild.cloneNode(true);
    article.classList.toggle('is-user', message.role === 'user');
    article.querySelector('.chat-message__author').textContent = message.role === 'user' ? 'Jij' : 'Agent';
    article.querySelector('.chat-message__time').textContent = new Date(message.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    article.querySelector('.chat-message__body').textContent = message.content;
    fragment.appendChild(article);
  });

  elements.chatMessages.replaceChildren(fragment);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function handleChatSubmit(event) {
  event.preventDefault();
  if (!state.selectedAgentId) return;

  const messageText = elements.chatInput.value.trim();
  if (!messageText) return;

  elements.chatInput.value = '';
  const agentId = state.selectedAgentId;
  const agent = state.agents.find((entry) => entry.id === agentId);
  const history = getChatHistory(agentId);

  const userMessage = {
    role: 'user',
    content: messageText,
    timestamp: Date.now()
  };

  history.push(userMessage);
  saveChatHistory(agentId, history);
  renderChat(agentId);

  try {
    const assistantResponse = state.settings.useOpenAi && state.settings.openAiKey
      ? await fetchOpenAiResponse(agent, history)
      : await fallbackResponse(agent, messageText);

    const assistantMessage = {
      role: 'assistant',
      content: assistantResponse,
      timestamp: Date.now()
    };

    history.push(assistantMessage);
    saveChatHistory(agentId, history);
    renderChat(agentId);
  } catch (error) {
    console.error(error);
    elements.chatStatus.textContent = 'Kon geen antwoord ophalen.';
    elements.chatStatus.classList.add('is-error');
    setTimeout(() => {
      elements.chatStatus.textContent = '';
      elements.chatStatus.classList.remove('is-error');
    }, 4000);
  }
}

async function fetchOpenAiResponse(agent, history) {
  elements.chatStatus.textContent = 'Contact met OpenAI...';
  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: agent.context },
      ...history.map(({ role, content }) => ({ role, content }))
    ],
    temperature: 0.7,
    max_tokens: 320
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.settings.openAiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`OpenAI fout (${response.status})`);
  }

  const data = await response.json();
  elements.chatStatus.textContent = 'OpenAI antwoord ontvangen';
  setTimeout(() => {
    elements.chatStatus.textContent = '';
  }, 1500);

  return data.choices?.[0]?.message?.content?.trim() || 'Er kwam een leeg antwoord terug.';
}

async function fallbackResponse(agent, messageText) {
  elements.chatStatus.textContent = 'Demo-antwoord wordt opgebouwd...';
  await new Promise((resolve) => setTimeout(resolve, 400));

  const preview = `Demo-antwoord van ${agent.name} (geen echte OpenAI-koppeling actief).\n\n` +
    `Laat OpenAI-ondersteuning toe via het instellingenmenu om echte antwoorden te ontvangen.`;

  elements.chatStatus.textContent = '';
  return preview;
}

function openAgentModal(agent) {
  editingAgentId = agent?.id ?? null;
  elements.agentDialogTitle.textContent = agent ? 'Agent bewerken' : 'Nieuwe agent';
  elements.agentNameInput.value = agent?.name ?? '';
  elements.agentRoleInput.value = agent?.role ?? '';
  elements.agentDescriptionInput.value = agent?.description ?? '';
  elements.agentContextInput.value = agent?.context ?? '';
  elements.agentDialog.showModal();
}

function closeAgentModal() {
  elements.agentForm.reset();
  elements.agentDialog.close();
  editingAgentId = null;
}

function handleAgentFormSubmit(event) {
  event.preventDefault();
  const newAgent = {
    id: editingAgentId ?? createId(),
    name: elements.agentNameInput.value.trim(),
    role: elements.agentRoleInput.value.trim(),
    description: elements.agentDescriptionInput.value.trim(),
    context: elements.agentContextInput.value.trim()
  };

  if (!newAgent.name || !newAgent.role || !newAgent.description || !newAgent.context) {
    return;
  }

  if (editingAgentId) {
    state.agents = state.agents.map((agent) => (agent.id === editingAgentId ? newAgent : agent));
  } else {
    state.agents = [newAgent, ...state.agents];
  }

  saveAgents();
  closeAgentModal();
  renderAgents();
  selectAgent(newAgent.id);
}

function handleAgentDelete() {
  if (!state.selectedAgentId) return;
  const agent = state.agents.find((entry) => entry.id === state.selectedAgentId);
  if (!agent) return;

  const confirmed = confirm(`Weet je zeker dat je ${agent.name} wil verwijderen?`);
  if (!confirmed) return;

  state.agents = state.agents.filter((entry) => entry.id !== agent.id);
  saveAgents();

  const histories = JSON.parse(localStorage.getItem(storageKeys.chats) || '{}');
  delete histories[agent.id];
  localStorage.setItem(storageKeys.chats, JSON.stringify(histories));

  if (state.agents.length) {
    selectAgent(state.agents[0].id);
  } else {
    state.selectedAgentId = null;
    elements.agentDetails.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    renderAgents();
  }
}

function openSettingsModal() {
  elements.openAiKey.value = state.settings.openAiKey;
  elements.useOpenAi.checked = Boolean(state.settings.useOpenAi);
  elements.settingsDialog.showModal();
}

function closeSettingsModal() {
  elements.settingsForm.reset();
  elements.settingsDialog.close();
  elements.openAiKey.value = state.settings.openAiKey;
  elements.useOpenAi.checked = Boolean(state.settings.useOpenAi);
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  state.settings.openAiKey = elements.openAiKey.value.trim();
  state.settings.useOpenAi = elements.useOpenAi.checked;
  saveSettings();
  elements.settingsDialog.close();
}

function wireEvents() {
  elements.addAgent.addEventListener('click', () => openAgentModal());
  elements.editAgent.addEventListener('click', () => {
    const agent = state.agents.find((entry) => entry.id === state.selectedAgentId);
    if (agent) openAgentModal(agent);
  });

  elements.deleteAgent.addEventListener('click', handleAgentDelete);
  elements.chatForm.addEventListener('submit', handleChatSubmit);

  elements.agentDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeAgentModal();
  });

  elements.cancelAgent.addEventListener('click', (event) => {
    event.preventDefault();
    closeAgentModal();
  });

  elements.closeAgentDialog.addEventListener('click', closeAgentModal);
  elements.agentForm.addEventListener('submit', handleAgentFormSubmit);

  elements.searchAgents.addEventListener('input', (event) => {
    state.searchTerm = event.target.value;
    renderAgents();
  });

  elements.toggleSettings.addEventListener('click', openSettingsModal);
  elements.closeSettingsDialog.addEventListener('click', closeSettingsModal);
  elements.cancelSettings.addEventListener('click', (event) => {
    event.preventDefault();
    closeSettingsModal();
  });

  elements.settingsDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSettingsModal();
  });

  elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
}

function init() {
  loadState();
  wireEvents();
  renderAgents();

  if (state.agents.length) {
    selectAgent(state.agents[0].id);
  }
}

if (typeof document !== 'undefined') {
  init();
}
